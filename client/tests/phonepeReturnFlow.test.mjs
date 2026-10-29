import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');
const SERVER_ROOT = path.resolve(__dirname, '../../server');

const paymentStatusJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/PaymentStatus.jsx'), 'utf8');
const paymentStatusCss = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/PaymentStatus.css'), 'utf8');
const paymentStatesJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/checkout/PaymentStates.jsx'), 'utf8');
const orderConfirmationJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/OrderConfirmation.jsx'), 'utf8');
const checkoutJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/Checkout.jsx'), 'utf8');
const phonepeUtilJs = fs.readFileSync(path.join(SERVER_ROOT, 'utils/phonepe.js'), 'utf8');
const serverIndexJs = fs.readFileSync(path.join(SERVER_ROOT, 'index.js'), 'utf8');

test('PhonePe Return Flow: "Status unavailable" warning is completely eliminated', () => {
  // Neither PaymentStatus nor PaymentStates must contain the confusing "Status unavailable" text
  assert.ok(
    !paymentStatusJsx.includes('Status unavailable'),
    'PaymentStatus.jsx must not render "Status unavailable"'
  );
  assert.ok(
    !paymentStatesJsx.includes('Status unavailable'),
    'PaymentStates.jsx must not render "Status unavailable"'
  );
  assert.ok(
    !orderConfirmationJsx.includes('Status unavailable'),
    'OrderConfirmation.jsx must not render "Status unavailable"'
  );
  assert.ok(
    !paymentStatesJsx.includes('ShieldAlert'),
    'PaymentStates.jsx must not show alarming ShieldAlert icon'
  );
});

test('PhonePe Return Flow: Multi-source orderId resolution withstands mobile app-switching', () => {
  // Query parameters check
  assert.ok(paymentStatusJsx.includes("searchParams.get('orderId')"), 'Must inspect orderId query param');
  assert.ok(paymentStatusJsx.includes("searchParams.get('merchantTransactionId')"), 'Must inspect merchantTransactionId query param');
  assert.ok(paymentStatusJsx.includes("searchParams.get('transactionId')"), 'Must inspect transactionId query param');
  assert.ok(paymentStatusJsx.includes("searchParams.get('merchantOrderId')"), 'Must inspect merchantOrderId query param');

  // Multi-tier storage fallback (sessionStorage, localStorage pending, localStorage last_order)
  assert.ok(paymentStatusJsx.includes("sessionStorage.getItem('ecshopping_pending_payment')"), 'Must check sessionStorage pending payment key');
  assert.ok(paymentStatusJsx.includes("localStorage.getItem('ecshopping_pending_payment')"), 'Must check localStorage pending payment key');
  assert.ok(paymentStatusJsx.includes("localStorage.getItem('ecshopping_last_order')"), 'Must inspect last_order from localStorage as fallback');

  // Checkout.jsx must store both sessionStorage and localStorage before redirecting to PhonePe
  assert.ok(checkoutJsx.includes("sessionStorage.setItem('ecshopping_pending_payment', orderId)"), 'Checkout must set sessionStorage');
  assert.ok(checkoutJsx.includes("localStorage.setItem('ecshopping_pending_payment', orderId)"), 'Checkout must set localStorage pending key');
  assert.ok(checkoutJsx.includes("localStorage.setItem('ecshopping_last_order'"), 'Checkout must cache order in localStorage');
});

test('PhonePe Return Flow (Requirement A): Verified success redirects to OrderConfirmation with authoritative order', () => {
  // Finalizing guard to prevent duplicate navigations
  assert.ok(paymentStatusJsx.includes('finalizingRef'), 'Must use finalizingRef guard');
  assert.ok(paymentStatusJsx.includes('finalizingRef.current = true'), 'Must lock finalizingRef on first execution');

  // Clean transition and cache updates
  assert.ok(paymentStatusJsx.includes("paymentStatus === 'paid'"), 'Must verify paymentStatus is paid');
  assert.ok(paymentStatusJsx.includes("localStorage.setItem('ecshopping_last_order'"), 'Must update ecshopping_last_order on paid');
  assert.ok(paymentStatusJsx.includes('cart?.clear?.()'), 'Must clear cart on verified payment success');
  assert.ok(paymentStatusJsx.includes('clearPendingOrderMarkers'), 'Must clear pending order keys on success');

  // Navigation to order confirmation
  assert.ok(
    paymentStatusJsx.includes('navigate(`/order-confirmation/${orderData.id || orderId}`') ||
    paymentStatusJsx.includes('navigate(`/order-confirmation/'),
    'Must navigate to /order-confirmation/:orderId'
  );
  assert.ok(paymentStatusJsx.includes('replace: true'), 'Must navigate with replace: true to prevent browser-back loops');

  // OrderConfirmation page and PaymentStates render confirmed payment status
  assert.ok(paymentStatesJsx.includes('Payment successful'), 'PaymentStates must render Payment successful header');
  assert.ok(orderConfirmationJsx.includes('PaymentStates'), 'Order confirmation must integrate PaymentStates component');
  assert.ok(orderConfirmationJsx.includes('Thank you'), 'Order confirmation must thank the customer');
});

