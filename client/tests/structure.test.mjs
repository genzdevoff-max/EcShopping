// Structural regression guards (plain node --test): assert the Phase-0
// source invariants by reading the actual files. These do not execute React
// code — the P0 fix is also covered by lint+build and the server-side API
// tests; runtime browser verification is intentionally out of scope here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(HERE, rel), 'utf8');

test('P0 regression guard: App.jsx must not reference setCurrentCustomer at all', () => {
  const appSource = read('../src/App.jsx');
  assert.ok(!appSource.includes('setCurrentCustomer'), 'App.jsx must not call the removed storage helper');
});

test('customer login still persists profile + token (single source of truth)', () => {
  const authForm = read('../src/components/auth/AuthForm.jsx');
  assert.ok(authForm.includes('saveCustomerSession(data.user, data.token)'), 'AuthForm must persist session pair');
  const appSource = read('../src/App.jsx');
  assert.ok(appSource.includes('handleCustomerLogin'), 'App handler still wired');
});

test('order creation is server-authoritative on the client', () => {
  const storage = read('../src/utils/storage.js');
  assert.ok(storage.includes('await api.createOrder(orderData)'), 'order helper must confirm with the server first');
  assert.ok(storage.includes('serverVerified: false'), 'offline fallback drafts must stay unverified');
  assert.ok(storage.includes('syncOrdersFromServerDetailed'), 'detailed sync result exists for pages');
  const checkout = read('../src/pages/Checkout.jsx');
  const serverFirst =
    checkout.includes('await api.createOrder(orderPayload)') ||
    checkout.includes('serverOrder = await addOrder(');
  assert.ok(serverFirst, 'checkout must await a server-issued order before any payment step');
  assert.ok(
    checkout.includes('serverOrder = result.order') || checkout.includes('serverOrder = await addOrder('),
    'checkout adopts the server row as the order'
  );
  assert.ok(
    checkout.includes("serverOrder?.serverVerified !== false"),
    'PhonePe payments must be blocked for offline (unverified) drafts'
  );
});

test('order history merge uses orderSync rules instead of wholesale replacement', () => {
  const storage = read('../src/utils/storage.js');
  assert.ok(storage.includes("from './orderSync.js'"), 'storage must use the shared merge module');
  assert.ok(storage.includes('mergeOrderHistory(serverOrders, getOrders())'), 'full pulls merge with the local cache');
  assert.ok(!storage.includes('localStorage.setItem(ORDERS_KEY, JSON.stringify(normalized))'), 'old replace-all sync must be gone');
});

test('server no longer performs client-driven order upserts', () => {
  const serverIndex = read('../../server/index.js');
  assert.ok(serverIndex.includes('generateOrderId'), 'order ids must be server-issued');
  // The order upsert used VALUES(customer_name) only in the removed order
  // block (the guarded products upsert never set customer fields).
  assert.ok(!serverIndex.includes('VALUES(customer_email)'), 'the order upsert overwrite vector must be removed');
  assert.ok(serverIndex.includes("'pending', NULL, 'Processing')"), 'payment state is forced pending at insert');
});

test('demo catalog module is fully removed from the client source tree', () => {
  const srcRoot = path.join(HERE, '../src');
  assert.ok(!existsSync(path.join(srcRoot, 'data', 'catalog.js')), 'data/catalog.js must be deleted');

  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(jsx?|css)$/.test(entry.name)) files.push(full);
    }
  };
  walk(srcRoot);
  assert.ok(files.length > 0, 'source scan must find files');

  for (const file of files) {
    assert.ok(
      !readFileSync(file, 'utf8').includes('data/catalog'),
      `${path.relative(srcRoot, file)} must not reference the removed demo catalog`
    );
  }
});

test('storefront data surfaces only server rows (no fabricated demo rails)', () => {
  const storefront = read('../src/data/storefront.js');
  assert.ok(storefront.includes("from './mapProduct'"), 'storefront rows must flow through the shared mapper');
  assert.ok(!storefront.includes("from './catalog'"), 'storefront must not import the removed demo catalog');
});
