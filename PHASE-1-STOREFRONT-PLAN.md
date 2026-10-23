# Phase 1 — Real-Data Customer Storefront (Implementation Plan)

Status: **DRAFT — awaiting approval. No code has been changed.**
Scope: the customer-facing storefront (`/`, `/shop`, `/category/:slug`, `/collection/:slug`, `/product/:id`, header search, footer/home category links) must render only server data from TiDB; the hardcoded demo catalogue (`client/src/data/catalog.js` products, ~875 lines of `eco-*` / Unsplash content) must stop feeding these pages.

---

## 1. Current data flow (verified by read-only audit)

| Surface | Today | Source |
|---|---|---|
| Home rails (bestsellers / new / deals) | `getProductsByTag('bestseller')`, `getProductsByTag('new')`, `getCollectionProducts('deals')` — hardcoded demo tags | `data/catalog.js` |
| Home hero / benefits stats | `products.length`, `categories.length` from demo data | `data/catalog.js` |
| Home category rails / grid | `getCatalogProducts()` filtered by `category.slug`; circles link to `/category/<slug>` | `data/catalog.js` |
| Shop (all/category/collection) | `getCatalogProducts()` + `getCategory(slug)` + `getCollection(slug)`; **simulated 260 ms loading timer**; client-side pagination (PAGE_SIZE 12), client-side search/sort/filters | `data/catalog.js` + URL params |
| Product detail | `findProduct(id)` with **simulated 180 ms timer**; gallery = `product.images`; specs tab; related = `getRelatedProducts` | `data/catalog.js`; only reviews are already real (`api.getReviews` / `api.createReview`) |
| Header | category dropdown + search suggestions + mobile links from `categories`; suggestions filter `getCatalogProducts()` client-side | `data/catalog.js` |
| Footer | `categories.slice(0, 5)` links | `data/catalog.js` |
| Wishlist / Cart / Checkout | localStorage product snapshots (unchanged by this phase) | — |
| Collection pages | `/collection/:slug` resolves hardcoded collections (`bestsellers`, `new-arrivals`, `deals`, `special`, `combos`, …) with `productIds` lists | `data/catalog.js` |

Vendor products already reach the customer cache: `App.jsx` mounts → `syncFromServer()` → `syncProductsFromServer(role=undefined)` → `GET /api/products` (anon ⇒ **approved only**) → normalized into `localStorage['ecshopping_products']`, and `cartContext.dataVersion` is bumped. So a version of the storefront *could* read real data today — but every storefront page bypasses it via `catalog.js`.

## 2. Server reality (verified)

- `GET /api/products` (optionalAuth, server/index.js:635): anon/customer ⇒ `status='approved'` only. Accepts `vendorId`, `category`, `status`. **No** `search`, `sort`, `minPrice/maxPrice`, `page/limit`, `stockStatus`. Fixed `ORDER BY created_at DESC`.
- `GET /api/products/:id` (:677): public for approved rows (others 404-masked). ✔ Reusable as-is.
- `GET /api/categories` (:483): **`requireAuth('vendor','admin')` — not public.** Returns `{id, vendorId, name, description, status, createdAt}`. Category images/taglines do **not** exist in DB (only in static category objects).
- `GET /api/reviews` — already public; per-product ratings would need HTML-free JSON only (there is no aggregate column).
- Client `api.js` already has `getProduct(id)`, `getProducts(params, role)`, `getCategories()` (vendor-token scoped), `getReviews`, `createReview`.
- **Live `ecshopping` DB has 0 products, 2 categories, 1 vendor.** After this phase the storefront will be *empty* until sellers list and admins approve. That is intended (Rule: no demo fallback).

**Server product fields:** `id, vendorId, vendorName, title|name, description, category (name string), price, strikePrice, unit, image, stockStatus ('in_stock'/'out_of_stock'), status, createdAt`.
**Card/PDP fields expected by UI:** `title, price, compareAt, image, images[], category (slug), seller, badge, rating, reviews(count), variants[], tags, inStock, sales, addedAt, unit, description, specs[{label,value}|[k,v]], highlights[]`.

## 3. Approved-scope changes

### 3.1 Backend (server/index.js only — no schema migration)
All storefront-facing endpoints must keep the existing role scoping (approved-only for anon/customers).