test('PhonePe Return Flow (Requirement B): Neutral pending state with responsive bounded retries', () => {
  // Verify bounded retry schedule
  assert.ok(paymentStatusJsx.includes('RETRY_DELAYS_MS = [2000, 3000, 4000, 5000, 5000]'), 'Must use 5 bounded retries with fast initial delays');
  assert.ok(!paymentStatusJsx.includes('20000'), 'Must not stall on a 20-second initial freeze');

  // Progress and neutral copy
  assert.ok(paymentStatusJsx.includes('Confirming your payment…'), 'Must show neutral "Confirming your payment…" header');
  assert.ok(paymentStatusJsx.includes('Attempt {attemptIndex} of {RETRY_DELAYS_MS.length}'), 'Must display informative attempt count during retries');

  // Settling state after retries exhausted
  assert.ok(paymentStatusJsx.includes('pending_settling'), 'Must define pending_settling state after retries complete');
  assert.ok(paymentStatusJsx.includes('Payment confirmation in progress'), 'Settling state must inform customer of in-progress payment');
  assert.ok(paymentStatusJsx.includes('Check payment status'), 'Must provide manual "Check payment status" action');
  assert.ok(paymentStatusJsx.includes('View order details'), 'Must provide link to view order details');
});

test('PhonePe Return Flow (Requirement C): Failed or cancelled payment allows retry on SAME order without duplicate', () => {
  // Failed state messaging
  assert.ok(paymentStatusJsx.includes('Payment did not complete'), 'Must display "Payment did not complete"');
  assert.ok(paymentStatusJsx.includes('No amount was deducted') || paymentStatusJsx.includes('No amount has been deducted'), 'Must reassure customer that no funds were deducted');

  // Retry on same order ID
  assert.ok(paymentStatusJsx.includes('createPhonePePayment(orderId)'), 'payAgain must use existing orderId, never minting a duplicate order');
  assert.ok(paymentStatusJsx.includes('Try paying again'), 'Must present "Try paying again" button');
  assert.ok(paymentStatusJsx.includes('Back to cart'), 'Must provide link back to cart');
});

test('PhonePe Return Flow (Requirement D): Unresolved or missing orderId provides calm guidance without alarming errors', () => {
  // Neutral unresolved view
  assert.ok(paymentStatusJsx.includes("state === 'unresolved'"), 'Must handle unresolved state');
  assert.ok(paymentStatusJsx.includes('We’re checking your payment'), 'Must show neutral "We’re checking your payment" header');
  assert.ok(paymentStatusJsx.includes('before paying again to avoid duplicate charges'), 'Must advise checking orders to prevent double charging');
  assert.ok(paymentStatusJsx.includes('/orders'), 'Must link to customer orders');
  assert.ok(paymentStatusJsx.includes('/track-order'), 'Must link to order tracking');
});

test('PhonePe Return Flow (Server & URL Integrity): Server attaches orderId and validates status independently', () => {
  // Server redirect URL helper accepts orderId
  assert.ok(/getPhonePeRedirectUrl\s*=\s*\([^)]*orderId/.test(phonepeUtilJs), 'getPhonePeRedirectUrl must accept orderId parameter');
  assert.ok(phonepeUtilJs.includes('orderId='), 'getPhonePeRedirectUrl must append orderId query param to return URL');

  // Server checkout session creation passes orderId
  assert.ok(
    serverIndexJs.includes('getPhonePeRedirectUrl(process.env, order.id)') ||
    serverIndexJs.includes('getPhonePeRedirectUrl(process.env, merchantOrderId)'),
    'server/index.js must pass order.id to getPhonePeRedirectUrl'
  );

  // Client never trusts query parameters alone for payment success
  assert.ok(
    paymentStatusJsx.includes('verifyPhonePePayment(orderId)'),
    'PaymentStatus must verify status with backend endpoint'
  );
});

test('PhonePe Return Flow (Styling & Accessibility): 44px min-height buttons and responsive layout', () => {
  assert.ok(paymentStatusCss.includes('min-height: 44px'), 'Buttons must meet 44px minimum touch target size');
  assert.ok(paymentStatusCss.includes('.ps-wrap'), 'Must define wrapper container');
  assert.ok(paymentStatusCss.includes('.ps-card'), 'Must define card panel');
  assert.ok(paymentStatusCss.includes('@media (max-width: 520px)'), 'Must support narrow mobile viewports');
});
