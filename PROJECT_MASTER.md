# EcShopping — Master Project Specification & Source of Truth

**Project Name:** EcShopping Multi-Vendor Organic Marketplace  
**Version:** 1.0.0 (Production / Demo Ready)  
**Permanent Repository Path:** `E:\EcShopping`  
**Last Updated:** October 25, 2026  

---

## 1. Project Purpose & High-Level Overview

**EcShopping** is a full-featured, secure, multi-vendor organic e-commerce platform built to connect organic farmers, artisanal food producers, and wellness vendors directly with conscious consumers.

The platform provides dedicated, role-isolated portals for three core actor groups:
1. **Customers:** Discover and purchase authentic farm-fresh organic goods, manage multiple delivery addresses, track shipments in real time, write verified reviews, and initiate self-service order cancellations.
2. **Vendors:** Register store profiles, manage inventory and stock levels, submit new product listings with image validation for admin approval, track received orders scoped strictly to their line items, and manage fulfillment status transitions.
3. **Administrators:** Oversee platform governance, review and approve/reject vendor registrations and product submissions, manage global and vendor categories with relational safety guards, monitor revenue metrics, inspect customer accounts, and audit end-to-end platform order fulfillment.

---

## 2. Technology Stack & Architecture

### Backend
- **Runtime & Framework:** Node.js (ESM), Express.js
- **Database:** TiDB Cloud Serverless (MySQL 8.0 wire-compatible distributed SQL database)
- **Database Driver:** `mysql2/promise` with connection pooling, keepalive recycling, and transient connection reset retry wrappers
- **Authentication:** Role-scoped JSON Web Tokens (`jsonwebtoken`, HMAC SHA-256) with role claims (`customer`, `vendor`, `admin`) and Bcrypt password hashing (`bcryptjs`, 10 rounds, constant-time verification)
- **Security & Hardening:** Express Rate Limiter, magic-byte image format sniffing, fail-closed third-party integrations, parameterized SQL throughout (zero raw concatenation)
- **Media CDN:** Cloudinary SDK v2 with magic-byte buffer sniffing (JPEG, PNG, GIF, WebP, max 10MB) and safe base64 data URI fallback
- **Payments:** PhonePe Standard Checkout v2 integration (paisa constraints, fail-closed handling without secrets, UAT retry schedules)
- **Testing:** Node.js native test runner (`node --test`), `supertest` for REST integration testing

### Frontend
- **Framework & Tooling:** React 18, Vite 6, React Router DOM v6
- **Styling:** Modern CSS3 with design tokens, responsive CSS grids, CSS variables, mobile bottom-sheets, drag handles, and touch-target compliance (>= 44px)
- **Icons:** `lucide-react`
- **State & Data Management:** React Context (`CartContext`), server-first hydration with `localStorage` instant preview caching, role-isolated token/session storage (`storage.js`, `api.js`)
- **Linting & Hygiene:** `oxlint` (zero errors baseline)

---

## 3. Directory & File Structure

