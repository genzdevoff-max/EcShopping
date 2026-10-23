# EcShopping Implementation Progress

Working notes (concise). File-by-file verification details live in the phase reports.

## Session working rules
- Live `ecshopping` DB never written; test writes only via `server/test/**` against `ecshopping_test`.
- No commit/push/deploy; all changes uncommitted. Preserve unrelated work.

## Features
### 1. Customer storefront — COMPLETE (Phase 1 acceptance: PASS WITH LIMITATIONS)
Server-backed home/shop/category/search/PDP/cart/checkout; honest states; demo catalog deleted. See `docs/PHASE-1-STOREFRONT-IMPLEMENTATION-REPORT.md`.

### 2. Admin portal — IN PROGRESS
- [x] `GET /api/users` (admin) customers endpoint + `api.getUsers`; server tests pass.
- [x] `AdminDashboard.jsx` rewritten server-first: live fetch (vendors/products-with-pending/orders/users) per tab; approve/reject/re-review product; vendor approve/reject + direct-selling; admin fulfilment status select — all server-confirmed then refreshed from server (no localStorage writes, no fire-and-forget); loading/error/empty states; real stats only (pending counts, gross order total incl. unpaid labeled); payment status/method shown per order; removed fabricated `Ramesh Farms` fallback.
- [x] `PUT /api/products/:id` (product update for pending/rejected by vendor, or any by admin).
- [x] `DELETE /api/products/:id` (product deletion by owner vendor or admin).
- [x] `GET /api/orders/:id` (single order fetch scoped to role).
- [x] `GET /api/vendors/:id` (single vendor fetch without password hash).
- [x] Category escalation / shared-category management.
- [x] Fixed `AdminDashboard.jsx` runtime category handler scoping bug (handlers moved out of `useEffect` into component scope; removed unused `FolderTree` and `Tag` imports).

### 3. Vendor portal — IN PROGRESS
- [x] `EditProduct.jsx` added: dedicated product editor for vendors to edit pending/rejected products.
- [x] `VendorDashboard.jsx` integrated with `EditProduct` in pending & rejected tables.
- [x] `VendorDashboard.jsx` order status changes wired to `api.updateOrderStatus` (asynchronously committed to server DB with loading state).
- [x] AllProducts: in-place modal editor updates server directly via `api.updateProduct`.

### 4. Customer Profile & Address Management — COMPLETE & VERIFIED
- [x] `GET /api/user/profile` & `PUT /api/user/profile`: customer profile retrieval and name/phone update strictly authenticated with customer JWT.
- [x] `PUT /api/user/password`: secure password change with bcrypt verification, policy validation (min 8 chars), and legacy plaintext upgrade path.
- [x] `GET /api/user/addresses`, `POST /api/user/addresses`, `PUT /api/user/addresses/:id`, `DELETE /api/user/addresses/:id`, `PUT /api/user/addresses/:id/default`: scoped address management preventing cross-customer access (404), ensuring a single default address, and promoting next address when default is deleted.
- [x] `client/src/pages/CustomerProfile.jsx`: tabbed UI (Orders, Addresses, Profile/Security) with full address modal, order cancellation modal, and profile synchronization.
- [x] Automated test suite `server/test/api/customer-profile.test.js` (5/5 tests pass).

### 5. PhonePe Payment Integration — COMPLETE (code verified; sandbox UAT pending credentials)
- [x] Server-first checkout flow: `Checkout.jsx` places the order on the server (`api.createOrder` / storage `addOrder`) BEFORE any payment step; offline (unverified) drafts can never start a gateway payment.
- [x] Server-authoritative payable amount derived from order row (`POST /api/payments/phonepe/create-payment`), never trusted from the client.
- [x] PhonePe checkout session redirect wired up; fails closed (503) when sandbox credentials are not configured, without cancelling the created order.
- [x] Single canonical return route (`/payment/phonepe/return`) via `pages/PaymentStatus.jsx` (replaced the divergent `PhonePeReturn.jsx`): verifies through PhonePe Order Status API (`POST /api/payments/phonepe/verify`), auto-reconciles while pending per UAT schedule (`20s, 3s, 3s, 3s, 4s, 4s, 4s`), clears cart only on paid, retry restarts the checkout session for the SAME order (no duplicate orders), passes the verified order as route state so `OrderConfirmation` renders.
- [x] `PaymentStates.jsx` gained an honest `warning` state (gateway/payment unavailable ≠ fabricated outcome).
- [x] Server `.env.example` documents the phonepe config block; credential flow verified from `server/.env`.
- [x] Unit & API tests re-run after the seam rewrite: **81/81 server tests pass** (incl. fail-closed 503s, state mapping, paisa bounds).

### 6. Cloudinary and Product Media (Phase 7) — COMPLETE & VERIFIED
- [x] Server-side magic-byte sniffing (`detectImageFormat`) prevents extension/MIME-type spoofing (supports JPEG, PNG, GIF, WebP).
- [x] File size enforcement (`validateImageUpload` caps at 10MB) and empty upload rejection.
- [x] Fail-closed upload handling: graceful fallback to development data URI if Cloudinary credentials misconfigured (e.g. invalid cloud_name with spaces).
- [x] Public ID extraction helper (`extractCloudinaryPublicId`) for reliable asset tracking.
- [x] Vendor and admin authorization required on `POST /api/upload`; customer tokens strictly rejected (403).
- [x] Media automated test suite `server/test/media.test.js` (7/7 tests pass).

### 7. Inventory, Orders & Multi-Vendor Fulfillment (Phase 9) — COMPLETE & VERIFIED
- [x] Schema migration for numerical inventory: additive `stock_quantity INT NOT NULL DEFAULT 50` added to `products` table (`server/scripts/phase-9-inventory-migration.sql` and `server/scripts/phase-9-inventory-rollback.sql`).
- [x] Non-negative integer validation on product creation (`POST /api/products`) and updates (`PUT /api/products/:id`), synchronizing `stock_status` (`in_stock` vs `out_of_stock`).
- [x] Pre-order stock verification and atomic stock decrement on order creation (`POST /api/orders` with `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?`).
- [x] Concurrent purchase overselling protection: transaction rolls back with clear `Insufficient stock for "<product>"` error if concurrent orders deplete available inventory.
- [x] Stock restoration: inventory quantity is replenished and `stock_status` reset to `in_stock` upon customer or vendor order cancellation.
- [x] Multi-vendor fulfillment segregation: single cart checkout splits items accurately across vendor records with individual fulfillment tracking.
- [x] Automated test suite `server/test/api/inventory-fulfillment.test.js` (6/6 tests pass).

## Verification log
- `server npm test` → **99 pass / 0 fail** (`ecshopping_test` only, full test suite).
- `client npm test` → **23 pass / 0 fail**.
- `client npm run lint` → **0 errors**; 45 pre-existing warnings (0 errors).
- `client npm run build` → **0 errors** (vite production build successful).
