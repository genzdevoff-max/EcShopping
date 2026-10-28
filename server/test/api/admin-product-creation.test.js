import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

process.env.DB_NAME = 'ecshopping_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_unit_tests_only_32_chars_long';

const { default: app, transporter } = await import('../../index.js');
const { initDatabase, pool } = await import('../../db.js');
const { signToken } = await import('../../middleware/auth.js');

const request = supertest(app);

const adminToken = signToken({ sub: 'adm_create_test', role: 'admin', email: 'admin_creator@ecshopping.test', name: 'Admin Creator' });
const vendorToken = signToken({ sub: 'v_create_test', vendorId: 'v_create_test', role: 'vendor', email: 'vendor_creator@test.com', name: 'Vendor Creator' });
const customerToken = signToken({ sub: 'c_create_test', role: 'customer', email: 'customer_creator@test.com', name: 'Customer Test' });

const testVendorId = 'v_create_test';
const createdProductIds = [];
let origSendMail;

before(async () => {
  await initDatabase();
  origSendMail = transporter.sendMail;
  transporter.sendMail = async () => ({ messageId: 'test-admin-mail-123' });

  // Seed test vendor for assignment test
  await pool.query(
    `INSERT INTO vendors (id, name, email, password, status)
     VALUES (?, 'Vendor Creator', 'vendor_creator@test.com', 'hashed_pwd', 'approved')
     ON DUPLICATE KEY UPDATE status = 'approved'`,
    [testVendorId]
  );
});

after(async () => {
  transporter.sendMail = origSendMail;
  if (createdProductIds.length > 0) {
    const placeholders = createdProductIds.map(() => '?').join(',');
    await pool.query(`DELETE FROM products WHERE id IN (${placeholders})`, createdProductIds);
  }
  await pool.query('DELETE FROM vendors WHERE id = ?', [testVendorId]);
  await pool.end();
});

test('Admin Product Creation: Admin can create a valid approved product via POST /api/admin/products', async () => {
  const pId = 'p_adm_test_' + Date.now();
  createdProductIds.push(pId);

  const res = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      id: pId,
      title: 'Admin Created Organic Apples',
      description: 'Crisp organic apples from the orchard',
      category: 'Fresh Produce',
      price: 180,
      strikePrice: 220,
      unit: 'Kilogram (KG)',
      stockQuantity: 40,
      status: 'approved'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.product.id, pId);
  assert.equal(res.body.product.title, 'Admin Created Organic Apples');
  assert.equal(res.body.product.status, 'approved');
  assert.equal(res.body.product.vendorId, null, 'Platform product has vendorId = null');
  assert.equal(res.body.product.vendorName, 'Platform Direct');
  assert.equal(Number(res.body.product.price), 180);
  assert.equal(res.body.product.stockQuantity, 40);

  // Verify storefront visibility: approved admin product MUST appear in public catalog
  const sfRes = await request.get('/api/products?search=Admin+Created+Organic+Apples');
  assert.equal(sfRes.status, 200);
  const found = sfRes.body.products.some((p) => p.id === pId);
  assert.equal(found, true, 'Approved admin product must be visible in public storefront');
});

test('Admin Product Creation: Admin can create a product with pending status (hidden from storefront)', async () => {
  const pId = 'p_adm_pend_' + Date.now();
  createdProductIds.push(pId);

  const res = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      id: pId,
      title: 'Admin Pending Draft Herb',
      category: 'Pantry Staples',
      price: 120,
      status: 'pending'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.product.status, 'pending');

  // Verify storefront visibility: pending product MUST NOT appear in public catalog
  const sfRes = await request.get('/api/products?search=Admin+Pending+Draft+Herb');
  assert.equal(sfRes.status, 200);
  const found = sfRes.body.products.some((p) => p.id === pId);
  assert.equal(found, false, 'Pending admin product must be hidden from public storefront');
});

test('Admin Product Creation: Admin can assign product ownership to an existing verified vendor', async () => {
  const pId = 'p_adm_vassign_' + Date.now();
  createdProductIds.push(pId);

  const res = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      id: pId,
      title: 'Vendor Assigned Artisan Bread',
      category: 'Pantry Staples',
      price: 90,
      vendorId: testVendorId,
      status: 'approved'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.product.vendorId, testVendorId);
  assert.equal(res.body.product.vendorName, 'Vendor Creator');
});

