import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'ecshopping_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_unit_tests_only_32_chars_long';
process.env.ADMIN_EMAIL = 'admin-reset-test@ecshopping.local';
process.env.SMTP_EMAIL = 'smtp-sender@ecshopping.local';
process.env.SMTP_PASSWORD = 'fake-test-password';
process.env.SENDER_NAME = 'EcShopping Test';
process.env.FRONTEND_URL = 'http://localhost:5173';

const { default: app, transporter } = await import('../../index.js');
const { initDatabase, pool } = await import('../../db.js');
const { hashPassword } = await import('../../utils/passwords.js');

const request = supertest(app);

const testCustomer = {
  id: 'c_reset_' + Date.now(),
  name: 'Reset Test Customer',
  email: 'cust_reset_test@ecshopping.local',
  oldPassword: 'OldPassword123!',
  newPassword: 'BrandNewPassword123!'
};

const testVendor = {
  id: 'v_reset_' + Date.now(),
  name: 'Reset Test Vendor',
  email: 'vendor_reset_test@ecshopping.local',
  oldPassword: 'OldPassword123!',
  newPassword: 'BrandNewVendorPass123!'
};

const testAdmin = {
  id: 'a_reset_' + Date.now(),
  email: 'admin_reset_test@ecshopping.local',
  oldPassword: 'OldAdminPassword123!',
  newPassword: 'BrandNewAdminPassword123!'
};

before(async () => {
  await initDatabase();

  const customerHash = await hashPassword(testCustomer.oldPassword);
  await pool.query(
    `INSERT INTO users (id, name, email, password, password_hash)
     VALUES (?, ?, ?, '', ?)
     ON DUPLICATE KEY UPDATE password_hash = ?`,
    [testCustomer.id, testCustomer.name, testCustomer.email, customerHash, customerHash]
  );

  const vendorHash = await hashPassword(testVendor.oldPassword);
  await pool.query(
    `INSERT INTO vendors (id, name, email, password, password_hash, status)
     VALUES (?, ?, ?, '', ?, 'approved')
     ON DUPLICATE KEY UPDATE password_hash = ?, status = 'approved'`,
    [testVendor.id, testVendor.name, testVendor.email, vendorHash, vendorHash]
  );

  const adminHash = await hashPassword(testAdmin.oldPassword);
  await pool.query(
    `INSERT INTO admins (id, email, password_hash)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = ?`,
    [testAdmin.id, testAdmin.email, adminHash, adminHash]
  );
});

after(async () => {
  await pool.query('DELETE FROM password_resets WHERE email IN (?, ?, ?)', [
    testCustomer.email,
    testVendor.email,
    testAdmin.email
  ]);
  await pool.query('DELETE FROM users WHERE id = ?', [testCustomer.id]);
  await pool.query('DELETE FROM vendors WHERE id = ?', [testVendor.id]);
  await pool.query('DELETE FROM admins WHERE id = ?', [testAdmin.id]);
  await pool.end();
});

test('Feature B1: Forgot password generates token and sends email for valid customer', async () => {
  let sentMailOptions = null;
  const originalSendMail = transporter.sendMail;
  transporter.sendMail = async (options) => {
    sentMailOptions = options;
    return { messageId: 'msg-reset-test' };
  };

  try {
    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: testCustomer.email, role: 'customer' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.match(res.body.message, /password reset link has been sent/i);

    assert.ok(sentMailOptions, 'transporter.sendMail should be invoked');
    assert.equal(sentMailOptions.to, testCustomer.email);
    assert.match(sentMailOptions.subject, /Reset your EcShopping.*password/i);
    assert.match(sentMailOptions.html, /\/reset-password\?token=[a-f0-9]+&role=customer/i);

    // Verify token exists in database
    const [resets] = await pool.query(
      'SELECT id, role, used_at FROM password_resets WHERE email = ? AND role = "customer"',
      [testCustomer.email]
    );
    assert.ok(resets.length >= 1, 'Token must be recorded in password_resets table');
    assert.equal(resets[0].used_at, null, 'Newly created token must not be marked used');
  } finally {
    transporter.sendMail = originalSendMail;
  }
});

