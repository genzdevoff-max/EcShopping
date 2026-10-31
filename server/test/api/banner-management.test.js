process.env.DB_NAME = 'ecshopping_test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

const { default: app } = await import('../../index.js');
const { initDatabase, default: pool } = await import('../../db.js');
const { signToken } = await import('../../middleware/auth.js');

const request = () => supertest(app);

const ADMIN_TOKEN = signToken({ sub: 'admin-banner-test', role: 'admin', email: 'admin@test.local' });
const VENDOR_TOKEN = signToken({ sub: 'vendor-banner-test', role: 'vendor', vendorId: 'v-banner-test', email: 'vendor@test.local' });
const CUSTOMER_TOKEN = signToken({ sub: 'customer-banner-test', role: 'customer', email: 'customer@test.local' });

let createdBannerId = null;

before(async () => {
  await initDatabase();
  await pool.query("DELETE FROM homepage_banners WHERE id LIKE 'test-banner-%'");
});

after(async () => {
  if (createdBannerId) {
    await pool.query('DELETE FROM homepage_banners WHERE id = ?', [createdBannerId]);
  }
  await pool.query("DELETE FROM homepage_banners WHERE id LIKE 'test-banner-%'");
  await pool.end();
});

test('GET /api/banners is public and returns active banners list', async () => {
  const res = await request().get('/api/banners');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.banners));
  // Every banner in public response must be active
  res.body.banners.forEach((b) => {
    assert.equal(b.is_active, 1);
  });
});

test('GET /api/admin/banners enforces admin authentication', async () => {
  // 401 without token
  const resNoAuth = await request().get('/api/admin/banners');
  assert.equal(resNoAuth.status, 401);

  // 403 with customer token
  const resCust = await request()
    .get('/api/admin/banners')
    .set('Authorization', `Bearer ${CUSTOMER_TOKEN}`);
  assert.equal(resCust.status, 403);

  // 403 with vendor token
  const resVendor = await request()
    .get('/api/admin/banners')
    .set('Authorization', `Bearer ${VENDOR_TOKEN}`);
  assert.equal(resVendor.status, 403);

  // 200 with admin token
  const resAdmin = await request()
    .get('/api/admin/banners')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
  assert.equal(resAdmin.status, 200);
  assert.equal(resAdmin.body.success, true);
  assert.ok(Array.isArray(resAdmin.body.banners));
});

test('POST /api/admin/banners validates required title and image', async () => {
  // Missing image
  const resMissingImg = await request()
    .post('/api/admin/banners')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({ title: 'Test Harvest Special' });
  assert.equal(resMissingImg.status, 400);
  assert.equal(resMissingImg.body.success, false);

  // Missing title
  const resMissingTitle = await request()
    .post('/api/admin/banners')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({ imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e' });
  assert.equal(resMissingTitle.status, 400);
  assert.equal(resMissingTitle.body.success, false);
});

test('POST /api/admin/banners creates a new promotional banner with full metadata', async () => {
  const newBanner = {
    title: 'Test Organic Honey Harvest',
    subtitle: 'Wild rock bee honey harvested directly from Nilgiri biosphere reserve.',
    imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38',
    ctaText: 'Shop Forest Honey',
    ctaLink: '/products?category=Honey',
    secondaryCtaText: 'Learn More',
    secondaryCtaLink: '/blog/wild-honey',
    tag: 'Wild Harvested',
    badge: '100% Raw • Unprocessed',
    displayOrder: 99,
    isActive: true
  };

  const res = await request()
    .post('/api/admin/banners')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send(newBanner);

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.ok(res.body.banner);
  assert.equal(res.body.banner.title, newBanner.title);
  assert.equal(res.body.banner.subtitle, newBanner.subtitle);
  assert.equal(res.body.banner.image_url, newBanner.imageUrl);
  assert.equal(res.body.banner.tag, newBanner.tag);
  assert.equal(res.body.banner.badge, newBanner.badge);
  assert.equal(res.body.banner.display_order, 99);
  assert.equal(res.body.banner.is_active, 1);

  createdBannerId = res.body.banner.id;
});

test('PUT /api/admin/banners/:id updates banner fields', async () => {
  assert.ok(createdBannerId, 'Banner must have been created');

  const updates = {
    title: 'Test Updated Organic Honey Harvest',
    isActive: false,
    displayOrder: 100
  };

  const res = await request()
    .put(`/api/admin/banners/${createdBannerId}`)
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send(updates);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.banner.title, 'Test Updated Organic Honey Harvest');
  assert.equal(res.body.banner.is_active, 0);
  assert.equal(res.body.banner.display_order, 100);
});

test('PUT /api/admin/banners/order reorders banners batch', async () => {
  assert.ok(createdBannerId, 'Banner must have been created');

  const orderPayload = [
    { id: createdBannerId, displayOrder: 10 }
  ];

  const res = await request()
    .put('/api/admin/banners/order')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({ order: orderPayload });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const [check] = await pool.query('SELECT display_order FROM homepage_banners WHERE id = ?', [createdBannerId]);
  assert.equal(check[0].display_order, 10);
});

test('DELETE /api/admin/banners/:id removes banner', async () => {
  assert.ok(createdBannerId, 'Banner must have been created');

  const res = await request()
    .delete(`/api/admin/banners/${createdBannerId}`)
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const [check] = await pool.query('SELECT * FROM homepage_banners WHERE id = ?', [createdBannerId]);
  assert.equal(check.length, 0);

  createdBannerId = null;
});
