// Unit tests for the server-row mapper (pure module, no browser imports).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapServerProduct, slugifyName, categorySlugFromName } from '../src/data/mapProduct.js';

function serverRow(overrides = {}) {
  return {
    id: 'prod_2',
    title: 'Bell Pepper',
    name: 'Bell Pepper',
    description: 'Crisp capsicum from a verified farm.',
    price: 42,
    strikePrice: 55,
    image: 'https://cdn.example/bell-pepper.jpg',
    category: 'Fresh Vegetables',
    vendorId: 'ven_7',
    vendorName: 'Green Valley Farms',
    unit: '500 g',
    stockStatus: 'in_stock',
    status: 'approved',
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides
  };
}

test('mapServerProduct maps a full row to the storefront shape', () => {
  const mapped = mapServerProduct(serverRow());

  assert.equal(mapped.id, 'prod_2');
  assert.equal(mapped.title, 'Bell Pepper');
  assert.equal(mapped.categorySlug, 'fresh-vegetables');
  assert.equal(mapped.seller, 'Green Valley Farms');
  assert.equal(mapped.price, 42);
  assert.equal(mapped.compareAt, 55);
  assert.equal(mapped.unit, '500 g');
  assert.equal(mapped.inStock, true);
  assert.equal(mapped.status, 'approved');
  assert.equal(mapped.isApproved, true);
  assert.equal(mapped.isServerListing, true);
  assert.deepEqual(mapped.images, ['https://cdn.example/bell-pepper.jpg']);
  assert.equal(mapped.createdAt, '2026-10-01T00:00:00.000Z');
});

test('mapServerProduct never invents demo values (ratings, badges, variants)', () => {
  const mapped = mapServerProduct(serverRow());

  assert.equal(mapped.rating, null);
  assert.equal(mapped.reviews, null);
  assert.equal(mapped.badge, null);
  assert.deepEqual(mapped.variants, []);
  assert.deepEqual(mapped.tags, []);
  assert.deepEqual(mapped.specs, []);
  assert.equal(mapped.sales, null);
});

test('compareAt only survives when the strike price is genuinely higher', () => {
  assert.equal(mapServerProduct(serverRow({ strikePrice: 42 })).compareAt, null);
  assert.equal(mapServerProduct(serverRow({ strikePrice: 30 })).compareAt, null);
  assert.equal(mapServerProduct(serverRow({ strikePrice: '' })).compareAt, null);
  assert.equal(mapServerProduct(serverRow({ strikePrice: null })).compareAt, null);
  assert.equal(mapServerProduct(serverRow({ strikePrice: '60' })).compareAt, 60);
});

test('stock status drives inStock', () => {
  assert.equal(mapServerProduct(serverRow({ stockStatus: 'out_of_stock' })).inStock, false);
  assert.equal(mapServerProduct(serverRow({ stockStatus: undefined })).inStock, true);
});

test('approval status gates isApproved', () => {
  assert.equal(mapServerProduct(serverRow({ status: 'pending' })).isApproved, false);
  assert.equal(mapServerProduct(serverRow({ status: undefined })).isApproved, true);
});

test('id, seller and titles fall back instead of crashing on sparse rows', () => {
  const sparse = mapServerProduct({ id: 99 });

  assert.equal(sparse.id, '99');
  assert.equal(sparse.title, 'Untitled product');
  assert.equal(sparse.name, 'Untitled product');
  assert.equal(sparse.seller, 'EcShopping Seller');
  assert.equal(sparse.price, 0);
  assert.equal(sparse.categorySlug, '');
});

test('non-object rows map to null', () => {
  assert.equal(mapServerProduct(null), null);
  assert.equal(mapServerProduct(undefined), null);
  assert.equal(mapServerProduct('prod_2'), null);
});

test('slugifyName collapses punctuation and trailing dashes', () => {
  assert.equal(slugifyName('Fresh Vegetables'), 'fresh-vegetables');
  assert.equal(slugifyName('  Dairy & Eggs!! '), 'dairy-eggs');
  assert.equal(slugifyName(''), '');
  assert.equal(slugifyName(null), '');
  assert.equal(categorySlugFromName('Dairy & Eggs'), 'dairy-eggs');
});
