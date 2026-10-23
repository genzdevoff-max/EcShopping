// API tests hit the app inside a test process against the ecshopping_test
// database (DB_NAME is overridden before the app module imports db.js).
// dotenv.config() inside db.js never overrides an already-set env var.
process.env.DB_NAME = 'ecshopping_test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

const { default: app } = await import('../../index.js');
const { initDatabase, pool } = await import('../../db.js');
const { hashPassword } = await import('../../utils/passwords.js');
const { signToken } = await import('../../middleware/auth.js');

const CUSTOMER_A = { email: 'unit-cust-a@ecshopping.test', password: 'unit-cust-pass-1', phone: '9876500001' };
const CUSTOMER_B_EMAIL = 'unit-cust-b2@ecshopping.test';

const PRODUCTS = [
  { id: 'p-unit-ok', vendor_id: 'v-unit-001', vendor_name: 'Unit Vendor', title: 'Unit Test Product', price: 100.0, stock_status: 'in_stock', status: 'approved' },
  { id: 'p-unit-ok2', vendor_id: 'v-unit-001', vendor_name: 'Unit Vendor', title: 'Unit Test Product 2', price: 30.0, stock_status: 'in_stock', status: 'approved' },
  { id: 'p-unit-oos', vendor_id: 'v-unit-001', vendor_name: 'Unit Vendor', title: 'OutOfStock Product', price: 50.0, stock_status: 'out_of_stock', status: 'approved' },
  { id: 'p-unit-pend', vendor_id: 'v-unit-001', vendor_name: 'Unit Vendor', title: 'Pending Product', price: 999.0, stock_status: 'in_stock', status: 'pending' }
];

const SEED_ORDERS = [
  { id: 'ORD-UNIT-777', email: 'unit-other-cust@ecshopping.test', name: 'Other Customer' },
  { id: 'ORD-UNIT-888', email: 'unit-other-cust@ecshopping.test', name: 'Other Customer' }
];

const VENDOR_UNIT = { id: 'v-unit-001', email: 'unit-vendor@ecshopping.test', password: 'unit-vendor-pass-1' };

let customerAToken = null;
let vendorToken = null;
let customerBToken = null;
let customerAOrderId = null;

const request = () => supertest(app);

const insertSeedProduct = async (p) => {
  await pool.query(
    `INSERT INTO products (id, vendor_id, vendor_name, title, name, description, category, price, strike_price, unit, image, stock_status, status)
     VALUES (?, ?, ?, ?, ?, '', 'General', ?, NULL, '', '', ?, ?)`,
    [p.id, p.vendor_id, p.vendor_name, p.title, p.title, p.price, p.stock_status, p.status]
  );
};

const insertSeedOrder = async (order, vendorId) => {
  await pool.query(
    `INSERT INTO orders (id, customer_name, customer_email, customer_phone, shipping_address, subtotal, discount, shipping, total,
        delivery_method, payment_method, payment_status, status)
     VALUES (?, ?, ?, '9876500099', '{"street":"1 Test St","city":"Unit City","state":"TN","postcode":"600001"}', ?, 0, 0, ?, 'standard', 'cod', 'pending', 'Processing')`,
    [order.id, order.name, order.email, 123, 123]
  );
  await pool.query(
    `INSERT INTO order_items (order_id, product_id, vendor_id, vendor_name, title, price, quantity, image, variant)
     VALUES (?, 'p-unit-ok', ?, ?, 'Unit Test Product', 123, 1, '', NULL)`,
    [order.id, vendorId, vendorId === 'v-unit-001' ? 'Unit Vendor' : 'Other Vendor']
  );
};

// Rollback test helper: replaces pool.getConnection so the SECOND order_items
// INSERT rejects while everything else behaves as normal.
const originalGetConnection = pool.getConnection.bind(pool);
const rollbackState = { active: false, itemInsertsSeen: 0 };
pool.getConnection = async () => {
  const conn = await originalGetConnection();
  if (!rollbackState.active) return conn;
  const realQuery = conn.query.bind(conn);
  rollbackState.itemInsertsSeen = 0;
  conn.query = (sql, params) => {
    if (typeof sql === 'string' && sql.startsWith('INSERT INTO order_items')) {
      rollbackState.itemInsertsSeen += 1;
      if (rollbackState.itemInsertsSeen === 2) {
        return Promise.reject(new Error('SIMULATED_ITEM_FAILURE'));
      }
    }
    return realQuery(sql, params);
  };
  return conn;
};

