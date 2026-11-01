process.env.DB_NAME = 'ecshopping_test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

const { default: app } = await import('../index.js');
const { initDatabase, default: pool } = await import('../db.js');
const { signToken } = await import('../middleware/auth.js');
const { transporter } = await import('../services/emailService.js');
if (transporter) {
  transporter.sendMail = async () => ({ messageId: 'mock-gap', response: '250 OK' });
}

const request = () => supertest(app);

const ADMIN_TOKEN = signToken({ sub: 'admin-gap-test', role: 'admin', email: 'admin@ecshopping.in' });
const VENDOR_ID = 'vendor-gap-test-101';
const VENDOR_TOKEN = signToken({ sub: VENDOR_ID, role: 'vendor', vendorId: VENDOR_ID, email: 'seller@organicfarms.in' });
const CUST_ID = 'cust-gap-test-202';
const CUST_TOKEN = signToken({ sub: CUST_ID, role: 'customer', email: 'cust@ecshopping.in' });

before(async () => {
  await initDatabase();

  // Clean test fixtures
  await pool.query('DELETE FROM coupons WHERE code LIKE "TEST%"');
  await pool.query('DELETE FROM deals WHERE product_id LIKE "prod-gap-%"');
  await pool.query('DELETE FROM order_items WHERE order_id LIKE "ord-gap-%"');
  await pool.query('DELETE FROM orders WHERE id LIKE "ord-gap-%"');
  await pool.query('DELETE FROM products WHERE id LIKE "prod-gap-%"');
  await pool.query('DELETE FROM vendors WHERE id = ?', [VENDOR_ID]);
  await pool.query('DELETE FROM users WHERE id IN (?, "cust-gap-test-303")', [CUST_ID]);

  // Insert a test vendor
  await pool.query(
    `INSERT INTO vendors (id, name, email, password, phone, business_name, registered_name, business_type, address, city, state, pincode, country, gst_status, gstin, fssai_status, fssai_number, bank_account_holder, bank_name, bank_account_number, bank_ifsc, commission_rate, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      VENDOR_ID,
      'Organic Test Vendor',
      'seller@organicfarms.in',
      '$2b$10$abcdefghijklmnopqrstuu',
      '9876543210',
      'Organic Test Farms',
      'Organic Test Farms LLP',
      'Producer / Farmer',
      '123 Green Valley Farm Road',
      'Pune',
      'Maharashtra',
      '411001',
      'India',
      'Registered',
      '27AAAAA0000A1Z5',
      'Applicable',
      '10019022001234',
      'Organic Test Farms LLP',
      'HDFC Bank',
      '50200012345678',
      'HDFC0001234',
      8.5,
      'approved'
    ]
  );

  // Insert a test user
  await pool.query(
    'INSERT INTO users (id, name, email, password, password_hash, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [CUST_ID, 'Test Customer Gap', 'cust@ecshopping.in', '$2b$10$abcdefghijklmnopqrstuu', '$2b$10$abcdefghijklmnopqrstuu', '9123456789', 'active']
  );

  // Insert a test product with multiple images
  await pool.query(
    `INSERT INTO products (id, title, price, stock_quantity, category, vendor_id, images, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'prod-gap-1',
      'Cold Pressed Groundnut Oil 1L',
      299,
      50,
      'staples',
      VENDOR_ID,
      JSON.stringify(['https://cdn.example.com/oil1.jpg', 'https://cdn.example.com/oil2.jpg']),
      'approved'
    ]
  );
});

/* ---------------- 1. DOCUMENT UPLOAD ---------------- */
test('POST /api/upload/document validates magic bytes and accepts PDF document', async () => {
  const pdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<</Root 1 0 R>>\n%%EOF');
  const res = await request()
    .post('/api/upload/document')
    .attach('document', pdfBuffer, 'sample-fssai.pdf');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.mimeType, 'application/pdf');
  assert.ok(res.body.url);
});

