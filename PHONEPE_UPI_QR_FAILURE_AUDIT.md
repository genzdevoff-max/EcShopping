# PhonePe UPI QR Generation Failure — Diagnostic & Architectural Audit

**Repository:** `E:\EcShopping`  
**Date:** October 27, 2026  
**Status:** `CONFIGURATION ACTION REQUIRED`  
**Frontend Origin:** `https://ec-shopping.vercel.app`  
**Backend Origin:** `https://ec-shopping-three.vercel.app`  
**Merchant Page Name:** EConnect Internet Centre  

---

## 1. Executive Summary & Root Cause Analysis

### Observed Failure
When a customer selects PhonePe hosted checkout and clicks **"Click to view QR"** on the hosted payment page, the browser issues:
- **Request:** `POST https://api.phonepe.com/apis/pg/checkout/ui/v2/pay`
- **Payload:** `{"type":"UPI_QR"}`
- **HTTP Status:** `400 Bad Request`
- **Response:** `INTERNAL_SECURITY_BLOCK_1`, `isRetryEnabled: false`

### Root Cause Diagnosis
According to official PhonePe Business and Developer Documentation:
> **`INTERNAL_SECURITY_BLOCK_1`**: *"Payment blocked as the payment URL doesn't match the one you shared during onboarding."*  
> **Category:** `TXN_BLOCKED` / `PRE_AUTHENTICATION` / `PAYMENT_GATEWAY` / `Fraud Risk Assessment (FRA)`

1. **Merchant Domain Whitelist Mismatch (Primary Cause):**
   - The PhonePe merchant account is registered under **"EConnect Internet Centre"** (MID: `M22KWW43XGUAZ`).
   - During merchant onboarding/KYC for "EConnect Internet Centre", a specific business website URL was provided (or an offline/placeholder domain).
   - Live payment requests and redirects are originating from `https://ec-shopping.vercel.app` with return URL `https://ec-shopping.vercel.app/payment/phonepe/return`.
   - When the user clicks **"Click to view QR"**, PhonePe's checkout UI invokes its backend (`/apis/pg/checkout/ui/v2/pay`), triggering PhonePe's pre-authentication Fraud Risk Assessment (FRA). Because `https://ec-shopping.vercel.app` is not the authorized domain whitelisted in the merchant profile for "EConnect Internet Centre", PhonePe server rejects dynamic QR generation with `INTERNAL_SECURITY_BLOCK_1`.

2. **Referrer Policy & Origin Disclosure:**
   - PhonePe's documentation specifies that if a checkout page opens or redirects without passing a valid HTTP `Referer` (or uses a `no-referrer` policy), PhonePe receives an empty merchant URL and blocks the transaction.
   - The application previously lacked an explicit `<meta name="referrer" content="strict-origin-when-cross-origin" />` tag in `client/index.html` and explicit `Referrer-Policy` response headers in `client/vercel.json`.

3. **`merchantUserId` Specification Compliance:**
   - PhonePe's integration specification strictly mandates that `merchantUserId` must be **alphanumeric only** (`^[a-zA-Z0-9]{1,35}$`), under 36 characters, and must **never contain PII** (such as customer email or mobile number).
   - The backend was passing `metaInfo.udf2` (which contained the customer email with special characters `@` and `.`) into `merchantUserId`. This violated PhonePe's input constraints and was corrected.

---

## 2. Fault Attribution

| Layer | Responsibility | Status | Details |
|---|---|---|---|
| **EcShopping Application Code** | EcShopping Engineering | **Fixed & Verified** | Hardened Referrer-Policy on frontend and sanitized `merchantUserId` on backend to strictly comply with PhonePe specs. |
| **PhonePe Merchant Configuration** | Merchant / PhonePe Admin | **Configuration Action Required** | The domain `https://ec-shopping.vercel.app` must be added/whitelisted in the PhonePe Business Dashboard for "EConnect Internet Centre". |
| **PhonePe Support Action** | PhonePe Merchant Operations | **Required if self-serve update is locked** | If the Business Dashboard does not allow updating website URLs for active MIDs, a support ticket to PhonePe Merchant Support / Account Manager is required. |

---

## 3. Exact Files Changed and Why

### 1. `client/index.html`
- **Change:** Added `<meta name="referrer" content="strict-origin-when-cross-origin" />` in the `<head>` section.
- **Why:** Complies with PhonePe's security requirement ensuring the browser always passes the origin `https://ec-shopping.vercel.app/` as the HTTP `Referer` header to PhonePe's hosted checkout, preventing blank referrer FRA blocks.

### 2. `client/vercel.json`
- **Change:** Added security header configuration:
  ```json
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
  ```
- **Why:** Enforces `Referrer-Policy: strict-origin-when-cross-origin` on all deployed static assets and SPA routes served by Vercel.

### 3. `server/utils/phonepe.js`
- **Change:** Added `sanitizeMerchantUserId(rawUserId, fallbackOrderId)` helper:
  - Strips non-alphanumeric characters.
  - Validates length (`>= 3 && <= 35`).
  - Falls back to `MUID` + sanitized order ID.
  - Replaced usage of `metaInfo?.udf2` (customer email) with sanitized, PII-free merchant user identifier.
- **Why:** PhonePe strictly rejects or blocks transactions where `merchantUserId` contains special characters (`@`, `.`, `-`) or contains PII like email addresses.

