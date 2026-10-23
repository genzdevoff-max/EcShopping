# EcShopping — Phase 2: Three-Interface Audit & Implementation Plan

**Date:** 2026-10-21 · **Mode:** PASSIVE AUDIT (no source, DB, env, or process changes were made; temp probe scripts deleted after use; no secrets printed)

**Companion document:** `SECURITY-REPORT.md` (Phase 1 — account-claims & access-control hardening, verified).

---

## 0. Executive summary

| Theme | Verdict |
|---|---|
| Server | Running current code (child PID proc started after `index.js` mtime — no stale server). Health endpoint reports TiDB connected. |
| Security controls (Phase 1) | In place and verified last phase (bcrypt, JWT role tokens, rate limiting, generic 5xx, secret-free defaults, admin table). Legacy vendor `<EMAIL>` is **still plaintext** (hash column NULL) — migration approval still pending. |
| Regression introduced in Phase 1 | `App.jsx:163` calls `setCurrentCustomer` which is no longer imported → **customer login crashes (P0)**. One-line fix required before committing. |
| Storefront data | Server SKU products table is **empty**; UI is 100% static demo data (`catalog.js` 20 items). Orders (3, all Processing/COD/pending) exist only via legacy client-side storage flows. |
| Payments | Simulated end-to-end; no server-authoritative payment. `POST /api/orders` trusts client totals and supports upsert-overwrite of existing order IDs by unauthenticated callers (**HIGH**). |
| Test status | Executed last phase: 22/22 (8 passwords + 8 auth-tokens + 6 admin-API vs `ecshopping_test`). Not re-run this phase by design (read-only). |
| Git | All Phase-1 work is uncommitted (16 modified files + 5 untracked paths). Recommend commit after P0 fix. |

---

## 1. Step-1 verification (environment & current state)

1. **Port/process**: `:5000` LISTENING by node PID 12432, `node.exe index.js`, child of nodemon (PID 5492). Child creation `22:34:18` > `server/index.js` mtime `22:01:37` → the running process **reflects current code**. Old PID 10040 from the Phase-1 wait-for-approval list is gone (nodemon recycled), so that pending item is resolved.
2. **Health**: `GET /api/health` → `{"status":"online","database":"TiDB Cloud MySQL connected","dbName":"ecshopping"}` (TLS, TiDB).
3. **Env files**: `client` – none (Vite defaults; API_BASE falls back to `http://localhost:5000`); `server` – `.env` (1200 B) + `.env.example`. Key-name diff: all critical keys present (DB_*, JWT_SECRET, SMTP_*, ADMIN_EMAIL, ADMIN_PASSWORD, CLOUDINARY_*, RATE_LIMIT_*); only the optional `RATE_LIMIT_REGISTER_MAX` / `RATE_LIMIT_REVIEW_MAX` overrides are absent from `.env` (fallback defaults are applied in code). No secret values were read this phase.
4. **Git**: `M` App.jsx, AuthForm.jsx, Checkout.jsx, Orders.jsx, AdminDashboard.jsx, AdminLogin.jsx, AddProduct.jsx, AllProducts.jsx, CategoryManager.jsx, VendorDashboard.jsx, VendorLogin.jsx, api.js, storage.js, server/.env.example, db.js, index.js, package-lock, package.json; `??` SECURITY-REPORT.md, server/middleware/, server/scripts/, server/test/, server/utils/.
5. **DB state (SELECT-only probe)**: users 0, vendors 1, admins 1, categories 2, products 0, orders 3, order_items 5, reviews 0. Sole vendor `v179***`: status **approved**, direct_selling 1, `password_hash` **NULL** (legacy plaintext pending migration). Orders: 3 × Processing / pending / COD (2026-10-19/20). Indexes confirmed: products(vendor_id, status), orders(customer_email, status), plus order_items(order_id, vendor_id) and reviews(vendor_id, product_id) per `db.js` DDL.
6. **Legacy artifact**: `server/data/db.json` (531 B, untouched since Oct 18) still holds demo user + demo vendor records with **plaintext passwords** — recommended for deletion/relocation for seed-only use (ow item below).
7. **Regression check (verified by read)**: `client/src/App.jsx:3` imports from `./utils/storage` *without* `setCurrentCustomer`, while `App.jsx:163` (`handleCustomerLogin`) calls it → `ReferenceError` on every customer login. Introduced while cleaning the import list in the Phase-1 token-plumbing change set. **P0, one-line fix.**

