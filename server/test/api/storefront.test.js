// Storefront API tests (Phase 1): public categories, product search/sort/
// filter/pagination params, and the related-products endpoint.
//
// Runs inside a test process against the ecshopping_test database only
// (DB_NAME is overridden before the app module imports db.js). The live
// ecshopping database is never touched.
process.env.DB_NAME = 'ecshopping_test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

const { default: app } = await import('../../index.js');
const { initDatabase, pool } = await import('../../db.js');
const { signToken } = await import('../../middleware/auth.js');

const VENDOR = { id: 'v-sf-001', name: 'SF Farms', email: 'sf-vendor@ecshopping.test' };
const VENDOR_2 = { id: 'v-sf-002', name: 'SF Livestock', email: 'sf-vendor2@ecshopping.test' };

const request = () => supertest(app);

const SEED_CATEGORIES = [
  { id: 'sf-cat-fresh-1', vendor_id: VENDOR.id, name: 'Fresh Produce', description: 'Farm produce', status: 'active' },
  { id: 'sf-cat-fresh-2', vendor_id: VENDOR_2.id, name: 'Fresh Produce', description: 'Other vendor copy', status: 'active' },
  { id: 'sf-cat-dairy', vendor_id: null, name: 'Dairy & Eggs', description: null, status: 'active' },
  { id: 'sf-cat-pantry', vendor_id: null, name: 'Pantry Staples', description: 'Cached stock', status: 'active' },
  { id: 'sf-cat-hidden', vendor_id: VENDOR.id, name: 'Inactive Cat', description: null, status: 'inactive' }
];

const SEED_PRODUCTS = [
  // id, vendor, vendor_name, title, category, price, strike, stock, status, description
  { id: 'p-sf-tomato', vendor: VENDOR, vn: 'SF Farms', title: 'Farm Tomatoes 1kg', cat: 'Fresh Produce', price: 40, strike: 48, stock: 'in_stock', status: 'approved', desc: 'Vine tomatoes' },
  { id: 'p-sf-chicken', vendor: VENDOR_2, vn: 'SF Livestock', title: 'Country Chicken 1kg', cat: 'Fresh Produce', price: 600, strike: null, stock: 'in_stock', status: 'approved', desc: 'Free range bird' },
  { id: 'p-sf-milk', vendor: VENDOR, vn: 'SF Dairy', title: 'Fresh Milk 500ml', cat: 'Dairy & Eggs', price: 32, strike: 36, stock: 'in_stock', status: 'approved', desc: 'Morning milk' },
  { id: 'p-sf-oos', vendor: VENDOR, vn: 'SF Pantry', title: 'Old Jaggery Pack', cat: 'Pantry Staples', price: 50, strike: 60, stock: 'out_of_stock', status: 'approved', desc: 'Demo deal bundle' },
  { id: 'p-sf-fake', vendor: VENDOR, vn: 'SF Pantry', title: 'Phoney Discount Pack', cat: 'Pantry Staples', price: 100, strike: 10, stock: 'in_stock', status: 'approved', desc: 'Strike below price' },
  { id: 'p-sf-pct', vendor: VENDOR, vn: 'SF Pantry', title: '50% Off Deal_1', cat: 'Pantry Staples', price: 75, strike: 90, stock: 'in_stock', status: 'approved', desc: 'LIKE escaping probe' },
  { id: 'p-sf-pend', vendor: VENDOR, vn: 'SF Farms', title: 'Pending Zucchini', cat: 'Fresh Produce', price: 55, strike: null, stock: 'in_stock', status: 'pending', desc: 'Awaiting approval' },
  { id: 'p-sf-pend2', vendor: VENDOR_2, vn: 'SF Livestock', title: 'Pending Goat', cat: 'Fresh Produce', price: 900, strike: null, stock: 'in_stock', status: 'pending', desc: 'Awaiting approval' }
];

const insertSeedCategory = async (c) => {
  await pool.query(
    'INSERT INTO categories (id, vendor_id, name, description, status) VALUES (?, ?, ?, ?, ?)',
    [c.id, c.vendor_id, c.name, c.description, c.status]
  );
};