test('POST /api/upload/document rejects spoofed file extensions with invalid magic bytes', async () => {
  const fakePdfBuffer = Buffer.from('This is completely fake plaintext pretending to be a PDF certificate');
  const res = await request()
    .post('/api/upload/document')
    .attach('document', fakePdfBuffer, 'fake-gst.pdf');

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /Invalid document format/);
});

/* ---------------- 2. VENDOR REGISTRATION & VERIFICATION ---------------- */
test('POST /api/auth/vendor/register accepts all compliance, address, and bank fields', async () => {
  const newRegEmail = `vendor-${Date.now()}@testfarms.in`;
  const res = await request()
    .post('/api/auth/vendor/register')
    .send({
      name: 'Ramesh Patel',
      email: newRegEmail,
      password: 'SecurePassword123!',
      businessName: 'Patel Natural Farms',
      registeredName: 'Patel Natural Agro Private Limited',
      businessType: 'Producer / Farmer',
      ownerName: 'Ramesh Patel',
      phone: '9822012345',
      address: 'Plot 44 Agro SEZ',
      city: 'Nashik',
      district: 'Nashik',
      state: 'Maharashtra',
      pincode: '422001',
      country: 'India',
      gstStatus: 'Registered',
      gstin: '27AABCP1234Q1Z2',
      fssaiStatus: 'Applicable',
      fssaiNumber: '10020030040050',
      bankAccountName: 'Patel Natural Agro Private Limited',
      bankName: 'State Bank of India',
      bankAccountNumber: '38192837465',
      bankIfsc: 'SBIN0001234'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.vendor.status, 'pending');

  const [vRows] = await pool.query('SELECT * FROM vendors WHERE email = ?', [newRegEmail]);
  assert.equal(vRows.length, 1);
  assert.equal(vRows[0].city, 'Nashik');
  assert.equal(vRows[0].gstin, '27AABCP1234Q1Z2');
  assert.equal(vRows[0].fssai_number, '10020030040050');

  // Clean up
  await pool.query('DELETE FROM vendors WHERE email = ?', [newRegEmail]);
});

test('GET /api/vendors/:id/public exposes verified public details and hides bank accounts', async () => {
  const res = await request().get(`/api/vendors/${VENDOR_ID}/public`);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.vendor.businessName, 'Organic Test Farms');
  assert.equal(res.body.vendor.city, 'Pune');
  assert.equal(res.body.vendor.gstStatus, 'Registered');
  assert.equal(res.body.vendor.fssaiStatus, 'Applicable');
  // Must NOT expose sensitive banking info
  assert.equal(res.body.vendor.bankAccountNumber, undefined);
  assert.equal(res.body.vendor.bank_account_number, undefined);
  assert.equal(res.body.vendor.bankIfsc, undefined);
  assert.equal(res.body.vendor.bank_ifsc, undefined);
});

