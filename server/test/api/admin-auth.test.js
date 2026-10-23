// API tests hit the app inside a test process against the ecshopping_test
// database (DB_NAME is overridden before the app module imports db.js).
// dotenv.config() inside db.js never overrides an already-set env var.
process.env.DB_NAME = 'ecshopping_test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

const { default: app } = await import('../../index.js');
const { initDatabase } = await import('../../db.js');
const { hashPassword, verifyHash } = await import('../../utils/passwords.js');
const { signToken } = await import('../../middleware/auth.js');
const { pool } = await import('../../db.js');

const TEST_ADMIN = {
  id: 'a-test-001',
  email: 'unit-admin@ecshopping.test',
  password: 'unit-admin-pass-123'
};

before(async () => {
  await initDatabase();
  // Fresh, synthetic admin row (test DB only — never touches prod credentials).
  await pool.query('DELETE FROM admins');
  await pool.query(
    'INSERT INTO admins (id, email, password_hash) VALUES (?, ?, ?)',
    [TEST_ADMIN.id, TEST_ADMIN.email, await hashPassword(TEST_ADMIN.password)]
  );
});

after(async () => {
  await pool.query('DELETE FROM admins');
  await pool.end();
});

const request = () => supertest(app);

test('POST /api/auth/admin/login 400 when fields are missing', async () => {
  const res = await request().post('/api/auth/admin/login').send({});
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('POST /api/auth/admin/login 401 for an unknown email', async () => {
  const res = await request()
    .post('/api/auth/admin/login')
    .send({ email: 'nobody@ecshopping.test', password: TEST_ADMIN.password });
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('POST /api/auth/admin/login 401 for a wrong password', async () => {
  const res = await request()
    .post('/api/auth/admin/login')
    .send({ email: TEST_ADMIN.email, password: 'definitely-wrong-pass' });
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'Invalid email or password');
});

test('POST /api/auth/admin/login 200 + admin token for valid credentials', async () => {
  const res = await request()
    .post('/api/auth/admin/login')
    .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.role, 'admin');
  assert.ok(res.body.token, 'token must be present');
  // The stored hash must be bcrypt-verified (not plaintext comparison).
  const [rows] = await pool.query('SELECT password_hash FROM admins WHERE id = ?', [TEST_ADMIN.id]);
  assert.ok(await verifyHash(TEST_ADMIN.password, rows[0].password_hash));
});

test('GET /api/vendors 401 without a token', async () => {
  const res = await request().get('/api/vendors');
  assert.equal(res.status, 401);
});

test('GET /api/vendors 200 with an admin token (no password fields leaked)', async () => {
  const token = signToken({ sub: TEST_ADMIN.id, role: 'admin', email: TEST_ADMIN.email, name: 'Tester' });
  const res = await request().get('/api/vendors').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  const vendors = Array.isArray(res.body) ? res.body : res.body.vendors;
  assert.ok(Array.isArray(vendors), 'vendors list should be an array');
  for (const v of vendors) {
    assert.equal(v.password, undefined, 'password must never appear');
    assert.equal(v.passwordHash, undefined, 'password_hash must never appear');
  }
});

test('GET /api/users 401 without a token', async () => {
  const res = await request().get('/api/users');
  assert.equal(res.status, 401);
  assert.ok(!('users' in res.body), 'no payload may leak without the token');
});

test('GET /api/users 200 with an admin token (restrained customer fields only)', async () => {
  const token = signToken({ sub: TEST_ADMIN.id, role: 'admin', email: TEST_ADMIN.email, name: 'Tester' });
  const res = await request().get('/api/users').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.users), 'users list should be an array');
  for (const u of res.body.users) {
    assert.ok(u.id && u.email, 'each row is a customer account');
    assert.equal(u.password, undefined, 'password must never appear');
    assert.equal(u.passwordHash, undefined, 'password_hash must never appear');
    assert.ok('createdAt' in u, 'registration time is exposed');
    assert.ok(!('password_hash' in u) && !('password' in u));
  }
});