---

## 2. Interface inventories (what exists today)

All file:line anchors below were verified by direct reads this phase unless marked *(agent-verified — consistent with code read-around, re-check during implementation)*.

### 2.1 Customer storefront (`/` under `/*` inside header/footer shell)

| Screen (route) | File | Current state / findings |
|---|---|---|
| Home `/` | `pages/Home.jsx` | Promo banners from `data/catalog.js` `homePromos`; hero uses Unsplash photography; carousel; all demo data. *(agent-verified)* There are **two “Shop” heading ids** (aria-labelledby targeting `shop-1` on a page with `shop-1`, `shop-2`, `shop-3`) — a11y bug. *(agent-verified)* |
| Shop `/*` | `pages/Shop.jsx`, `data/catalog.js` | 20 hardcoded demo products `eco-*` / Unsplash; category = `shop-3` param drives collection filtering only; no API use. Sorts/filter demo-only. |
| Product detail | `pages/ProductPage.jsx` | `getProduct(productId)` from local demo catalog; gallery, variant selector, reviews unless otherwise confirmed (local only); **basket Stock button** *(agent-verified)*. |
| Cart | `components/CartContext.jsx` | LocalStorage `psc_cart_*` keys, no auth coupling, cartsession count for the header badge; item id String coercion remated. *(events acceptable for now — to migrate to server-side cart later)* |
| Checkout | `pages/Checkout.jsx` | **PhonePe payment is entirely simulated** — pages>0 components `PaymentSuccess` (no payment service, no server verify). Coupon `first200` hardcoded client-side. POSTs `/api/orders` with client-computed subtotal/total. |
| Orders `/*` | `pages/Orders.jsx` | List built from `getOrders()` local; effect at line 22 syncs from server (`BY_CUSTOMER_EMAIL` → “CUSTOMER” token) keyed by logged-in user ⇒ **empty-params response REPLACES the local ORDERS store** (`storage.js:371–379`) → server sync wipes the local history on login; guard writes. |
| Order details `/*` | `pages/OrderDetails.jsx` | Looks up order only in `getOrders()` (local, lines 20–32); ownership check vs. `loggedInCustomer.email`; never calls server `GET /api/orders/:id`. |
| Track order `/*` | `pages/TrackOrder.jsx` | Pure local search of orderNumber; no server call; guests can not track server-known orders. |
| OrderConfirmation `/*` | `pages/OrderConfirmation.jsx` | `today: Date.now()` recomputed per render meme (not not memo'd — trivial). *(agent-verified)* |
| Login/Register | `pages/customer/CustomerLogin.jsx`, `AuthForm.jsx`, `CustomerRegister.jsx` | **P0 crash path** — `AuthForm` `onCustomerLogin` → `App.jsx:163` ReferenceError. Registration + login use server `/api/auth/user/*`; tokens stored via storage-layer. |
| Profile, policies, misc | `pages/customer/CustomerProfile.jsx`, `pages/*Policy.jsx` (14-line wrappers) fine; Contact/About static; **Price & status field are locked away from vendor-relevant items** *(agent-verified)*; privacy/contact/simple pages OK. `orders` `/*.l…` *(agent-verified)* not applicable. |

### 2.2 Vendor portal (`/vendor/*` and `/vendors/*`)

| Screen | File | Findings |
|---|---|---|
| Vendor login | `VendorLogin.jsx` (rewritten Phase 1) | Governance approved; persists “vendor” token via storage/auth layers; **login gated on `status: approved`** (server side); rejected vendor message mislabels “pending” — text needs a bypass cleanup (P3). |
| Vendor dashboard | `pages/vendor/VendorDashboard.jsx` | Cards + ”apply for direct selling`/`displayed by`directSelling` flag; lists contract products (own, **WHATEVER status** — client shows even rejected/pending incorrectly marked “” for storefront metrics). CPU “”…” *(agent-verified)*. |
| Vendor products (view/build/edit flags) | `pages/vendor/AllProducts.jsx` (edited? w/ defaults in **legacy** unused `AddProduct.jsx` duplicate-legacy version) | drag-in verify cell; **🔴 inline “Set status approve/details/registrar” row actions assume vendor-known status transitions; server rule: `PUT /api/products/:id/status` = requireAdmin ⇒ any action on a vendor-applied product edit will 403** (UI two-way bug). |
| Categories | `pages/vendor/CategoryManager.jsx` | PUT/DELETE guarded by ownership server-side; main issue: admin “shared” (`vendor_id NULL`) categories are shown in vendor lists but cannot be silently edited by vendor (403 paths) — a “shared category but cannot be managed” design needs display treatment. Categories are a vendor-scoped vs shared mess-wide: 2 rows total. Products page categories use `catalog.js` hardcoded — **shop pages will not respect category additions.** |
| Add product (legacy/production) | `pages/vendor/AddProduct.jsx` | Uses server `/api/products` (defaults `vendorId`, auto-classified `pending`; front/back tests verified). The canonical add-page. |
| Order mgmt | `pages/vendor/*Orders.jsx` | GETs `/api/orders` with vendor token (server scopes rows to own items via `order_items.vendor_id`); vendor may update `PUT /api/orders/:id/status` — vendor caveat: ownership only requires **≥1 item of that vendor in the order**, but the status change is **order-global**, affecting other vendors’ items in the same multi-vendor order (Correctness vs. per-item fulfilment only stub). Per-item shipping progressive isn't possible in current schema. |

### 2.3 Admin dashboard (`/admin/*`)

| Screen | Findings |
|---|---|
| Admin login | `AdminLogin.jsx` — rewritten Phase 1; posts `/api/auth/admin/login` (bcrypt verified server-side); bedtime secrets removed; persists token “admin”. |
| Admin dashboard | `pages/admin/AdminDashboard.jsx` — pending products to approve/reject (works with admin token); vendor list + approve/reset/`direct-selling` toggles; **stats tiles computed over ALL vendors rather than page/effect-scoped counts** (each card should use totals from `GET /api/products?vendorId=...` plus role-scope wrong — correct but needs a page-scoped“management view”);
| | “rows repeat” on the product list because rows across vendors render similar builds — list memo + normalized keys needed (P2 UX). |
| Products to approve | `PUT /api/products/:id/status` admin-only — matches server. |
| Orders (admin view) | Admin sees all orders; customer email filter supported server-side; **payments are “simulated” COD/pending everywhere** |
| Categories | Admin can create categories with NULL (shared) vendor id; manage all. |

---

## 3. Current-vs-target order/data-flow artifacts

### 3.1 Current high-level flow (as-is)

```
                       ┌──────────────────── createStorefront (static) ───────────────────────┐
 browser (Vite :5173)  │ Shop.jsx ──────────── uses data/catalog.js 20 demo products          │
                       │ ProductPage ──────── demo lookups only                               │
                       │ Checkout ── SIMULATED PhonePe ──────POST /api/orders (public)──────► TiDB (orders/order_items)
                       │ Orders/OrdersDetails/Track ── local ord_storage only (server sync replaces it!)
                       └─────────────────────────────────────────────────────────────────────┘
 vendor portal ── token ─► /api/products (own, any status), /api/orders (own items), /api/categories
 admin portal ─── token ─► /api/products?status, /api/products/:id/status, /api/vendors (all/status/direct-selling), /api/orders (all), /api/categories
```

### 3.2 Target flow (per instructions / phase plan)

```
 Storefront ── uses SKU rows from products (status='approved') via /api/products (public, optionalAuth)
            ── server-authoritative prices at checkout; cart memoized per customer on server (cookieless cart key later)
 Payment   ── REAL PhonePe: client ▸ POST /api/payments/initiate (server computes amount) ▸ redirect
            ── server ▸ verify callback / poll ─▸ order.paymentStatus=Paid + paymentReference restored
 Fulfilment ─ multi-vendor order ⇒ shipment split per vendor_items; per-vendor status ledger (target schema needs parent/child or status-per-item table) — vendor updates only its slice; customer sees aggregate; admin overridable
 Order mgmt ─ order detail from server GET /api/orders/:id (token) or public tracking by orderId+email/webhook-type (design decision pending)
 A11y/perf  ─ 6-target Lighthouse pass; componentized list memoization; CSV vendor bulk upload from file
```

### 3.3 Screen × file × server coverage matrix (planning aid)

| Planned change group | Touches (client files) | Touches (server files) | New API | Needs approval? |
|---|---|---|---|---|
| P0 auth regression | `App.jsx` (import fix only) | — | — | No |
| Real catalog on storefront | `Home`, `Shop.jsx`, `ProductPage.jsx`, remove `data/catalog.js` hardcoding | `products` endpoints already cover (public list + product filter), add price/sorting compatibility mapping | — (reuse existing) | Seed/volume data (prod write; DB seed approval) |
| Genuine PhonePe | `Checkout.jsx`, `OrderConfirmation.jsx` | new `routes/payments.js` (initiate + verify), `orders` payment_status update server-side | `/api/payments/*` | **Yes** (merchant creds, DB writes, prod enablement) |
| Server-authoritative carts | `CartContext.jsx`, `Checkout.jsx` | orders create → recompute totals server-side; items price/description re-verify | schema: none (voluntary) | Pricing rules (rounding, coupons engine server-side) |
| Local order history vs server merge | `Orders.jsx`, `storage.js` (`syncFromServer` semantics), `OrderDetails.jsx`, `TrackOrder.jsx` | optional `GET /api/orders/track?orderId=&email=` public-gated endpoint | yes (design decision + hook) | Simple; P0-click-through |
| Vendor fulfilment split | `VendorOrders*`, customer `OrderDetails.jsx` | per-item status: order_items + new per-item fulfillment table/HTML | partial — new table | Schema change approval |
| Category unification on shop | `Shop.jsx`, `ProductPage.jsx` | `/api/categories` remains vendor/admin; **needs optional public GET** for storefront nav | public categories GET | trivial |
| Warehouse/alerts to admin | `AdminDashboard.jsx` stats correct-scope, admin vendor grid fixes | adds scoring query (`COUNT` products by status, scoped) | — | — |
| A11y/perf | Home, Shop, ProductPage, vendor list memoization, form labels | — | — | — |
| E2E tests | `test/**` playwright? add client side `test` folder | server-test helpers for order/payment mock | — | Yes (test seeding into `ecshopping_test` only) |

---

## 4. API & DB dependency matrix (verified server route map)

`server/index.js` (1,223 lines) — every route read this phase:

| Route (file anchor) | Auth (verified) | DB tables | Notes / gaps |
|---|---|---|---|
| `POST /api/upload` (L91) | requireVendorOrAdmin, multer 10 MB memory | none (Cloudinary or inline data URI fallback) | fallback stores base64 in `products.image` → can blow row size; enable Cloudinary, or reject fallback. No file-type sniffing beyond multer. |
| `GET /api/health` (L139) | public | SELECT 1 | fine. |
| `POST /api/auth/user/register` (L157) | public (registerLimiter 5/h) | users | bcrypt at creation; role=customer only (no role column needed). |
| `POST /api/auth/user/login` (~L200s) | public (authLimiter 10/15min) | users | verify → JWT (role, name, email + vendorId where applicable, TTL 7d). Phase-1 semantics: hashed password only (user path had no plaintext to migrate; legacy path verified via vendor only). |
| `POST /api/auth/vendor/register` / `/login` (~L270s) | public | vendors | **Vendor self-registration exists; approval gate depends solely on `status='approved'`** — self-approval risk: verify default status inside the handler and eventual “pending on create + admin approval” policy change in implementation phases. Legacy plaintext login still possible until `-apply` migration (Phase-1 known, masked). |
| `POST /api/auth/admin/login` (~L300s) | public | admins | bcrypt-only. admins table has no `role` column (single admin role by design now). |
| `GET /api/vendors` (~L410) | public | vendors | returns all except rejected; `password`/`password_hash` are NOT selected. OK. |
| `PUT /api/vendors/:id/status` (L437) | requireAdmin | vendors | validates status enum; good. |
| `PUT /api/vendors/:id/direct-selling` (L459) | requireAdmin | vendors | good. |
| `GET /api/categories` (L482) | requireAuth vendor/admin | categories | vendor → own + shared (NULL); used by portals only — storefront can not read it (gap for shop nav). |
| `POST /api/categories` (L514) | requireAuth vendor/admin | categories | dedupe by lowercase name per owner; good. |
| `PUT /api/categories/:id` (L562) | requireAuth vendor/admin | categories | ownership enforced for vendors; shared categories vendor-immutable (403). |
| `DELETE /api/categories/:id` (L603) | requireAuth vendor/admin | categories | ownership enforced; no FK/product link check (delete leaves products pointing to stale category string, acceptable as products store the name). |
| `GET /api/products` (L634) | optionalAuth | products | anon/customer → approved only; vendor → own (any status); admin → all with filters. Verified. Storefront will hit this once catalog real. |
| `GET /api/products/:id` (L676) | optionalAuth | products | 404-masking for non-approved (anon / non-owner). Verified. |
| `POST /api/products` (L701) | requireVendorOrAdmin | products | **always created `pending`**; vendor identity from token; id collision guarded for vendors; admin email notification pending-mail only when SMTP configured. Verified. |
| `PUT /api/products/:id` (L800) | requireVendorOrAdmin | products | ownership guard; **editing does NOT reset status → a previously approved product silently keeps its approved badge after edits.** Plan: on substantive edit reset to `pending` (approval gate TBD). |
| `PUT /api/products/:id/status` (L843) | requireAdmin | products | verified; no status-change email notification to vendor (nice-to-have). |
| `DELETE /api/products/:id` (L867) | requireVendorOrAdmin | products | ownership guard; no FK cascade (reviews keep stale productId — fine for placeholder; plan: null-up refs). |
| `GET /api/orders` (L942) | requireAuth customer/vendor/admin | orders, order_items | role-scoped WHERE, customer pinned to own email; vendor scoped by order_items vendor_id; admin passthrough filters. Verified. |
| `GET /api/orders/:id` (L975) | requireAuth customer/vendor/admin | orders, order_items | 404-masking for unauthorized. Verified. |
| `POST /api/orders` (L1000) | **PUBLIC** | orders, order_items | 🔴 trust: client totals & items; 🔴 upsert-on-duplicate lets an unauthenticated caller **overwrite any existing order (id + items)** (HIGH). Transactional + idempotently replaces line items — keep, but gate rewrite behind owning token and recompute server-side in Phase 4. |
| `PUT /api/orders/:id/status` (L1083) | requireAuth vendor/admin | orders, order_items | vendor requires ≥1 own item → but flips **order-global** status for all vendors (design driver for per-vendor fulfilment). |
| `GET /api/reviews` (L1117) | public | reviews | exposes name but never email. Verified. |
| `POST /api/reviews` (L1140) | requireCustomerOrAnon + reviewLimiter 20/h | reviews | rating/comment validated; customer identity from token when present; guest email accepted from body (spam-ish but limiter-covered). |
| `POST /api/send-welcome` (L1202) | public | none | intentionally 410 (legacy plaintext email flow removed in Phase 1). |
| App root `/api/*` 404 fallback (~L1215) | — | — | generic JSON; no stack leakage. Verified. |
| Error middleware (utils/errors.js) | — | — | all 5xx messages generic; details console-side only. Verified. |

Rate limiting: auth 10/15min, register 5/h, review 20/h (in-memory; shared-store migration note flagged for horizontal scale).

---

## 5. Prioritized bug / issue list

**P0 — fix immediately (small edits)**
1. `App.jsx:163` — `setCurrentCustomer` referenced but not imported (`App.jsx:3`) → customer login ReferenceError. *Verified.*
2. Commit hygiene: Phase-1 changes uncommitted — commit after P0 fix so `Test`/CI and language work can never regress-oni. (security + recovery risk)

**P1 — high**
3. `POST /api/orders` upsert allows unauthenticated overwrite of existing orders & posts client-supplied totals/prices (index.js:1000–1080). Tighten per target flow (server-authoritative amounts; id generation server-side; ownership/merchant issuance rules). Already the correct constraint axis.
4. `Orders.jsx` server-sync replace semantics wipe local order history (`storage.js:371–379`, `Orders.jsx:22`); harmonize merge (P1 UX + data).
5. `server/data/db.json` plaintext demo credentials on disk (vend/user). Delete or convert-to-test fixture in later phase (directory not in repo tree; delete on approval only).
6. Legacy vendor password remains plaintext pending `--apply` migration (from Phase-1 approval list; verified hash NULL this phase). Approval needed before applying in `prod` — plan already documented in SECURITY-REPORT.md.

**P2 — medium**
7. Vendor inline product **status edit** uses admin-only endpoint (AllProducts ⧉ server mismatch ⇒ 403 spam).
8. AdminDashboard “stats” aggregate over all vendor data; scope per page/tab; product-list row-keys memoization.
9. `Update product fields` does not flip approved⇒pending — marketplace risk (stale approved variants after vendor edits).
10. Categories: no public storefront read; shop pages drive off hardcoded `catalog.js` → category additions never surface in the storefront.
11. Home a11y: duplicate heading/aria ids (`shop-1..3`); labels/tones on vendor products page fields; button-as-div patterns in demo areas.
12. Wide-open `cors()` at index.js:47 — provide explicit origin allow-list before public deployment.
13. `POST /api/upload` data-URI fallback writes huge base64 strings into product row `image` TEXT — requires cloudinary config, or hard-reject fallback in prod config (already configured in `.env` for this box).
14. Order history growth: payable full-table scan on customer_email etc. ADD indexes where needed (orders table indexed now; add order_items(order_id, vendor_id) is; composite `orders(customer_email,status)` candidate).

**P3 / polish**
15. OrderConfirmation `today: Date.now()` re-evaluated per render; memoize or pass `placedAt`.
16. Vendor login error text when vendor is `rejected` vs `pending` message correctness.
17. TrackOrder: purely local; whatever we want for guests needs an explicit decision (public endpoint by order-id + contact vs. login gate).
18. Admin “raw vendor provider … grid `${idx + 1}. Ramesh`1` visual glitch (agent-verified).
19. `AddProduct.jsx` legacy duplicate page — verify whether referenced by routes or dead code; remove dead code or unify.

*(No agent-only claim was promoted to a hard bug without a corroborating code read unless explicitly tagged *(agent-verified)* above.)*

---

## 6. Phased implementation plan (with approval gates)

> Sequencing follows the instruction set: (1) redo each of the 3 interfaces ⇒ server-authoritative data; (2) payments via PhonePe; (3) fulfilment + admin financial ops; (4) performance/a11y/E2E. Account-claims reset (`/api/account-claims`) already documented in SECURITY-REPORT phase-1 — reused, not rebuilt.

| Phase | Contents | Files | Server work | Gate |
|---|---|---|---|---|
| **0 — P0 stabilization** | Fix App.jsx import regression; run lint+build; commit all Phase-1 work | App.jsx | — | none (1 line) |
| **1 — Storefront on real data** | Shop/Home/ProductPage read `/api/products` (+public categories GET); catalog.js becomes fixture for tests only; price/sort/search server params | Home, Shop, ProductPage, catalog.js | `GET /api/categories` optionalAuth variant or `/api/categories/public`; (re)-order filters | seeding volume products = DB write ⇒ **approval** |
| **2 — Order history truth** | Orders.jsx merge (never wipe local copy silently); OrderDetails from `GET /api/orders/:id` w/ fallback; TrackOrder policy decision made & implemented; checkout stores receipts | Orders.jsx, OrderDetails.jsx, TrackOrder.jsx, storage.js | optional public track endpoint OR 404-generalized client search | design decision (public endpoint?) — ask |
| **3 — Server-authoritative commerce** | checkout totals recompute, price/stock verify, coupon engine server-side, secure order id | Checkout.jsx, CartContext.jsx | harden `POST /api/orders` (kill upsert-overwrite; compute amounts); unit tests in `ecshopping_test` | pricing rules/coupons — confirm business rules first |
| **4 — PhonePe integration** | real pay flow redirect + verify | Checkout.jsx, OrderConfirmation.jsx, brand PayPage? | new `/api/payments/initiate|verify` (server-computed amount, callback auth/crypto verify, update order server-side); mock service for dev | **PG credentials + prod writes** — approval (documented already) |
| **5 — Multi-vendor fulfilment** | per-vendor dispatch: order_items gets `fulfilment_status`; vendors see/update own slice only; customer aggregates; admin overrides each slice | VendorOrders pages, AdminDashboard, OrderDetails.jsx | schema change (new column or table), endpoint changes (per-item PUT) | **schema migration** ⇒ approval + backup first |
| **6 — Admin financial/ops upgrades** | admin order/fulfilment grid, refunds/queries via payment refs, vendor payout tab (estimates only), better stats | AdminDashboard.jsx | read-heavy queries; optional `GET /api/admin/summary` | none if read-only |
| **7 — Perf/a11y/E2E** | list virtualization/memos, a11y fixes (Home headings etc.), Playwright E2E suite vs staging env, Lighthouse runs 6 targets | many client files | none | CI runner only |

Each phase = separate commit + its own tests; no phase starts until sign-off of the prior acceptance checklist.

---

## 7. Acceptance criteria (summary) & test strategy

- **Executed (last session, verified):** 8/8 `passwords.test.js`, 8/8 `auth-tokens.test.js`, 6/6 `api/admin-auth.test.js` (via `SUPABASE`-style env to `ecshopping_test`). `npm test` + `npm run test:api` were **not re-run this phase** (they write to `ecshopping_test`; read-only constraint).
- Every phase above ships with: unit tests (server, DB-free where possible), API integration tests against `ecshopping_test` (e.g., order server-authoritative recompute), and Playwright storefront E2E for Phase 7.
- New unit tests must be added for: order upsert protection, phonepay verify crypto, per-vendor fulfilment transitions, category public GET, storage merge semantics.
- Manual QA checklist per screen (all 3 portals; a11y keyboard passes; Lighthouse ≥ thresholds on Home/Shop/Product).

## 8. DB / backup / rollback considerations

- Before any Phase 5 schema migration or any bulk product seeding in prod: `mysqldump`-equivalent backup (TiDB: `dumpling` or `SELECT … INTO OUTFILE` per-table) + row-count snapshot; rollback = restore dump (no destructive ALTERs planned except additive columns).
- Migrations remain **additive only** (established Phase-1 pattern: `password_hash` columns, admins table). No touching of legacy `password` columns until the pending `-apply` migration is approved (see §5.6).
- `server/scripts/security-rollback.sql` remains the safety valve for auth-layer rollback.
- E2E/staging runs target `ecshopping_test` only.

## 9. Approval still outstanding (carried over from SECURITY-REPORT.md)

1. `npm run db:hash-legacy-passwords -- --apply` in server/ — legacy vendor still plaintext (verified hash NULL today). **Remains blocked on your approval.**
2. Rotate the bootstrap admin password via `npm run db:create-admin` (Phase-1 SOP; current admin row verified intact & bcrypt-hashed).
3. Dev server is already running current code; today's only change candidates are the P0 1-liner + commit — both cheap and safe.

## 10. Incident-account + report-end statement

The `POST /api/send-welcome` endpoint emails the payload credentials was eliminated in Phase 1 (now 410); the user education history shows no customer password leaks to vendor; mock payment never touched external systems; TiDB credentials held only in `server/.env` on this machine (read-only this phase). No secrets printed; temp probe script deleted after single use.
