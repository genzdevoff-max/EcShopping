/**
 * PhonePe Payment Gateway client (Standard Checkout v2).
 *
 * Implements the official server-to-server flow documented at
 * developer.phonepe.com (Standard Checkout — Website Integration):
 *   1. Authorization: POST {authBase}/v1/oauth/token
 *      (x-www-form-urlencoded: client_id, client_version, client_secret,
 *      grant_type=client_credentials) → { access_token, expires_at, token_type }
 *   2. Create payment: POST {pgBase}/checkout/v2/pay
 *      body { merchantOrderId, amount (paisa), expireAfter,
 *             paymentFlow: { type: 'PG_CHECKOUT', merchantUrls: { redirectUrl } } }
 *      header `Authorization: O-Bearer <access_token>`
 *      → { orderId, state: 'PENDING', expireAt, redirectUrl }
 *   3. Verify: GET {pgBase}/checkout/v2/order/{merchantOrderId}/status
 *      → root `state`: PENDING | COMPLETED | FAILED | EXPIRED, plus
 *        paymentDetails[] attempts; only the root state is trusted for
 *        payment-status decisions (per the UAT checklist).
 *
 * Security rules:
 *   - Client IDs, versions and secrets come exclusively from the environment
 *     (server/.env) and are NEVER logged or echoed to responses.
 *   - Amounts are always derived from the trusted order row by the routes in
 *     server/index.js; this module validates shape only.
 *   - No local "success" simulation exists here: without configured sandbox
 *     credentials every call fails hard, and callers surface 503.
 */

const ENVIRONMENTS = {
  production: {
    auth: 'https://api.phonepe.com/apis/identity-manager',
    pg: 'https://api.phonepe.com/apis/pg'
  },
  sandbox: {
    auth: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    pg: 'https://api-preprod.phonepe.com/apis/pg-sandbox'
  }
};

const REQUIRED_ENV = ['PHONEPE_CLIENT_ID', 'PHONEPE_CLIENT_VERSION', 'PHONEPE_CLIENT_SECRET', 'PHONEPE_REDIRECT_URL'];

/** Validates payment-gateway configuration without leaking secret values. */
export const validatePhonePeConfig = (env = process.env) => {
  const missing = REQUIRED_ENV.filter((key) => !String(env[key] || '').trim());
  return { ok: missing.length === 0, missing };
};

const pgBase = () => (process.env.PHONEPE_ENV === 'production' ? ENVIRONMENTS.production.pg : ENVIRONMENTS.sandbox.pg);
const authBase = () =>
  process.env.PHONEPE_ENV === 'production' ? ENVIRONMENTS.production.auth : ENVIRONMENTS.sandbox.auth;

/* Token cache: PhonePe tokens are issued with a validity window; refresh a
 * minute before expiry. A missing/invalid expiry never pins a dead token. */
let cachedToken = null;

export const resetTokenCache = () => { cachedToken = null; };

async function getAccessToken() {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - nowSec > 60) return cachedToken.token;

  const form = new URLSearchParams({
    client_id: process.env.PHONEPE_CLIENT_ID,
    client_version: process.env.PHONEPE_CLIENT_VERSION,
    client_secret: process.env.PHONEPE_CLIENT_SECRET,
    grant_type: 'client_credentials'
  });

  let res;
  try {
    res = await fetch(`${authBase()}/v1/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
  } catch {
    throw new Error('Could not reach PhonePe to authorize the payment request');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    throw new Error(res.status === 401 ? 'Payment gateway rejected the merchant credentials' : 'Payment gateway authorization failed');
  }
  cachedToken = {
    token: data.access_token,
    // expires_at is epoch seconds; fall back to a short validity window so
    // malformed expiry values never pin a dead token.
    expiresAt: Number(data.expires_at) || nowSec + 120
  };
  return cachedToken.token;
}

/** Paisa integer between ₹1 and ₹1,00,00,000 per request constraints. */
export const assertPaisa = (paisa) => Number.isInteger(Number(paisa))
  && Number(paisa) >= 100 && Number(paisa) <= 100000000;

export const phonePeError = (status, message) => Object.assign(new Error(message), { status });

export async function createCheckoutPayment({ merchantOrderId, amountPaisa, redirectUrl, metaInfo, expireAfter }) {
  if (!assertPaisa(amountPaisa)) throw phonePeError(400, 'Payment amount is outside the gateway limits');
  const token = await getAccessToken();

  let res;
  try {
    res = await fetch(`${pgBase()}/checkout/v2/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${token}` },
      body: JSON.stringify({
        merchantOrderId: String(merchantOrderId),
        amount: Number(amountPaisa),
        ...(Number.isFinite(Number(expireAfter)) ? { expireAfter: Number(expireAfter) } : {}),
        paymentFlow: {
          type: 'PG_CHECKOUT',
          merchantUrls: { redirectUrl: String(redirectUrl) }
        },
        ...(metaInfo && Object.keys(metaInfo).length ? { metaInfo } : {})
      })
    });
  } catch {
    throw phonePeError(502, 'Could not reach the PhonePe payment gateway');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw phonePeError(res.status === 400 ? 400 : 502, data?.message || 'PhonePe rejected the payment request');
  }
  if (!data?.redirectUrl || data.state !== 'PENDING') {
    throw phonePeError(502, 'PhonePe did not create a checkout session');
  }
  return data; // { orderId, state, expireAt, redirectUrl }
}

export async function getOrderStatus(merchantOrderId) {
  const token = await getAccessToken();
  let res;
  try {
    res = await fetch(
      `${pgBase()}/checkout/v2/order/${encodeURIComponent(String(merchantOrderId))}/status?details=true&errorContext=true`,
      { headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${token}` } }
    );
  } catch {
    throw phonePeError(502, 'Could not reach the PhonePe status endpoint');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw phonePeError(res.status === 404 ? 404 : 502, data?.message || 'Payment status lookup failed');
  return data; // { orderId, state, amount, expireAt, paymentDetails? }
}

/**
 * Pure state mapping used by the verify route and unit tests. Per the UAT
 * checklist only the root-level `state` decides payment status; unknown
 * states must resolve to 'pending' rather than inventing a terminal result.
 */
export const mapPhonePeState = (state) => {
  switch (String(state || '').toUpperCase()) {
    case 'COMPLETED': return 'paid';
    case 'FAILED':
    case 'CANCELLED':
    case 'CANCELLED_BY_USER':
    case 'EXPIRED': return 'failed';
    default: return 'pending';
  }
};

/** Latest successful attempt id for receipt references (may be null). */
export const latestTransactionId = (statusRow) => {
  const details = Array.isArray(statusRow?.paymentDetails) ? statusRow.paymentDetails : [];
  const completed = details.filter((d) => String(d?.state || '').toUpperCase() === 'COMPLETED');
  const pick = completed.length ? completed[completed.length - 1] : details[details.length - 1];
  return pick?.transactionId ? String(pick.transactionId) : null;
};
