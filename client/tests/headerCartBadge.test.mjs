import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

describe('Header Wishlist and Cart Icon Verification', () => {
  const headerJsxPath = path.join(CLIENT_ROOT, 'src/components/Header.jsx');
  const headerCssPath = path.join(CLIENT_ROOT, 'src/components/Header.css');

  test('Header.jsx does not display price in header cart button', () => {
    const content = fs.readFileSync(headerJsxPath, 'utf8');

    // Cart total text and price rendering must be completely removed
    assert.strictEqual(
      content.includes('cart-total-text'),
      false,
      'cart-total-text must not be present in Header.jsx'
    );
    assert.strictEqual(
      content.includes('has-total'),
      false,
      'has-total class must not be applied to cart button'
    );
    assert.strictEqual(
      content.includes('cartSubtotal'),
      false,
      'cartSubtotal should not be computed or used in Header.jsx'
    );

    // Cart button must only show ShoppingCart icon and icon-badge with cartCount
    assert.match(
      content,
      /<button[^>]*className="action-icon-btn header-cart-btn"[^>]*>[\s\S]*?<ShoppingCart[^>]*\/>[\s\S]*?{cartCount > 0 && <span className="icon-badge">{cartCount}<\/span>}/,
      'Cart button must contain ShoppingCart and only icon-badge for item count'
    );

    // Wishlist button must be right before Cart button with matching structure
    assert.match(
      content,
      /<Link to="\/wishlist"[^>]*className="action-icon-btn"[^>]*>[\s\S]*?<Heart[^>]*\/>[\s\S]*?{wishlistCount > 0 && <span className="icon-badge">{wishlistCount}<\/span>}/,
      'Wishlist button must contain Heart and icon-badge for wishlist count'
    );
  });

  test('Header.css styles action-icon-btn cleanly without leftover cart total styles', () => {
    const css = fs.readFileSync(headerCssPath, 'utf8');

    assert.strictEqual(
      css.includes('.cart-total-text'),
      false,
      'No leftover .cart-total-text in Header.css'
    );
    assert.strictEqual(
      css.includes('.header-cart-btn.has-total'),
      false,
      'No leftover .header-cart-btn.has-total in Header.css'
    );

    // action-icon-btn has border: none and cursor: pointer
    assert.match(
      css,
      /\.action-icon-btn\s*{[^}]*border:\s*none;[^}]*cursor:\s*pointer;/s,
      '.action-icon-btn must have border: none and cursor: pointer'
    );
  });
});