before(async () => {
  await initDatabase();

  // Fresh slice of the TEST database only (never the live ecshopping DB).
  await pool.query("DELETE FROM order_items WHERE order_id LIKE 'ORD-UNIT-%'");
  await pool.query("DELETE FROM orders WHERE id LIKE 'ORD-UNIT-%'");
  await pool.query("DELETE FROM products WHERE id LIKE 'p-unit-%'");
  await pool.query("DELETE FROM users WHERE email LIKE 'unit-%@ecshopping.test'");
  await pool.query("DELETE FROM vendors WHERE email LIKE 'unit-%@ecshopping.test'");

  for (const p of PRODUCTS) await insertSeedProduct(p);
  await insertSeedOrder(SEED_ORDERS[0], 'v-unit-001');
  await insertSeedOrder(SEED_ORDERS[1], 'v-unit-999');

  await pool.query(
    `INSERT INTO vendors (id, name, email, password, password_hash, phone, status, direct_selling)
     VALUES (?, 'Unit Vendor', ?, '', ?, '9876500088', 'approved', 1)`,
    [VENDOR_UNIT.id, VENDOR_UNIT.email, await hashPassword(VENDOR_UNIT.password)]
  );

  customerBToken = signToken({
    sub: 'unit-cust-b-id',
    role: 'customer',
    email: CUSTOMER_B_EMAIL,
    name: 'Customer B'
  });
});

after(async () => {
  await pool.query("DELETE FROM order_items WHERE order_id LIKE 'ORD-UNIT-%'");
  await pool.query("DELETE FROM orders WHERE id LIKE 'ORD-UNIT-%'");
  await pool.query("DELETE FROM products WHERE id LIKE 'p-unit-%'");
  await pool.query("DELETE FROM users WHERE email LIKE 'unit-%@ecshopping.test'");
  await pool.query("DELETE FROM vendors WHERE email LIKE 'unit-%@ecshopping.test'");
  await pool.end();
});

const guestPayload = (overrides = {}) => ({
  customerName: 'Guest Buyer',
  customerEmail: 'unit-guest@ecshopping.test',
  customerPhone: '9876500011',
  shippingAddress: { street: '12 Test Street', city: 'Unit City', state: 'TN', postcode: '600001' },
  deliveryMethod: 'standard',
  paymentMethod: 'cod',
  items: [{ id: 'p-unit-ok', quantity: 1 }],
  ...overrides
});

test('POST /api/auth/user/register works (customer A token for later tests)', async () => {
  const res = await request().post('/api/auth/user/register').send({
    name: 'Customer A',
    email: CUSTOMER_A.email,
    password: CUSTOMER_A.password,
    phone: CUSTOMER_A.phone
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.token, 'register must mint a token');
  customerAToken = res.body.token;
});

test('anonymous POST /api/orders cannot overwrite an existing order id', async () => {
  const res = await request().post('/api/orders').send(guestPayload({
    id: 'ORD-UNIT-777',
    items: [{ id: 'p-unit-ok', quantity: 1 }],
    paymentStatus: 'paid',
    paymentReference: 'CLIENT-CLAIMED-REF',
    total: 1,
    subtotal: 1
  }));
  assert.equal(res.status, 201);
  assert.ok(res.body.success);
  assert.notEqual(res.body.order.id, 'ORD-UNIT-777', 'client id must be ignored');
  assert.match(String(res.body.order.id), /^ORD-\d{6}$/, 'server must mint ORD-###### ids');

  // The pre-existing order must be untouched.
  const [rows] = await pool.query(
    `SELECT o.total, o.customer_email, o.payment_status, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS items
     FROM orders o WHERE o.id = 'ORD-UNIT-777'`
  );
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].total), 123);
  assert.equal(rows[0].customer_email, 'unit-other-cust@ecshopping.test');
  assert.equal(rows[0].payment_status, 'pending');
  assert.equal(Number(rows[0].items), 1);
});

