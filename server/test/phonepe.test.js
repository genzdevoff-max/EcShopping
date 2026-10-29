// PhonePe payment integration tests. Network-dependent claims are NOT
// exercised here (sandbox credentials are required and human-owned). This
// suite covers: pure state mapping, paisa validation, token-cache reset and
// the fail-closed 503 behavior of the payment routes when no credentials are
// configured. Sandbox end-to-end runs are gated on real credentials.
process.env.DB_NAME = 'ecshopping_test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

const { default: app } = await import('../index.js');
const { initDatabase, pool } = await import('../db.js');
const {
  validatePhonePeConfig,
  mapPhonePeState,
  assertPaisa,
  resetTokenCache,
  sanitizeMerchantUserId,
  getFrontendOrigin,
  getPhonePeRedirectUrl,
  getPhonePeCallbackUrl
} = await import('../utils/phonepe.js');

// Ensure no payment credentials are present for this process so the
// fail-closed assertions are deterministic (must run after index.js dotenv.config()).
for (const key of [
  'PHONEPE_CLIENT_ID', 'PHONEPE_CLIENT_VERSION', 'PHONEPE_CLIENT_SECRET', 'PHONEPE_REDIRECT_URL',
  'PHONEPE_MERCHANT_ID', 'PHONEPE_SALT_KEY', 'PHONEPE_SALT_INDEX', 'phonepe_merchant_id', 'phonepe_salt_key'
]) {
  delete process.env[key];
}

before(async () => {
  await initDatabase();
});

after(async () => {
  await pool.end();
});

const request = () => supertest(app);

test('PhonePe config validation lists missing keys without leaking values', () => {
  const check = validatePhonePeConfig();
  assert.equal(check.ok, false);
  assert.ok(check.missing.includes('PHONEPE_CLIENT_ID'));
  assert.ok(check.missing.includes('PHONEPE_REDIRECT_URL'));
  for (const key of check.missing) {
    assert.equal(process.env[key], undefined, 'missing keys must be absent, not blank-but-set');
  }
});

test('state mapping follows the documented root-state contract only', () => {
  assert.equal(mapPhonePeState('COMPLETED'), 'paid');
  assert.equal(mapPhonePeState('PENDING'), 'pending');
  assert.equal(mapPhonePeState('FAILED'), 'failed');
  assert.equal(mapPhonePeState('EXPIRED'), 'failed');
  assert.equal(mapPhonePeState('CANCELLED_BY_USER'), 'failed');
  // Unknown/unexpected values must resolve to pending, never to paid.
  assert.equal(mapPhonePeState(''), 'pending');
  assert.equal(mapPhonePeState('weird-GATEWAY-state'), 'pending');
  assert.equal(mapPhonePeState(null), 'pending');
});

test('amount validation enforces the gateway paisa constraints', () => {
  assert.equal(assertPaisa(1000), true, '₹10 == 1000 paisa');
  assert.equal(assertPaisa(100), true, 'minimum 100 paisa');
  assert.equal(assertPaisa(99), false, 'below minimum');
  assert.equal(assertPaisa(100.5), false, 'fractional paisa rejected');
  assert.equal(assertPaisa(0), false);
  assert.equal(assertPaisa(-5000), false, 'no negatives');
});

test('token cache can be reset between processes', () => {
  assert.doesNotThrow(() => resetTokenCache());
});

test('POST /api/payments/phonepe/create-payment fails closed (503) without credentials', async () => {
  const res = await request()
    .post('/api/payments/phonepe/create-payment')
    .send({ orderId: 'ORD-UNIT-901' });
  assert.equal(res.status, 503);
  assert.equal(res.body.success, false);
  assert.equal(res.body.missingConfig, true);
  assert.ok(!('redirectUrl' in res.body), 'no redirect may be issued without configuration');
});

test('POST /api/payments/phonepe/create-payment 400 without an order id', async () => {
  const res = await request().post('/api/payments/phonepe/create-payment').send({});
  assert.equal(res.status, 400);
});

test('POST /api/payments/phonepe/verify 404s unknown orders and never fabricates success', async () => {
  const res = await request()
    .post('/api/payments/phonepe/verify')
    .send({ orderId: 'ORD-UNIT-DOES-NOT-EXIST' });
  assert.equal([404, 503].includes(res.status), true, '404 when configured, 503 when the gateway is unconfigured');
  assert.equal(res.body.success, false);
  assert.ok(res.body.paymentStatus == null || res.body.paymentStatus !== 'paid', 'no phantom paid states');
});

test('Option A: validatePhonePeConfig detects Hermes PG v1 mode when merchant ID and salt key are set', () => {
  const mockEnv = {
    PHONEPE_MERCHANT_ID: 'MOCK_MERCHANT',
    PHONEPE_SALT_KEY: 'mock-salt-key',
    PHONEPE_SALT_INDEX: '1',
    PHONEPE_REDIRECT_URL: 'https://example.com/return'
  };
  const check = validatePhonePeConfig(mockEnv);
  assert.equal(check.ok, true);
  assert.equal(check.mode, 'v1');
});

