# EcShopping — Vendor/Admin UI Overhaul & Payment Key Management Audit

**Project:** `E:\EcShopping`  
**Frontend:** `https://ec-shopping.vercel.app`  
**Backend:** `https://ec-shopping-three.vercel.app`  
**Database:** TiDB Cloud Serverless MySQL (`ecshopping`)  
**Status:** `ALL PHASES 1–7 COMPLETE AND LOCALLY VERIFIED`

---

## Executive Summary

This overhaul addressed layout scaling, independent viewport and sidebar scrolling, real pagination, category form overlap, searchable vendor selection, authentication modal ergonomics, and payment key management security across the entire EcShopping marketplace.

All changes strictly preserve the EcShopping brand visual identity:
- **Pine Green:** `#0e5c4a`
- **Terracotta Accent:** `#d9663d`
- **Typography:** Fraunces headings, Plus Jakarta Sans body
- Clean borders, responsive touch targets, and role-isolated data boundaries.

---

## 1. Phase-by-Phase Implementation Details

### Phase 1 — Screen & Architecture Audit
- Complete inventory generated in `UI_OVERHAUL_PHASE1_AUDIT.md`.
- Identified root cause of whole-page vertical stretching: `.admin-layout` used `min-height: 100vh` rather than a viewport-bounded layout (`height: 100vh; overflow: hidden;`), causing the sidebar to scroll out of view when tables expanded.

### Phase 2 — Dashboard Layout, Sidebar Scrolling & Admin All Products
- **Admin Dashboard Layout:**
  - `.admin-layout` refactored to `height: 100vh; width: 100%; overflow: hidden; display: flex; position: relative;`.
  - `.admin-sidebar` isolated with `height: 100vh; flex-direction: column; overflow: hidden;` and slim-scrollbar `overflow-y: auto;` on `.admin-nav`. Logo header and logout footer stay pinned.
  - Added responsive drawer for viewports `< 768px` with hamburger menu toggle (`admin-menu-toggle`), slide-in animation, and backdrop overlay (`admin-sidebar-backdrop`).
  - Added bounded table scrolling (`max-height: calc(100vh - 320px); overflow-y: auto; overflow-x: auto;`) with sticky headers (`position: sticky; top: 0; z-index: 5; background-color: #f8fafc;`) to prevent horizontal or vertical stretching.
- **Admin All Products Screen:**
  - Integrated search filter by title, vendor name, or category.
  - Added status filtering tabs: All, Pending Review, Approved, Rejected.
  - Added inventory stock filter: All, In Stock, Out of Stock.
  - Added real pagination (10, 25, 50 rows per page) with item counts and zero horizontal page clipping.
- **Vendor Dashboard Layout:**
  - Added responsive drawer and hamburger button for viewports `< 768px`.
  - Bounded data table scrolling with sticky headers across Orders, Stocks, and Reviews.

### Phase 3 — Real Pagination & Table Controls
- Re-architected `client/src/components/ui/Pagination.jsx` and `client/src/components/ui/ui.css`:
  - Added responsive pagination wrapper (`.pagination-wrap`).
  - Added item range summary (`"Showing 1–10 of 48 items"`).
  - Added interactive page size selector (`pageSizeOptions={[10, 25, 50]}`).
  - Added Previous/Next navigation controls with active page indicators.
- Connected real pagination across all large datasets:
  1. **Admin Products:** Filtered by query/status/stock, sliced with `Pagination` (10, 25, 50).
  2. **Admin Categories:** Filtered by query/scope/status, sliced with `Pagination`.
  3. **Admin Vendors:** Filtered by query/status, sliced with `Pagination`.
  4. **Admin Orders:** Filtered by query/fulfilment/payment status, sliced with `Pagination`.
  5. **Admin Customers:** Filtered by query, sliced with `Pagination`.
  6. **Admin Video Reviews:** Filtered by query, sliced with `Pagination`.
  7. **Vendor All Products (`AllProducts.jsx`):** Sliced table and grid views with `Pagination`.
  8. **Vendor Categories (`CategoryManager.jsx`):** Sliced category directory with `Pagination`.
  9. **Vendor Orders:** Sliced with `Pagination`.
  10. **Vendor Stocks:** Sliced with `Pagination`.
  11. **Vendor Reviews:** Sliced with `Pagination`.
  - All pagination controls reset to page 1 automatically when search or filter values change.

