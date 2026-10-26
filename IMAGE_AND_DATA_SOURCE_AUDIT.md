# EcShopping — Comprehensive Image, Data Source & Deployment Verification Audit

**Audit Date:** 2026-10-25  
**Audit Scope:** Fresh Vercel Deployment Verification, Codebase Image References, and Full Data Path Audit (Customer, Vendor, Admin)  
**Project:** EcShopping (`E:\EcShopping`)  
**Frontend URL:** `https://ec-shopping.vercel.app`  
**Backend URL:** `https://ec-shopping-three.vercel.app`  
**Local Baseline:** 39/39 Client Tests Pass, 102/102 Server Tests Pass, 0 Client Linter Errors  

---

## 1. Task 1 — Fresh Frontend Deployment Verification

### 1.1 Direct Runtime Evidence

| Check # | Check Description | Expected | Actual Evidence | Status |
|---|---|---|---|---|
| **1.1.1** | Fetch frontend HTML & identify entry script | Fresh HTML pointing to bundle targeting backend | `GET https://ec-shopping.vercel.app/` returns HTML referencing `<script type="module" crossorigin src="/assets/index-BmNLyhdI.js"></script>` | **FAIL** (Stale bundle) |
| **1.1.2** | Inspect production JS bundle content | Bundle contains `https://ec-shopping-three.vercel.app` | `/assets/index-BmNLyhdI.js` contains `var In="https://ecshopping.onrender.com"`. Search for `ec-shopping-three` returns 0 matches. | **FAIL** (Targets Render) |
| **1.1.3** | Production deployment timestamp & age | Created on or after Oct 25, 2026 | `last-modified: Fri, 23 Oct 2026 21:59:06 GMT`, `age: 156657` (~43.5 hours old), `etag: W/"38dc3d4571104efb0e98f28d033c9d46"`, `x-vercel-cache: HIT` | **FAIL** (Deployment not updated on domain) |
| **1.1.4** | Check backend `GET /api/categories/public` | HTTP 200 with live categories | Status `200 OK`, `access-control-allow-origin: *`, returns all 6 categories from TiDB Cloud | **PASS** |
| **1.1.5** | Check backend `GET /api/products` | HTTP 200 with live products | Status `200 OK`, returns 8 approved products with live prices and images | **PASS** |
| **1.1.6** | Check backend root `GET /` | HTTP 200 health check | Status `200 OK`, `{"success": true, "service": "EcShopping API"}` | **PASS** |
| **1.1.7** | Deployed frontend end-to-end connectivity | Browser requests route to Vercel backend | Deployed frontend currently makes client-side API requests to `https://ecshopping.onrender.com` (which fails/404s). | **BLOCKED** |

### 1.2 Deployment Discrepancy Root Cause & Exact Resolution

1. **Why `https://ec-shopping.vercel.app` still serves the Oct 23 build:**
   - In Vite applications, `import.meta.env.VITE_API_URL` is **inlined as a string literal at build time** (`vite build`).
   - Although `VITE_API_URL=https://ec-shopping-three.vercel.app` is configured in Vercel Project Settings, the live production domain is still pointed to the immutable deployment `dpl_...` created on **Oct 23, 2026 at 21:59:06 GMT**.
   - If a redeployment was triggered in the Vercel dashboard:
     - Either it was deployed as a **Preview** deployment (generating a private preview URL without promoting to Production),
     - Or **"Use existing Build Cache"** was checked, causing Vite to reuse cached bundle artifacts without re-evaluating the new environment variable,
     - Or the build encountered an error during deployment.
2. **Action Required by Developer:**
   - In Vercel Dashboard -> `ec-shopping` frontend project -> **Deployments**.
   - On the Production branch (`main`), click the three dots (`...`) -> **Redeploy**.
   - Ensure the checkbox **"Use existing Build Cache" is unchecked**.
   - Verify that the resulting deployment is assigned as the **Production Deployment** (`ec-shopping.vercel.app`).

---

## 2. Task 2 — Complete Codebase Image Audit