```text
E:\EcShopping\
├── client\                           # Frontend React application
│   ├── index.html                    # Single-page app entry HTML
│   ├── package.json                  # Frontend scripts and dependencies
│   ├── vite.config.js                # Vite build and dev server configuration
│   ├── src\
│   │   ├── main.jsx                  # React DOM mount point
│   │   ├── App.jsx                   # Central router, auth guards, modal roots
│   │   ├── index.css                 # Base resets, theme tokens, typography
│   │   ├── api.js                    # Base URL resolution & request wrappers
│   │   ├── components\
│   │   │   ├── checkout\             # Address selection, payment method choices
│   │   │   ├── header\               # Navigation bar, category chips, cart drawer trigger
│   │   │   ├── home\                 # Hero banner, deals rail, best-sellers grid
│   │   │   └── ui\                   # Reusable UI tokens: ProductCard, ProductQuickView,
│   │   │                             # QuantityStepper, Toast, Modal, Tabs, Breadcrumbs
│   │   ├── context\
│   │   │   └── CartContext.jsx       # Cart state, item quantities, subtotal calculations
│   │   ├── data\
│   │   │   ├── mapProduct.js         # Server product row normalization to UI model
│   │   │   └── storefront.js         # Public category, search, and related product fetchers
│   │   ├── pages\
│   │   │   ├── Home.jsx              # Customer storefront home page
│   │   │   ├── Shop.jsx              # Catalog search, category filters, sorting, pagination
│   │   │   ├── ProductDetails.jsx    # PDP with reviews, quantity selector, related items
│   │   │   ├── Cart.jsx              # Shopping cart inspection and line-item controls
│   │   │   ├── Checkout.jsx          # Shipping address select & COD/PhonePe payment
│   │   │   ├── OrderDetails.jsx      # Order progress, item list, cancellation modal
│   │   │   ├── CustomerProfile.jsx   # Profile update, password change, multi-address manager
│   │   │   ├── Login.jsx             # Customer login & registration tabs
│   │   │   ├── PaymentStatus.jsx     # PhonePe return page with polling reconciliation
│   │   │   ├── TrackOrder.jsx        # Public and authenticated shipment tracker
│   │   │   ├── admin\
│   │   │   │   ├── AdminLogin.jsx    # Admin login portal with security badge
│   │   │   │   └── AdminDashboard.jsx# Metrics, Approvals, Vendors, Categories, Orders
│   │   │   └── vendor\
│   │   │       ├── VendorLogin.jsx   # Vendor login portal with approval gating notice
│   │   │       ├── VendorRegister.jsx# Vendor registration saving to TiDB with pending status
│   │   │       ├── VendorDashboard.jsx# Products, Orders, Stocks, Reviews, Settings
│   │   │       ├── AddProduct.jsx    # Product submission with Cloudinary image upload
│   │   │       ├── EditProduct.jsx   # Product re-submission for pending/rejected items
│   │   │       ├── AllProducts.jsx   # Full product inventory with status filters
│   │   │       └── CategoryManager.jsx# Vendor category management
│   │   └── utils\
│   │       ├── api.js                # Central API client, JWT session attach & 401 eviction
│   │       ├── pricing.js            # INR currency formatting, discount calculation
│   │       └── storage.js            # Session helpers, cache sync, optimistic updates
│   └── tests\                        # Client automated unit test suites
│       ├── authAuditRemaining.test.mjs# Auth isolation, session expiry, navigation guards
│       ├── mapProduct.test.mjs       # Product normalization and compare-at pricing logic
│       ├── orderSync.test.mjs        # Server order history merge algorithms
│       ├── quickviewAndMobile.test.mjs# Mobile grid breakpoints and Quick-View portal
│       └── structure.test.mjs        # Anti-regression tests (no mock catalog imports)
├── server\                           # Backend Node/Express application
│   ├── index.js                      # Express application entry, API routes, middleware
│   ├── db.js                         # TiDB connection pool, auto-migrations, retry logic
│   ├── package.json                  # Backend scripts and dependencies
│   ├── .env.example                  # Safe template of required environment variables
│   ├── middleware\
│   │   ├── auth.js                   # JWT signing, verification, and role-based guards
│   │   └── rateLimit.js              # Express rate-limiting configurations
│   ├── scripts\
│   │   ├── create-admin.js           # CLI provisioning script for admin accounts
│   │   ├── phase-9-inventory-migration.sql# Schema migration for stock tracking
│   │   └── phase-9-inventory-rollback.sql # Rollback migration
│   ├── test\                         # Server automated integration test suites (102 tests)
│   │   ├── auth-tokens.test.js       # JWT signing, tampering, expiration, RBAC tests
│   │   ├── db-pool.test.js           # Database pool keepalive and connection handling
│   │   ├── media.test.js             # Image magic-byte validation and Cloudinary tests
│   │   ├── passwords.test.js         # Bcrypt hashing and constant-time verification tests
│   │   └── api\
│   │       ├── admin-auth.test.js    # Admin login, invalid credentials, RBAC tests
│   │       ├── categories.test.js    # Category CRUD and safe deletion guards
│   │       ├── customer-profile.test.js# User profile, password update, address CRUD
│   │       ├── inventory-fulfillment.test.js# Atomic stock decrement, vendor stock management
│   │       ├── orders.test.js        # Server-authoritative order placement and transactions
│   │       ├── phonepe.test.js       # PhonePe Standard Checkout fail-closed integration
│   │       └── storefront.test.js    # Public catalog search, filters, pagination
│   └── utils\
│       ├── media.js                  # Buffer format sniffing and Cloudinary helper
│       ├── passwords.js              # Bcrypt password hashing & validation utilities
│       └── phonepe.js                # PhonePe v2 client and state mappings
├── PROGRESS.md                       # Session-by-session development handover log
├── TASK_TRACKER.md                   # Complete master plan task tracker (Phases 0–18)
├── SCREEN_INVENTORY.md               # Audit inventory of all 45 application views
├── LOGIN_AND_EMAIL_SETUP.md          # Authentication and email fallback documentation
└── FINAL_AUDIT_REPORT.md             # Evidence-based completion audit report
```

