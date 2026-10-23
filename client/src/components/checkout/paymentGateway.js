/**
 * PhonePe Standard Checkout v2 — client seam.
 *
 * The client only ever asks the backend to start a checkout session for an
 * EXISTING server-side order and to verify the outcome afterwards. The
 * payable amount is read from the order row by the server; nothing in the
 * browser can mint a paid state.
 */
import api from '../../utils/api';

/** Route the gateway redirects shoppers back to (registered server-side). */
export const PAYMENT_RETURN_PATH = '/payment/phonepe/return';

/** Asks the backend to create the checkout session; resolves with the
 *  official redirect URL, or throws with a user-safe message. */
export async function createPhonePePayment(orderId) {
  const res = await api.createPhonePePayment(orderId);
  if (res?.missingConfig) {
    throw new Error(res.error || 'PhonePe payments are not configured yet.');
  }
  if (!res?.success || !res.redirectUrl) {
    throw new Error(res?.error || 'PhonePe did not return a payment page. No amount was charged.');
  }
  return res;
}

/** Asks the backend to verify the gateway status for an order. */
export async function verifyPhonePePayment(orderId) {
  const res = await api.verifyPhonePePayment(orderId);
  if (res?.missingConfig) {
    throw new Error(res.error || 'PhonePe payments are not configured yet.');
  }
  if (!res?.success || !res.paymentStatus) {
    throw new Error(res?.error || 'Verification failed. The order stays pending until confirmed.');
  }
  return res; // { paymentStatus: 'paid'|'failed'|'pending', order, gatewayState? }
}