### 2.1 Categorization Schema
1. **Database-backed product images:** URLs stored in the TiDB `products` table in column `image` and returned by `GET /api/products`.
2. **Database-backed category/banner images:** URLs stored in database records and returned by the API.
3. **Local decorative assets:** Static brand logos, icons, and illustrations in `src/assets/`.
4. **Hardcoded content:** Images or catalog content embedded directly in client JavaScript source code.
5. **Fallbacks/placeholders:** Images or paths displayed when database/API images are missing or trigger `onError`.
6. **External-hosted images:** Images loaded from third-party CDNs (e.g., Unsplash, Cloudinary, Google Storage).

---

### 2.2 Comprehensive Component & Screen Inventory

| Screen / Component | Source File & Lines | Current Image Source | Classification | Demo / Prod Problem? | Recommended Fix |
|---|---|---|---|---|---|
| **Header Brand Logo** | `client/src/components/Header.jsx:138, 407` | `import brandLogo from '../assets/logo/without-bg-logo.png'` | Local decorative asset | **No** (Standard brand mark) | None required. |
| **Footer Brand Logo** | `client/src/components/Footer.jsx:62` | `import brandLogo from '../assets/logo/without-bg-logo.png'` | Local decorative asset | **No** (Standard brand mark) | None required. |
| **Customer Login Modal** | `client/src/components/auth/LoginModal.jsx:58` | `import brandLogo from '../../assets/logo/without-bg-logo.png'` | Local decorative asset | **No** (Standard brand mark) | None required. |
| **Customer Login Side Banner** | `client/src/pages/Login.jsx:30` | `import userLoginImg from '../assets/login-page/user-login.png'` | Local decorative asset | **No** (Marketing illustration) | None required. |
| **Vendor Login Side Banner** | `client/src/pages/vendor/VendorLogin.jsx:110` | `import vendorLoginImg from '../../assets/login-page/vendor-login.png'` | Local decorative asset | **No** (Marketing illustration) | None required. |
| **Vendor Dashboard Sidebar Logo** | `client/src/pages/vendor/VendorDashboard.jsx:380` | `import brandLogoWithBg from '../../assets/logo/logo.png'` | Local decorative asset | **No** (Brand identity) | None required. |
| **Form Select Dropdown Arrow** | `client/src/index.css:456` | Inline SVG Data URI (`data:image/svg+xml,...`) | Local decorative asset | **No** (UI component styling) | None required. |
| **Home: Compact Category Bar** | `client/src/components/home/HomeSections.jsx:66` | `<img src={cat.image} />` (derived from `content.js:458-466`) | Hardcoded external (Unsplash) | **Acceptable for Demo** (Visuals only; category names & counts are live from DB) | Future: add `image_url` to `categories` database table. |
| **Home: Shop by Category Tiles** | `client/src/components/home/HomeSections.jsx:134` | `<img src={cat.image} />` (derived from `content.js:458-466`) | Hardcoded external (Unsplash) | **Acceptable for Demo** | Future: add `image_url` to `categories` database table. |
| **Home: Product Rails (Deals, Best Sellers, New Arrivals)** | `client/src/components/ui/ProductCard.jsx:96-105` | `<img src={product.image} />` from `GET /api/products` | **Database-backed** (Unsplash URLs stored in TiDB) | **No** (Live from database) | None required. |
| **ProductCard Fallback** | `client/src/components/ui/ProductCard.jsx:102-105` | `onError`: falls back to `categoryDisplayForName(product.category).image` or `DEFAULT_CATEGORY_IMAGE` | Fallback / External-hosted (Unsplash) | **No** (Graceful fallback prevents broken image icon) | None required. |
| **Product Quick-View Modal** | `client/src/components/ui/ProductQuickView.jsx:119-131` | `<img src={product.image} />` from live product prop | **Database-backed** | **No** (Live from database) | None required. |
| **Product Quick-View Fallback** | `client/src/components/ui/ProductQuickView.jsx:124-130` | `onError`: falls back to `categoryDisplayForName(product.category).image` or `DEFAULT_CATEGORY_IMAGE` | Fallback / External-hosted (Unsplash) | **No** (Graceful fallback) | None required. |
| **Product Details (PDP) Main Gallery** | `client/src/pages/ProductDetails.jsx:262-271` | `<img src={gallery[activeImage]} />` from `GET /api/products/:id` | **Database-backed** | **No** (Live from database) | None required. |
| **Product Details Fallback** | `client/src/pages/ProductDetails.jsx:267-270` | `onError`: falls back to `category?.image` | Fallback / External-hosted (Unsplash) | **No** (Graceful fallback) | None required. |
| **Header Live Search Preview** | `client/src/components/Header.jsx:172` | `<img src={p.image} />` from `api.getProducts({ search })` | **Database-backed** | **No** (Live from database) | None required. |
| **Header Category Dropdown** | `client/src/components/Header.jsx:235` | `<img src={c.image} />` (from `content.js:458-466`) | Hardcoded external (Unsplash) | **No** | Future: DB category image. |
| **Cart Drawer & Cart Page** | `client/src/components/CartDrawer.jsx:74`, `client/src/pages/Cart.jsx:77` | `<img src={item.image} />` from cart item snapshot | **Database-backed** | **No** (Carries live product image) | None required. |
| **Checkout Summary** | `client/src/pages/Checkout.jsx:441` | `<img src={item.image} />` from cart items | **Database-backed** | **No** (Carries live product image) | None required. |
| **Order Confirmation & Orders List** | `client/src/pages/OrderConfirmation.jsx:145`, `client/src/pages/Orders.jsx:132` | `<img src={item.image} />` from `order.items` snapshot in DB | **Database-backed** | **No** (Live from `order_items` DB table) | None required. |
| **Customer Profile Recent Orders** | `client/src/pages/CustomerProfile.jsx:452` | `<img src={item.image || '/placeholder.png'} />` | **Defective Fallback** (`/placeholder.png` missing from `public/`) | **YES (Defect)** | Create `client/public/placeholder.png` or fallback to SVG/Unsplash constant. |
| **Vendor All Products Thumbnails** | `client/src/pages/vendor/AllProducts.jsx:476` | `<img src={p.image || 'https://images.unsplash.com/...'} />` | **Database-backed** with Unsplash fallback | **No** | None required. |
| **Vendor Add/Edit Product Preview** | `client/src/pages/vendor/AddProduct.jsx:465, 571`, `EditProduct.jsx:365, 428` | `<img src={image} />` (Uploaded image URL / Cloudinary CDN) | Dynamic user upload / Cloudinary CDN | **No** | None required. |
| **Admin Dashboard Product Table** | `client/src/pages/admin/AdminDashboard.jsx:664` | `{product.image ? <img src={product.image} /> : <span>No image</span>}` | **Database-backed** | **No** (Safely renders text if null) | None required. |
| **Home: Video Shop Posters** | `client/src/components/home/HomeSections.jsx:428` | `video.poster` from `content.js:521-546` | Hardcoded external (Unsplash) | **No** (Secondary editorial content) | Acceptable for demo. |
| **Home: Collection Banners** | `client/src/components/home/HomeSections.jsx:348, 377` | `deals.image` and `coll.image` from `content.js:479-490` | Hardcoded external (Unsplash) | **No** (Editorial hero visuals) | Acceptable for demo. |
| **Blog Articles (`/blog`)** | `client/src/pages/Blog.jsx:67, 86`, `BlogPost.jsx:54` | `post.image` from `content.js:253-383` | Hardcoded external (Unsplash) | **No** (Static editorial blog) | Acceptable for demo. |