test('Option A: mapPhonePeState maps v1 response codes accurately', () => {
  assert.equal(mapPhonePeState('PAYMENT_SUCCESS'), 'paid');
  assert.equal(mapPhonePeState('SUCCESS'), 'paid');
  assert.equal(mapPhonePeState('PAYMENT_ERROR'), 'failed');
  assert.equal(mapPhonePeState('PAYMENT_DECLINED'), 'failed');
  assert.equal(mapPhonePeState('PAYMENT_PENDING'), 'pending');
});

test('sanitizeMerchantUserId strictly enforces PhonePe alphanumeric and length requirements', () => {
  // Strips special characters like @ and . from emails
  const user1 = sanitizeMerchantUserId('customer@example.com', 'ORD-123456');
  assert.equal(/^[a-zA-Z0-9]{1,35}$/.test(user1), true);
  assert.equal(user1.includes('@'), false);
  assert.equal(user1.includes('.'), false);

  // Fallback when raw ID is empty or invalid
  const fallback = sanitizeMerchantUserId('', 'ORD-987654');
  assert.equal(fallback, 'MUIDORD987654');
  assert.equal(/^[a-zA-Z0-9]{1,35}$/.test(fallback), true);

  // Length clamping to under 36 characters
  const veryLong = sanitizeMerchantUserId('A'.repeat(50), 'ORD-1');
  assert.equal(veryLong.length, 35);
  assert.equal(/^[a-zA-Z0-9]{1,35}$/.test(veryLong), true);
});

test('getFrontendOrigin safely resolves canonical storefront origins', () => {
  // Explicit FRONTEND_URL configuration
  assert.equal(getFrontendOrigin({ FRONTEND_URL: 'https://ecshopping.in' }), 'https://ecshopping.in');
  assert.equal(getFrontendOrigin({ FRONTEND_URL: 'https://ecshopping.in/' }), 'https://ecshopping.in');
  assert.equal(getFrontendOrigin({ FRONTEND_URL: 'http://localhost:5173' }), 'http://localhost:5173');

  // Fallback in production mode
  assert.equal(getFrontendOrigin({ NODE_ENV: 'production' }), 'https://ecshopping.in');
  assert.equal(getFrontendOrigin({ PHONEPE_ENV: 'production' }), 'https://ecshopping.in');
  assert.equal(getFrontendOrigin({ PHONEPE_ENV: 'prod' }), 'https://ecshopping.in');

  // Fallback in local/development mode
  assert.equal(getFrontendOrigin({ NODE_ENV: 'development' }), 'http://localhost:5173');
  assert.equal(getFrontendOrigin({}), 'http://localhost:5173');

  // Malformed URL safely falls back to environment default
  assert.equal(getFrontendOrigin({ FRONTEND_URL: 'not-a-valid-url', NODE_ENV: 'production' }), 'https://ecshopping.in');
});

test('getPhonePeRedirectUrl constructs valid canonical return URLs', () => {
  // Explicit override takes precedence when valid
  assert.equal(
    getPhonePeRedirectUrl({ PHONEPE_REDIRECT_URL: 'https://custom.ecshopping.in/return' }),
    'https://custom.ecshopping.in/return'
  );

  // Derived from FRONTEND_URL
  assert.equal(
    getPhonePeRedirectUrl({ FRONTEND_URL: 'https://ecshopping.in' }),
    'https://ecshopping.in/payment/phonepe/return'
  );

  // Production default
  assert.equal(
    getPhonePeRedirectUrl({ NODE_ENV: 'production' }),
    'https://ecshopping.in/payment/phonepe/return'
  );

  // Development default
  assert.equal(
    getPhonePeRedirectUrl({ NODE_ENV: 'development' }),
    'http://localhost:5173/payment/phonepe/return'
  );
});

test('getPhonePeCallbackUrl isolates server webhooks from browser return URLs', () => {
  // Explicit webhook setting
  assert.equal(
    getPhonePeCallbackUrl({ PHONEPE_CALLBACK_URL: 'https://my-backend.app/callback' }),
    'https://my-backend.app/callback'
  );

  // Production backend callback URL default
  assert.equal(
    getPhonePeCallbackUrl({ NODE_ENV: 'production' }),
    'https://ec-shopping-three.vercel.app/api/payments/phonepe/callback'
  );

  // Development backend callback URL default
  assert.equal(
    getPhonePeCallbackUrl({ NODE_ENV: 'development' }),
    'http://localhost:5000/api/payments/phonepe/callback'
  );
});

test('POST /api/payments/phonepe/callback handles webhook verification and validation safely', async () => {
  // Missing order reference returns 400
  const missingRes = await request()
    .post('/api/payments/phonepe/callback')
    .send({});
  assert.equal(missingRes.status, 400);
  assert.equal(missingRes.body.success, false);

  // Unknown order returns 404
  const unknownRes = await request()
    .post('/api/payments/phonepe/callback')
    .send({ orderId: 'ORD-NON-EXISTENT-XYZ', state: 'COMPLETED' });
  assert.equal(unknownRes.status, 404);
  assert.equal(unknownRes.body.success, false);
});
