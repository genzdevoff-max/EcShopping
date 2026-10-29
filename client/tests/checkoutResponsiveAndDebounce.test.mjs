import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

const checkoutJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/Checkout.jsx'), 'utf8');
const checkoutCss = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/Checkout.css'), 'utf8');

test('Checkout.jsx implements internal submission guard preventing duplicate order submissions and double clicks', () => {
  // Verifies useRef submission guard
  assert.ok(checkoutJsx.includes('useRef'), 'Must import useRef for non-render state guard');
  assert.ok(checkoutJsx.includes('submittingRef = useRef(false)'), 'Must declare submittingRef initialized to false');
  
  // Guard check before order creation
  assert.ok(
    checkoutJsx.includes('if (submitting || submittingRef.current) return;'),
    'placeOrder must immediately discard duplicate clicks/calls when submitting is active'
  );
  assert.ok(
    checkoutJsx.includes('submittingRef.current = true;'),
    'placeOrder must flag submittingRef as true before making server call'
  );

  // Recovery when errors occur
  assert.ok(
    checkoutJsx.includes('submittingRef.current = false;\n      setSubmitting(false);'),
    'Must re-enable submission guard when order creation or validation fails'
  );

  // Submit buttons disabled state and loading indicators
  assert.ok(checkoutJsx.includes('disabled={submitting}'), 'Submit button must be disabled when submitting');
  assert.ok(checkoutJsx.includes('animate-spin') || checkoutJsx.includes('Loader2'), 'Must display spinner icon when submitting');
});

test('Checkout.jsx provides mobile collapsible order summary disclosure with accessible semantics', () => {
  // Summary toggle button
  assert.ok(checkoutJsx.includes('co-summary-toggle-btn'), 'Must have dedicated summary toggle button');
  assert.ok(checkoutJsx.includes('aria-expanded={!summaryCollapsed}'), 'Must expose dynamic aria-expanded state');
  assert.ok(checkoutJsx.includes('aria-controls="co-summary-content"'), 'Must link toggle to collapsible summary body');
  assert.ok(checkoutJsx.includes('Show order summary'), 'Must have clear Show order summary text');
  assert.ok(checkoutJsx.includes('Hide order summary'), 'Must have clear Hide order summary text');

  // Both desktop and mobile submission buttons correctly wired
  assert.ok(checkoutJsx.includes('co-main-submit-bar'), 'Must provide reachable submit button in main form for mobile');
  assert.ok(checkoutJsx.includes('co-summary-submit-desktop'), 'Must retain desktop summary submit button');
});

test('Checkout.css enforces responsive single-column layout, 44px touch targets, and iOS zoom prevention', () => {
  // Mobile breakpoint
  assert.ok(checkoutCss.includes('@media (max-width: 960px)'), 'Must define responsive rules at 960px breakpoint');
  assert.ok(checkoutCss.includes('grid-template-columns: 1fr'), 'Mobile layout must collapse into single column');

  // Collapsible summary visibility
  assert.ok(checkoutCss.includes('.co-summary-collapsible.is-collapsed'), 'Must define collapsed state');
  assert.ok(checkoutCss.includes('.co-summary-collapsible.is-expanded'), 'Must define expanded state');

  // 44px min touch target rule
  assert.ok(checkoutCss.includes('min-height: 44px'), 'Must enforce at least 44px touch targets on mobile');

  // iOS zoom prevention (font-size >= 16px)
  assert.ok(
    checkoutCss.includes('font-size: 16px') || checkoutCss.includes('font-size: 16px !important'),
    'Must enforce 16px font size on inputs to prevent iOS auto-zoom'
  );
});
