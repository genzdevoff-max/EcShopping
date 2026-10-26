process.env.DB_NAME = 'ecshopping_test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

const { default: app } = await import('../../index.js');
const { initDatabase, default: pool } = await import('../../db.js');
const { signToken } = await import('../../middleware/auth.js');

const request = () => supertest(app);

const VENDOR_A_ID = 'v-inv-test-a';
const VENDOR_B_ID = 'v-inv-test-b';
const CUSTOMER_ID = 'c-inv-test';
const CUSTOMER_EMAIL = 'customer-inv@test.local';

const VENDOR_A_TOKEN = signToken({ sub: VENDOR_A_ID, role: 'vendor', vendorId: VENDOR_A_ID, email: 'va@test.local' });
const ADMIN_TOKEN = signToken({ sub: 'admin-inv', role: 'admin', email: 'admin-inv@test.local' });
const CUSTOMER_TOKEN = signToken({ sub: CUSTOMER_ID, role: 'customer', email: CUSTOMER_EMAIL });

const PROD_1_ID = 'p-inv-001';
const PROD_2_ID = 'p-inv-002';
const PROD_MULTI_ID = 'p-inv-003';

before(async () => {
  await initDatabase();

  await pool.query("DELETE FROM order_items WHERE order_id LIKE 'ORD-INV-%'");
  await pool.query("DELETE FROM orders WHERE id LIKE 'ORD-INV-%'");
  await pool.query("DELETE FROM products WHERE id IN (?, ?, ?)", [PROD_1_ID, PROD_2_ID, PROD_MULTI_ID]);

  // Seed Product 1: Vendor A, 10 in stock
  await pool.query(
    `INSERT INTO products (id, vendor_id, vendor_name, title, name, price, stock_status, stock_quantity, status)
     VALUES (?, ?, 'Organic Valley', 'Organic Honey 500g', 'Organic Honey 500g', 250, 'in_stock', 10, 'approved')`,
    [PROD_1_ID, VENDOR_A_ID]
  );

  // Seed Product 2: Vendor A, 2 in stock (limited)
  await pool.query(
    `INSERT INTO products (id, vendor_id, vendor_name, title, name, price, stock_status, stock_quantity, status)
     VALUES (?, ?, 'Organic Valley', 'Rare Wild Saffron', 'Rare Wild Saffron', 500, 'in_stock', 2, 'approved')`,
    [PROD_2_ID, VENDOR_A_ID]
  );

  // Seed Product 3: Vendor B, 15 in stock (multi-vendor test)
  await pool.query(
    `INSERT INTO products (id, vendor_id, vendor_name, title, name, price, stock_status, stock_quantity, status)
     VALUES (?, ?, 'Himalayan Herbs', 'Organic Green Tea', 'Organic Green Tea', 180, 'in_stock', 15, 'approved')`,
    [PROD_MULTI_ID, VENDOR_B_ID]
  );
});

after(async () => {
  await pool.query("DELETE FROM order_items WHERE order_id LIKE 'ORD-INV-%'");
  await pool.query("DELETE FROM orders WHERE id LIKE 'ORD-INV-%'");
  await pool.query("DELETE FROM products WHERE id IN (?, ?, ?)", [PROD_1_ID, PROD_2_ID, PROD_MULTI_ID]);
  await pool.end();
});