---

## 4. Role-Based Access Control & Portals

The application strictly isolates sessions, tokens, and data access among three roles:

| Role | Browser Routes | Auth Token Key | Profile Key | Server Guard | Permitted Capabilities |
|---|---|---|---|---|---|
| **Customer** | `/`, `/shop`, `/product/:id`, `/cart`, `/checkout`, `/orders/:id`, `/track-order`, `/profile` | `ecshopping_token_customer` | `ecshopping_current_customer` | `requireAuth('customer')` | Browse catalog, place orders, save addresses, update profile/password, write reviews, cancel non-delivered orders |
| **Vendor** | `/vendor`, `/vendor/login`, `/vendor/register`, `/vendor/dashboard`, `/vendor/products/*`, `/vendor/orders`, `/vendor/stocks` | `ecshopping_token_vendor` | `ecshopping_current_vendor` | `requireAuth('vendor')` | Submit products for approval, edit pending/rejected products, manage stock status and quantities on own approved items, update fulfillment status of own order items |
| **Admin** | `/admin`, `/admin/login`, `/admin/dashboard` | `ecshopping_token_admin` | `ecshopping_current_admin` | `requireAuth('admin')` | Approve/reject vendor accounts, approve/reject product submissions with feedback, manage shared & vendor categories, inspect platform metrics and customer accounts |

---

## 5. Database Schema & Data Integrity

The relational database is deployed on **TiDB Cloud** and initialized via `server/db.js`.

### Core Tables
1. **`users`**: Customer accounts (`id`, `name`, `email`, `password_hash`, `phone`, `created_at`).
2. **`vendors`**: Vendor accounts (`id`, `name`, `email`, `password_hash`, `phone`, `status` [pending/approved/rejected], `direct_selling`, `created_at`).
3. **`admins`**: Platform administrator accounts (`id`, `email`, `password_hash`, `created_at`). CLI-provisioned only; no public sign-up.
4. **`categories`**: Global shared categories and vendor-scoped categories (`id`, `vendor_id` [NULL for shared], `name`, `description`, `status` [active/inactive], `created_at`). Foreign key safety prevents deletion if referenced by products.
5. **`products`**: Product listings (`id`, `vendor_id`, `vendor_name`, `title`, `name`, `description`, `category`, `price`, `strike_price`, `unit`, `image`, `stock_status` [in_stock/out_of_stock], `stock_quantity`, `status` [pending/approved/rejected], `created_at`).
6. **`orders`**: Customer orders (`id` [ORD-XXXXXX], `customer_name`, `customer_email`, `customer_phone`, `shipping_address`, `subtotal`, `discount`, `shipping`, `total`, `coupon_code`, `delivery_method`, `payment_method`, `payment_status`, `payment_reference`, `status` [Processing/Shipped/Delivered/Cancelled], `created_at`).
7. **`order_items`**: Individual line items (`id`, `order_id`, `product_id`, `vendor_id`, `vendor_name`, `title`, `price`, `quantity`, `image`, `variant`).
8. **`reviews`**: Product ratings and feedback (`id`, `product_id`, `vendor_id`, `product_title`, `customer_name`, `customer_email`, `rating` [1–5], `comment`, `created_at`).
9. **`customer_addresses`**: Customer saved shipping addresses (`id`, `user_id`, `name`, `phone`, `street`, `city`, `state`, `postcode`, `country`, `is_default`, `created_at`). Enforces single default address invariant.