1. **`GET /api/categories` — public variant.** Add `GET /api/categories/public` (no auth): `status='active'` only, `DISTINCT` rows, return the same restrained shape (`id, name, description, createdAt`) — **no vendor_id leaking per row is avoided by grouping**: return `{name, description, createdAt}` deduped by `LOWER(name)` plus a `count` of active approved products per category. Marketing imagery stays client-side (§3.2 map).
2. **`GET /api/products` — storefront query params** (applied only in the anon/customer branches so vendor/admin listings logic is untouched):
   - `search=<q>` → `AND (title LIKE ? OR name LIKE ? OR description LIKE ?)` (parameterized, escaped `%_`).
   - `sort=` whitelist → `newest` (default, current order) | `price-asc` | `price-desc`. `rating` / `bestselling` are **not implementable** (no rating/sales columns) — the UI will hide those options for server-backed listings (explicit decision wanted, §5).
   - `minPrice=` / `maxPrice=` → `AND price >= ? (< ?)`; numeric, else ignored/400.
   - `stockStatus=in_stock|out_of_stock` → `AND stock_status = ?`.
   - `page` / `limit` → server-side pagination, `LIMIT ? OFFSET ?` (default `limit=12`, cap `48`), plus `{success, products, total, page, limit}`.
3. **`GET /api/products/:id/related`** (public): up to 8 approved products sharing the same `category`, excluding the id, newest first. (Cheaper and more consistent than client-side pick-4.)

No `products`/`categories` DDL changes. No other endpoints touched.

### 3.2 Frontend
1. **New module `client/src/data/storefront.js`** (single fetch layer for public catalog data):
   - `fetchStorefrontCategories()` → `GET /api/categories/public`; normalizes to `{slug: URL-safe name, name, title, blurb?, image?}` where `image` comes from a **static display map** (keeps existing category visuals keyed by name; purely presentation, falls back to a default tile when unmatched).
   - `fetchStorefrontProducts(params)` → `GET /api/products` with `{search, category, sort, minPrice, maxPrice, stockStatus, page, limit}`; normalizes each server row to the UI shape (table below) and returns `{ok, status, products, total, page, limit}`.
   - `mapServerProduct(row)` — `title ← title||name`, `price ← Number(price)`, `compareAt ← strikePrice only when > price`, `seller ← vendorName`, `category ← category (name, URL-encoded)`, `inStock ← stockStatus !== 'out_of_stock'`, `addedAt ← createdAt`; `rating/reviews/variants/specs/badge/sales/images/tags` stay undefined → UI already renders gracefully when absent (stars grey 0.0, no variant UI, "seller has not listed specs"). Verified mapping — no invented values.
2. **`Shop.jsx`** — merge-mapped: remove simulated 260 ms timer; fetch via `fetchStorefrontProducts` with current URL params (`search`, `category`, `sort`, `band`→min/maxPrice, `inStock`→stockStatus, page); real `loading` state + `ErrorState` (distinguish network fail vs empty); server-driven `total` for pagination; category strip/sidebar options from `fetchStorefrontCategories()`; keep unknown-slug empty state. Collection mode (`/collection/:slug`): hardcode-free definition available to server data: `deals` = approved products with `strikePrice > price` (option added as `hasDiscount=1` param on the products endpoint — tiny whitelist, documented); `bestsellers`, `new-arrivals`, `special`, `combos` cannot be honored from server data at launch — see §5 decision D2.
3. **`ProductDetails.jsx`** — replace timer: `api.getProduct(id)` (+ `fetchStorefrontProducts` fallback by id if `getProduct` not found — not needed, `api.getProduct` exists); loading skeleton stays; 404 → existing EmptyState; keep the already-real reviews flow.
4. **`Home.jsx`** — rails become server-fed: "New products" → approved first 8 by `createdAt`; "Bestsellers/deals" rails + „XX+ products live" stat + Category rails ← `fetchStorefrontProducts`/`fetchStorefrontCategories`; rails hide themselves (`ProductRail` already returns `null` on empty). Marketing sections (hero copy, benefits, testimonials, videos, marquee, collections strip imagery, category circle imagery/taglines) keep using `catalog.js` as **presentation-only content** — the audit confirms this matches "never render demo products as store data".
5. **`Header.jsx` / `Footer.jsx`** — categories from `fetchStorefrontCategories()` (static display map for visuals); header search: debounced (250 ms) `search` API call for suggestions (no more `getCatalogProducts()` filter); `/collection/bestsellers|special|combos` nav links follow §5 D2.
6. **`data/catalog.js` scope after phase:** trimmed to marketing/static content (hero, benefits, testimonials, videos, marquee, collections imagery, `siteInfo` in `data/content.js`) + a small test-fixture file. `products`/`getCatalogProducts`/`getProductsByTag`/`getCollectionProducts`/`findProduct`/`getRelatedProducts` are removed from storefront imports — enforced by a `structure.test.mjs` addition (no `from '.../data/catalog'` product-API imports in storefront pages).
7. **Unchanged on purpose:** cart/checkout/order placement (Phase 0 hardened), wishlist storage, vendor/admin portals, review endpoints, `pricing.js` business rules, item identity (`id`, `::` variant keys) — cart snapshots store whatever shape the new `mapServerProduct` product has, so line keys stay stable.

