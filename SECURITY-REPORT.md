# EcShopping Security Upgrade — Implementation Report

**Date:** 2026-10-21
**Scope:** Server-side auth hardening + client token plumbing
**Server:** Node 20 / Express / TiDB Cloud (`ecshopping`, port 4000)
**Client:** React + Vite (`E:\EcShopping\client`)

---

## 1. What was implemented

### Server (previously completed — verified this session)
| Area | Detail |
|---|---|
| bcrypt passwords | `password_hash VARCHAR(255) NULL` columns on `users` + `vendors`; login prefers the hash and upgrades legacy plaintext rows on first successful login (writes only the hash never the plaintext column). |
| Admin accounts on the server | Separate `admins` table (`id`, `email`, bcrypt `password_hash`, `created_at`); `POST /api/auth/admin/login` verifies bcrypt and mints an admin JWT. The legacy `VITE_ADMIN_EMAIL/VITE_ADMIN_PASSWORD` browser-bundle credentials are retired. |
| Bootstrapping / ops scripts | `scripts/create-admin.js` (env-driven upsert/rotation, policy ≥12 chars), `scripts/hash-legacy-passwords.js` (dry-run default, `--apply`), `scripts/security-rollback.sql` (approval-gated manual DDL rollback). |
| Token/role middleware | `middleware/auth.js`: `signToken`/`verifyToken` (7d TTL), `requireAuth(...roles)`, `requireAdmin`, `requireVendorOrAdmin`, `optionalAuth`, `requireCustomerOrAnon`. Rate limiting on auth/registration/review endpoints. |
| Route auth matrix | Vendors list/status → admin; categories CRUD → vendor/admin; product writes → vendor/admin, product **status** → admin; orders reads → customer/vendor/admin (server-scoped), order status → vendor/admin; order creation stays public (guest checkout); review posting accepts customer token (anonymous allowed). |
| Data hygiene | Password fields never appear in API responses (only `SELECT`s project non-credential columns); `/api/send-welcome` returns 410 (plaintext credential emails discontinued). |

### Client (this session)
| File | Change |
|---|---|
| `src/utils/api.js` | Rewritten: role-keyed JWT store (`ecshopping_token_customer|vendor|admin`), automatic `Authorization: Bearer` attachment per endpoint, 401 → auto token clear. New methods: `userLogin`, `userRegister`, `adminLogin`, category CRUD, `uploadImage`. |
| `src/utils/storage.js` | Session helpers `saveCustomerSession`/`logoutCustomer`, `saveVendorSession`/`logoutVendor`, `saveAdminSession`/`getCurrentAdmin`/`logoutAdmin`. `addCustomer` no longer persists any plaintext password. **Removed** the local plaintext `verifyVendorLogin` credential check. Sync helpers accept a role so tokens flow through (`syncOrdersFromServer(params, role)`, `syncFromServer({ordersRole})`). |
| `src/components/auth/AuthForm.jsx` | Server-first only: login and signup go through `api.userLogin`/`api.userRegister`; **removed both localhost plaintext fallback checks**; tokens saved via `saveCustomerSession`. |
| `src/pages/admin/AdminLogin.jsx` | Rewritten: verifies against `/api/auth/admin/login` (bcrypt in `admins` table) and persists the admin session. The `VITE_ADMIN_*` leak is gone (grep confirms zero references). |
| `src/pages/vendor/VendorLogin.jsx` | Local cached-credential fallback removed; pending/rejected messaging comes from the server. Token persisted via `saveVendorSession`. |
| `src/App.jsx` | Admin session is token-backed and survives refresh (`getCurrentAdmin`); logout clears customer/vendor/admin tokens. |
| `src/pages/vendor/{CategoryManager,AddProduct,AllProducts}.jsx` | Raw `fetch()` calls replaced with token-aware `api` calls (categories, uploads); product sync uses the vendor token so vendor-only pending listings show. |
| `src/pages/{admin/AdminDashboard.jsx,vendor/VendorDashboard.jsx}` | Scoped syncs (admin/vendor order+product sync) and role-correct order-status updates. |
| `src/pages/Orders.jsx` | Signed-in users hydrate real (server-scoped) order history via the customer token; copy updated. |
| `src/pages/Checkout.jsx` | Guest auto-account now registers via `api.userRegister` (bcrypt on the server). The dead call to the discontinued `/api/send-welcome` and the local plaintext password store are gone. |

## 2. Verification