---

## 6. Critical Business Rules & Workflows

### A. Product Approval & Anti-Tampering Lifecycle
1. Vendor registers via `/vendor/register`; record is saved in TiDB with `status: 'pending'`.
2. Admin reviews pending vendor in Admin Dashboard Vendors tab and clicks "Approve".
3. Vendor submits a product via `/vendor/products/add`. Server validates image magic-bytes and assigns `status: 'pending'`.
4. Admin reviews product in Admin Dashboard Products tab. Admin can "Approve" (surfacing it immediately in the public catalog) or "Reject" with a reason.
5. If rejected, vendor can edit product details via `EditProduct.jsx` and re-submit, which resets status to `'pending'` for re-review.
6. **Anti-Tampering Rule:** Once a product is approved, the vendor cannot alter content fields (`title`, `price`, `description`, `image`, `category`) without admin re-approval.
7. **Vendor Inventory Rule:** Vendors retain full control over inventory for their own approved products: they can toggle stock status (`in_stock` / `out_of_stock`) and update `stock_quantity` directly from `/vendor/stocks`.

### B. Order Placement & Inventory Concurrency
1. Customer initiates checkout at `/checkout`.
2. Client sends line items to `POST /api/orders`. The client **never** dictates prices, totals, or order IDs.
3. Server generates a cryptographically random order ID (`ORD-XXXXXX`).
4. Server starts a SQL transaction:
   - Recomputes item prices from live database product records.
   - Executes atomic stock decrements: `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?`.
   - If stock is insufficient, transaction rolls back cleanly with HTTP 400 (`INSUFFICIENT_STOCK`).
   - Inserts order row and vendor-scoped `order_items`.
   - Commits transaction.

### C. Order Fulfillment & Multi-Vendor Segregation
1. Multi-vendor orders are split across line items in `order_items` tagged with `vendor_id`.
2. When a vendor accesses `/vendor/orders`, the server scopes results so vendors see only the items they are responsible for fulfilling.
3. Customer address and payment details are protected.
4. Vendor/Admin transitions fulfillment status: `Processing` -> `Shipped` -> `Delivered`.
5. Customer views progress via the 4-stage visual timeline on `/orders/:id` and `/track-order`.

### D. Order Cancellation & Stock Restoration
1. Customers can cancel non-delivered orders directly from `/orders/:id` or `/profile`.
2. Server verifies customer token matches order email and order status is eligible for cancellation (`Processing`).
3. Server executes a transaction updating order status to `'Cancelled'` and atomically increments product `stock_quantity`.
4. If quantity becomes positive, `stock_status` automatically transitions back to `'in_stock'`.

---

## 7. External Integrations & Configuration