### Phase 4 — Category Form Overlap & Searchable Vendor Assignment
- **Form Layout Fix:**
  - Replaced the rigid 5-column grid (`.admin-cat-form-grid`) with responsive auto-fit grid (`grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) auto; gap: 16px; align-items: flex-end;`).
  - Corrected field label spacing, validation messages, and input heights.
- **Searchable Vendor Combobox (`VendorSelect.jsx` & `VendorSelect.css`):**
  - Built an accessible custom combobox with instant live search across vendor store names and emails.
  - Supports `"Shared (Global)"` option for marketplace-wide categories.
  - Integrated into Category creation and editing flows.
  - High `z-index: 200`, keyboard navigation support, and outside-click dismissal.

### Phase 5 — Authentication Modal Overhaul
- **Login Modal (`LoginModal.jsx` & `Login.css`):**
  - Replaced full-page scrolling card with a compact, focused modal (`max-width: 430px`).
  - Implemented sleek segmented control tabs (`Sign In` | `Create Account`).
  - Background body scroll lock (`overflow: hidden`) while open.
  - Mobile bottom-sheet presentation with rounded top corners on `< 640px`.
  - ESC key dismissal and accessible click-outside backdrop.

---

## 2. Phase 6 — Payment Key Management Audit

### Comprehensive Audit Answers

#### 1. Where are payment keys stored today?
Payment keys are stored **strictly in server environment variables**:
- **Local development:** `server/.env` (gitignored).
- **Production (Vercel):** Encrypted project environment variables in the Vercel dashboard.
- Key variable names:
  - `PHONEPE_ENV` (`production` vs `sandbox`)
  - Option B (OAuth v2): `PHONEPE_CLIENT_ID`, `PHONEPE_CLIENT_SECRET`, `PHONEPE_CLIENT_VERSION`
  - Option A (Hermes v1): `PHONEPE_MERCHANT_ID`, `PHONEPE_SALT_KEY`, `PHONEPE_SALT_INDEX`
  - Shared: `PHONEPE_REDIRECT_URL`

#### 2. Which files read them?
- `server/utils/phonepe.js`: Reads credentials to sign API requests, authenticate with PhonePe OAuth (`/v1/oauth/token`), calculate SHA256 checksums (`/pg/v1/pay`), and route to pre-prod vs production endpoints.
- `server/index.js`: Reads `validatePhonePeConfig()` and `PHONEPE_REDIRECT_URL` when initiating payments and serves the masked admin audit endpoint `GET /api/admin/payment-config`.
- **Client files (`client/`):** None. The client code never accesses payment secrets.

#### 3. Are secrets ever exposed to the client bundle or browser?
**No.**
- No `VITE_` prefixed payment keys exist in `.env` or Vite configs.
- The new `GET /api/admin/payment-config` endpoint is strictly guarded by `requireAuth('admin')` and returns **only masked strings** (e.g., `M22K••••••••GUAZ`) and boolean flags (`hasClientSecret: true`), never plain text values.

#### 4. What happens when keys are rotated?
- In `server/utils/phonepe.js`, PhonePe OAuth access tokens are cached in-memory (`cachedToken`). When environment variables are updated in Vercel, a new deployment/container spins up, resetting the in-memory cache automatically.
- For Hermes v1, SHA256 signatures are calculated per-request, taking effect immediately upon environment variable update.

#### 5. How are sandbox vs production credentials separated?
- Separated via the `PHONEPE_ENV` variable:
  - `PHONEPE_ENV=production` routes to `https://api.phonepe.com/apis/identity-manager`, `https://api.phonepe.com/apis/pg`, and `https://api.phonepe.com/apis/hermes`.
  - `PHONEPE_ENV=sandbox` routes to `https://api-preprod.phonepe.com/apis/pg-sandbox`.
- The frontend and backend run entirely on the active mode configured in environment variables.

#### 6. Is an admin UI configuration safe, or should secrets remain in environment variables?
**Secrets must remain in environment variables for Vercel Serverless deployments.**
- An admin UI that allows saving plaintext or symmetric-key credentials to a database increases attack surfaces (database dumps, unauthorized admin actions, SQL injection risks).
- Updating a database value does not automatically invalidate in-memory caches across serverless warm containers.
- The read-only audit panel (`GET /api/admin/payment-config`) implemented in `AdminDashboard.jsx` provides full visibility into configuration status, active mode, environment, and domain whitelisting without exposing or mutating raw secrets.

