/**
 * PhonePe Payment Gateway client (Dual-Mode: Option A Hermes PG v1 & Option B Standard Checkout v2).
 *
 * Mode Detection:
 *   - Option B (v2 OAuth): Enabled when PHONEPE_CLIENT_ID and PHONEPE_CLIENT_SECRET are set.
 *     Uses /v1/oauth/token and /checkout/v2/pay.
 *   - Option A (v1 Hermes): Enabled when PHONEPE_MERCHANT_ID and PHONEPE_SALT_KEY are set.
 *     Uses /pg/v1/pay with SHA256 checksum and X-VERIFY header.
 *
 * Security rules:
 *   - Client IDs, salt keys, and secrets come exclusively from the environment
 *     and are NEVER logged or echoed to responses.
 *   - Amounts are always derived from the trusted order row by the routes in
 *     server/index.js; this module validates shape only.
 *   - Without configured credentials, every call fails closed with 503.
 */

import crypto from 'node:crypto';

const ENVIRONMENTS = {
  production: {
    auth: 'https://api.phonepe.com/apis/identity-manager',
    pg: 'https://api.phonepe.com/apis/pg',
    hermes: 'https://api.phonepe.com/apis/hermes'
  },
  sandbox: {
    auth: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    pg: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    hermes: 'https://api-preprod.phonepe.com/apis/pg-sandbox'
  }
};

const REQUIRED_ENV_V2 = ['PHONEPE_CLIENT_ID', 'PHONEPE_CLIENT_VERSION', 'PHONEPE_CLIENT_SECRET', 'PHONEPE_REDIRECT_URL'];

const getOptAConfig = (env = process.env) => {
  const merchantId = String(env.PHONEPE_MERCHANT_ID || env.phonepe_merchant_id || '').trim();
  const saltKey = String(env.PHONEPE_SALT_KEY || env.phonepe_salt_key || '').trim();
  const saltIndex = String(env.PHONEPE_SALT_INDEX || env.phonepe_salt_index || '1').trim();
  const envType = String(env.PHONEPE_ENV || env.phonepe_env || 'sandbox').trim().toLowerCase();
  const isProd = envType === 'prod' || envType === 'production';
  const defaultHost = isProd ? ENVIRONMENTS.production.hermes : ENVIRONMENTS.sandbox.hermes;
  const hostUrl = String(env.PHONEPE_HOST_URL || env.phonepe_host_url || defaultHost).trim();
  const redirectUrl = String(env.PHONEPE_REDIRECT_URL || env.phonepe_redirect_url || '').trim();

  return {
    merchantId,
    saltKey,
    saltIndex,
    isProd,
    hostUrl,
    redirectUrl,
    isValid: Boolean(merchantId && saltKey && saltIndex)
  };
};

const getOptBConfig = (env = process.env) => {
  const missing = REQUIRED_ENV_V2.filter((key) => !String(env[key] || '').trim());
  return {
    isValid: missing.length === 0,
    missing
  };
};

/** Validates payment-gateway configuration without leaking secret values. */
export const validatePhonePeConfig = (env = process.env) => {
  const optB = getOptBConfig(env);
  if (optB.isValid) {
    return { ok: true, mode: 'v2', missing: [] };
  }

  const optA = getOptAConfig(env);
  if (optA.isValid) {
    return { ok: true, mode: 'v1', missing: [] };
  }

  // When neither is configured, report missing keys for v2 (preserving test contract)
  return { ok: false, mode: null, missing: optB.missing };
};

const pgBase = () => (process.env.PHONEPE_ENV === 'production' ? ENVIRONMENTS.production.pg : ENVIRONMENTS.sandbox.pg);
const authBase = () =>
  process.env.PHONEPE_ENV === 'production' ? ENVIRONMENTS.production.auth : ENVIRONMENTS.sandbox.auth;