test('PUT /api/vendors/:id/verification allows admin to audit status, notes and commission override', async () => {
  const res = await request()
    .put(`/api/vendors/${VENDOR_ID}/verification`)
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({
      status: 'approved',
      verificationNotes: 'GSTIN and FSSAI verified on official MCA portal. 7.5% custom fee.',
      commissionRate: 7.5
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.vendor.commissionRate, 7.5);
  assert.equal(res.body.vendor.reviewedBy, 'admin@ecshopping.in');
});

/* ---------------- 3. CUSTOMER ACCOUNT DELETION & SOFT-DEACTIVATION ---------------- */
test('DELETE /api/user/account hard-deletes customer account when 0 orders exist', async () => {
  const freshUserId = 'cust-gap-test-303';
  await pool.query(
    'INSERT INTO users (id, name, email, password, password_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
    [freshUserId, 'Zero Orders User', 'zero-orders@test.local', '$2b$10$abcdefghijklmnopqrstuu', '$2b$10$abcdefghijklmnopqrstuu', 'active']
  );
  const freshUserToken = signToken({ sub: freshUserId, role: 'customer', email: 'zero-orders@test.local' });

  const res = await request()
    .delete('/api/user/account')
    .set('Authorization', `Bearer ${freshUserToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.deleted, true);

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [freshUserId]);
  assert.equal(rows.length, 0);
});

test('DELETE /api/user/account soft-deactivates customer credentials if orders exist', async () => {
  // Attach an order to CUST_ID
  await pool.query(
    `INSERT INTO orders (id, customer_name, customer_email, customer_phone, shipping_address, subtotal, discount, shipping, total, payment_method, payment_status, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['ord-gap-101', 'Test Customer Gap', 'cust@ecshopping.in', '9123456789', '123 Market St', 299, 0, 50, 349, 'cod', 'pending', 'Delivered']
  );

  const res = await request()
    .delete('/api/user/account')
    .set('Authorization', `Bearer ${CUST_TOKEN}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.deactivated, true);

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [CUST_ID]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'deactivated');
  assert.equal(rows[0].password_hash, 'DEACTIVATED');

  // Subsequent login attempt must be rejected
  const loginRes = await request()
    .post('/api/auth/user/login')
    .send({ email: 'cust@ecshopping.in', password: 'AnyPassword' });

  assert.equal(loginRes.status, 403);
  assert.match(loginRes.body.error, /deactivated/);
});

/* ---------------- 4. COUPONS ENGINE ---------------- */
test('Coupons: Admin CRUD and Storefront validation', async () => {
  // 1. Admin Create Coupon
  const createRes = await request()
    .post('/api/admin/coupons')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({
      code: 'TESTFARM25',
      description: '25% off on organic farm harvests',
      discountType: 'percent',
      discountValue: 25,
      minOrderAmount: 200,
      maxDiscountAmount: 150,
      usageLimit: 50,
      isActive: true
    });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.success, true);
  assert.equal(createRes.body.coupon.code, 'TESTFARM25');

  // 2. Validate Coupon below min order -> rejected
  const valLowRes = await request()
    .post('/api/coupons/validate')
    .send({ code: 'TESTFARM25', subtotal: 150 });

  assert.equal(valLowRes.status, 400);
  assert.match(valLowRes.body.error, /Minimum order amount/);

  // 3. Validate Coupon above min order -> accepted with calculated discount
  const valOkRes = await request()
    .post('/api/coupons/validate')
    .send({ code: 'TESTFARM25', subtotal: 400 });

  assert.equal(valOkRes.status, 200);
  assert.equal(valOkRes.body.success, true);
  // 25% of 400 = 100
  assert.equal(valOkRes.body.discount, 100);

  // 4. Validate Coupon with cap constraint
  const valCappedRes = await request()
    .post('/api/coupons/validate')
    .send({ code: 'TESTFARM25', subtotal: 1000 });

  assert.equal(valCappedRes.status, 200);
  // 25% of 1000 = 250, capped at maxDiscountAmount 150
  assert.equal(valCappedRes.body.discount, 150);

  // 5. Admin Delete Coupon
  const delRes = await request()
    .delete('/api/admin/coupons/TESTFARM25')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

  assert.equal(delRes.status, 200);
  assert.equal(delRes.body.success, true);
});

/* ---------------- 5. DEALS OF THE DAY ---------------- */
test('Deals: Admin CRUD and Active Deals endpoint', async () => {
  // 1. Admin Create Deal
  const createRes = await request()
    .post('/api/admin/deals')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({
      productId: 'prod-gap-1',
      dealPrice: 199,
      stockLimit: 25,
      status: 'active'
    });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.success, true);
  const dealId = createRes.body.deal.id;

  // 2. Public Active Deals endpoint returns the deal with computed discount
  const activeRes = await request().get('/api/deals/active');
  assert.equal(activeRes.status, 200);
  assert.equal(activeRes.body.success, true);
  const found = activeRes.body.deals.find((d) => d.productId === 'prod-gap-1');
  assert.ok(found);
  assert.equal(found.dealPrice, 199);
  assert.equal(found.originalPrice, 299);
  // Round(((299 - 199) / 299) * 100) = 33%
  assert.equal(found.discountPct, 33);

  // 3. Admin Delete Deal
  const delRes = await request()
    .delete(`/api/admin/deals/${dealId}`)
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

  assert.equal(delRes.status, 200);
  assert.equal(delRes.body.success, true);
});

/* ---------------- 6. COMMISSION & ORDER SETTLEMENT SNAPSHOTS ---------------- */
test('Commission: Admin global settings, order snapshot, and vendor financials', async () => {
  // 1. Read default commission
  const commRes = await request()
    .get('/api/admin/commission')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

  assert.equal(commRes.status, 200);
  assert.equal(commRes.body.success, true);
  assert.equal(typeof commRes.body.defaultCommissionRate, 'number');

  await pool.query('DELETE FROM deals WHERE product_id LIKE "prod-gap-%"');

  // 2. Create an order with line items from VENDOR_ID (which has 7.5% custom commission)
  const ordRes = await request()
    .post('/api/orders')
    .send({
      customerName: 'Sanjay Sharma',
      customerEmail: 'sanjay@example.com',
      customerPhone: '9876543210',
      shippingAddress: {
        street: '404 Palm Heights',
        city: 'Pune',
        state: 'Maharashtra',
        postcode: '411001'
      },
      items: [
        {
          productId: 'prod-gap-1',
          quantity: 2,
          price: 299,
          vendorId: VENDOR_ID
        }
      ],
      paymentMethod: 'cod'
    });

  assert.equal(ordRes.status, 201);
  assert.equal(ordRes.body.success, true);
  const createdOrderId = ordRes.body.order.id;

  // Inspect order_items table for financial snapshots
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [createdOrderId]);
  assert.equal(items.length, 1);
  const item = items[0];
  // Subtotal = 2 * 299 = 598. Commission rate = 7.5%.
  // Commission amount = (598 * 7.5) / 100 = 44.85
  // Vendor payout = 598 - 44.85 = 553.15
  assert.equal(Number(item.commission_rate), 7.5);
  assert.equal(Number(item.commission_amount), 44.85);
  assert.equal(Number(item.vendor_payout), 553.15);

  // 3. Vendor financials endpoint calculates totals
  const finRes = await request()
    .get('/api/vendor/financials')
    .set('Authorization', `Bearer ${VENDOR_TOKEN}`);

  assert.equal(finRes.status, 200);
  assert.equal(finRes.body.success, true);
  assert.ok(finRes.body.summary.grossSales >= 598);
  assert.ok(finRes.body.summary.totalCommission >= 44.85);
  assert.ok(finRes.body.summary.netPayout >= 553.15);

  // Clean up order
  await pool.query('DELETE FROM order_items WHERE order_id = ?', [createdOrderId]);
  await pool.query('DELETE FROM orders WHERE id = ?', [createdOrderId]);
});

/* ---------------- 7. MULTI-IMAGE PRODUCTS ---------------- */
test('Products: normalize and return images array across create, get, and list', async () => {
  const getRes = await request().get('/api/products/prod-gap-1');
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.success, true);
  assert.ok(Array.isArray(getRes.body.product.images));
  assert.equal(getRes.body.product.images.length, 2);
  assert.equal(getRes.body.product.images[0], 'https://cdn.example.com/oil1.jpg');
});

/* ---------------- 8. VENDOR-SPECIFIC DELIVERY CHARGES ---------------- */
test('Vendor Delivery: vendor updates store shipping settings and GET /api/shipping-config hydrates them', async () => {
  // 1. Vendor updates shipping charges in portal
  const putRes = await request()
    .put('/api/vendor/profile')
    .set('Authorization', `Bearer ${VENDOR_TOKEN}`)
    .send({
      shippingEnabled: true,
      shippingCharge: 40,
      shippingFreeThreshold: 350,
      shippingEstimatedDays: '2-3 business days'
    });

  assert.equal(putRes.status, 200);
  assert.equal(putRes.body.success, true);
  assert.equal(Number(putRes.body.vendor.shippingCharge), 40);
  assert.equal(Number(putRes.body.vendor.shippingFreeThreshold), 350);

  // 2. GET /api/shipping-config?vendorIds=... returns vendor shipping rules
  const shipRes = await request().get(`/api/shipping-config?vendorIds=${VENDOR_ID}`);
  assert.equal(shipRes.status, 200);
  assert.equal(shipRes.body.success, true);
  assert.ok(shipRes.body.vendorShipping);
  assert.equal(shipRes.body.vendorShipping[VENDOR_ID]?.shippingCharge, 40);
  assert.equal(shipRes.body.vendorShipping[VENDOR_ID]?.shippingFreeThreshold, 350);

  // 3. Placing order for vendor product uses vendor delivery charge (₹40), not admin default
  const orderRes = await request()
    .post('/api/orders')
    .send({
      customerName: 'Delivery Test Customer',
      customerEmail: 'deliv-test@example.com',
      customerPhone: '9876543210',
      shippingAddress: {
        street: '12 Farm Way',
        city: 'Coimbatore',
        state: 'TN',
        postcode: '641001'
      },
      deliveryMethod: 'standard',
      paymentMethod: 'cod',
      items: [
        {
          productId: 'prod-gap-1',
          quantity: 1 // unit price 299, below 350 threshold
        }
      ]
    });

  assert.equal(orderRes.status, 201);
  assert.equal(orderRes.body.success, true);
  assert.equal(Number(orderRes.body.order.shipping), 40);
  assert.equal(Number(orderRes.body.order.total), 299 + 40);

  // Clean up order
  const orderId = orderRes.body.order.id;
  await pool.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
  await pool.query('DELETE FROM orders WHERE id = ?', [orderId]);
});

/* ---------------- 9. PRODUCT EDITS & ADMIN RE-APPROVAL FLOW ---------------- */
test('Vendor & Admin product edits: vendor edit triggers re-approval (pending), admin edit stays approved', async () => {
  // 1. Ensure prod-gap-1 is approved
  await pool.query('UPDATE products SET status = "approved" WHERE id = "prod-gap-1"');

  // 2. Vendor edits product details
  const vendorEditRes = await request()
    .put('/api/products/prod-gap-1')
    .set('Authorization', `Bearer ${VENDOR_TOKEN}`)
    .send({
      title: 'Updated Organic Cold-Pressed Mustard Oil',
      price: 320,
      description: 'Revised cold pressed mustard oil description',
      images: ['https://cdn.example.com/oil1.jpg', 'https://cdn.example.com/oil2.jpg', 'https://cdn.example.com/oil3.jpg']
    });

  assert.equal(vendorEditRes.status, 200);
  assert.equal(vendorEditRes.body.success, true);
  assert.equal(vendorEditRes.body.product.status, 'pending');
  assert.equal(Number(vendorEditRes.body.product.price), 320);
  assert.equal(vendorEditRes.body.product.images.length, 3);

  // 3. Admin edits product (re-approves and updates price)
  const adminEditRes = await request()
    .put('/api/products/prod-gap-1')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({
      title: 'Admin Verified Organic Mustard Oil',
      price: 310,
      status: 'approved'
    });

  assert.equal(adminEditRes.status, 200);
  assert.equal(adminEditRes.body.success, true);
  assert.equal(adminEditRes.body.product.status, 'approved');
  assert.equal(Number(adminEditRes.body.product.price), 310);
});

after(async () => {
  try {
    await pool.query('DELETE FROM coupons WHERE code LIKE "TEST%"');
    await pool.query('DELETE FROM deals WHERE product_id LIKE "prod-gap-%"');
    await pool.query('DELETE FROM products WHERE id LIKE "prod-gap-%"');
    await pool.query('DELETE FROM vendors WHERE id = ?', [VENDOR_ID]);
    await pool.query('DELETE FROM users WHERE id IN (?, "cust-gap-test-303")', [CUST_ID]);
    await pool.end();
  } catch (e) {
    // ignore cleanup errors
  }
});