| Integration | Configuration Keys in `server/.env` | Behavior & Fail-Closed Mitigations |
|---|---|---|
| **Database** | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Required for server startup. Connects to TiDB Cloud with TLS 1.2+ and connection keepalive recycling. |
| **JWT Secrets** | `JWT_SECRET` | Required. Signs and verifies HMAC SHA-256 tokens across all roles with 7-day expiration. |
| **Admin Password** | `ADMIN_PASSWORD` | Used by CLI seed script `server/scripts/create-admin.js` to create admin credentials. |
| **Media (Cloudinary)** | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Magic-byte buffer validation (JPEG, PNG, GIF, WebP, max 10MB). If credentials contain spaces or are unconfigured, server logs a warning and falls back cleanly to base64 data URIs without throwing errors. |
| **Payments (PhonePe)** | `PHONEPE_CLIENT_ID`, `PHONEPE_CLIENT_VERSION`, `PHONEPE_CLIENT_SECRET`, `PHONEPE_REDIRECT_URL` | Standard Checkout v2. If credentials are placeholders, `POST /api/payments/phonepe/create-payment` returns HTTP 503 (`missingConfig: true`), allowing customers to place orders seamlessly using Cash on Delivery (COD). |
| **Email (SMTP)** | `SMTP_EMAIL`, `SMTP_PASSWORD` | Optional. If absent, outbound email notifications are safely skipped with logged warnings; all application flows succeed without error. |

---

## 8. Verification & Test Commands

```powershell
# 1. Run all Server Automated Integration Tests (102 tests)
npm test --prefix server

# 2. Run all Client Automated Unit Tests (39 tests)
npm test --prefix client

# 3. Run Client Code Hygiene & Linter (0 errors)
npm run lint --prefix client

# 4. Run Client Production Build (successful bundle)
npm run build --prefix client
```

---

## 9. Live Demo Walkthrough Guide

### Journey 1: Customer Storefront Experience
1. Open `http://localhost:5173/` in your browser.
2. Browse organic products on the homepage rails, category filter chips, and flash deals.
3. Click **"Quick View"** on any product card:
   - Inspect modal with responsive layout (bottom-sheet on mobile, centered dialog on desktop).
   - Adjust quantity stepper, select variants, and click "Add to Cart".
   - Dismiss modal via close button or Escape key.
4. Navigate to `/cart`, review items and subtotal, and proceed to `/checkout`.
5. Enter shipping address, choose **Cash on Delivery (COD)**, and click "Place Order".
6. View generated order receipt (`ORD-XXXXXX`) at `/order-confirmation/:id`.
7. Click "Track Order" or navigate to `/orders/:id` to inspect the 4-stage tracking timeline.
8. Test self-service order cancellation by clicking "Cancel Order" and selecting a reason. Verify stock is restored in real time.

### Journey 2: Vendor Portal Experience
1. Navigate to `http://localhost:5173/vendor/register`.
2. Register a new vendor profile with store name, email, and password. Notice the account status is pending approval.
3. Once approved by Admin, log in at `/vendor/login`.
4. Open the **"Add product"** tab (`/vendor/products/add`):
   - Fill in product name, select category, set price, and select unit.
   - Upload an image (validated via magic-bytes) or choose a sample image.
   - Submit product — notice toast confirmation: *"waiting for admin approval"*.
5. Open the **"Stocks"** tab (`/vendor/stocks`):
   - Click "Mark out of stock" on your product. Notice the badge updates to "Out of stock (0)" and persists to TiDB Cloud.
   - Click "Mark in stock" to restore inventory back to 50 units.
6. Open the **"Orders"** tab (`/vendor/orders`):
   - View orders containing your items. Update fulfillment status (`Processing` -> `Shipped` -> `Delivered`).

### Journey 3: Admin Portal Experience
1. Navigate to `http://localhost:5173/admin/login`.
2. Log in with admin credentials (`admin@ecshopping.local`).
3. Inspect dashboard metrics cards: Gross Revenue, Total Orders, Active Vendors, Total Products.
4. Open **"Products"** tab:
   - Inspect the approval queue. Review vendor submissions. Click "Approve" to publish to the public catalog, or "Reject" to keep hidden.
5. Open **"Vendors"** tab:
   - Review pending vendor registrations. Click "Approve" to activate vendor access. Toggle "Direct selling" permissions.
6. Open **"Categories"** tab:
   - Create a new global category. Edit description or deactivate status. Notice relational deletion protection prevents deleting categories that contain active products.
7. Open **"Orders"** and **"Customers"** tabs to audit all platform orders and registered shoppers.
8. Log out — verify session is evicted and view transitions cleanly to login.
