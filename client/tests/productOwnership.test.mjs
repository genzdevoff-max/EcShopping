import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

test('VendorSelect.jsx provides Admin ownership and hides Shared option for products', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/admin/VendorSelect.jsx'), 'utf8');

  // Must support Admin (EcShopping) option
  assert.ok(jsx.includes('Admin (EcShopping)'), 'Must include Admin (EcShopping) label');
  assert.ok(jsx.includes("handleSelect('admin')"), 'Must select admin value');
  assert.ok(jsx.includes('vendor-badge-admin'), 'Must render vendor-badge-admin class');

  // Must gate shared option behind includeShared/allowShared
  assert.ok(jsx.includes('showShared'), 'Must gate shared option behind showShared flag');
});

test('AddProduct.jsx removes Shared ownership and defaults to Admin in admin mode', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/vendor/AddProduct.jsx'), 'utf8');

  // Selected vendor default must be 'admin'
  assert.ok(jsx.includes("useState('admin')"), 'Must default selectedVendorId to admin');
  assert.ok(!jsx.includes("useState('shared')"), 'Must not default selectedVendorId to shared');

  // VendorSelect invocation must disable shared mode
  assert.ok(jsx.includes('includeShared={false}'), 'Must pass includeShared={false} to VendorSelect');
  assert.ok(jsx.includes('Product Owner'), 'Must label ownership section as Product Owner');

  // Admin payload creation must set Admin metadata for admin products
  assert.ok(jsx.includes("vendorName: isSelectedVendor ? (currentAssignedVendor?.name || '') : 'Admin'"), 'Must assign Admin vendorName when Admin-owned');
});

test('AdminDashboard.jsx includes Ownership filter and renders Admin/Vendor badges', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/admin/AdminDashboard.jsx'), 'utf8');
  const css = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/admin/AdminDashboard.css'), 'utf8');

  // Filter state and select
  assert.ok(jsx.includes('prodOwnerFilter'), 'Must maintain prodOwnerFilter state');
  assert.ok(jsx.includes('Admin Products Only'), 'Must provide Admin Products Only filter option');
  assert.ok(jsx.includes('Vendor Products Only'), 'Must provide Vendor Products Only filter option');

  // Badges
  assert.ok(jsx.includes('prod-owner-admin'), 'Must render prod-owner-admin badge in table');
  assert.ok(jsx.includes('prod-owner-vendor'), 'Must render prod-owner-vendor badge in table');
  assert.ok(css.includes('.prod-owner-admin'), 'CSS must define .prod-owner-admin');
  assert.ok(css.includes('.prod-owner-vendor'), 'CSS must define .prod-owner-vendor');
});

test('mapProduct.js distinguishes Admin-owned vs Vendor-owned products', async () => {
  const { mapServerProduct } = await import('../src/data/mapProduct.js');

  // Vendor product
  const vendorProduct = mapServerProduct({
    id: 'p-ven-1',
    title: 'Organic Honey',
    price: 350,
    vendorId: 'ven_123',
    vendorName: 'Bee Farms'
  });
  assert.equal(vendorProduct.isVendorProduct, true);
  assert.equal(vendorProduct.isAdminProduct, false);
  assert.equal(vendorProduct.seller, 'Bee Farms');
  assert.equal(vendorProduct.ownerType, 'vendor');

  // Admin product (no vendorId)
  const adminProduct = mapServerProduct({
    id: 'p-adm-1',
    title: 'Heritage Rice',
    price: 180,
    vendorId: null,
    vendorName: 'Admin'
  });
  assert.equal(adminProduct.isVendorProduct, false);
  assert.equal(adminProduct.isAdminProduct, true);
  assert.equal(adminProduct.seller, 'Admin Direct');
  assert.equal(adminProduct.ownerType, 'admin');
});

test('AllProducts.jsx renders vendor ownership pill', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/vendor/AllProducts.jsx'), 'utf8');
  assert.ok(jsx.includes('prod-owner-vendor'), 'Must render vendor ownership pill');
});
