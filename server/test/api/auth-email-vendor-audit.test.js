import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_unit_tests_only_32_chars_long';
process.env.ADMIN_EMAIL = 'econnectshopping@gmail.com';
process.env.SMTP_EMAIL = 'econnectshopping@gmail.com';
process.env.SMTP_FROM = 'EcShopping <econnectshopping@gmail.com>';
process.env.SMTP_PASSWORD = 'test-smtp-password';
process.env.SENDER_NAME = 'EcShopping Test';
process.env.FRONTEND_URL = 'https://ecshopping.in';

const { default: app, transporter } = await import('../../index.js');
const { initDatabase, pool } = await import('../../db.js');
const { hashPassword } = await import('../../utils/passwords.js');

const request = supertest(app);

const uid = Date.now();
const testCustomer = {
  id: `c_audit_${uid}`,
  name: 'Audit Customer',
  email: `customer_audit_${uid}@ecshopping.local`,
  password: 'Password123!',
  token: null
};

const testApprovedVendor = {
  id: `v_audit_app_${uid}`,
  name: 'Approved Vendor',
  email: `vendor_app_${uid}@ecshopping.local`,
  password: 'Password123!',
  token: null
};

const testPendingVendor = {
  id: `v_audit_pen_${uid}`,
  name: 'Pending Vendor',
  email: `vendor_pen_${uid}@ecshopping.local`,
  password: 'Password123!'
};

const testDeactivatedVendor = {
  id: `v_audit_deact_${uid}`,
  name: 'Deactivated Vendor',
  email: `vendor_deact_${uid}@ecshopping.local`,
  password: 'Password123!'
};

const testLegacyVendor = {
  id: `v_audit_leg_${uid}`,
  name: 'Legacy Hash Vendor',
  email: `vendor_leg_${uid}@ecshopping.local`,
  password: 'Password123!'
};

const testAdmin = {
  id: `a_audit_${uid}`,
  email: `admin_audit_${uid}@ecshopping.local`,
  password: 'AdminPassword123!',
  token: null
};

// Track dispatched emails in mock transporter
let sentEmails = [];
let originalSendMail = null;

before(async () => {
  await initDatabase();

  originalSendMail = transporter.sendMail;
  transporter.sendMail = async (mailOptions) => {
    sentEmails.push(mailOptions);
    return { messageId: `msg-${Date.now()}` };
  };

  const passwordHash = await hashPassword('Password123!');
  const adminHash = await hashPassword('AdminPassword123!');

  // Seed Customer
  await pool.query(
    'INSERT INTO users (id, name, email, password, password_hash) VALUES (?, ?, ?, "", ?)',
    [testCustomer.id, testCustomer.name, testCustomer.email, passwordHash]
  );

  // Seed Approved Vendor
  await pool.query(
    'INSERT INTO vendors (id, name, email, password, password_hash, status) VALUES (?, ?, ?, "", ?, "approved")',
    [testApprovedVendor.id, testApprovedVendor.name, testApprovedVendor.email, passwordHash]
  );

  // Seed Pending Vendor
  await pool.query(
    'INSERT INTO vendors (id, name, email, password, password_hash, status) VALUES (?, ?, ?, "", ?, "pending")',
    [testPendingVendor.id, testPendingVendor.name, testPendingVendor.email, passwordHash]
  );

  // Seed Deactivated Vendor
  await pool.query(
    'INSERT INTO vendors (id, name, email, password, password_hash, status) VALUES (?, ?, ?, "", ?, "deactivated")',
    [testDeactivatedVendor.id, testDeactivatedVendor.name, testDeactivatedVendor.email, passwordHash]
  );

  // Seed Legacy Vendor (hash stored in legacy `password` column, password_hash empty)
  await pool.query(
    'INSERT INTO vendors (id, name, email, password, password_hash, status) VALUES (?, ?, ?, ?, "", "approved")',
    [testLegacyVendor.id, testLegacyVendor.name, testLegacyVendor.email, passwordHash]
  );

  // Seed Admin
  await pool.query(
    'INSERT INTO admins (id, email, password_hash) VALUES (?, ?, ?)',
    [testAdmin.id, testAdmin.email, adminHash]
  );

  // Login Admin to get token
  const adminRes = await request.post('/api/auth/admin/login').send({
    email: testAdmin.email,
    password: testAdmin.password
  });
  testAdmin.token = adminRes.body.token;

  // Login Approved Vendor to get token
  const vendorRes = await request.post('/api/auth/vendor/login').send({
    email: testApprovedVendor.email,
    password: testApprovedVendor.password
  });
  testApprovedVendor.token = vendorRes.body.token;
});

