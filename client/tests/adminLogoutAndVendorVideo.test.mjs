import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');
const SERVER_ROOT = path.resolve(__dirname, '../../server');

test('AdminDashboard.jsx contains exactly one Logout button in the sidebar footer', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/admin/AdminDashboard.jsx'), 'utf8');

  // Verify the sidebar logout button is present
  assert.ok(jsx.includes('className="admin-logout-btn"'), 'Must have .admin-logout-btn in sidebar');
  assert.ok(jsx.includes('<button className="admin-logout-btn" onClick={onLogout}>'), 'Sidebar button triggers onLogout');

  // Verify the duplicate header logout button has been removed
  assert.ok(!jsx.includes('admin-header-logout-btn'), 'Duplicate header logout button must not exist');

  // Count occurrences of onClick={onLogout} in buttons
  const logoutButtons = jsx.match(/<button[^>]*onClick=\{onLogout\}[^>]*>/g) || [];
  assert.equal(logoutButtons.length, 1, 'Exactly one button in AdminDashboard must invoke onLogout');
});

test('api.js getProduct resolves session role to authenticate vendor and admin requests', () => {
  const apiJs = fs.readFileSync(path.join(CLIENT_ROOT, 'src/utils/api.js'), 'utf8');

  assert.ok(apiJs.includes('getProduct: (id, role) =>'), 'getProduct accepts id and role');
  assert.ok(apiJs.includes("authSessions.get('admin')"), 'getProduct checks admin session');
  assert.ok(apiJs.includes("authSessions.get('vendor')"), 'getProduct checks vendor session');
  assert.ok(apiJs.includes('deleteCloudinaryVideo'), 'api.js exports deleteCloudinaryVideo helper');
});

test('EditProduct.jsx calls getProduct with vendor role and provides cache fallback', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/vendor/EditProduct.jsx'), 'utf8');

  assert.ok(jsx.includes("api.getProduct(productId, 'vendor')"), 'EditProduct must request product with vendor role');
  assert.ok(jsx.includes('getProducts()'), 'EditProduct must import and use local cache fallback if needed');
});

test('VendorDashboard.jsx allows clicking pending approval products to open edit/inspection', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/vendor/VendorDashboard.jsx'), 'utf8');

  assert.ok(jsx.includes('setEditingProductId(p.id)'), 'VendorDashboard must set editingProductId when pending product is clicked');
  assert.ok(jsx.includes("cursor: ['pending', 'rejected'].includes(p.status) ? 'pointer' : 'default'"), 'Pending product row has pointer cursor');
});

test('AllProducts.jsx incorporates video upload and URL management in edit modal', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/vendor/AllProducts.jsx'), 'utf8');

  assert.ok(jsx.includes('handleVideoFileUpload'), 'AllProducts must define handleVideoFileUpload');
  assert.ok(jsx.includes('handleApplyVideoUrl'), 'AllProducts must define handleApplyVideoUrl');
  assert.ok(jsx.includes("api.uploadVideo(file, 'vendor')"), 'AllProducts must invoke api.uploadVideo with vendor role');
  assert.ok(jsx.includes('videoUrl: editingProduct.videoUrl'), 'AllProducts must save videoUrl on edit save');
  assert.ok(jsx.includes('previewProduct.videoUrl'), 'AllProducts preview modal must display product video');
});

test('server index.js targets ecshopping/products/videos folder and exposes video delete', () => {
  const serverJs = fs.readFileSync(path.join(SERVER_ROOT, 'index.js'), 'utf8');

  assert.ok(serverJs.includes("folder: 'ecshopping/products/videos'"), 'Cloudinary video upload must target ecshopping/products/videos');
  assert.ok(serverJs.includes('/api/upload/video/delete'), 'Server must provide /api/upload/video/delete endpoint');
  assert.ok(serverJs.includes('resource_type: \'video\''), 'Upload and delete must specify video resource_type');
});

test('VendorDashboard.jsx contains exactly one Logout button in the sidebar footer and has mobile close button', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/vendor/VendorDashboard.jsx'), 'utf8');

  // Verify the sidebar footer has vendor-logout-btn
  assert.ok(jsx.includes('className="vendor-logout-btn"'), 'Must have .vendor-logout-btn');
  assert.ok(jsx.includes('vendor-sidebar-footer'), 'Must place logout in vendor-sidebar-footer');
  assert.ok(jsx.includes('vendor-sidebar-close-btn'), 'Must have mobile drawer close button');

  // Count occurrences of onClick={onLogout} in buttons
  const logoutButtons = jsx.match(/<button[^>]*onClick=\{onLogout\}[^>]*>/g) || [];
  assert.equal(logoutButtons.length, 1, 'Exactly one button in VendorDashboard must invoke onLogout');
});

test('AdminDashboard.css and VendorDashboard.css provide mobile drawer responsive styling with safe area insets and touch targets >= 44px', () => {
  const adminCss = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/admin/AdminDashboard.css'), 'utf8');
  const vendorCss = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/vendor/VendorDashboard.css'), 'utf8');

  // Admin touch targets and safe area insets
  assert.ok(adminCss.includes('admin-sidebar-footer'), 'Admin CSS defines admin-sidebar-footer');
  assert.ok(adminCss.includes('min-height: 48px'), 'Admin logout button has min-height >= 44px');
  assert.ok(adminCss.includes('env(safe-area-inset-bottom'), 'Admin CSS includes safe area insets on mobile');
  assert.ok(adminCss.includes('100dvh'), 'Admin CSS includes 100dvh for mobile drawer viewport sizing');

  // Vendor touch targets and safe area insets
  assert.ok(vendorCss.includes('vendor-sidebar-footer'), 'Vendor CSS defines vendor-sidebar-footer');
  assert.ok(vendorCss.includes('min-height: 48px'), 'Vendor logout button has min-height >= 44px');
  assert.ok(vendorCss.includes('env(safe-area-inset-bottom'), 'Vendor CSS includes safe area insets on mobile');
  assert.ok(vendorCss.includes('100dvh'), 'Vendor CSS includes 100dvh for mobile drawer viewport sizing');
  assert.ok(vendorCss.includes('vendor-sidebar-close-btn'), 'Vendor CSS defines vendor-sidebar-close-btn');
});