const insertSeedProduct = async (p) => {
  await pool.query(
    `INSERT INTO products (id, vendor_id, vendor_name, title, name, description, category, price, strike_price, unit, image, stock_status, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?)`,
    [p.id, p.vendor.id, p.vn, p.title, p.title, p.desc, p.cat, p.price, p.strike, p.stock, p.status]
  );
};

const cleanup = async () => {
  await pool.query("DELETE FROM products WHERE id LIKE 'p-sf-%'");
  await pool.query("DELETE FROM categories WHERE id LIKE 'sf-cat-%'");
};

before(async () => {
  await initDatabase();

  await cleanup();
  for (const c of SEED_CATEGORIES) await insertSeedCategory(c);
  for (const p of SEED_PRODUCTS) await insertSeedProduct(p);
});

after(async () => {
  await cleanup();
  await pool.end();
});

const anonProducts = async (query = '') => {
  const res = await request().get(`/api/products${query}`);
  return res;
};

test('GET /api/categories/public is public, active-only, deduped and has approved-product counts', async () => {
  const res = await request().get('/api/categories/public');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const names = res.body.categories.map((c) => c.name);
  assert.ok(names.includes('Fresh Produce'));
  assert.ok(names.includes('Dairy & Eggs'));
  assert.ok(!names.includes('Inactive Cat')); // inactive categories are never public

  // Case-insensitive dedup across vendors, no vendor identity exposed.
  const fresh = res.body.categories.filter((c) => c.name === 'Fresh Produce');
  assert.equal(fresh.length, 1);
  for (const c of res.body.categories) {
    assert.deepEqual(
      Object.keys(c).sort(),
      ['createdAt', 'description', 'image', 'name', 'productsCount'].sort(),
      'only restrained fields are exposed'
    );
    assert.equal(typeof c.productsCount, 'number');
  }

  // 2 approved products sit in 'Fresh Produce' (pending rows are excluded).
  const freshRow = fresh[0];
  assert.equal(freshRow.productsCount, 2);
});

test('Public category dedup does not lose categories that exist only for one vendor', async () => {
  const res = await request().get('/api/categories/public');
  const dairy = res.body.categories.find((c) => c.name === 'Dairy & Eggs');
  assert.ok(dairy);
  assert.equal(dairy.productsCount, 1);
});

test('Anonymous product listing returns only approved rows plus storefront metadata', async () => {
  const res = await anonProducts('?limit=48');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(typeof res.body.total === 'number');
  assert.equal(res.body.page, 1);
  assert.equal(res.body.limit, 48);

  const ids = res.body.products.map((p) => p.id);
  assert.ok(ids.includes('p-sf-tomato'));
  assert.ok(!ids.includes('p-sf-pend'));
  assert.ok(!ids.includes('p-sf-pend2'));
});

test('search matches title/name/description with LIKE escaping intact', async () => {
  const tomato = await anonProducts('?search=Tomatoes');
  assert.ok(tomato.body.products.some((p) => p.id === 'p-sf-tomato'));
  assert.ok(!tomato.body.products.some((p) => p.id === 'p-sf-milk'));

  const none = await anonProducts('?search=zzz-no-match-zzz');
  assert.equal(none.status, 200);
  assert.equal(none.body.products.length, 0);
  assert.equal(none.body.total, 0);

  // '%' and '_' are treated literally, not as wildcards.
  const pct = await anonProducts(`?search=${encodeURIComponent('50% Off Deal_1')}`);
  assert.equal(pct.body.products.length, 1);
  assert.equal(pct.body.products[0].id, 'p-sf-pct');

  const wildcard = await anonProducts(`?search=${encodeURIComponent('50%')}`);
  assert.equal(wildcard.body.products.length, 1);
  assert.equal(wildcard.body.products[0].id, 'p-sf-pct');
});

test('category filter accepts single and comma-separated names (case-insensitive)', async () => {
  const single = await anonProducts(`?category=${encodeURIComponent('fresh produce')}`);
  const ids = single.body.products.map((p) => p.id);
  assert.deepEqual(new Set(ids), new Set(['p-sf-tomato', 'p-sf-chicken']));

  const multi = await anonProducts('?category=' + encodeURIComponent('Fresh Produce,Dairy & Eggs'));
  const multiIds = multi.body.products.map((p) => p.id);
  assert.ok(multiIds.includes('p-sf-milk'));
  assert.ok(multiIds.includes('p-sf-chicken'));
  assert.ok(!multiIds.includes('p-sf-pend'));
});