### 4. `server/test/phonepe.test.js`
- **Change:** Added automated regression test for `sanitizeMerchantUserId`:
  - Validates stripping of email special characters (`@`, `.`).
  - Verifies fallback generation (`MUID` + order ID).
  - Verifies string length clamping (`<= 35`).
  - Verifies regex adherence (`/^[a-zA-Z0-9]{1,35}$/`).
- **Why:** Prevents regressions in PhonePe parameter formatting.

---

## 4. Tests Run and Actual Results

| Test Suite / Step | Command | Working Directory | Result | Details |
|---|---|---|---|---|
| **Server Integration & Payment Tests** | `npm test --prefix server` | `E:\EcShopping\server` | **121 / 121 PASS (100%)** | All 11 suites passed, including `phonepe.test.js` with new `sanitizeMerchantUserId` assertions. |
| **Client Automated Unit Tests** | `npm test --prefix client` | `E:\EcShopping\client` | **53 / 53 PASS (100%)** | All client tests passed (auth, mapProduct, orders, quickview, storefront). |
| **Client Linter Hygiene** | `npm run lint --prefix client` | `E:\EcShopping\client` | **0 Errors** (54 style/hook warnings) | `oxlint` passed cleanly. |
| **Client Production Build** | `npm run build --prefix client` | `E:\EcShopping\client` | **0 Errors (PASS in 6.85s)** | Vite bundle generated successfully with index and assets. |

---

## 5. Required Vercel Environment Variables & Dashboard Settings

> [!IMPORTANT]
> Never expose secrets in documentation or source control. Only variable names and configuration keys are listed below.

### Backend Vercel Project (`ec-shopping-three.vercel.app`)
Ensure these exact environment variable names are configured in the Vercel Project Settings (`Environment Variables`):

| Variable Name | Required Value / Description | Sensitive |
|---|---|---|
| `PHONEPE_ENV` | `production` | No |
| `PHONEPE_HOST_URL` | `https://api.phonepe.com/apis/hermes` | No |
| `PHONEPE_MERCHANT_ID` | Production Merchant ID for "EConnect Internet Centre" | Yes |
| `PHONEPE_SALT_KEY` | Production Salt Key associated with the MID | Yes |
| `PHONEPE_SALT_INDEX` | Salt Key Index (typically `1`) | No |
| `PHONEPE_REDIRECT_URL` | `https://ec-shopping.vercel.app/payment/phonepe/return` | No |
| `PHONEPE_ENABLED` | `true` | No |

### Frontend Vercel Project (`ec-shopping.vercel.app`)
| Variable Name | Required Value / Description | Sensitive |
|---|---|---|
| `VITE_API_URL` | `https://ec-shopping-three.vercel.app` | No |

### PhonePe Business Dashboard Configuration (Action Required by Merchant)
Log into the **PhonePe Business Dashboard** (`https://business.phonepe.com`):
1. **Registered Website / Allowed Domains:**
   - Go to **Account Details / Developer Settings / Website Details**.
   - Verify the authorized website URL.
   - Add/Update the domain: `https://ec-shopping.vercel.app`
   - Add the return path: `https://ec-shopping.vercel.app/payment/phonepe/return`
2. **Accepted Payment Modes:**
   - Under **Payment Gateway Settings -> Payment Modes**, verify that **UPI Dynamic QR** (`UPI_QR`) is **Enabled / Active**.
3. **If Self-Serve Editing is Locked:**
   - Raise a ticket with PhonePe Merchant Support or contact the Relationship Manager (RM).
   - Provide:
     - **Merchant ID:** `M22KWW43XGUAZ`
     - **Business Name:** `EConnect Internet Centre`
     - **Authorized Storefront Domain:** `https://ec-shopping.vercel.app`
     - **Return / Callback URL:** `https://ec-shopping.vercel.app/payment/phonepe/return`
     - **Request:** Whitelist `https://ec-shopping.vercel.app` for online payment initiation and enable UPI QR generation.

---

## 6. Production Verification Status

- **Simulated / Unit Testing:** **COMPLETED** (121 server tests, 53 client tests, 0 lint errors, build succeeded).
- **Actual Live Production Test:** **NOT COMPLETED**
  - In accordance with task safety constraints, no real customer payments were initiated, no test money was captured, no production database orders were deleted, and production merchant credentials were not rotated.
  - Live production testing can proceed only after PhonePe Merchant Support / Dashboard completes domain whitelisting for `https://ec-shopping.vercel.app`.

---

## 7. Recommended Next Actions & Remaining Blockers

1. **Merchant / Support Action (Immediate Blocker):**
   - Log into `https://business.phonepe.com` under "EConnect Internet Centre" and whitelist `https://ec-shopping.vercel.app` as the authorized website URL.
   - If locked, email PhonePe Merchant Support (`merchant-support@phonepe.com`) with the request template provided in Section 5.

2. **Vercel Redeployment (After Whitelisting):**
   - Redeploy the frontend on Vercel so the updated `client/index.html` (with the referrer meta tag) and `client/vercel.json` are active in production.
   - Redeploy the backend on Vercel so the updated `sanitizeMerchantUserId` is active.

3. **Fallback Availability (Zero Customer Disruption):**
   - If a customer chooses PhonePe and the gateway encounters an issue, EcShopping already implements a fail-closed architecture:
     - Orders remain in pending status without data loss.
     - The customer is presented with an option to pay via **Cash on Delivery (COD)** or retry once PhonePe confirms the session.

---

**Final Status:** `CONFIGURATION ACTION REQUIRED`