---

### 2.3 Unused Local Assets in Repository
The following files exist in `client/src/assets/` from prior phases or template scaffolding but are **never imported or rendered** by any active component:
- `client/src/assets/corner-leaves-top-right.png`
- `client/src/assets/corner-leaves.png`
- `client/src/assets/cta_landscape_bg.png`
- `client/src/assets/ecshopping_signboard.png`
- `client/src/assets/farmer_holding_leaves.png`
- `client/src/assets/hero.png`
- `client/src/assets/how-it-works-phone.png`
- `client/src/assets/react.svg`
- `client/src/assets/top-right-leaves.png`
- `client/src/assets/vendor_with_tablet.png`
- `client/src/assets/vite.svg`

---

## 3. Task 3 — Dynamic Data Beyond Images Audit

### 3.1 Trace of Critical Data Paths (UI -> API -> Database)

1. **Products, Pricing, and Discounts:**
   - **Database:** TiDB Cloud `products` table (`id`, `vendor_id`, `name`, `title`, `description`, `category`, `price`, `strike_price`, `stock_quantity`, `stock_status`, `image`, `status`, `created_at`).
   - **API Endpoint:** `GET /api/products` (supports `search`, `category`, `sort`, `minPrice`, `maxPrice`, `stockStatus`, `hasDiscount`, `vendorName`, `page`, `limit`).
   - **UI Storefront Layer:** `fetchStorefrontProducts()` in `client/src/data/storefront.js`.
   - **Mapping & Protection:** `mapServerProduct()` in `client/src/data/mapProduct.js` strictly validates types. If API fails, `fetchStorefrontProducts()` returns `{ ok: false, error }`. **It never falls back to demo catalog data.**
   - **Verdict:** **100% Live Database-Backed.**