test('price bounds are validated and applied inclusively', async () => {
  const minOnly = await anonProducts('?minPrice=100');
  const minIds = minOnly.body.products.map((p) => p.id);
  assert.ok(!minIds.includes('p-sf-tomato'));
  assert.ok(minIds.includes('p-sf-fake'));

  const maxOnly = await anonProducts('?maxPrice=100');
  const maxIds = maxOnly.body.products.map((p) => p.id);
  assert.ok(maxIds.includes('p-sf-tomato'));
  assert.ok(maxIds.includes('p-sf-milk'));
  assert.ok(maxIds.includes('p-sf-fake'));

  const badMin = await anonProducts('?minPrice=abc');
  assert.equal(badMin.status, 400);

  const badMax = await anonProducts('?maxPrice=-5');
  assert.equal(badMax.status, 400);
});

test('stockStatus filter is whitelisted', async () => {
  const inStock = await anonProducts('?stockStatus=in_stock&limit=48');
  const ids = inStock.body.products.map((p) => p.id);
  assert.ok(!ids.includes('p-sf-oos'));

  const bogus = await anonProducts('?stockStatus=maybe');
  assert.equal(bogus.status, 400);
});

test('hasDiscount=1 uses the server-side strike_price > price comparison', async () => {
  const deals = await anonProducts('?hasDiscount=1&limit=48');
  const ids = deals.body.products.map((p) => p.id);
  assert.ok(ids.includes('p-sf-tomato')); // strike 48 > price 40
  assert.ok(!ids.includes('p-sf-fake')); // strike 10 <= price 100 — never a deal
});

test('vendorName matches the seller name exactly', async () => {
  const res = await anonProducts(`?vendorName=${encodeURIComponent('SF Farms')}&limit=48`);
  const ids = res.body.products.map((p) => p.id);
  assert.ok(ids.includes('p-sf-tomato')); // seeded as SF Farms
  assert.ok(!ids.includes('p-sf-milk')); // seller is 'SF Dairy'
  assert.ok(!ids.includes('p-sf-chicken')); // seller is 'SF Livestock'
  assert.ok(!ids.includes('p-sf-fake')); // seller is 'SF Pantry'
});

test('sort supports only the whitelisted options', async () => {
  const asc = await anonProducts('?sort=price-asc&limit=48');
  const prices = asc.body.products.map((p) => Number(p.price));
  assert.deepEqual([...prices].sort((a, b) => a - b), prices);

  const desc = await anonProducts('?sort=price-desc&limit=48');
  const descPrices = desc.body.products.map((p) => Number(p.price));
  assert.deepEqual([...descPrices].sort((a, b) => b - a), descPrices);

  const newest = await anonProducts('?sort=newest&limit=48');
  const times = newest.body.products.map((p) => new Date(p.createdAt).getTime());
  assert.deepEqual([...times].sort((a, b) => b - a), times);

  const rating = await anonProducts('?sort=rating');
  assert.equal(rating.status, 400);

  const injected = await anonProducts('?sort=price-asc; DROP TABLE products');
  assert.equal(injected.status, 400);
});

test('pagination is server-side with a validated cap', async () => {
  const page1 = await anonProducts('?limit=2&page=1');
  assert.equal(page1.body.products.length, 2);
  assert.equal(page1.body.page, 1);
  const page2 = await anonProducts('?limit=2&page=2');
  assert.equal(page2.body.products.length, 2);
  assert.equal(page2.body.page, 2);
  const p1Ids = page1.body.products.map((p) => p.id);
  const p2Ids = page2.body.products.map((p) => p.id);
  assert.ok(p1Ids.join() !== p2Ids.join(), 'pages must not overlap');

  const tooBig = await anonProducts('?limit=49');
  assert.equal(tooBig.status, 400);

  const zero = await anonProducts('?page=0');
  assert.equal(zero.status, 400);

  const frac = await anonProducts('?limit=1.5');
  assert.equal(frac.status, 400);
});

