import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeImageUrl } from '../src/utils/imageOptimizer.js';

test('optimizeImageUrl: transforms raw Cloudinary product URL with f_auto,q_auto,w_440', () => {
  const raw = 'https://res.cloudinary.com/wibpemz5/image/upload/v1793693169/ecshopping_products/ililcnfikky3mqpxqysk.png';
  const opt = optimizeImageUrl(raw, { width: 440 });
  assert.equal(opt, 'https://res.cloudinary.com/wibpemz5/image/upload/f_auto,q_auto,w_440/v1793693169/ecshopping_products/ililcnfikky3mqpxqysk.png');
});

test('optimizeImageUrl: does not double transform already transformed Cloudinary URLs', () => {
  const transformed = 'https://res.cloudinary.com/wibpemz5/image/upload/f_auto,q_auto,w_800/v1793699497/ecshopping_products/tkhvr1opaiuzoeisbh6r.png';
  const opt = optimizeImageUrl(transformed, { width: 440 });
  assert.equal(opt, transformed);
});

test('optimizeImageUrl: handles Unsplash URLs', () => {
  const unsplash = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80';
  const opt = optimizeImageUrl(unsplash, { width: 800 });
  assert.ok(opt.includes('w=800'));
});

test('optimizeImageUrl: passes through relative and non-CDN images unharmed', () => {
  assert.equal(optimizeImageUrl('/placeholder.png'), '/placeholder.png');
  assert.equal(optimizeImageUrl(''), '');
  assert.equal(optimizeImageUrl(null), null);
  assert.equal(optimizeImageUrl(undefined), undefined);
});