## 4. Tests & verification (against `ecshopping_test` only; live DB never written)
- **Server tests** (`server/test/api/`): products pagination/limit-cap, `sort` whitelist incl. invalid→400/ignored, `search` escaping (`%`, `'`), `minPrice/maxPrice` (valid/invalid), `stockStatus`, `hasDiscount=1`, `categories/public` (active-only, anon-OK, deduped by name, NO leaking of inactive), `products/:id/related` (excludes itself, approved-only), and re-run of the full existing suites (`test:api` 31 + `npm test` 47 must stay green).
- **Client tests:** `structure.test.mjs` — storefront pages import no product APIs from `data/catalog`; orderSync/storage suites unchanged (13 tests stay green); mapping unit test for `mapServerProduct` (strike/src/fields).
- **Live checks (read-only probes):** `ecshopping` row counts unchanged before/after (users 0, vendors 1, admins 1, categories 2, products 0, orders 3, reviews 0).
- **Manual acceptance:** empty-DB storefront shows honest empty/error states on `/`, `/shop`, `/product/:id`; inserting one `ecshopping_test` product shows up only on test-DB-backed runs.
- Lint (`npm run lint`), `npm test`, `vite build`, `npm run test:api`.

## 5. Decisions I need from you (ambiguous rules — documented per mandate)
- **D1 — Public categories shape:** return `{name, description, createdAt, productsCount}` deduped by `LOWER(name)` (no per-vendor duplication, vendor identities not exposed). OK?
- **D2 — Collections lacking server data:** at launch DB has no tags/sales/ratings. Proposal: `deals` = `strikePrice` items; `new-arrivals` = newest 24; **`bestsellers`, `special`, `combos`, `rating` sort, "4.7★ avg" stat are hidden** until a data basis exists (no invented numbers). Alternatives: (a) keep static collection pages fed by approved-products subsets chosen client-side, (b) drop only `special`/`combos`. Choose behavior.
- **D3 — Category imagery/taglines:** sourced from a static client map keyed by category name (display-only), kept even when server has no rows (circles still shown, linking to empty category pages). Alternative: hide grids with no categories.
- **D4 — `categories/public` path vs sharing root `GET /api/categories` publicly** (root stays vendor/admin for portal compatibility). OK to add the new public route?
- **D5 — `data/catalog.js` final scope** as in §3.2.6 (marketing content stays; product APIs removed). OK, or should marketing content also be relocated to a new `content.js` module for clarity (small extra diff)?

## 6. Risks & rollback
- Products exist only after vendor+admin flow populates them — storefront will look empty at first; no demo data will hide that (per rules). Roll-out-safe: every rail/section self-hides on empty.
- `mapServerProduct` must never put un-approved rows into card lists for anon browsing (server scope already guarantees it; a client-side `status==='approved'` guard is added defensively).
- `strikePrice`-vs-`compareAt` and name-vs-slug category mapping chosen conservatively; mapping verified against `AddProduct.jsx` writes and the `PRODUCT_COLUMNS` projection.
- Rollback = revert the ~8 touched files (server/index.js, 6 storefront files, new `storefront.js`); no DB migration to undo.

---

I will implement **only after you approve** (or amend) items above — say “approve plan” (optionally with D1–D5 choices) and I'll proceed.
