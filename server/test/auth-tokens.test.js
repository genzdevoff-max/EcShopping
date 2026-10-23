import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// auth.js exits when JWT_SECRET is missing, so dotenv must run before this import.
const { signToken, verifyToken, requireAuth } = await import('../middleware/auth.js');

test('signToken round-trips through verifyToken', () => {
  const token = signToken({ sub: 'u123', role: 'customer', email: 'u@test.dev', name: 'Unit User' });
  const payload = verifyToken(token);
  assert.ok(payload, 'token should verify');
  assert.equal(payload.sub, 'u123');
  assert.equal(payload.role, 'customer');
  assert.equal(payload.email, 'u@test.dev');
});

test('vendor tokens carry vendorId equal to sub', () => {
  const token = signToken({ sub: 'v42', role: 'vendor', email: 'v@test.dev', name: 'Vendor' });
  const payload = verifyToken(token);
  assert.equal(payload.vendorId, 'v42');
});

test('admin tokens do not carry vendorId', () => {
  const token = signToken({ sub: 'a1', role: 'admin', email: 'a@test.dev', name: 'Administrator' });
  const payload = verifyToken(token);
  assert.equal(payload.vendorId, undefined);
});

test('verifyToken returns null for garbage or tampered tokens', () => {
  assert.equal(verifyToken('not-a-jwt'), null);
  assert.equal(verifyToken(''), null);
  assert.equal(verifyToken(null), null);
  const token = signToken({ sub: 'u1', role: 'customer' });
  const tampered = token.slice(0, -8) + ('' + token.slice(-8)).split('').reverse().join('');
  assert.equal(verifyToken(tampered), null, 'a flipped signature must fail verification');
});

test('expired tokens verify to null', () => {
  const expired = jwt.sign(
    { sub: 'u1', role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: '-1s' }
  );
  assert.equal(verifyToken(expired), null);
});

test('requireAuth rejects requests without a Bearer token', () => {
  const middleware = requireAuth('admin');
  const fakeRes = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  middleware({ headers: {} }, fakeRes, () => { throw new Error('next() must not run'); });
  assert.equal(fakeRes.statusCode, 401);
});

test('requireAuth enforces the role whitelist', () => {
  const middleware = requireAuth('admin');
  const token = signToken({ sub: 'v1', role: 'vendor' });
  const fakeRes = {
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  middleware({ headers: { authorization: `Bearer ${token}` } }, fakeRes, () => { throw new Error('next() must not run'); });
  assert.equal(fakeRes.statusCode, 403);
});

test('requireAuth populates req.auth and calls next() for allowed roles', () => {
  const middleware = requireAuth('vendor', 'admin');
  const token = signToken({ sub: 'v1', role: 'vendor', email: 'v@test.dev', name: 'V' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  let nextCalled = false;
  middleware(req, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.auth.role, 'vendor');
  assert.equal(req.auth.id, 'v1');
  assert.equal(req.auth.vendorId, 'v1');
});