test('Vendor and admin listing behavior is unchanged', async () => {
  const vendorToken = signToken({ sub: VENDOR.id, role: 'vendor', email: VENDOR.email, name: VENDOR.name });
  const vendorRes = await request()
    .get('/api/products')
    .set('Authorization', `Bearer ${vendorToken}`);
  assert.equal(vendorRes.status, 200);
  const vendorIds = vendorRes.body.products.map((p) => p.id);
  assert.ok(!('total' in vendorRes.body), 'vendor response keeps its original shape');
  assert.ok(vendorIds.includes('p-sf-pend'), 'vendor still sees their pending rows');
  assert.ok(!vendorIds.includes('p-sf-pend2'), 'vendor does not see other vendors rows');

  const adminToken = signToken({ sub: 'admin-sf', role: 'admin', email: 'sf-admin@ecshopping.test', name: 'SF Admin' });
  const adminRes = await request()
    .get('/api/products')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(adminRes.status, 200);
  assert.ok(!('total' in adminRes.body), 'admin response keeps its original shape');
  const adminIds = adminRes.body.products.map((p) => p.id);
  assert.ok(adminIds.includes('p-sf-pend') && adminIds.includes('p-sf-pend2'));
});

test('related products are approved, same-category, and exclude the base product', async () => {
  const res = await request().get('/api/products/p-sf-tomato/related');
  assert.equal(res.status, 200);
  const ids = res.body.products.map((p) => p.id);
  assert.ok(!ids.includes('p-sf-tomato'));
  assert.ok(ids.includes('p-sf-chicken')); // approved Fresh Produce sibling
  assert.ok(!ids.includes('p-sf-pend'), 'pending rows never leak');
  assert.ok(!ids.includes('p-sf-milk'), 'other categories are excluded');
});

test('related products mask non-visible base products', async () => {
  const hidden = await request().get('/api/products/p-sf-pend/related');
  assert.equal(hidden.status, 404);

  const unknown = await request().get('/api/products/p-sf-none/related');
  assert.equal(unknown.status, 404);
});

test('GET /api/products/:id isolates pending products to owner vendor and admin', async () => {
  const ownerToken = signToken({ sub: VENDOR.id, role: 'vendor', vendorId: VENDOR.id, email: VENDOR.email });
  const otherVendorToken = signToken({ sub: VENDOR_2.id, role: 'vendor', vendorId: VENDOR_2.id, email: VENDOR_2.email });
  const adminToken = signToken({ sub: 'admin-01', role: 'admin', email: 'admin@ecshopping.test' });
  const customerToken = signToken({ sub: 'cust-01', role: 'customer', email: 'cust@ecshopping.test' });

  // 1. Anonymous user cannot view pending product (404)
  const anonRes = await request().get('/api/products/p-sf-pend');
  assert.equal(anonRes.status, 404);

  // 2. Customer cannot view pending product (404)
  const custRes = await request().get('/api/products/p-sf-pend').set('Authorization', `Bearer ${customerToken}`);
  assert.equal(custRes.status, 404);

  // 3. Different vendor cannot view another vendor's pending product (404)
  const diffVendorRes = await request().get('/api/products/p-sf-pend').set('Authorization', `Bearer ${otherVendorToken}`);
  assert.equal(diffVendorRes.status, 404);

  // 4. Owner vendor CAN view their own pending product (200)
  const ownerRes = await request().get('/api/products/p-sf-pend').set('Authorization', `Bearer ${ownerToken}`);
  assert.equal(ownerRes.status, 200);
  assert.equal(ownerRes.body.success, true);
  assert.equal(ownerRes.body.product.id, 'p-sf-pend');
  assert.equal(ownerRes.body.product.status, 'pending');

  // 5. Admin CAN view any pending product (200)
  const adminRes = await request().get('/api/products/p-sf-pend').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(adminRes.status, 200);
  assert.equal(adminRes.body.success, true);
  assert.equal(adminRes.body.product.id, 'p-sf-pend');
});
