// Unit tests for the order-history merge and payment-display rules.
// Pure functions, no browser APIs required — runs with plain `node --test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeOrderHistory, paymentStatusDisplay } from '../src/utils/orderSync.js';

const LABELS = { pending: 'Payment pending', paid: 'Paid', failed: 'Payment failed' };

const row = (over = {}) => ({
  id: 'ORD-1',
  date: '2026-10-20T10:00:00.000Z',
  customerEmail: 'a@example.com',
  paymentStatus: 'pending',
  status: 'Processing',
  totalAmount: 100,
  items: [],
  ...over
});

test('mergeOrderHistory marks every server row as server-confirmed', () => {
  const merged = mergeOrderHistory([row({ id: 'ORD-S1' }), row({ id: 'ORD-S2' })], []);
  for (const order of merged) assert.equal(order.serverVerified, true);
  assert.equal(merged.length, 2);
});

test('local-only rows survive a merge but are flagged unverified', () => {
  const local = [row({ id: 'ORD-LOCAL', serverVerified: true, date: '2026-10-21T08:00:00.000Z' })];
  const merged = mergeOrderHistory([], local);
  assert.equal(merged.length, 1);
  const kept = merged[0];
  assert.equal(kept.serverVerified, false, 'unverified copy must be re-flagged, never trusted');
});

test('server rows replace local rows with the same id (stale local values cannot win)', () => {
  const server = [row({ id: 'ORD-1', totalAmount: 4321, status: 'Shipped', items: [{ id: 'p1' }] })];
  const local = [row({ id: 'ORD-1', totalAmount: 1, status: 'Cancelled', items: [] })];
  const merged = mergeOrderHistory(server, local);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].totalAmount, 4321);
  assert.equal(merged[0].status, 'Shipped');
  assert.equal(merged[0].serverVerified, true);
  assert.equal(merged[0].items.length, 1);
});

test('empty server response keeps local history instead of wiping it', () => {
  const local = [row({ id: 'ORD-LOCAL1' }), row({ id: 'ORD-LOCAL2' })];
  const merged = mergeOrderHistory([], local);
  assert.equal(merged.length, 2);
  assert.ok(merged.every((o) => o.serverVerified === false));
});

test('merge is robust to non-array inputs', () => {
  assert.equal(mergeOrderHistory(null, undefined).length, 0);
  const merged = mergeOrderHistory(null, [row({ id: 'ONLY-LOCAL' })]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].serverVerified, false);
});

test('merged list is ordered newest first', () => {
  const server = [row({ id: 'OLD', date: '2026-10-01T00:00:00.000Z' })];
  const local = [row({ id: 'NEW-LOCAL', date: '2026-10-22T00:00:00.000Z' })];
  const merged = mergeOrderHistory(server, local);
  assert.equal(merged[0].id, 'NEW-LOCAL');
  assert.equal(merged[1].id, 'OLD');
});

test('payment display: verified states use the provided label map', () => {
  assert.equal(paymentStatusDisplay(row({ serverVerified: true, paymentStatus: 'paid' }), LABELS), 'Paid');
  assert.equal(paymentStatusDisplay(row({ serverVerified: true, paymentStatus: 'pending' }), LABELS), 'Payment pending');
  assert.equal(paymentStatusDisplay(row({ serverVerified: undefined, paymentStatus: 'pending' }), LABELS), 'Payment pending');
});

test('payment display: unverified copies never claim "paid"', () => {
  assert.equal(
    paymentStatusDisplay(row({ serverVerified: false, paymentStatus: 'paid' }), LABELS),
    'Payment unverified (device copy)'
  );
  assert.equal(
    paymentStatusDisplay(row({ serverVerified: false, paymentStatus: 'pending' }), LABELS),
    'Pending server confirmation'
  );
  assert.equal(paymentStatusDisplay(null, LABELS), '—');
  assert.equal(paymentStatusDisplay(row({ serverVerified: true, paymentStatus: 'unknown' }), LABELS), '—');
});
