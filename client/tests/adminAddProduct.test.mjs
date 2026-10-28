import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

test('AdminDashboard.jsx includes prominent Add Product button on All Products screen', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/admin/AdminDashboard.jsx'), 'utf8');

  assert.ok(jsx.includes('className="admin-add-product-main-btn"'), 'Must have prominent Add Product button class');
  assert.ok(jsx.includes('<Plus size={16} /> Add Product'), 'Must render Plus icon and Add Product text');
  assert.ok(jsx.includes('setAddProductOpen(true)'), 'Clicking Add Product must open the modal');
});

test('AdminDashboard.jsx includes Add Product in navigation and dashboard quick actions', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/admin/AdminDashboard.jsx'), 'utf8');

  // Sidebar navigation action
  assert.ok(jsx.includes('admin-sidebar-add-btn'), 'Must have Add Product button in admin sidebar');
  // Quick action on dashboard overview
  assert.ok(jsx.includes('admin-quick-add-btn'), 'Must have Add Product quick action on dashboard overview');
});

test('AdminDashboard.jsx renders responsive modal dialog with accessible Escape key dismissal', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/admin/AdminDashboard.jsx'), 'utf8');

  assert.ok(jsx.includes('className="admin-modal-overlay"'), 'Must render modal overlay backdrop');
  assert.ok(jsx.includes('role="dialog"'), 'Must include role dialog for accessibility');
  assert.ok(jsx.includes('aria-modal="true"'), 'Must include aria-modal="true"');
  assert.ok(jsx.includes('admin-modal-close-btn'), 'Must include close button');
  assert.ok(jsx.includes("e.key === 'Escape'"), 'Must handle Escape key to dismiss dialog');
  assert.ok(jsx.includes('<AddProduct'), 'Must mount shared AddProduct inside modal');
  assert.ok(jsx.includes('mode="admin"'), 'Must configure AddProduct with mode="admin"');
});

test('AdminDashboard.jsx includes product creation confirmation with name and status', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/admin/AdminDashboard.jsx'), 'utf8');

  assert.ok(jsx.includes('admin-created-banner'), 'Must render product creation confirmation banner');
  assert.ok(jsx.includes('Product Created Successfully!'), 'Must show success confirmation header');
  assert.ok(jsx.includes('productCreatedMsg.title'), 'Must display created product title');
  assert.ok(jsx.includes('productCreatedMsg.status'), 'Must display resulting approval status');
});

test('AddProduct.jsx supports admin mode with VendorSelect and Approval Status selector', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/vendor/AddProduct.jsx'), 'utf8');

  assert.ok(jsx.includes("mode === 'admin'"), 'Must conditionally check for admin mode');
  assert.ok(jsx.includes('VendorSelect'), 'Must mount VendorSelect for vendor assignment');
  assert.ok(jsx.includes('prod-status-select'), 'Must render approval status select');
  assert.ok(jsx.includes('value="approved"'), 'Must support approved status option');
  assert.ok(jsx.includes('value="pending"'), 'Must support pending status option');
  assert.ok(jsx.includes('value="rejected"'), 'Must support rejected status option');
});

test('AddProduct.jsx integrates searchable CategorySelect combobox', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/vendor/AddProduct.jsx'), 'utf8');

  assert.ok(jsx.includes('CategorySelect'), 'Must import and use CategorySelect');
  assert.ok(jsx.includes('categories={categoriesList}'), 'Must pass category list to selector');
  assert.ok(jsx.includes('onAddNew='), 'Must support inline category creation');
});

test('CategorySelect component provides search, Escape key handling, and clean dropdown layout', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/ui/CategorySelect.jsx'), 'utf8');
  const css = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/ui/CategorySelect.css'), 'utf8');

  assert.ok(jsx.includes('cat-search-input'), 'Must provide live search input');
  assert.ok(jsx.includes("e.key === 'Escape'"), 'Must handle Escape key to close dropdown');
  assert.ok(jsx.includes('cat-select-dropdown'), 'Must render floating dropdown');
  assert.ok(css.includes('z-index: 100'), 'Dropdown must have high z-index to avoid clipping');
  assert.ok(css.includes('max-height: 220px'), 'Options list must have bounded scrollable height');
});

test('AdminDashboard.css defines modal dialog, responsive breakpoints and Pine Green styling', () => {
  const css = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/admin/AdminDashboard.css'), 'utf8');

  assert.ok(css.includes('.admin-modal-overlay'), 'Must define .admin-modal-overlay');
  assert.ok(css.includes('.admin-modal-backdrop'), 'Must define .admin-modal-backdrop with blur');
  assert.ok(css.includes('.admin-modal-dialog'), 'Must define .admin-modal-dialog container');
  assert.ok(css.includes('.admin-add-product-main-btn'), 'Must style .admin-add-product-main-btn');
  assert.ok(css.includes('#0e5c4a'), 'Must use Pine Green #0e5c4a brand color');
  assert.ok(css.includes('@media (max-width: 640px)'), 'Must include mobile responsive breakpoint');
});

test('api.js exports createAdminProduct and createProduct supporting admin role', () => {
  const apiJs = fs.readFileSync(path.join(CLIENT_ROOT, 'src/utils/api.js'), 'utf8');

  assert.ok(apiJs.includes('createAdminProduct:'), 'Must export createAdminProduct');
  assert.ok(apiJs.includes('/api/admin/products'), 'createAdminProduct must call /api/admin/products');
  assert.ok(apiJs.includes("role: 'admin'"), 'Must attach admin role session token');
});