test('Feature B2: Forgot password is enumeration safe for non-existent accounts', async () => {
  let emailSent = false;
  const originalSendMail = transporter.sendMail;
  transporter.sendMail = async () => {
    emailSent = true;
    return { messageId: 'msg-never' };
  };

  try {
    const nonExistentEmail = 'definitely_does_not_exist_9988@ecshopping.local';
    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: nonExistentEmail, role: 'customer' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.match(res.body.message, /password reset link has been sent/i);
    assert.equal(emailSent, false, 'Email should not be sent for non-existent account');

    const [rows] = await pool.query(
      'SELECT id FROM password_resets WHERE email = ?',
      [nonExistentEmail]
    );
    assert.equal(rows.length, 0, 'No reset token should be recorded for non-existent account');
  } finally {
    transporter.sendMail = originalSendMail;
  }
});

test('Feature B3: Forgot password works for vendor and admin accounts', async () => {
  let sentVendEmail = false;
  let sentAdminEmail = false;
  const originalSendMail = transporter.sendMail;
  transporter.sendMail = async (opts) => {
    if (opts.to === testVendor.email) sentVendEmail = true;
    if (opts.to === testAdmin.email) sentAdminEmail = true;
    return { messageId: 'msg-vendor-admin' };
  };

  try {
    const vRes = await request
      .post('/api/auth/forgot-password')
      .send({ email: testVendor.email, role: 'vendor' });
    assert.equal(vRes.status, 200);
    assert.equal(sentVendEmail, true);

    const aRes = await request
      .post('/api/auth/forgot-password')
      .send({ email: testAdmin.email, role: 'admin' });
    assert.equal(aRes.status, 200);
    assert.equal(sentAdminEmail, true);
  } finally {
    transporter.sendMail = originalSendMail;
  }
});

test('Feature B4: Token verification handles valid, invalid, expired, and role-mismatched tokens', async () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const validResetId = 'pr_test_valid_' + Date.now();
  const futureDate = new Date(Date.now() + 3600000);

  await pool.query(
    'INSERT INTO password_resets (id, email, role, token_hash, expires_at) VALUES (?, ?, "customer", ?, ?)',
    [validResetId, testCustomer.email, tokenHash, futureDate]
  );

  // Valid token check
  const validRes = await request
    .post('/api/auth/verify-reset-token')
    .send({ token: rawToken, role: 'customer' });
  assert.equal(validRes.status, 200);
  assert.equal(validRes.body.valid, true);
  assert.equal(validRes.body.email, testCustomer.email);

  // Role mismatch check (customer token verified as vendor)
  const roleMismatchRes = await request
    .post('/api/auth/verify-reset-token')
    .send({ token: rawToken, role: 'vendor' });
  assert.equal(roleMismatchRes.status, 400);
  assert.equal(roleMismatchRes.body.valid, false);

  // Non-existent token check
  const badTokenRes = await request
    .post('/api/auth/verify-reset-token')
    .send({ token: 'fabricated_invalid_token', role: 'customer' });
  assert.equal(badTokenRes.status, 400);
  assert.equal(badTokenRes.body.valid, false);

  // Expired token check
  const expiredToken = crypto.randomBytes(32).toString('hex');
  const expiredHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
  const pastDate = new Date(Date.now() - 3600000);
  await pool.query(
    'INSERT INTO password_resets (id, email, role, token_hash, expires_at) VALUES (?, ?, "customer", ?, ?)',
    ['pr_test_exp_' + Date.now(), testCustomer.email, expiredHash, pastDate]
  );

  const expRes = await request
    .post('/api/auth/verify-reset-token')
    .send({ token: expiredToken, role: 'customer' });
  assert.equal(expRes.status, 400);
  assert.equal(expRes.body.valid, false);
  assert.match(expRes.body.error, /expired/i);
});

test('Feature B5: Reset password enforces policy, updates credentials, and invalidates single-use token', async () => {
  // 1. Setup fresh customer token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const resetId = 'pr_test_reset_' + Date.now();
  await pool.query(
    'INSERT INTO password_resets (id, email, role, token_hash, expires_at) VALUES (?, ?, "customer", ?, ?)',
    [resetId, testCustomer.email, tokenHash, new Date(Date.now() + 3600000)]
  );

  // 2. Reject short password (< 8 chars)
  const shortPassRes = await request
    .post('/api/auth/reset-password')
    .send({ token: rawToken, role: 'customer', newPassword: 'short' });
  assert.equal(shortPassRes.status, 400);
  assert.match(shortPassRes.body.error, /8 characters/i);

  // 3. Reset password successfully
  const resetRes = await request
    .post('/api/auth/reset-password')
    .send({ token: rawToken, role: 'customer', newPassword: testCustomer.newPassword });
  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.body.success, true);

  // 4. Single-use: Reusing the same token fails
  const reuseRes = await request
    .post('/api/auth/reset-password')
    .send({ token: rawToken, role: 'customer', newPassword: testCustomer.newPassword });
  assert.equal(reuseRes.status, 400);
  assert.match(reuseRes.body.error, /already used|invalid/i);

  // 5. Old password login is rejected
  const oldLoginRes = await request
    .post('/api/auth/user/login')
    .send({ email: testCustomer.email, password: testCustomer.oldPassword });
  assert.equal(oldLoginRes.status, 401);

  // 6. New password login succeeds
  const newLoginRes = await request
    .post('/api/auth/user/login')
    .send({ email: testCustomer.email, password: testCustomer.newPassword });
  assert.equal(newLoginRes.status, 200);
  assert.equal(newLoginRes.body.success, true);
  assert.ok(newLoginRes.body.token);
});