test('Inventory: Initial stock reflected in product endpoints', async () => {
  const res = await request().get(`/api/products/${PROD_1_ID}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.product.stockQuantity, 10);
  assert.equal(res.body.product.stockStatus, 'in_stock');
});

test('Inventory: Atomic stock decrement on order placement', async () => {
  const orderPayload = {
    customerName: 'Inventory Shopper',
    customerEmail: CUSTOMER_EMAIL,
    customerPhone: '9876543210',
    shippingAddress: { street: '123 Test Rd', city: 'Chennai', state: 'TN', postcode: '600001' },
    deliveryMethod: 'standard',
    paymentMethod: 'cod',
    items: [
      { productId: PROD_1_ID, quantity: 3 }
    ]
  };

  const res = await request()
    .post('/api/orders')
    .set('Authorization', `Bearer ${CUSTOMER_TOKEN}`)
    .send(orderPayload);

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  const orderId = res.body.order.id;

  // Verify stock decremented: 10 - 3 = 7
  const [pRows] = await pool.query('SELECT stock_quantity, stock_status FROM products WHERE id = ?', [PROD_1_ID]);
  assert.equal(pRows[0].stock_quantity, 7);
  assert.equal(pRows[0].stock_status, 'in_stock');
});

test('Inventory: Rejects order exceeding available stock quantity', async () => {
  // PROD_2_ID only has 2 in stock; attempt to order 3
  const orderPayload = {
    customerName: 'Greedy Buyer',
    customerEmail: CUSTOMER_EMAIL,
    customerPhone: '9876543210',
    shippingAddress: { street: '123 Test Rd', city: 'Chennai', state: 'TN', postcode: '600001' },
    deliveryMethod: 'standard',
    paymentMethod: 'cod',
    items: [
      { productId: PROD_2_ID, quantity: 3 }
    ]
  };

  const res = await request()
    .post('/api/orders')
    .set('Authorization', `Bearer ${CUSTOMER_TOKEN}`)
    .send(orderPayload);

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /insufficient stock/i);

  // Stock must remain intact at 2
  const [pRows] = await pool.query('SELECT stock_quantity FROM products WHERE id = ?', [PROD_2_ID]);
  assert.equal(pRows[0].stock_quantity, 2);
});

test('Inventory: Concurrent purchase simulation prevents overselling', async () => {
  // PROD_2_ID has exactly 2 in stock.
  // Two simultaneous purchases for 2 items each.
  // Exactly ONE must succeed and ONE must fail.
  const payload1 = {
    customerName: 'Buyer 1',
    customerEmail: CUSTOMER_EMAIL,
    customerPhone: '9876543210',
    shippingAddress: { street: '123 Test Rd', city: 'Chennai', state: 'TN', postcode: '600001' },
    deliveryMethod: 'standard',
    paymentMethod: 'cod',
    items: [{ productId: PROD_2_ID, quantity: 2 }]
  };
  const payload2 = {
    customerName: 'Buyer 2',
    customerEmail: CUSTOMER_EMAIL,
    customerPhone: '9876543210',
    shippingAddress: { street: '123 Test Rd', city: 'Chennai', state: 'TN', postcode: '600001' },
    deliveryMethod: 'standard',
    paymentMethod: 'cod',
    items: [{ productId: PROD_2_ID, quantity: 2 }]
  };

  const [res1, res2] = await Promise.all([
    request().post('/api/orders').set('Authorization', `Bearer ${CUSTOMER_TOKEN}`).send(payload1),
    request().post('/api/orders').set('Authorization', `Bearer ${CUSTOMER_TOKEN}`).send(payload2)
  ]);

  const statuses = [res1.status, res2.status].sort();
  assert.deepEqual(statuses, [201, 400], 'One request must succeed (201) and one must be rejected (400)');

  // Verify stock is now 0 and status is out_of_stock
  const [pRows] = await pool.query('SELECT stock_quantity, stock_status FROM products WHERE id = ?', [PROD_2_ID]);
  assert.equal(pRows[0].stock_quantity, 0);
  assert.equal(pRows[0].stock_status, 'out_of_stock');
});

test('Inventory: Stock restoration on customer order cancellation', async () => {
  // 1. Place an order for 2 units of PROD_1_ID (stock was 7 -> should become 5)
  const orderRes = await request()
    .post('/api/orders')
    .set('Authorization', `Bearer ${CUSTOMER_TOKEN}`)
    .send({
      customerName: 'Cancellation Tester',
      customerEmail: CUSTOMER_EMAIL,
      customerPhone: '9876543210',
      shippingAddress: { street: '123 Test Rd', city: 'Chennai', state: 'TN', postcode: '600001' },
      deliveryMethod: 'standard',
      paymentMethod: 'cod',
      items: [{ productId: PROD_1_ID, quantity: 2 }]
    });

  assert.equal(orderRes.status, 201);
  const orderId = orderRes.body.order.id;

  const [midStock] = await pool.query('SELECT stock_quantity FROM products WHERE id = ?', [PROD_1_ID]);
  assert.equal(midStock[0].stock_quantity, 5);

  // 2. Customer cancels order
  const cancelRes = await request()
    .post(`/api/orders/${orderId}/cancel`)
    .set('Authorization', `Bearer ${CUSTOMER_TOKEN}`)
    .send({ reason: 'Changed mind' });

  assert.equal(cancelRes.status, 200);

  // 3. Stock must be restored: 5 + 2 = 7
  const [restoredStock] = await pool.query('SELECT stock_quantity, stock_status FROM products WHERE id = ?', [PROD_1_ID]);
  assert.equal(restoredStock[0].stock_quantity, 7);
  assert.equal(restoredStock[0].stock_status, 'in_stock');
});

test('Multi-Vendor Fulfillment: Single order containing items from multiple vendors', async () => {
  // PROD_1_ID belongs to VENDOR_A_ID; PROD_MULTI_ID belongs to VENDOR_B_ID
  const multiVendorOrder = {
    customerName: 'Multi Vendor Shopper',
    customerEmail: CUSTOMER_EMAIL,
    customerPhone: '9876543210',
    shippingAddress: { street: '123 Test Rd', city: 'Chennai', state: 'TN', postcode: '600001' },
    deliveryMethod: 'standard',
    paymentMethod: 'cod',
    items: [
      { productId: PROD_1_ID, quantity: 1 },
      { productId: PROD_MULTI_ID, quantity: 2 }
    ]
  };

  const createRes = await request()
    .post('/api/orders')
    .set('Authorization', `Bearer ${CUSTOMER_TOKEN}`)
    .send(multiVendorOrder);

  assert.equal(createRes.status, 201);
  const orderId = createRes.body.order.id;

  // Customer fetches order: sees all items
  const custRes = await request()
    .get(`/api/orders/${orderId}`)
    .set('Authorization', `Bearer ${CUSTOMER_TOKEN}`);
  assert.equal(custRes.status, 200);
  assert.equal(custRes.body.order.items.length, 2);

  // Vendor A fetches orders: sees order and vendorItems contains ONLY Vendor A item
  const vARes = await request()
    .get('/api/orders')
    .set('Authorization', `Bearer ${VENDOR_A_TOKEN}`);
  assert.equal(vARes.status, 200);
  const vAOrder = vARes.body.orders.find((o) => o.id === orderId);
  assert.ok(vAOrder, 'Vendor A must see the order containing their item');
  assert.equal(vAOrder.vendorItems.length, 1);
  assert.equal(vAOrder.vendorItems[0].productId, PROD_1_ID);
});

test('Vendor Inventory: Vendor can toggle stock on their own approved product without altering status', async () => {
  // PROD_1_ID is approved and belongs to VENDOR_A_ID
  const res = await request()
    .put(`/api/products/${PROD_1_ID}`)
    .set('Authorization', `Bearer ${VENDOR_A_TOKEN}`)
    .send({ stockStatus: 'out_of_stock' });

  assert.equal(res.status, 200);
  assert.equal(res.body.product.stockStatus, 'out_of_stock');
  assert.equal(res.body.product.stockQuantity, 0);
  assert.equal(res.body.product.status, 'approved'); // Status remains approved!

  // Re-enable stock
  const resIn = await request()
    .put(`/api/products/${PROD_1_ID}`)
    .set('Authorization', `Bearer ${VENDOR_A_TOKEN}`)
    .send({ stockStatus: 'in_stock' });

  assert.equal(resIn.status, 200);
  assert.equal(resIn.body.product.stockStatus, 'in_stock');
  assert.ok(resIn.body.product.stockQuantity > 0);
  assert.equal(resIn.body.product.status, 'approved');
});

test('Vendor Anti-Tampering: Vendor cannot modify content fields on approved products', async () => {
  // Attempting to change price on approved product PROD_1_ID
  const priceRes = await request()
    .put(`/api/products/${PROD_1_ID}`)
    .set('Authorization', `Bearer ${VENDOR_A_TOKEN}`)
    .send({ price: 999 });

  assert.equal(priceRes.status, 403);
  assert.ok(priceRes.body.error.includes('Approved product details'));

  // Attempting to change title on approved product PROD_1_ID
  const titleRes = await request()
    .put(`/api/products/${PROD_1_ID}`)
    .set('Authorization', `Bearer ${VENDOR_A_TOKEN}`)
    .send({ title: 'Tampered Title' });

  assert.equal(titleRes.status, 403);
  assert.ok(titleRes.body.error.includes('Approved product details'));
});

test('Vendor Isolation: Vendor cannot modify inventory of another vendor product', async () => {
  // Vendor A attempts to toggle stock on Vendor B's product PROD_MULTI_ID
  const res = await request()
    .put(`/api/products/${PROD_MULTI_ID}`)
    .set('Authorization', `Bearer ${VENDOR_A_TOKEN}`)
    .send({ stockStatus: 'out_of_stock' });

  assert.equal(res.status, 403);
  assert.ok(res.body.error.includes('You can only manage your own products'));
});