test('Admin Product Creation: Assigning to non-existent vendor is rejected (400)', async () => {
  const res = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Orphan Product',
      category: 'General',
      price: 50,
      vendorId: 'non_existent_fake_vendor_123'
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'Selected vendor does not exist');
});

test('Admin Product Creation: Unauthenticated request cannot create products (401)', async () => {
  const res1 = await request.post('/api/admin/products').send({ title: 'Anon Item', price: 100 });
  assert.equal(res1.status, 401);

  const res2 = await request.post('/api/products').send({ title: 'Anon Item', price: 100 });
  assert.equal(res2.status, 401);
});

test('Admin Product Creation: Customers cannot create products (403)', async () => {
  const res1 = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ title: 'Customer Attempt', price: 100 });
  assert.equal(res1.status, 403);

  const res2 = await request
    .post('/api/products')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ title: 'Customer Attempt', price: 100 });
  assert.equal(res2.status, 403);
});

test('Admin Product Creation: Vendors cannot access admin-only endpoint POST /api/admin/products (403)', async () => {
  const res = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${vendorToken}`)
    .send({ title: 'Vendor Impersonating Admin', price: 100 });

  assert.equal(res.status, 403);
});

test('Admin Product Creation: Vendors cannot use admin privileges to self-approve or forge ownership on POST /api/products', async () => {
  const pId = 'p_vendor_tamper_' + Date.now();
  createdProductIds.push(pId);

  const res = await request
    .post('/api/products')
    .set('Authorization', `Bearer ${vendorToken}`)
    .send({
      id: pId,
      title: 'Vendor Submitting with Forged Status',
      category: 'Fresh Produce',
      price: 150,
      status: 'approved', // Vendor trying to bypass approval
      vendorId: 'some_other_vendor_id' // Vendor trying to assign other owner
    });

  assert.equal(res.status, 201);
  // Status MUST be forced to 'pending', vendorId MUST be forced to vendor's own token ID
  assert.equal(res.body.product.status, 'pending', 'Vendor submission must ALWAYS be pending');
  assert.equal(res.body.product.vendorId, testVendorId, 'Vendor cannot forge vendorId');
  assert.equal(res.body.product.vendorName, 'Vendor Creator');
});

test('Admin Product Creation: Missing required fields and invalid prices are rejected (400)', async () => {
  // Empty title
  const resNoTitle = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: '   ', price: 100 });
  assert.equal(resNoTitle.status, 400);
  assert.equal(resNoTitle.body.error, 'Product title is required');

  // Negative price
  const resNegPrice = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Negative Price Item', price: -10 });
  assert.equal(resNegPrice.status, 400);
  assert.equal(resNegPrice.body.error, 'A valid selling price is required');

  // Non-numeric price
  const resNaNPrice = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Bad Price Item', price: 'not-a-number' });
  assert.equal(resNaNPrice.status, 400);

  // Negative strike price
  const resNegStrike = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Bad Strike Item', price: 100, strikePrice: -20 });
  assert.equal(resNegStrike.status, 400);
  assert.equal(resNegStrike.body.error, 'Strike price must be a valid non-negative number');
});

test('Admin Product Creation: Invalid categories are rejected (400)', async () => {
  // Empty whitespace category
  const resEmptyCat = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Item with empty category', price: 100, category: '   ' });
  assert.equal(resEmptyCat.status, 400);
  assert.equal(resEmptyCat.body.error, 'Invalid product category');

  // Non-string category
  const resObjCat = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Item with obj category', price: 100, category: { evil: true } });
  assert.equal(resObjCat.status, 400);
  assert.equal(resObjCat.body.error, 'Invalid product category');
});

test('Admin Product Creation: Invalid stock quantity is rejected (400)', async () => {
  // Negative stock
  const resNegStock = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Negative Stock Item', price: 100, stockQuantity: -5 });
  assert.equal(resNegStock.status, 400);
  assert.equal(resNegStock.body.error, 'Stock quantity must be a non-negative whole number');

  // Non-integer stock
  const resFloatStock = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Decimal Stock Item', price: 100, stockQuantity: 4.5 });
  assert.equal(resFloatStock.status, 400);
  assert.equal(resFloatStock.body.error, 'Stock quantity must be a non-negative whole number');
});

test('Admin Product Creation: Invalid status is rejected for admin (400)', async () => {
  const res = await request
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Bad Status Item', price: 100, status: 'arbitrary_status' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Status must be pending, approved or rejected');
});