2. **Categories and Collections:**
   - **Database:** TiDB Cloud `categories` table (`id`, `name`, `description`, `vendor_id`, `created_at`).
   - **API Endpoint:** `GET /api/categories/public` returns active categories with live `productsCount`.
   - **Storefront Layer:** `fetchStorefrontCategories()` in `storefront.js`. Category names, slugs, and live counts come directly from the database.
   - **Presentation Enrichment:** Because the database `categories` schema lacks `image_url` and `tagline` columns, presentation metadata is joined client-side via `categoryDisplay` in `content.js`.
   - **Verdict:** **Names and counts are Live Database-Backed; category thumbnail images are presentation placeholders.**

3. **Product Stock & Availability:**
   - **Database:** `products.stock_status` (`in_stock` / `out_of_stock`) and `stock_quantity`.
   - **Write Paths:**
     - Atomic stock decrement upon checkout in `POST /api/orders` via database transactions.
     - Live stock restoration upon customer cancellation in `PUT /api/orders/:id/cancel`.
     - Vendor stock toggle via `PUT /api/products/:id` (`toggleProductStock()` in `storage.js`).
   - **Verdict:** **100% Live Database-Backed.**

4. **Search & Filters:**
   - **Database:** Full SQL `LIKE ?` search across product `title`, `name`, `description`, and `category`.
   - **Header Search:** Live API queries with 250ms debouncing (`api.getProducts({ search, limit: 5 })`).
   - **Shop Page:** Live API queries across 7 filter parameters.
   - **Verdict:** **100% Live Database-Backed.**

5. **Wishlist & Cart Storage:**
   - **Wishlist:** Stored in `localStorage['ecshopping_wishlist']`. Appropriate for guest/device persistence.
   - **Cart:** Managed in `CartContext.jsx` and backed by `localStorage['ecshopping_cart']`.
   - **Checkout Reconciliation:** Upon order placement, `POST /api/orders` re-reads all prices from the database and recalculates taxes, totals, and stock availability. Client cart pricing is never trusted.
   - **Verdict:** **Safe & Standard Architecture.**

6. **Customer Orders:**
   - **Database:** `orders` and `order_items` tables in TiDB Cloud.
   - **API Endpoint:** `GET /api/orders` (requires JWT authentication; scopes orders to customer email).
   - **Order Placement:** `POST /api/orders` creates verified server records.
   - **Verdict:** **100% Live Database-Backed.**

7. **Vendor Inventory & Orders:**
   - **Inventory:** `GET /api/products` with vendor role token returns owned products including pending/rejected.
   - **Orders:** `GET /api/orders` with vendor token returns only orders containing items sold by that vendor.
   - **Fulfillment:** `PUT /api/orders/:id/status` persists status transitions (`Processing` -> `Shipped` -> `Delivered`).
   - **Verdict:** **100% Live Database-Backed.**

8. **Admin Product, Category, and User Governance:**
   - **Approvals:** `PUT /api/products/:id/status` (`approved` / `rejected`).
   - **Categories:** `POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id`.
   - **Vendors:** `GET /api/vendors`, `PUT /api/vendors/:id/status`.
   - **Users:** `GET /api/users` (password hashes safely sanitized).
   - **Verdict:** **100% Live Database-Backed.**

---

### 3.2 Static / Hardcoded / Demo Content Identified

1. **Blog Posts (`client/src/data/content.js:253-383`):**
   - 4 static articles (`why-cold-pressed-oil-matters`, `how-to-read-a-honey-label`, etc.) with Unsplash images.
   - Status: Completely hardcoded on the client. Not database-backed.
   - Impact: Acceptable for informational/demo storefront marketing.