/* Token cache for Option B (OAuth v2) */
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

  const config = validatePhonePeConfig();
  if (!config.ok) {
    throw phonePeError(503, 'PhonePe payments are not configured yet');
  }

  // OPTION A: Hermes PG v1 integration
  if (config.mode === 'v1') {
    const optA = getOptAConfig();
    const effectiveRedirect = redirectUrl || optA.redirectUrl || 'https://ec-shopping.vercel.app/payment/phonepe/return';

    const payload = {
      merchantId: optA.merchantId,
      merchantTransactionId: String(merchantOrderId),
      merchantUserId: String(metaInfo?.udf2 || 'MUID_' + String(merchantOrderId).replace(/[^a-zA-Z0-9]/g, '')).slice(0, 36),
      amount: Number(amountPaisa),
      redirectUrl: effectiveRedirect,
      redirectMode: 'REDIRECT',
      callbackUrl: effectiveRedirect,
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const stringToHash = base64Payload + '/pg/v1/pay' + optA.saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const checksum = `${sha256}###${optA.saltIndex}`;

    let res;
    try {
      res = await fetch(`${optA.hostUrl}/pg/v1/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': checksum
        },
        body: JSON.stringify({ request: base64Payload })
      });
    } catch {
      throw phonePeError(502, 'Could not reach the PhonePe payment gateway');
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      throw phonePeError(res.status === 400 ? 400 : 502, data?.message || 'PhonePe rejected the payment request');
    }

    const payUrl = data?.data?.instrumentResponse?.redirectInfo?.url;
    if (!payUrl) {
      throw phonePeError(502, 'PhonePe did not provide a redirect URL');
    }

    return {
      orderId: data.data.merchantTransactionId || String(merchantOrderId),
      state: 'PENDING',
      expireAt: null,
      redirectUrl: payUrl
    };
  }

  // OPTION B: Standard Checkout v2 OAuth integration
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
  const config = validatePhonePeConfig();
  if (!config.ok) {
    throw phonePeError(503, 'PhonePe payments are not configured yet');
  }

  // OPTION A: Hermes PG v1 Status
  if (config.mode === 'v1') {
    const optA = getOptAConfig();
    const endpoint = `/pg/v1/status/${optA.merchantId}/${encodeURIComponent(String(merchantOrderId))}`;
    const stringToHash = endpoint + optA.saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const checksum = `${sha256}###${optA.saltIndex}`;

    let res;
    try {
      res = await fetch(`${optA.hostUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': checksum,
          'X-MERCHANT-ID': optA.merchantId
        }
      });
    } catch {
      throw phonePeError(502, 'Could not reach the PhonePe status endpoint');
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw phonePeError(res.status === 404 ? 404 : 502, data?.message || 'Payment status lookup failed');
    }

    // Map PhonePe v1 code/state
    const code = String(data?.code || '').toUpperCase();
    let state = 'PENDING';
    if (code === 'PAYMENT_SUCCESS') {
      state = 'COMPLETED';
    } else if (code === 'PAYMENT_ERROR' || code === 'PAYMENT_DECLINED' || code === 'TIMED_OUT') {
      state = 'FAILED';
    }

    const txnId = data?.data?.transactionId || data?.data?.providerReferenceId || null;
    return {
      orderId: data?.data?.merchantTransactionId || String(merchantOrderId),
      state,
      amount: data?.data?.amount,
      expireAt: null,
      paymentDetails: txnId ? [{ transactionId: txnId, state }] : []
    };
  }

  // OPTION B: Standard Checkout v2 Status
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
 * Pure state mapping used by the verify route and unit tests.
 */
export const mapPhonePeState = (state) => {
  switch (String(state || '').toUpperCase()) {
    case 'COMPLETED':
    case 'PAYMENT_SUCCESS':
    case 'SUCCESS':
      return 'paid';
    case 'FAILED':
    case 'CANCELLED':
    case 'CANCELLED_BY_USER':
    case 'EXPIRED':
    case 'PAYMENT_ERROR':
    case 'PAYMENT_DECLINED':
      return 'failed';
    default:
      return 'pending';
  }
};

/** Latest successful attempt id for receipt references (may be null). */
export const latestTransactionId = (statusRow) => {
  const details = Array.isArray(statusRow?.paymentDetails) ? statusRow.paymentDetails : [];
  const completed = details.filter((d) => {
    const s = String(d?.state || '').toUpperCase();
    return s === 'COMPLETED' || s === 'PAYMENT_SUCCESS' || s === 'SUCCESS';
  });
  const pick = completed.length ? completed[completed.length - 1] : details[details.length - 1];
  return pick?.transactionId ? String(pick.transactionId) : null;
};
