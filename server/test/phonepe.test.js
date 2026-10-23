// PhonePe payment integration tests. Network-dependent claims are NOT
// exercised here (sandbox credentials are required and human-owned). This
// suite covers: pure state mapping, paisa validation, token-cache reset and
// the fail-closed 503 behavior of the payment routes when no credentials are
// configured. Sandbox end-to-end runs are gated on real credentials.
process.env.DB_NAME = 'ecshopping_test';

// Ensure no payment credentials are present for this process so the
// fail-closed assertions are deterministic.
for (const key of ['PHONEPE_CLIENT_ID', 'PHONEPE_CLIENT_VERSION', 'PHONEPE_CLIENT_SECRET', 'PHONEPE_REDIRECT_URL']) {
  delete process.env[key];
}

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

const { default: app } = await import('../index.js');
const { initDatabase, pool } = await import('../db.js');
const { validatePhonePeConfig, mapPhonePeState, assertPaisa, resetTokenCache } = await import('../utils/phonepe.js');

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
