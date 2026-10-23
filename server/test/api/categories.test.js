process.env.DB_NAME = 'ecshopping_test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

const { default: app } = await import('../../index.js');
const { initDatabase, default: pool } = await import('../../db.js');
const { signToken } = await import('../../middleware/auth.js');

const request = () => supertest(app);

const ADMIN_TOKEN = signToken({ sub: 'admin-cat-test', role: 'admin', email: 'admin@test.local' });
const VENDOR_A_TOKEN = signToken({ sub: 'v-cat-test-a', role: 'vendor', vendorId: 'v-cat-test-a', email: 'vendora@test.local' });
const VENDOR_B_TOKEN = signToken({ sub: 'v-cat-test-b', role: 'vendor', vendorId: 'v-cat-test-b', email: 'vendorb@test.local' });

before(async () => {
  await initDatabase();
  await pool.query("DELETE FROM categories WHERE id LIKE 'test-cat-%'");
  await pool.query("DELETE FROM products WHERE id LIKE 'test-p-cat-%'");
});

after(async () => {
  await pool.query("DELETE FROM categories WHERE id LIKE 'test-cat-%'");
  await pool.query("DELETE FROM products WHERE id LIKE 'test-p-cat-%'");
  await pool.end();
});

test('GET /api/categories requires vendor or admin authentication (401 without token)', async () => {
  const res = await request().get('/api/categories');
  assert.equal(res.status, 401);
});

test('Admin can create a shared category (vendor_id IS NULL)', async () => {
  const res = await request()
    .post('/api/categories')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({ name: 'Test Shared Organics', description: 'Global shared category', status: 'active' });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.category.name, 'Test Shared Organics');
  assert.equal(res.body.category.vendorId, null);
  assert.equal(res.body.category.status, 'active');

  // Tag with prefix for cleanup
  await pool.query("UPDATE categories SET id = 'test-cat-shared-1' WHERE id = ?", [res.body.category.id]);
});

test('POST /api/categories rejects duplicate category names in the same scope (400)', async () => {
  const res = await request()
    .post('/api/categories')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({ name: 'test shared organics' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'Category already exists');
});

test('POST /api/categories requires a non-empty name (400)', async () => {
  const res = await request()
    .post('/api/categories')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({ name: '   ' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('Vendor can create their own scoped category', async () => {
  const res = await request()
    .post('/api/categories')
    .set('Authorization', `Bearer ${VENDOR_A_TOKEN}`)
    .send({ name: 'Vendor A Specialties', description: 'Vendor A exclusive' });

  assert.equal(res.status, 201);
  assert.equal(res.body.category.vendorId, 'v-cat-test-a');
  await pool.query("UPDATE categories SET id = 'test-cat-vendor-a' WHERE id = ?", [res.body.category.id]);
});

test('Admin lists all categories with productsCount', async () => {
  const res = await request()
    .get('/api/categories')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.categories));
  const shared = res.body.categories.find((c) => c.id === 'test-cat-shared-1');
  assert.ok(shared);
  assert.equal(typeof shared.productsCount, 'number');
});

test('Admin can update category details and status (active -> inactive deactivation)', async () => {
  const res = await request()
    .put('/api/categories/test-cat-shared-1')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({ name: 'Test Shared Organics Renamed', description: 'Updated description', status: 'inactive' });

  assert.equal(res.status, 200);
  assert.equal(res.body.category.name, 'Test Shared Organics Renamed');
  assert.equal(res.body.category.status, 'inactive');

  // Verify deactivated category is hidden from public customer storefront
  const publicRes = await request().get('/api/categories/public');
  const found = publicRes.body.categories.find((c) => c.name === 'Test Shared Organics Renamed');
  assert.equal(found, undefined, 'Inactive category must not appear in public categories');
});

test('Vendor cannot update or delete shared category (403)', async () => {
  const putRes = await request()
    .put('/api/categories/test-cat-shared-1')
    .set('Authorization', `Bearer ${VENDOR_A_TOKEN}`)
    .send({ name: 'Hacked Name' });

  assert.equal(putRes.status, 403);

  const delRes = await request()
    .delete('/api/categories/test-cat-shared-1')
    .set('Authorization', `Bearer ${VENDOR_A_TOKEN}`);

  assert.equal(delRes.status, 403);
});

test('Vendor cannot update or delete another vendor category (403)', async () => {
  const putRes = await request()
    .put('/api/categories/test-cat-vendor-a')
    .set('Authorization', `Bearer ${VENDOR_B_TOKEN}`)
    .send({ name: 'Cross Vendor Edit' });

  assert.equal(putRes.status, 403);
});

test('Safe category deletion: cannot delete category if products reference it (400)', async () => {
  // Reactivate category and add a product referencing it
  await request()
    .put('/api/categories/test-cat-shared-1')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({ name: 'Test Referenced Category', status: 'active' });

  await pool.query(
    `INSERT INTO products (id, vendor_id, vendor_name, title, name, description, category, price, strike_price, unit, image, stock_status, status)
     VALUES ('test-p-cat-1', 'v-cat-test-a', 'Vendor A', 'Test Product In Cat', 'Test Product In Cat', 'Desc', 'Test Referenced Category', 100, 120, '1 kg', '', 'in_stock', 'approved')`
  );

  // Attempt delete
  const delRes = await request()
    .delete('/api/categories/test-cat-shared-1')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

  assert.equal(delRes.status, 400);
  assert.equal(delRes.body.success, false);
  assert.ok(delRes.body.error.includes('assigned to it'));
  assert.equal(delRes.body.productCount, 1);
});

test('Can delete category when no products reference it (200)', async () => {
  // Create an empty category to delete
  const createRes = await request()
    .post('/api/categories')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({ name: 'Disposable Test Category' });

  const catId = createRes.body.category.id;

  const delRes = await request()
    .delete(`/api/categories/${catId}`)
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

  assert.equal(delRes.status, 200);
  assert.equal(delRes.body.success, true);
});