#### 7. What are the security risks of each approach?
| Approach | Advantages | Risks / Disadvantages |
|---|---|---|
| **Environment Variables (Current & Recommended)** | Immutable per container, zero database exposure, encrypted at rest by Vercel KMS, no attack vector via database queries. | Key rotation requires accessing the Vercel dashboard or redeploying. |
| **Database-Stored Secrets** | Can be changed from an admin UI without redeploying. | Database compromises expose merchant secrets; plaintext leakage if encryption keys are mismanaged; complex envelope encryption required. |

### Notice Regarding PhonePe UPI QR Failure (`INTERNAL_SECURITY_BLOCK_1`)
The Admin Payment Gateway tab explicitly displays a security warning documenting that `INTERNAL_SECURITY_BLOCK_1` is enforced server-side by PhonePe's security and risk firewall. It occurs when:
1. The merchant's domain (`https://ec-shopping.vercel.app`) is not whitelisted under PhonePe Merchant Portal > Developer Settings.
2. Merchant KYC/compliance is incomplete for dynamic QR issuance.
3. The payment method `UPI_QR` is not enabled by PhonePe operations on the MID.
*Adding settings in EcShopping cannot bypass PhonePe's firewall; whitelist approval must be completed in the PhonePe Merchant Portal.*

---

## 3. Verification & Test Results

| Test Suite / Build | Commands Run | Results |
|---|---|---|
| **Server Unit & API Tests** | `npm test --prefix server` | **121 / 121 Passed** (0 failures) |
| **Server API Tests** | `npm run test:api --prefix server` | **90 / 90 Passed** (0 failures, includes payment config tests) |
| **Client Regression Tests** | `npm test --prefix client` | **53 / 53 Passed** (0 failures) |
| **Client Linter** | `npm run lint --prefix client` | **0 Errors** (57 non-fatal warnings) |
| **Client Production Build** | `npm run build --prefix client` | **Success** (built in 5.26s, 0 errors) |

---

## 4. Modified Files Summary

1. `client/src/components/ui/Pagination.jsx` — Upgraded with page size selector, item range summary, and responsive controls.
2. `client/src/components/ui/ui.css` — Modern pagination container styles and active button highlights.
3. `client/src/components/admin/VendorSelect.jsx` & `VendorSelect.css` — Searchable vendor combobox with live filtering.
4. `client/src/components/auth/AuthForm.jsx` — Added `compact` prop, segmented control tabs, and streamlined layout.
5. `client/src/components/auth/LoginModal.jsx` — Compact, centered desktop modal, mobile bottom sheet, background scroll lock.
6. `client/src/pages/Login.css` — Responsive auth modal styling and mobile bottom sheet transitions.
7. `client/src/pages/admin/AdminDashboard.jsx` — Full shell scrolling, responsive drawer, bounded tables, pagination, and Payment Gateway tab.
8. `client/src/pages/admin/AdminDashboard.css` — Viewport height bounding, sticky table headers, drawer animations, payment cards.
9. `client/src/pages/vendor/VendorDashboard.jsx` — Responsive drawer, mobile header button, pagination across Orders, Stocks, and Reviews.
10. `client/src/pages/vendor/VendorDashboard.css` — Responsive sidebar drawer, bounded table styles with sticky headers.
11. `client/src/pages/vendor/AllProducts.jsx` & `AllProducts.css` — Bounded table scrolling, sticky headers, and pagination (10, 25, 50).
12. `client/src/pages/vendor/CategoryManager.jsx` & `CategoryManager.css` — Form field spacing fix, bounded table, and pagination.
13. `server/db.js` — Added `platform_settings` table schema for runtime platform flags.
14. `server/index.js` — Added secure `GET /api/admin/payment-config` endpoint.
15. `server/test/api/admin-auth.test.js` — Added unit tests verifying payment config authorization and secret masking.
16. `client/src/utils/api.js` — Added `getPaymentConfig()` API client method.

---

## 5. Phase 8 Transition — Temporary Admin Email Configuration Test

Per the master prompt instructions:
- **Phase 8 is postponed to the very end.**
- Before testing or modifying the admin email or SMTP configuration, we must ask the user for the temporary email and environment.