test('payment status is never trusted from the client (forced pending, reference ignored)', async () => {
  const res = await request().post('/api/orders').send(guestPayload({
    paymentMethod: 'phonepe',
    paymentStatus: 'paid',
    items: [{ id: 'p-unit-ok', quantity: 1 }]
  }));
  assert.equal(res.status, 201);
  assert.equal(res.body.order.paymentStatus, 'pending');
  assert.equal(res.body.order.paymentMethod, 'phonepe', 'declared method is kept');
});

test('client-supplied prices/titles/vendors are ignored — totals recomputed from DB', async () => {
  const res = await request().post('/api/orders').send(guestPayload({
    items: [{ id: 'p-unit-ok', quantity: 1, price: 0.01, title: 'FAKE TITLE', vendorId: 'v-fake', vendorName: 'FAKE VENDOR' }],
    subtotal: 1,
    discount: 999,
    shipping: 0,
    total: 1,
    totalAmount: 1
  }));
  assert.equal(res.status, 201);
  const order = res.body.order;
  assert.equal(Number(order.items[0].price), 100, 'line price must come from the DB row');
  assert.equal(order.items[0].title, 'Unit Test Product');
  assert.equal(order.items[0].vendorId, 'v-unit-001');
  assert.equal(Number(order.subtotal), 100);
  assert.equal(Number(order.shipping), 50, 'standard shipping below free threshold');
  assert.equal(Number(order.discount), 0);
  assert.equal(Number(order.totalAmount), 150);
});

test('coupon below minOrder does not apply; valid coupon follows the ported rule', async () => {
  const early = await request().post('/api/orders').send(guestPayload({
    couponCode: 'WELCOME10',
    items: [{ id: 'p-unit-ok', quantity: 1 }]
  }));
  // subtotal 100 < minOrder 299 → no discount, standard shipping
  assert.equal(Number(early.body.order.discount), 0);
  assert.equal(early.body.order.couponCode, null);
  assert.equal(Number(early.body.order.totalAmount), 150);

  const valid = await request().post('/api/orders').send(guestPayload({
    couponCode: 'FRESH50',
    items: [{ id: 'p-unit-ok', quantity: 6 }]
  }));
  // subtotal 600 → FRESH50 flat 50; subtotal >= 499 → free standard shipping
  assert.equal(Number(valid.body.order.discount), 50);
  assert.equal(Number(valid.body.order.shipping), 0);
  assert.equal(Number(valid.body.order.totalAmount), 550);
  assert.equal(valid.body.order.couponCode, 'FRESH50');
});

const EXPECT_400_CASES = [
  ['empty items', { items: [] }],
  ['quantity 0', { items: [{ id: 'p-unit-ok', quantity: 0 }] }],
  ['fractional quantity', { items: [{ id: 'p-unit-ok', quantity: 1.5 }] }],
  ['quantity over cap', { items: [{ id: 'p-unit-ok', quantity: 100 }] }],
  ['unknown product id', { items: [{ id: 'p-unit-none', quantity: 1 }] }],
  ['pending product rejected', { items: [{ id: 'p-unit-pend', quantity: 1 }] }],
  ['out-of-stock product rejected', { items: [{ id: 'p-unit-oos', quantity: 1 }] }],
  ['invalid payload item shape', { items: ['not-an-object'] }],
  ['invalid email', guestPayload({ customerEmail: 'not-an-email' })],
  ['missing customer name', guestPayload({ customerName: '' })],
  ['invalid phone', guestPayload({ customerPhone: '12345' })],
  ['missing shipping address', guestPayload({ shippingAddress: null })],
  ['bad postcode', guestPayload({ shippingAddress: { street: 's', city: 'c', state: 'TN', postcode: '12' } })],
  ['unsupported payment method', guestPayload({ paymentMethod: 'paypal' })]
];

for (const [label, payload] of EXPECT_400_CASES) {
  test(`POST /api/orders 400 for ${label}`, async () => {
    const res = await request().post('/api/orders').send(payload);
    assert.equal(res.status, 400, `expected 400 (${label})`);
    assert.equal(res.body.success, false);
  });
}