| Check | Result |
|---|---|
| Server unit + API tests (`npm test`) | **22 / 22 pass** — 8× `passwords.test.js`, 8× `auth-tokens.test.js` (round-trip, tamper, expiry, RBAC middleware), 6× `test/api/admin-auth.test.js` (400/401/401/200 login flow + admin RBAC gate + no password leakage) against `ecshopping_test`. |
| Schema verification (INFORMATION_SCHEMA) | `password_hash` present on `users`,`vendors`,`admins`; `admins` table exists. Row counts: users 0, vendors 1, admins 1, products 0, orders 3, categories 2. |
| Admin bootstrap | `.env` `ADMIN_EMAIL` was found reverted to empty (also fixes the notification-recipient naming overlap — documented in `.env.example`). Re-ran `npm run db:create-admin` → one `admins` row (`$2a$10$…`, 60 chars). |
| Client lint (`npx oxlint` on `src/`) | **exit 0 — warnings only** (all pre-existing patterns except two trivial ones, fixed). No build-level errors. |
| Client build (`npx vite build`) | **Passed** (pre-existing 577 kB chunk-size warning only). |
| `VITE_ADMIN_*` leak | Confirmed **removed** from the whole client tree. |

## 3. The "TiDB outage" — root cause (important lesson)

The previous session's `ECONNREFUSED` saga was **not** a TiDB problem. Probe scripts invoked `dotenv.config()` too — which reads **`.env` relative to the current working directory** — but commands ran from the repo root (`E:\EcShopping`), not `E:\EcShopping\server`. Result: `DB_HOST` was `undefined`, and every "connection" silently targeted `127.0.0.1:4000` → `ECONNREFUSED` with an empty `AggregateError` message. TCP/TLS to the real gateway were always fine (verified with raw socket probes).

> **Rule adopted:** DB-touching one-off scripts/probes must run with `workdir: E:\EcShopping\server`.

## 4. Pending approvals / follow-ups (needs your call)

1. **`npm run db:hash-legacy-passwords -- --apply`** — dry run shows exactly **1 vendor** still holds a legacy plaintext password. The script would add a bcrypt hash into `password_hash` (legacy `password` column is left untouched). Apply when ready.
2. **Old server instance restart** — the pre-upgrade server (old code) is still listening on **port 5000** (PID 10040). Stop it and start the upgraded code with `npm start` in `E:\EcShopping\server`.
3. **Admin password rotation** — the initial `ADMIN_PASSWORD` in `.env` is a bootstrap credential; rotate it after first login (`npm run db:create-admin` re-upserts).
4. **Prod DB appearance during development** — current production tables look freshly reset (users 0, products 0, orders 3). If that reset was intentional, nothing to do; if not, check backups before further testing.
5. **Testing with a fresh browser** — tokens are role-keyed in `localStorage`; old "logged in" states from before the upgrade won't have a token, so users simply need to log in again once.

## 5. Files touched this session

```
server/ (verification + ops only)
  .env                                     ADMIN_EMAIL set (was empty)
  scripts/create-admin.js                  run → admins row restored
  scripts/hash-legacy-passwords.js         dry run only (pending approval)
  .tmp-probe.cjs / .tmp-tls-probe.cjs / .tmp-tcp-probe.cjs   created, used, deleted

server/ (new this session)
  test/passwords.test.js
  test/auth-tokens.test.js
  test/api/admin-auth.test.js

client/src/
  utils/api.js                rewritten (role-token plumbing)
  utils/storage.js            session helpers, no plaintext checks
  components/auth/AuthForm.jsx
  pages/admin/AdminLogin.jsx  rewritten (server-side auth)
  pages/admin/AdminDashboard.jsx
  pages/vendor/VendorLogin.jsx
  pages/vendor/VendorDashboard.jsx
  pages/vendor/CategoryManager.jsx
  pages/vendor/AddProduct.jsx
  pages/vendor/AllProducts.jsx
  pages/Orders.jsx
  pages/Checkout.jsx
  App.jsx
```

## 6. Known limitations (accepted, Phase 1)

- **One token per role per browser.** Manager-style users switching between customer and admin tabs share the browser's `localStorage`; a role switch takes effect on the next full login of that role.
- **Guest order tracking remains local.** `GET /api/orders/:id` requires authentication by design; guests keep their order via the confirmation page + local cache.
- **Vendor self-profile update (`Settings`) is still local-only** — no corresponding server endpoint exists yet.
