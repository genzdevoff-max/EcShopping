import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');
const SERVER_ROOT = path.resolve(CLIENT_ROOT, '../server');

const appJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/App.jsx'), 'utf8');
const viteConfig = fs.readFileSync(path.join(CLIENT_ROOT, 'vite.config.js'), 'utf8');
const serverIndex = fs.readFileSync(path.join(SERVER_ROOT, 'index.js'), 'utf8');
const serverDb = fs.readFileSync(path.join(SERVER_ROOT, 'db.js'), 'utf8');

test('App.jsx implements route-level code splitting with React.lazy and Suspense', () => {
  assert.ok(appJsx.includes('lazy('), 'App.jsx must import and use React.lazy');
  assert.ok(appJsx.includes('<Suspense'), 'App.jsx must wrap routes in Suspense boundary');
  assert.ok(appJsx.includes("lazy(() => import('./pages/admin/AdminDashboard'))"), 'AdminDashboard must be lazy loaded');
  assert.ok(appJsx.includes("lazy(() => import('./pages/vendor/VendorDashboard'))"), 'VendorDashboard must be lazy loaded');
  assert.ok(appJsx.includes("lazy(() => import('./pages/Checkout'))"), 'Checkout must be lazy loaded');
});

test('vite.config.js optimizes vendor chunks with manualChunks function', () => {
  assert.ok(viteConfig.includes('manualChunks(id)'), 'vite.config.js must provide manualChunks function for Rolldown');
  assert.ok(viteConfig.includes('vendor-react'), 'Must chunk react dependencies');
  assert.ok(viteConfig.includes('vendor-icons'), 'Must chunk lucide-react icons');
});

test('server optimizes query performance and static asset caching', () => {
  // Products query optimization
  assert.ok(
    serverIndex.includes('if (built.limit === null) {\n        total = rows.length;\n      } else {'),
    'Server must skip redundant COUNT(*) queries when products are unpaginated'
  );

  // Categories caching
  assert.ok(
    serverIndex.includes("res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')"),
    'Public categories endpoint must return Cache-Control header'
  );

  // Database performance indexes
  assert.ok(
    serverDb.includes('idx_products_status_category'),
    'Database initialization must create composite index on products(status, category)'
  );
  assert.ok(
    serverDb.includes('idx_orders_customer_status'),
    'Database initialization must create index on orders(customer_email, status)'
  );
});
