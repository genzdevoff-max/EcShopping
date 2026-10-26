import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_DESCRIPTIONS,
  STATUS_BADGE_CLASS,
  getTimeline,
  statusBadgeClass,
  statusLabel,
  normalizeOrderStatus
} from '../src/utils/orderStatus.js';

test('ORDER_STATUS_FLOW aligns with canonical backend states', () => {
  assert.deepEqual(ORDER_STATUS_FLOW, ['Processing', 'Shipped', 'Delivered']);
});

test('normalizeOrderStatus maps casing and legacy aliases gracefully', () => {
  assert.equal(normalizeOrderStatus('Processing'), 'Processing');
  assert.equal(normalizeOrderStatus('processing'), 'Processing');
  assert.equal(normalizeOrderStatus('confirmed'), 'Processing');
  assert.equal(normalizeOrderStatus('packed'), 'Processing');
  assert.equal(normalizeOrderStatus('Shipped'), 'Shipped');
  assert.equal(normalizeOrderStatus('shipped'), 'Shipped');
  assert.equal(normalizeOrderStatus('out_for_delivery'), 'Shipped');
  assert.equal(normalizeOrderStatus('Delivered'), 'Delivered');
  assert.equal(normalizeOrderStatus('delivered'), 'Delivered');
  assert.equal(normalizeOrderStatus('Cancelled'), 'Cancelled');
  assert.equal(normalizeOrderStatus('cancelled'), 'Cancelled');
});

test('getTimeline produces correct progression for Processing order', () => {
  const timeline = getTimeline({ status: 'Processing' });
  assert.equal(timeline.length, 3);
  assert.equal(timeline[0].id, 'Processing');
  assert.equal(timeline[0].current, true);
  assert.equal(timeline[0].done, false);
  assert.equal(timeline[1].id, 'Shipped');
  assert.equal(timeline[1].current, false);
  assert.equal(timeline[1].done, false);
  assert.equal(timeline[2].id, 'Delivered');
  assert.equal(timeline[2].current, false);
  assert.equal(timeline[2].done, false);
});

test('getTimeline produces correct progression for Shipped order', () => {
  const timeline = getTimeline({ status: 'Shipped' });
  assert.equal(timeline[0].done, true);
  assert.equal(timeline[1].current, true);
  assert.equal(timeline[1].done, false);
  assert.equal(timeline[2].done, false);
});

test('getTimeline produces correct progression for Delivered order', () => {
  const timeline = getTimeline({ status: 'Delivered' });
  assert.equal(timeline[0].done, true);
  assert.equal(timeline[1].done, true);
  assert.equal(timeline[2].current, true);
});

test('getTimeline marks all stages inactive for Cancelled order', () => {
  const timeline = getTimeline({ status: 'Cancelled' });
  for (const step of timeline) {
    assert.equal(step.done, false);
    assert.equal(step.current, false);
  }
});

test('statusBadgeClass and statusLabel handle canonical and case-insensitive statuses', () => {
  assert.equal(statusBadgeClass('Processing'), 'badge badge-info');
  assert.equal(statusBadgeClass('processing'), 'badge badge-info');
  assert.equal(statusBadgeClass('Shipped'), 'badge badge-warning');
  assert.equal(statusBadgeClass('Delivered'), 'badge badge-success');
  assert.equal(statusBadgeClass('Cancelled'), 'badge badge-danger');

  assert.equal(statusLabel('Processing'), 'Order Placed & Processing');
  assert.equal(statusLabel('Shipped'), 'Dispatched');
  assert.equal(statusLabel('Delivered'), 'Delivered');
  assert.equal(statusLabel('Cancelled'), 'Cancelled');
});

test('App.jsx mounts ScrollToTop inside Router', () => {
  const appSrc = fs.readFileSync('src/App.jsx', 'utf8');
  assert.ok(appSrc.includes('import ScrollToTop from \'./components/ui/ScrollToTop\';'));
  assert.ok(appSrc.includes('<ScrollToTop />'));
});

test('Checkout.jsx integrates saved delivery addresses', () => {
  const checkoutSrc = fs.readFileSync('src/pages/Checkout.jsx', 'utf8');
  assert.ok(checkoutSrc.includes('api.getUserAddresses()'));
  assert.ok(checkoutSrc.includes('savedAddresses'));
  assert.ok(checkoutSrc.includes('co-saved-addresses-grid'));
});

test('ShortsAndVideos component is mounted on Home page and backed by API', () => {
  const homeSrc = fs.readFileSync('src/pages/Home.jsx', 'utf8');
  assert.ok(homeSrc.includes('import ShortsAndVideos from \'../components/home/ShortsAndVideos\';'));
  assert.ok(homeSrc.includes('<ShortsAndVideos />'));

  const apiSrc = fs.readFileSync('src/utils/api.js', 'utf8');
  assert.ok(apiSrc.includes('getPublicVideos: () => request(\'/api/videos/public\')'));
  assert.ok(apiSrc.includes('getVideos: () => request(\'/api/videos\', { role: \'admin\' })'));
  assert.ok(apiSrc.includes('createVideo: (data) => request(\'/api/videos\''));
});