test('Feature B6: Reset password enforces 12-char minimum policy for admin accounts', async () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const resetId = 'pr_test_admin_' + Date.now();
  await pool.query(
    'INSERT INTO password_resets (id, email, role, token_hash, expires_at) VALUES (?, ?, "admin", ?, ?)',
    [resetId, testAdmin.email, tokenHash, new Date(Date.now() + 3600000)]
  );

  // 11 characters (< 12) must fail for admin
  const shortAdminRes = await request
    .post('/api/auth/reset-password')
    .send({ token: rawToken, role: 'admin', newPassword: 'AdminPass99' });
  assert.equal(shortAdminRes.status, 400);
  assert.match(shortAdminRes.body.error, /12 characters/i);

  // 12+ characters must succeed for admin
  const validAdminRes = await request
    .post('/api/auth/reset-password')
    .send({ token: rawToken, role: 'admin', newPassword: testAdmin.newPassword });
  assert.equal(validAdminRes.status, 200);
  assert.equal(validAdminRes.body.success, true);

  // New admin password login succeeds
  const adminLoginRes = await request
    .post('/api/auth/admin/login')
    .send({ email: testAdmin.email, password: testAdmin.newPassword });
  assert.equal(adminLoginRes.status, 200);
  assert.equal(adminLoginRes.body.success, true);
});

test('Feature B7: SMTP transmission failure returns 503 and does not falsely claim email was sent', async () => {
  const originalSendMail = transporter.sendMail;
  transporter.sendMail = async () => {
    const err = new Error('Data command failed: 550-5.4.5 Daily user sending limit exceeded.');
    err.code = 'EENVELOPE';
    err.responseCode = 550;
    err.response = '550-5.4.5 Daily user sending limit exceeded.';
    throw err;
  };

  try {
    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: testCustomer.email, role: 'customer' });

    assert.equal(res.status, 503, 'Must return HTTP 503 when SMTP transmission fails');
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /unavailable|unable to dispatch/i);
  } finally {
    transporter.sendMail = originalSendMail;
  }
});

test('Feature B8: Reset link contains canonical production URL and secure token', async () => {
  let capturedHtml = '';
  const originalSendMail = transporter.sendMail;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  delete process.env.FRONTEND_URL; // Test canonical default

  transporter.sendMail = async (opts) => {
    capturedHtml = opts.html || '';
    return { messageId: 'msg-canonical-test', response: '250 OK' };
  };

  try {
    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: testVendor.email, role: 'vendor' });

    assert.equal(res.status, 200);
    assert.match(capturedHtml, /https:\/\/ecshopping\.in\/reset-password\?token=[a-f0-9]{64}&role=vendor/);
  } finally {
    transporter.sendMail = originalSendMail;
    if (originalFrontendUrl) process.env.FRONTEND_URL = originalFrontendUrl;
  }
});

test('Feature B9: Auto-detection of role when role is omitted in forgot-password', async () => {
  let capturedRole = '';
  const originalSendMail = transporter.sendMail;
  transporter.sendMail = async (opts) => {
    if (opts.html.includes('role=vendor')) capturedRole = 'vendor';
    if (opts.html.includes('role=customer')) capturedRole = 'customer';
    return { messageId: 'msg-auto-detect', response: '250 OK' };
  };

  try {
    // Send without role for testVendor
    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: testVendor.email });

    assert.equal(res.status, 200);
    assert.equal(capturedRole, 'vendor', 'Should auto-detect vendor role when registered in vendors table');
  } finally {
    transporter.sendMail = originalSendMail;
  }
});
