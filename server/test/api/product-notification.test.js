import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';

process.env.DB_NAME = 'ecshopping_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_unit_tests_only_32_chars_long';
process.env.ADMIN_EMAIL = 'admin-notif-test@ecshopping.local';
process.env.SMTP_EMAIL = 'smtp-sender@ecshopping.local';
process.env.SMTP_PASSWORD = 'fake-test-password';
process.env.SENDER_NAME = 'EcShopping Test';

const { default: app, transporter } = await import('../../index.js');
const { initDatabase, pool } = await import('../../db.js');
const { signToken } = await import('../../middleware/auth.js');

const request = supertest(app);

const vendorPayload = {
  sub: 'v_notif_test_1',
  vendorId: 'v_notif_test_1',
  name: 'Organic Farm Co',
  email: 'vendor_notif@ecshopping.local',
  role: 'vendor'
};
const vendorToken = signToken(vendorPayload);

const createdProductIds = [];

before(async () => {
  await initDatabase();
  // Ensure test vendor exists
  await pool.query(
    `INSERT INTO vendors (id, name, email, password, status)
     VALUES (?, ?, ?, 'hashed_pw', 'approved')
     ON DUPLICATE KEY UPDATE status = 'approved'`,
    [vendorPayload.vendorId, vendorPayload.name, vendorPayload.email]
  );
});

after(async () => {
  if (createdProductIds.length > 0) {
    const placeholders = createdProductIds.map(() => '?').join(',');
    await pool.query(`DELETE FROM products WHERE id IN (${placeholders})`, createdProductIds);
  }
  await pool.query(`DELETE FROM vendors WHERE id = ?`, [vendorPayload.vendorId]);
  await pool.end();
});

test('Feature A: Vendor product submission triggers admin email notification with correct details', async () => {
  let sentMailOptions = null;
  const originalSendMail = transporter.sendMail;
  transporter.sendMail = async (options) => {
    sentMailOptions = options;
    return { messageId: 'test-msg-123' };
  };

  try {
    const pId = 'p_notif_' + Date.now();
    createdProductIds.push(pId);

    const res = await request
      .post('/api/products')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({
        id: pId,
        title: 'Fresh Wild Honey 500g',
        description: 'Pure raw honey from forest hives',
        category: 'Honey',
        price: 450,
        strikePrice: 500,
        unit: 'Bottle',
        image: 'https://example.com/honey.jpg',
        stockQuantity: 25
      });

    assert.equal(res.status, 201, 'Should create product with 201 status');
    assert.equal(res.body.success, true);
    assert.equal(res.body.product.id, pId);
    assert.equal(res.body.product.status, 'pending', 'Must default to pending status');
    assert.equal(res.body.product.vendorId, vendorPayload.vendorId, 'Vendor ID must be assigned from token');

    // Verify email was dispatched
    assert.ok(sentMailOptions, 'transporter.sendMail must be called upon successful submission');
    assert.equal(sentMailOptions.to, process.env.ADMIN_EMAIL, 'Recipient must match configured ADMIN_EMAIL');
    assert.ok(sentMailOptions.subject.includes('Fresh Wild Honey 500g'), 'Subject must mention product title');
    assert.ok(sentMailOptions.html.includes('Fresh Wild Honey 500g'), 'HTML body must contain product title');
    assert.ok(sentMailOptions.html.includes('Organic Farm Co'), 'HTML body must identify the vendor');
    assert.ok(sentMailOptions.html.includes('450'), 'HTML body must contain product price');
    assert.ok(sentMailOptions.html.includes(pId), 'HTML body must include product ID');
  } finally {
    transporter.sendMail = originalSendMail;
  }
});

test('Feature A: Validation failure does NOT trigger admin email notification', async () => {
  let sentMailOptions = null;
  const originalSendMail = transporter.sendMail;
  transporter.sendMail = async (options) => {
    sentMailOptions = options;
    return { messageId: 'should-not-be-called' };
  };

  try {
    // Missing title
    const res = await request
      .post('/api/products')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({
        title: '',
        price: 200
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(sentMailOptions, null, 'No email must be sent when validation fails');

    // Negative price
    const res2 = await request
      .post('/api/products')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({
        title: 'Bad Price Item',
        price: -50
      });

    assert.equal(res2.status, 400);
    assert.equal(sentMailOptions, null, 'No email must be sent when price is negative');
  } finally {
    transporter.sendMail = originalSendMail;
  }
});

test('Feature A: SMTP transport error does NOT fail the product creation HTTP response', async () => {
  const originalSendMail = transporter.sendMail;
  transporter.sendMail = async () => {
    throw new Error('Simulated SMTP connection timeout');
  };

  try {
    const pId = 'p_notif_smtp_fail_' + Date.now();
    createdProductIds.push(pId);

    const res = await request
      .post('/api/products')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({
        id: pId,
        title: 'Millet Cookies Pack',
        category: 'Snacks',
        price: 120,
        stockQuantity: 10
      });

    // Product insert succeeded, so response should still be 201 Created
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.product.id, pId);
    assert.equal(res.body.product.status, 'pending');
  } finally {
    transporter.sendMail = originalSendMail;
  }
});

test('Feature A: Missing SMTP configuration safely skips email notification without error', async () => {
  const origSmtpPass = process.env.SMTP_PASSWORD;
  delete process.env.SMTP_PASSWORD;

  let emailSent = false;
  const originalSendMail = transporter.sendMail;
  transporter.sendMail = async () => {
    emailSent = true;
    return {};
  };

  try {
    const pId = 'p_notif_no_smtp_' + Date.now();
    createdProductIds.push(pId);

    const res = await request
      .post('/api/products')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({
        id: pId,
        title: 'Wood Pressed Groundnut Oil 1L',
        category: 'Oils',
        price: 320,
        stockQuantity: 15
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(emailSent, false, 'Email should be skipped when SMTP is unconfigured');
  } finally {
    process.env.SMTP_PASSWORD = origSmtpPass;
    transporter.sendMail = originalSendMail;
  }
});
