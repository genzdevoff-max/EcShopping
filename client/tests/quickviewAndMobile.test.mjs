// Unit and structural regression tests for ProductQuickView, responsive cards, and mobile login pages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { formatINR, discountPercent, parsePrice } from '../src/utils/pricing.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(HERE, rel), 'utf8');

// --------------------------------------------------------------------------
// 1. Pricing and Discount Logic
// --------------------------------------------------------------------------

test('pricing utilities: formatINR formats standard and large amounts correctly', () => {
  assert.equal(formatINR(0), '₹0');
  assert.equal(formatINR(42), '₹42');
  assert.equal(formatINR(1499), '₹1,499');
  assert.equal(formatINR('999'), '₹999');
});

test('pricing utilities: discountPercent calculates integer percentage accurately', () => {
  assert.equal(discountPercent(80, 100), 20);
  assert.equal(discountPercent(75, 100), 25);
  assert.equal(discountPercent(33, 100), 67);
  assert.equal(discountPercent(100, 100), 0);
  assert.equal(discountPercent(120, 100), 0);
  assert.equal(discountPercent(50, 0), 0);
});

test('pricing utilities: parsePrice safely extracts numeric prices', () => {
  assert.equal(parsePrice(49.99), 49.99);
  assert.equal(parsePrice('₹120'), 120);
  assert.equal(parsePrice('invalid'), 0);
  assert.equal(parsePrice(null), 0);
  assert.equal(parsePrice(undefined), 0);
});

// --------------------------------------------------------------------------
// 2. ProductQuickView Structure and Requirements
// --------------------------------------------------------------------------

test('ProductQuickView component exists and includes required modal features', () => {
  assert.ok(existsSync(path.join(HERE, '../src/components/ui/ProductQuickView.jsx')), 'ProductQuickView.jsx must exist');
  assert.ok(existsSync(path.join(HERE, '../src/components/ui/ProductQuickView.css')), 'ProductQuickView.css must exist');

  const source = read('../src/components/ui/ProductQuickView.jsx');

  // React Portal & Dialog role
  assert.ok(source.includes('createPortal'), 'ProductQuickView must render through createPortal');
  assert.ok(source.includes('role="dialog"'), 'ProductQuickView must have role="dialog"');
  assert.ok(source.includes('aria-modal="true"'), 'ProductQuickView must declare aria-modal="true"');

  // Escape listener & background scroll lock
  assert.ok(source.includes("e.key === 'Escape'"), 'ProductQuickView must handle Escape key');
  assert.ok(source.includes("document.body.style.overflow = 'hidden'"), 'ProductQuickView must lock body scrolling');

  // Controls & Data elements
  assert.ok(source.includes('<QuantityStepper'), 'ProductQuickView must reuse QuantityStepper');
  assert.ok(source.includes('quickview-close-btn'), 'ProductQuickView must render a close button');
  assert.ok(source.includes('quickview-price-now'), 'ProductQuickView must render the current price');
  assert.ok(source.includes('quickview-price-was'), 'ProductQuickView must render the compareAt price');
  assert.ok(source.includes('quickview-variant-chip'), 'ProductQuickView must render variant chips');
  assert.ok(source.includes('quickview-stock-notice'), 'ProductQuickView must render stock notices');
  assert.ok(source.includes('quickview-add-btn'), 'ProductQuickView must provide an Add to Cart button');
  assert.ok(source.includes('quickview-details-link'), 'ProductQuickView must link to the full product page');
});

// --------------------------------------------------------------------------
// 3. ProductCard Quick-View Integration and Event Isolation
// --------------------------------------------------------------------------

test('ProductCard integrates quick-view and isolates button events', () => {
  const cardSource = read('../src/components/ui/ProductCard.jsx');

  assert.ok(cardSource.includes('ProductQuickView'), 'ProductCard must import/render ProductQuickView');
  assert.ok(cardSource.includes('pcard-quickview-btn'), 'ProductCard must provide a quick-view trigger');
  assert.ok(cardSource.includes('onQuickView'), 'ProductCard must support onQuickView prop');

  // Ensure stopPropagation is used on Add to Cart and Wishlist so modal is not inadvertently opened
  assert.ok(
    cardSource.includes('handleAdd') && cardSource.includes('e.stopPropagation()'),
    'handleAdd must call e.stopPropagation()'
  );
  assert.ok(
    cardSource.includes('handleWish') && cardSource.includes('e.stopPropagation()'),
    'handleWish must call e.stopPropagation()'
  );
});

// --------------------------------------------------------------------------
// 4. Responsive Card & Grid Breakpoints (320px–430px Support)
// --------------------------------------------------------------------------

test('Product grid CSS supports 2 columns on mobile and 1 column at <= 350px', () => {
  const indexCss = read('../src/index.css');
  assert.ok(indexCss.includes('@media (max-width: 680px)'), 'index.css must handle mobile breakpoint (<= 680px)');
  assert.ok(indexCss.includes('@media (max-width: 350px)'), 'index.css must handle narrow phone breakpoint (<= 350px)');

  const shopCss = read('../src/pages/Shop.css');
  assert.ok(shopCss.includes('@media (max-width: 680px)'), 'Shop.css must handle mobile breakpoint (<= 680px)');
  assert.ok(shopCss.includes('@media (max-width: 350px)'), 'Shop.css must handle narrow phone breakpoint (<= 350px)');

  const uiCss = read('../src/components/ui/ui.css');
  assert.ok(uiCss.includes('min-width: 0'), 'ui.css pcard components must specify min-width: 0 to prevent grid blowout');
  assert.ok(uiCss.includes('flex-wrap: wrap'), 'ui.css price container must flex-wrap to prevent overflow');
});

// --------------------------------------------------------------------------
// 5. Authentication Pages Responsive Polish & Identity Preservation
// --------------------------------------------------------------------------

test('Customer & Vendor login CSS supports narrow phones and touch targets', () => {
  const loginCss = read('../src/pages/Login.css');

  assert.ok(loginCss.includes('min-height: 44px'), 'Login.css must enforce 44px min-height for touch inputs');
  assert.ok(loginCss.includes('.auth-eye-toggle'), 'Login.css must style password eye toggles');
  assert.ok(loginCss.includes('@media (max-width: 640px)'), 'Login.css must support mobile view (<= 640px)');
  assert.ok(loginCss.includes('@media (max-width: 360px)'), 'Login.css must support 320px narrow phones (<= 360px)');
});

test('Admin login page includes secure styling, password eye toggle, and 320px support', () => {
  const adminJsx = read('../src/pages/admin/AdminLogin.jsx');
  const adminCss = read('../src/pages/admin/AdminLogin.css');

  assert.ok(adminJsx.includes('admin-security-badge'), 'AdminLogin.jsx must display admin security badge');
  assert.ok(adminJsx.includes('admin-password-toggle'), 'AdminLogin.jsx must provide a password toggle');
  assert.ok(adminJsx.includes('api.adminLogin'), 'AdminLogin.jsx must preserve api.adminLogin authentication');
  assert.ok(adminJsx.includes('saveAdminSession'), 'AdminLogin.jsx must preserve saveAdminSession');

  assert.ok(adminCss.includes('height: 44px') || adminCss.includes('min-height: 44px'), 'AdminLogin.css must ensure 44px touch targets');
  assert.ok(adminCss.includes('@media (max-width: 360px)'), 'AdminLogin.css must support 320px narrow phones');
});
