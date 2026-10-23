# EcShopping — Phase 0: Stabilization & Critical Order-Security Fixes

**Date:** 2026-10-21 · **Inputs:** Phase 1 Security Report + Phase 2 Audit · **Status:** COMPLETE — stopped for review.

**Not done in this phase:** PhonePe integration, UI redesign, deployment/hosting, settlements, legacy `--apply` password migration (still awaiting approval), commits/pushes. The live `ecshopping` database was **not modified** (verified by read-only probe before/after). All automated write tests ran against `ecshopping_test` only.

---

## 1. Files changed and reasons

### Server
| File | Change | Reason |
|---|---|---|
| `server/index.js` | **Rewrote `POST /api/orders`** (~1000–1235): • order ids are server-generated (`ORD-` + 6 random digits via `crypto.randomInt`, uniqueness verified inside the transaction, 8-attempt loop, `ER_DUP_ENTRY → 409`) • removed the `ON DUPLICATE KEY UPDATE` upsert (the anonymous order-overwrite vector) • accepts only `productId/id`, `quantity`, `variant` per item; prices/titles/vendor fields/totals recomputed from DB • products must exist, be `approved`, not `out_of_stock` • merged duplicate product+variant lines; caps: ≤50 lines, qty 1–99 • contact validation (email regex, 10-digit mobile → ported from client `Checkout` rules, name ≤120, address object street/city/6-digit PIN or legacy string) • business rules **ported verbatim** from `client/src/utils/pricing.js` (`DELIVERY_RULES`: standard ₹50/free≥499, express ₹120; `COUPON_RULES`: WELCOME10, FRESH50, FREESHIP, HARVEST20) so the server is the single source of truth — no invented rules, unknown/short-of-threshold coupons simply don't apply • `payment_status` forced `'pending'`, `payment_reference` forced NULL at creation (never trusted from client) • transactional `BEGIN/COMMIT` orders+order_items insert with full rollback on any item failure • signed-in customer's identity always overrides payload email/name | Step 3: prevent overwrites, client-side price manipulation, honor stock, honest payment state; preserve guest checkout with validated payloads |
| `server/index.js` | Added `import { randomInt } from 'node:crypto'` | server-issued order ids |

No schema changes — the existing `orders`/`order_items` tables were sufficient.

### Client
| File | Change | Reason |
|---|---|---|
| `client/src/App.jsx` | `handleCustomerLogin` no longer calls the (undefined, un-imported) `setCurrentCustomer`; it only mirrors UI state. `AuthForm` already persists profile+token via `saveCustomerSession(data.user, data.token)` before invoking this callback | Step 2 P0 fix: removes the `ReferenceError` while keeping a **single source of truth** (no local-password auth reintroduced, no second identity store) |
| `client/src/utils/orderSync.js` (**new**) | Pure module: `mergeOrderHistory(serverOrders, localOrders)` + `paymentStatusDisplay(order, labels)`. Identity rule = order `id` (string-compare); server rows always win; local-only rows survive with `serverVerified: false`; merged list sorted newest-first | Step 4 merge semantics; testable in Node without a browser |
| `client/src/utils/storage.js` | `addOrder` is now **async, server-first**: posts to the API, stores the server-confirmed order (marked `serverVerified: true`); on any failure keeps an **offline draft** locally, flagged `serverVerified: false` (offline id regenerated to avoid collisions). `syncOrdersFromServerDetailed` added ({ ok, status, error }); empty-params sync **merges** via `mergeOrderHistory` instead of wholesale `setItem` replacement | Steps 3+4: server-confirmed placement; empty server responses can no longer wipe local history; failures distinguishable |
| `client/src/utils/api.js` | `request()` errors now carry `error.status`; `createOrder` attaches the optional customer token (`role: 'customer'`) so logged-in checkouts are identity-bound | Step 3 (token-bound orders) + Step 4 (auth vs network distinction) |
| `client/src/pages/Orders.jsx` | Uses the detailed sync; separate states for **loading** (hero subtitle), **auth errors** (session-expired banner), **network/5xx** (banner, cache untouched); server-confirmed payment labels; device-only copies show "Payment unverified (device copy)" / "Pending server confirmation" and a "Device copy — not yet confirmed by the server." note; no cross-customer exposure (list filtered by the signed-in email) | Step 4 requirements |
| `client/src/pages/OrderDetails.jsx`, `TrackOrder.jsx` | Payment labels routed through `paymentStatusDisplay` so unverified device copies never display as "Paid" | Step 4: don't present unverified local data as paid |
| `client/src/pages/Checkout.jsx` | `await addOrder(...)` (one-word change) | `addOrder` is now async; confirmation/navigate must use the returned (server-confirmed) order |
| `client/package.json` | Added `npm test → node --test tests/` | runnable client unit tests |
| `client/tests/orderSync.test.mjs`, `client/tests/structure.test.mjs` (**new**) | 13 unit tests: merge rules, payment-gating, P0 static guard, server-authoritative checks | Step 5 validation (see §3) |
| `server/test/api/orders.test.js` (**new**) | 25 tests covering the Step-5 API checklist (see §3) | Step 5 validation |

---

## 2. Security & data-integrity fixes delivered

