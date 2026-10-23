import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyHash,
  isHashed,
  timingSafeEqualStrings,
  passwordMeetsPolicy
} from '../utils/passwords.js';

test('hashPassword returns a bcrypt-format hash', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.ok(isHashed(hash), 'hash should match bcrypt format');
  assert.equal(hash.length, 60);
});

test('hashPassword never reuses a salt', async () => {
  const a = await hashPassword('same-plaintext-password');
  const b = await hashPassword('same-plaintext-password');
  assert.notEqual(a, b, 'each call must produce a distinct hash');
});

test('verifyHash accepts the right password and rejects the wrong one', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.equal(await verifyHash('correct horse battery staple', hash), true);
  assert.equal(await verifyHash('wrong password', hash), false);
});

test('verifyHash never throws on malformed or missing hashes', async () => {
  assert.equal(await verifyHash('anything', null), false);
  assert.equal(await verifyHash('anything', ''), false);
  assert.equal(await verifyHash('anything', 'plaintext-not-a-hash'), false);
  assert.equal(await verifyHash('anything', '$2y$10$truncated-garbage'), false);
});

test('isHashed flags bcrypt hashes ($2a/$2b/$2y) and nothing else', () => {
  assert.equal(isHashed('$2a$10$abcdefghijklmnopqrstuv'), true);
  assert.equal(isHashed('$2b$10$abcdefghijklmnopqrstuv'), true);
  assert.equal(isHashed('$2y$10$abcdefghijklmnopqrstuv'), true);
  assert.equal(isHashed('plaintext-password'), false);
  assert.equal(isHashed(''), false);
  assert.equal(isHashed(null), false);
  assert.equal(isHashed(undefined), false);
});

test('timingSafeEqualStrings compares equal and different strings', () => {
  assert.equal(timingSafeEqualStrings('abc', 'abc'), true);
  assert.equal(timingSafeEqualStrings('', ''), true);
  assert.equal(timingSafeEqualStrings('abc', 'abd'), false);
});

test('timingSafeEqualStrings is safe across mismatched lengths', () => {
  assert.doesNotThrow(() => timingSafeEqualStrings('short', 'a very much longer string'));
  assert.equal(timingSafeEqualStrings('short', 'a very much longer string'), false);
  assert.equal(timingSafeEqualStrings(null, ''), true);
  assert.equal(timingSafeEqualStrings(null, 'x'), false);
});

test('passwordMeetsPolicy enforces the minimum length', () => {
  assert.equal(passwordMeetsPolicy('12345678'), true);
  assert.equal(passwordMeetsPolicy('1234567'), false);
  assert.equal(passwordMeetsPolicy('short', 12), false);
  assert.equal(passwordMeetsPolicy('0123456789ab', 12), true);
  assert.equal(passwordMeetsPolicy(12345678), false);
  assert.equal(passwordMeetsPolicy(null), false);
  assert.equal(passwordMeetsPolicy(undefined), false);
});