after(async () => {
  transporter.sendMail = originalSendMail;

  const vendorIds = [testApprovedVendor.id, testPendingVendor.id, testDeactivatedVendor.id, testLegacyVendor.id];
  const allEmails = [testCustomer.email, testApprovedVendor.email, testPendingVendor.email, testDeactivatedVendor.email, testLegacyVendor.email, testAdmin.email];

  await pool.query('DELETE FROM email_verifications WHERE email IN (?)', [allEmails]);
  await pool.query('DELETE FROM password_resets WHERE email IN (?)', [allEmails]);
  await pool.query('DELETE FROM order_items WHERE vendor_id IN (?)', [vendorIds]);
  await pool.query('DELETE FROM products WHERE vendor_id IN (?)', [vendorIds]);
  await pool.query('DELETE FROM users WHERE id = ?', [testCustomer.id]);
  await pool.query('DELETE FROM vendors WHERE id IN (?)', [vendorIds]);
  await pool.query('DELETE FROM admins WHERE id = ?', [testAdmin.id]);
  await pool.end();
});

// ================= TEST SUITE =================

test('1. Vendor Login: Approved vendor with bcrypt password_hash logs in successfully (200)', async () => {
  const res = await request.post('/api/auth/vendor/login').send({
    email: testApprovedVendor.email,
    password: testApprovedVendor.password
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.token);
  assert.equal(res.body.vendor.email, testApprovedVendor.email);
});

test('2. Vendor Login: Legacy hash stored in `password` column logs in and auto-migrates to `password_hash`', async () => {
  const res = await request.post('/api/auth/vendor/login').send({
    email: testLegacyVendor.email,
    password: testLegacyVendor.password
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.token);

  // Check that password_hash is now populated and legacy password column is cleared
  const [rows] = await pool.query('SELECT password, password_hash FROM vendors WHERE id = ?', [testLegacyVendor.id]);
  assert.equal(rows[0].password, '');
  assert.ok(rows[0].password_hash.startsWith('$2'));
});

test('3. Vendor Login: Pending vendor is rejected with 403', async () => {
  const res = await request.post('/api/auth/vendor/login').send({
    email: testPendingVendor.email,
    password: testPendingVendor.password
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /pending admin approval/i);
});

test('4. Vendor Login: Deactivated vendor is rejected with 403', async () => {
  const res = await request.post('/api/auth/vendor/login').send({
    email: testDeactivatedVendor.email,
    password: testDeactivatedVendor.password
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /deactivated/i);
});

test('5. Vendor Login: Cross-role helpful error when customer tries vendor login', async () => {
  const res = await request.post('/api/auth/vendor/login').send({
    email: testCustomer.email,
    password: testCustomer.password
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /customer account/i);
});

test('6. Customer Login: Valid customer logs in successfully (200)', async () => {
  const res = await request.post('/api/auth/user/login').send({
    email: testCustomer.email,
    password: testCustomer.password
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.token);
});

test('7. Customer Login: Cross-role helpful error when vendor tries customer login', async () => {
  const res = await request.post('/api/auth/user/login').send({
    email: testApprovedVendor.email,
    password: testApprovedVendor.password
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /seller account/i);
});

test('8. Forgot Password: Vendor receives password reset email even if requested without role or with customer role', async () => {
  sentEmails = [];

  // Request forgot password for vendor with role: 'customer' (fixing the frontend modal bug)
  const res = await request.post('/api/auth/forgot-password').send({
    email: testApprovedVendor.email,
    role: 'customer'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  // Email must have been dispatched with role=vendor in link!
  assert.equal(sentEmails.length, 1);
  const sentMail = sentEmails[0];
  assert.equal(sentMail.to, testApprovedVendor.email);
  assert.match(sentMail.subject, /Reset your EcShopping.*password/i);
  assert.match(sentMail.html, /\/reset-password\?token=[a-f0-9]+&role=vendor/);

  // Token in database must be saved with role = 'vendor'
  const [tokens] = await pool.query(
    'SELECT id, role, used_at FROM password_resets WHERE email = ? ORDER BY created_at DESC LIMIT 1',
    [testApprovedVendor.email]
  );
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].role, 'vendor');
  assert.equal(tokens[0].used_at, null);
});

test('9. Password Reset: Complete lifecycle (verify token and reset password)', async () => {
  // Extract token from reset email
  const match = sentEmails[0].html.match(/token=([a-f0-9]+)&role=vendor/);
  assert.ok(match, 'Token must be present in email link');
  const rawToken = match[1];

  // Verify token
  const verifyRes = await request.post('/api/auth/verify-reset-token').send({
    token: rawToken,
    role: 'vendor'
  });
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.valid, true);
  assert.equal(verifyRes.body.email, testApprovedVendor.email);

  // Reset password to new password
  const newPassword = 'BrandNewVendorPass123!';
  const resetRes = await request.post('/api/auth/reset-password').send({
    token: rawToken,
    role: 'vendor',
    newPassword
  });
  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.body.success, true);

  // Attempting to reuse the token must fail (single-use token)
  const reuseRes = await request.post('/api/auth/verify-reset-token').send({
    token: rawToken,
    role: 'vendor'
  });
  assert.equal(reuseRes.status, 400);
  assert.equal(reuseRes.body.valid, false);

  // Vendor logs in with new password
  const newLoginRes = await request.post('/api/auth/vendor/login').send({
    email: testApprovedVendor.email,
    password: newPassword
  });
  assert.equal(newLoginRes.status, 200);
  assert.ok(newLoginRes.body.token);

  // Restore old password for subsequent tests
  testApprovedVendor.password = newPassword;
  testApprovedVendor.token = newLoginRes.body.token;
});

test('10. Email Verification: Customer register creates verification token & dispatches verification email', async () => {
  sentEmails = [];
  const newEmail = `new_reg_${Date.now()}@ecshopping.local`;

  const regRes = await request.post('/api/auth/user/register').send({
    name: 'New Registered User',
    email: newEmail,
    password: 'NewUserPassword123!',
    phone: '9876543210'
  });

  assert.equal(regRes.status, 201);
  assert.equal(regRes.body.success, true);

  // Verification email dispatched
  assert.equal(sentEmails.length, 1);
  const sentMail = sentEmails[0];
  assert.equal(sentMail.to, newEmail);
  assert.match(sentMail.subject, /Verify your email/i);
  assert.match(sentMail.html, /\/verify-email\?token=[a-f0-9]+&role=customer/);

  // Token recorded in email_verifications
  const [vRows] = await pool.query('SELECT id, verified_at FROM email_verifications WHERE email = ?', [newEmail]);
  assert.equal(vRows.length, 1);
  assert.equal(vRows[0].verified_at, null);

  // Clean up
  await pool.query('DELETE FROM email_verifications WHERE email = ?', [newEmail]);
  await pool.query('DELETE FROM users WHERE email = ?', [newEmail]);
});

test('11. Email Verification: Token verification succeeds and enforces single-use', async () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const testEmail = `ver_test_${Date.now()}@ecshopping.local`;

  await pool.query(
    'INSERT INTO email_verifications (id, email, role, token_hash, expires_at) VALUES (?, ?, "vendor", ?, DATE_ADD(NOW(), INTERVAL 1 DAY))',
    [`ev_${Date.now()}`, testEmail, tokenHash]
  );

  // Verify valid token
  const verifyRes = await request.post('/api/auth/verify-email').send({
    token: rawToken,
    role: 'vendor'
  });
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.success, true);
  assert.match(verifyRes.body.message, /verified successfully/i);

  // Calling again returns alreadyVerified
  const secondRes = await request.post('/api/auth/verify-email').send({
    token: rawToken,
    role: 'vendor'
  });
  assert.equal(secondRes.status, 200);
  assert.equal(secondRes.body.alreadyVerified, true);

  // Cleanup
  await pool.query('DELETE FROM email_verifications WHERE email = ?', [testEmail]);
});

test('12. Email Verification: Resend verification email enforces cooldown (429)', async () => {
  // First request generates email
  sentEmails = [];
  const resend1 = await request.post('/api/auth/resend-verification').send({
    email: testCustomer.email,
    role: 'customer'
  });
  assert.equal(resend1.status, 200);
  assert.equal(resend1.body.success, true);
  assert.equal(sentEmails.length, 1);

  // Immediate second request must trigger cooldown (429)
  const resend2 = await request.post('/api/auth/resend-verification').send({
    email: testCustomer.email,
    role: 'customer'
  });
  assert.equal(resend2.status, 429);
  assert.match(resend2.body.error, /wait a minute/i);
});

test('13. Vendor Add Product: Admin email notification Anti-Spoofing & details verification', async () => {
  sentEmails = [];
  const prodTitle = `Audit Test Product ${Date.now()}`;

  const res = await request
    .post('/api/products')
    .set('Authorization', `Bearer ${testApprovedVendor.token}`)
    .send({
      title: prodTitle,
      category: 'Electronics',
      price: 1999,
      unit: 'piece',
      stockStatus: 'in_stock',
      stockQuantity: 10
    });

  assert.equal(res.status, 201);
  const createdProd = res.body.product;

  // Verify admin notification email
  assert.equal(sentEmails.length, 1);
  const adminMail = sentEmails[0];

  assert.equal(adminMail.to, process.env.ADMIN_EMAIL);
  // CRITICAL ANTI-SPOOFING CHECK: 'from' MUST NOT spoof the vendor's email address!
  assert.ok(!adminMail.from.includes(testApprovedVendor.email), 'SMTP From must never spoof vendor address');
  assert.ok(adminMail.from.includes(process.env.SMTP_EMAIL), 'SMTP From must use authenticated SMTP address');
  assert.equal(adminMail.replyTo, testApprovedVendor.email, 'Reply-To should route replies to the vendor');

  // Verify submission details in email body
  assert.match(adminMail.html, new RegExp(prodTitle));
  assert.match(adminMail.html, new RegExp(createdProd.id));
  assert.match(adminMail.html, new RegExp(testApprovedVendor.name));
  assert.match(adminMail.html, /1999/);
  assert.match(adminMail.html, /\/admin\?tab=products/);
});

test('14. Bi-directional: Admin approves product -> Vendor receives notification email', async () => {
  // Create a product to approve
  const prodTitle = `Audit Status Product ${Date.now()}`;
  const prodRes = await request
    .post('/api/products')
    .set('Authorization', `Bearer ${testApprovedVendor.token}`)
    .send({
      title: prodTitle,
      category: 'Electronics',
      price: 2499,
      unit: 'piece',
      stockStatus: 'in_stock',
      stockQuantity: 5
    });

  const createdProd = prodRes.body.product;

  sentEmails = [];
  const approveRes = await request
    .put(`/api/products/${createdProd.id}/status`)
    .set('Authorization', `Bearer ${testAdmin.token}`)
    .send({ status: 'approved' });

  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.product.status, 'approved');

  // Vendor must receive approval notification email
  assert.equal(sentEmails.length, 1);
  const vendorProdMail = sentEmails[0];
  assert.equal(vendorProdMail.to, testApprovedVendor.email);
  assert.match(vendorProdMail.subject, /product has been approved/i);
  assert.match(vendorProdMail.html, new RegExp(`/product/${createdProd.id}`));
});

test('15. Admin Remove Vendor: Active unfulfilled customer order prevents vendor removal (400)', async () => {
  const orderId = `ord_audit_${Date.now()}`;

  // Insert active unfulfilled order
  await pool.query(
    'INSERT INTO orders (id, customer_email, total, status) VALUES (?, "test@ecshopping.local", 1999, "Processing")',
    [orderId]
  );
  await pool.query(
    'INSERT INTO order_items (order_id, vendor_id, vendor_name, title, price, quantity) VALUES (?, ?, ?, "Item", 1999, 1)',
    [orderId, testApprovedVendor.id, testApprovedVendor.name]
  );

  // Attempt to delete vendor with active order
  const delRes = await request
    .delete(`/api/vendors/${testApprovedVendor.id}`)
    .set('Authorization', `Bearer ${testAdmin.token}`);

  assert.equal(delRes.status, 400);
  assert.equal(delRes.body.success, false);
  assert.match(delRes.body.error, /active, unfulfilled customer orders/i);

  // Clean up order
  await pool.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
  await pool.query('DELETE FROM orders WHERE id = ?', [orderId]);
});

test('16. Admin Remove Vendor: Safe deactivation preserves order history & archives products', async () => {
  sentEmails = [];

  // Vendor has products created earlier; deletion should soft-deactivate and archive products
  const delRes = await request
    .delete(`/api/vendors/${testApprovedVendor.id}`)
    .set('Authorization', `Bearer ${testAdmin.token}`);

  assert.equal(delRes.status, 200);
  assert.equal(delRes.body.success, true);
  assert.equal(delRes.body.mode, 'deactivated');

  // Verify vendor status is deactivated in DB
  const [vRows] = await pool.query('SELECT status FROM vendors WHERE id = ?', [testApprovedVendor.id]);
  assert.equal(vRows[0].status, 'deactivated');

  // Verify vendor's products are archived
  const [pRows] = await pool.query('SELECT status FROM products WHERE vendor_id = ?', [testApprovedVendor.id]);
  for (const prod of pRows) {
    assert.equal(prod.status, 'archived');
  }

  // Deactivated vendor can no longer log in
  const loginRes = await request.post('/api/auth/vendor/login').send({
    email: testApprovedVendor.email,
    password: testApprovedVendor.password
  });
  assert.equal(loginRes.status, 403);
  assert.match(loginRes.body.error, /deactivated/i);
});

test('17. Admin Remove Vendor: Vendor with 0 orders and 0 products is hard deleted', async () => {
  const tempVendorId = `v_clean_${Date.now()}`;
  const tempEmail = `clean_vendor_${Date.now()}@ecshopping.local`;
  const passHash = await hashPassword('TempPass123!');

  await pool.query(
    'INSERT INTO vendors (id, name, email, password, password_hash, status) VALUES (?, "Clean Vendor", ?, "", ?, "pending")',
    [tempVendorId, tempEmail, passHash]
  );

  const delRes = await request
    .delete(`/api/vendors/${tempVendorId}`)
    .set('Authorization', `Bearer ${testAdmin.token}`);

  assert.equal(delRes.status, 200);
  assert.equal(delRes.body.success, true);
  assert.equal(delRes.body.mode, 'deleted');

  // Verify vendor row is gone from DB
  const [vRows] = await pool.query('SELECT id FROM vendors WHERE id = ?', [tempVendorId]);
  assert.equal(vRows.length, 0);
});