test('rollback: order and items are not persisted when an order_items insert fails', async () => {
  const [beforeRows] = await pool.query('SELECT COUNT(*) AS n FROM orders');
  rollbackState.active = true;
  let res;
  try {
    res = await request().post('/api/orders').send(guestPayload({
      items: [{ id: 'p-unit-ok', quantity: 1 }, { id: 'p-unit-ok2', quantity: 1 }]
    }));
  } finally {
    rollbackState.active = false;
  }
  assert.equal(res.status, 500);
  assert.equal(res.body.success, false);
  assert.ok(rollbackState.itemInsertsSeen >= 2, 'first item insert must have happened before the failure');
  const [afterRows] = await pool.query('SELECT COUNT(*) AS n FROM orders');
  assert.equal(Number(afterRows[0].n), Number(beforeRows[0].n), 'rollback must leave no new orders');
});

test('authenticated customer: server forces token identity over payload email', async () => {
  const res = await request()
    .post('/api/orders')
    .set('Authorization', `Bearer ${customerAToken}`)
    .send(guestPayload({ customerEmail: CUSTOMER_B_EMAIL, customerName: 'Spoofed Name' }));
  assert.equal(res.status, 201);
  assert.equal(res.body.order.customerEmail, CUSTOMER_A.email, 'token email wins');
  customerAOrderId = res.body.order.id;
});

test('authenticated customer ownership: list and detail scoping', async () => {
  assert.ok(customerAToken, 'register test must have run first');
  assert.ok(customerAOrderId, 'identity test must have created an owned order first');

  const list = await request()
    .get('/api/orders')
    .set('Authorization', `Bearer ${customerAToken}`);
  assert.equal(list.status, 200);
  const emails = new Set(list.body.orders.map((o) => o.customerEmail));
  assert.ok(emails.has(CUSTOMER_A.email));
  assert.ok(!emails.has('unit-other-cust@ecshopping.test'), 'no other customer rows exposed');

  const seeded = await request()
    .get('/api/orders/ORD-UNIT-777')
    .set('Authorization', `Bearer ${customerAToken}`);
  assert.equal(seeded.status, 404, 'another customer order is masked as not found');

  const own = await request()
    .get(`/api/orders/${encodeURIComponent(customerAOrderId)}`)
    .set('Authorization', `Bearer ${customerAToken}`);
  assert.equal(own.status, 200, 'owner can fetch own order');

  const foreign = await request()
    .get(`/api/orders/${encodeURIComponent(customerAOrderId)}`)
    .set('Authorization', `Bearer ${customerBToken}`);
  assert.equal(foreign.status, 404, 'other customer masked as not found');
});

test('GET /api/orders 401 without a token', async () => {
  const res = await request().get('/api/orders');
  assert.equal(res.status, 401);
});

test('vendor sees only orders containing own items and cannot touch others', async () => {
  const login = await request()
    .post('/api/auth/vendor/login')
    .send({ email: VENDOR_UNIT.email, password: VENDOR_UNIT.password });
  assert.equal(login.status, 200);
  vendorToken = login.body.token;
  assert.ok(vendorToken);

  const list = await request().get('/api/orders').set('Authorization', `Bearer ${vendorToken}`);
  assert.equal(list.status, 200);
  const ids = new Set(list.body.orders.map((o) => o.id));
  assert.ok(ids.has('ORD-UNIT-777'), 'order containing own item is visible');
  assert.ok(!ids.has('ORD-UNIT-888'), 'other-vendor order hidden');

  const forbidden = await request()
    .put('/api/orders/ORD-UNIT-888/status')
    .set('Authorization', `Bearer ${vendorToken}`)
    .send({ status: 'Shipped' });
  assert.equal(forbidden.status, 404, 'status change on foreign order is masked');

  const allowed = await request()
    .put('/api/orders/ORD-UNIT-777/status')
    .set('Authorization', `Bearer ${vendorToken}`)
    .send({ status: 'Shipped' });
  assert.equal(allowed.status, 200);

  const [rows] = await pool.query('SELECT status FROM orders WHERE id = ?', ['ORD-UNIT-777']);
  assert.equal(rows[0].status, 'Shipped');
});

test('vendor still 401 without token on PUT /api/orders/:id/status', async () => {
  const res = await request().put('/api/orders/ORD-UNIT-777/status').send({ status: 'Shipped' });
  assert.equal(res.status, 401);
});