2. **Store Locations (`client/src/data/content.js:389-430`):**
   - 4 physical store locations in Tamil Nadu (Erode, Coimbatore, Chennai, Madurai).
   - Status: Hardcoded static array. Not database-backed.
   - Impact: Acceptable for store locator reference.
3. **Shop Video Clips (`client/src/data/content.js:521-546`):**
   - 4 sample Google storage video URLs with Unsplash poster frames.
   - Status: Hardcoded static demo media.
   - Impact: Suppressed from primary viewport; acceptable for demo.
4. **Site Info & Legal Policies (`content.js:7-251`):**
   - Terms, Privacy, Returns, Shipping, FAQs, Marquee messages, and Announcement messages.
   - Status: Hardcoded content. Standard for client-side policy rendering.

---

## 4. Missing, Broken, or Hardcoded Issues Identified

1. **Deployment Blocker (High Priority):**
   - `https://ec-shopping.vercel.app` is serving an old static bundle from Oct 23 (`index-BmNLyhdI.js`) with `https://ecshopping.onrender.com` compiled into it.
   - A clean Vercel Redeployment with **"Use existing Build Cache" unchecked** is required.
2. **Missing Asset Defect (Low Priority):**
   - `client/src/pages/CustomerProfile.jsx:452`: references `/placeholder.png` as fallback for order item thumbnails.
   - `client/public/placeholder.png` does not exist on disk. If an order item has no image, an HTTP 404 broken image request will result.
3. **Category Thumbnail Decoupling (Architecture Consideration):**
   - The database `categories` table does not possess an `image_url` column. Category thumbnail visuals on the Home page and Header are mapped via the static `categoryDisplay` array in `content.js`.

---

## 5. Automated Test Baseline & Evidence

| Test Suite | Tests Run | Pass | Fail | Execution Time | Command |
|---|---|---|---|---|---|
| **Client Test Suite** | 39 | 39 | 0 | 0.61s | `npm test --prefix client` |
| **Server Test Suite** | 102 | 102 | 0 | 47.8s | `npm test --prefix server` |
| **Client Linter** | Complete codebase | 0 errors | 0 | 0.45s | `npm run lint --prefix client` |

---

## 6. Executive Summary & Audit Answers

1. **Does the deployed frontend use the correct backend?**
   - **NO.** The production domain `https://ec-shopping.vercel.app` is currently serving the static bundle built on **October 23, 2026 (`index-BmNLyhdI.js`)**, which targets the legacy `https://ecshopping.onrender.com`.
   - The backend at `https://ec-shopping-three.vercel.app` is healthy, live, and returning HTTP 200 with live TiDB Cloud data.
   - **Remedy:** The frontend must be redeployed on Vercel with build cache disabled.

2. **Are all product images database-backed?**
   - **YES.** Every product card, product rail, quick-view modal, PDP gallery, cart line, checkout summary, order confirmation, and admin/vendor inventory row receives its product image URL directly from the TiDB Cloud `products.image` column via `/api/products`. The current seed products use live Unsplash CDN URLs stored in the database.

3. **Which screens still use local, hardcoded, or fallback images?**
   - **Local Assets:** Brand logos in Header, Footer, Vendor Dashboard, and Auth illustrations in `/login` and `/vendor/login`.
   - **Hardcoded External (Unsplash):** Home category thumbnails, Home collection banners, Video posters, and Blog post images (in `content.js`).
   - **Fallbacks:** `ProductCard`, `ProductQuickView`, and `ProductDetails` use `onError` handlers that fall back to category Unsplash images. `CustomerProfile.jsx` references a missing `/placeholder.png`.

4. **Are home-page products and categories genuinely live database/API data?**
   - **YES.** Home page products (Deals, Best Sellers, New Arrivals, Category rails) and category names/counts are fetched directly from `GET /api/products` and `GET /api/categories/public`. If the server is unreachable, the UI renders honest error/retry states; **zero mock or demo catalog data is ever displayed.**

5. **What must be fixed before the client demo?**
   - **Trigger a clean Vercel Redeployment** of the frontend (`ec-shopping`) with build cache disabled so the live domain compiles `VITE_API_URL=https://ec-shopping-three.vercel.app`.
   - **Create a lightweight SVG/PNG placeholder** at `client/public/placeholder.png` to safeguard against 404s in `CustomerProfile.jsx`.