1. **P0 crash fixed:** customer login no longer throws `ReferenceError` (`App.jsx`); vendor/admin flows untouched (verified by admin-auth + vendor-login tests).
2. **Order overwrite eliminated:** the `POST /api/orders` upsert (could replace **any** existing order + items by sending a guessed `ORD-…` id) is gone; ids are server-issued and uniqueness-checked inside the transaction.
3. **Price/total manipulation blocked:** order math derives from DB product rows + server-side copies of the pricing config; client-sent `price/title/subtotal/total discount/paymentStatus/paymentReference` are all ignored.
4. **Stock/approval honored:** unknown, non-`approved`, or out-of-stock products are rejected before any write.
5. **Rollback protection:** orders + items commit atomically; a mid-flight item-insert failure leaves zero rows (verified by a connection-level failure injection).
6. **Honest payment display:** server always starts `pending`; unverified device copies can never render as "Paid" anywhere (Orders / OrderDetails / TrackOrder gated through `paymentStatusDisplay`).
7. **History preservation:** empty/partial server responses no longer wipe local history; server values win on matching ids; stale local values can never overwrite server-confirmed rows.
8. **Guest checkout retained, securely:** guests may still create orders (validated payload only) and can never read (`401`/`404`-masked) or overwrite another customer's orders. Documented gap: a draft placed while offline has no server record until a future sync; it is explicitly labelled "device copy".

## 3. Tests run and actual results

**Backend — `E:\EcShopping\server` (writes only to `ecshopping_test`; `DB_NAME` overridden before app import, same harness as the existing admin-auth suite):**

| Command | Result |
|---|---|
| `npm run test:api` (node --test test/api/) | **31/31 pass, 0 fail** — includes the 6 existing admin-auth regression tests + 25 new: customer register/login regression, anonymous-overwrite attempt (existing row byte-identical), client price/title/vendor spoofing ignored, payment `paid`+reference forced to `pending`/NULL, coupon below-threshold & valid-coupon math, 14 invalid-payload 400 cases (empty items, qty 0/1.5/100, unknown/pending/out-of-stock product, malformed item, bad email/name/phone/address/PIN, unsupported payment method), **transaction rollback under injected item-insert failure** (order count unchanged), token identity overrides payload email, customer list/detail ownership scoping (incl. 404 masking for other customers), anonymous GET orders → 401, vendor login regression + vendor order scoping + vendor cannot flip foreign order status (404-masked) + unauthenticated status PUT → 401 |
| `npm test` (all server tests incl. unit) | **47/47 pass, 0 fail** (adds passwords 8/8, token 8/8, requireAuth behavior 7/7 |

**Frontend — `E:\EcShopping\client`:**

| Command | Result |
|---|---|
| `npm run lint` (oxlint) | **exit 0** (31 pre-existing warnings, none introduced by this phase's files) |
| `npm test` (node --test tests/) | **13/13 pass, 0 fail** — merge semantics (server-wins, local-preserving, empty-response safety, ordering, robustness), payment-gating rules, P0 static guard (no `setCurrentCustomer` reference), AuthForm persists session pair, Checkout awaits server-first `addOrder`, storage merges instead of replace-all, server upsert removed |
| `npm run build` (vite build) | **success, exit 0** (1985 modules; only the pre-existing "chunks larger than 500 kB" advisory) |

**Not executed / not applicable (stated honestly):**
- **Browser runtime E2E of the React login flow** — no React test runner exists in the repo; the P0 regression is covered by: targeted unit edits verified by oxlint + `vite build` + an automated structural guard test asserting the removed helper is no longer referenced. A real browser click-through remains to be done by the reviewer (recommend: log in with a real account after the dev server reloads).
- **True concurrent duplicate-order-id race (`ER_DUP_ENTRY → 409`)** — not deterministically testable without concurrency injection; guarded by the pre-INSERT existence check inside the transaction.
- **Anything against the live DB** — intentionally skipped; `ecshopping` remains untouched (probe: users 0, orders 3, products 0, vendors 1 before and after).
- Test rows in `ecshopping_test` were cleaned up during the test `after()` hooks; a final sweep removed 24 residual order/order_items rows left in the **test** database only.

## 4. Unresolved decisions / risks (need business or reviewer input)

1. **Numeric stock decrement:** `products` has `stock_status` but no quantity column, so "availability" = in/out-of-stock flag. True stock decrement on purchase needs a schema change (future phase, needs approval).
2. **Coupon abuse:** coupons are static config replicated server-side; there's no per-customer usage limit (a guest can reuse `FREESHIP` freely). Decide: usage counters/rule tightening before public launch.
3. **Vendor global order status:** `PUT /api/orders/:id/status` still flips the *whole* order (any vendor with ≥1 item can cancel everyone's slice). Per-item fulfilment requires a schema change — deferred to the fulfilment phase (Phase 2 plan §6), **not silently changed here**.
4. **Guest→account linkage:** guests who check out while the auto-account registration fails (e.g., email already registered) get orders tied to their email only. Future design (from the audit): public tracked-order endpoint or claim-flow — documented, not implemented (would be a new public surface).
5. **Offline drafts:** an order placed with the API unreachable stays `serverVerified: false` on-device; there is no background retry. Acceptable for Phase 0; vendor/admin data flows unchanged.
6. **`payment_status` for COD:** stays `pending` until admin/provider updates it later — the UI now labels this honestly.

## 5. Database changes and rollback

- **No schema changes**; **no live (`ecshopping`) data writes** (SELECT-only probes before/after confirmed counts: users 0, orders 3, products 0, vendors 1).
- Rollback of this phase's *code* is trivial (git checkout of the 10 changed files; no migration to undo). The new tests can be removed with the files.

## 6. Scope confirmation

✅ Customer/vendor/admin interfaces were **not redesigned** (only the minimal Step-2/4 fixes + payment-label gating); ✅ **no PhonePe** implementation (mock payment UI unchanged; server refuses to store verification claims); ✅ **no deployment/hosting/settlement** work; ✅ no commits, no pushes, no `--apply` migration, no prod-data modifications.

**Stopping here per instructions — awaiting review before the next phase.**
