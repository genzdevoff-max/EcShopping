import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

describe('Checkout Mobile Order Summary & Coupon Responsiveness', () => {
  const checkoutJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/Checkout.jsx'), 'utf8');
  const checkoutCss = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/Checkout.css'), 'utf8');

  test('Coupon section features dedicated responsive input wrapper and distinct Apply button', () => {
    // Structural isolation
    assert.ok(
      checkoutJsx.includes('co-coupon-input-wrap'),
      'Checkout.jsx must wrap coupon input in co-coupon-input-wrap'
    );
    assert.ok(
      checkoutJsx.includes('co-coupon-btn'),
      'Checkout.jsx must assign co-coupon-btn class to Apply / Remove button'
    );

    // CSS responsive rules
    assert.ok(
      checkoutCss.includes('.co-coupon-row'),
      'Checkout.css must define .co-coupon-row'
    );
    assert.match(
      checkoutCss,
      /\.co-coupon-input-wrap\s*{[^}]*flex:\s*1;/s,
      'Coupon input wrap must flex: 1 to shrink gracefully on mobile'
    );
    assert.match(
      checkoutCss,
      /\.co-coupon-input-wrap\s*{[^}]*min-width:\s*0;/s,
      'Coupon input wrap must have min-width: 0'
    );
    assert.match(
      checkoutCss,
      /\.co-coupon-btn\s*{[^}]*flex-shrink:\s*0;/s,
      'Coupon Apply button must have flex-shrink: 0'
    );
    assert.match(
      checkoutCss,
      /\.co-coupon-btn\s*{[^}]*min-height:\s*44px;/s,
      'Coupon Apply button must have at least 44px touch target'
    );
  });

  test('Coupon section stacks vertically on <= 340px for comfortable full-width touch targets', () => {
    assert.ok(
      checkoutCss.includes('@media (max-width: 340px)'),
      'Must define @media (max-width: 340px) rule for very narrow screens'
    );
    assert.match(
      checkoutCss,
      /@media\s*\(max-width:\s*340px\)\s*{[^}]*\.co-coupon-row\s*{[^}]*flex-direction:\s*column;/s,
      'Must stack coupon input and button vertically at <= 340px'
    );
  });

  test('Product row in Order Summary supports word-wrapping and flexible layout', () => {
    assert.match(
      checkoutCss,
      /\.co-item-name\s*{[^}]*flex:\s*1;[^}]*min-width:\s*0;/s,
      'co-item-name must have flex: 1 and min-width: 0'
    );
    assert.match(
      checkoutCss,
      /\.co-item-title\s*{[^}]*word-break:\s*break-word;[^}]*overflow-wrap:\s*anywhere;/s,
      'co-item-title must support word-break: break-word and overflow-wrap: anywhere'
    );
    assert.match(
      checkoutCss,
      /\.co-item-row\s*{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;/s,
      'co-item-row must enforce width: 100% and min-width: 0'
    );
  });

  test('Summary card and layout enforce box-sizing and 100% max-width across mobile breakpoints', () => {
    assert.match(
      checkoutCss,
      /\.checkout-main,\s*\n\s*\.checkout-summary\s*{[^}]*width:\s*100%;/s,
      'Summary and main columns must enforce 100% width on mobile'
    );
    assert.match(
      checkoutCss,
      /\.co-summary-collapsible\.is-expanded\s*{[^}]*width:\s*100%;/s,
      'Collapsible summary card must enforce width: 100%'
    );
    assert.match(
      checkoutCss,
      /\.co-summary-collapsible\.is-expanded\s*{[^}]*box-sizing:\s*border-box;/s,
      'Collapsible summary card must enforce box-sizing: border-box'
    );
  });

  test('Order Summary preserves coupon validation, quantity changes, and Place Order actions', () => {
    assert.ok(checkoutJsx.includes('handleUpdateQuantity'), 'Must preserve handleUpdateQuantity');
    assert.ok(checkoutJsx.includes('handleRemoveItem'), 'Must preserve handleRemoveItem');
    assert.ok(checkoutJsx.includes('applyCoupon'), 'Must preserve applyCoupon');
    assert.ok(checkoutJsx.includes('clearCoupon'), 'Must preserve clearCoupon');
    assert.ok(checkoutJsx.includes('placeOrder'), 'Must preserve placeOrder');
    assert.ok(checkoutJsx.includes('co-shipping-breakdown'), 'Must style shipping breakdown');
  });
});
