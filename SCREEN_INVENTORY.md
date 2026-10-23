# EcShopping — Comprehensive Screen & Route Inventory

This inventory documents every screen, nested view, modal, and route across Customer, Vendor, and Admin roles.

Status Legend:
- `VERIFIED`: Screen implemented, visually inspected in browser/app, API connected, primary actions tested, zero runtime errors.
- `PARTIALLY VERIFIED`: Component renders and works with existing features, but depends on unconfigured external accounts (e.g. PhonePe live sandbox merchant, Cloudinary CDN credentials).
- `BLOCKED`: Blocked by external hard dependency.
- `NOT IMPLEMENTED`: Screen missing or not implemented.

---

## 1. Customer Storefront & Account Screens

| Screen ID | Screen Name | Route / Path | Role / Access | Purpose | Backend Dependencies | Tested Actions | Status |
|---|---|---|---|---|---|---|---|
| `SCR-CUST-01` | Homepage | `/` | Public | Storefront landing with hero banners, promotional rails, value props, testimonials | `GET /api/products`, `GET /api/categories/public` | Hero links, search trigger, add to cart, banner clicks | `VERIFIED` |
| `SCR-CUST-02` | Shop / Catalog | `/shop` | Public | Master product browsing, multi-category filters, price band filters, stock filter, sorting | `GET /api/products`, `GET /api/categories/public` | Category filter, in-stock toggle, price band, sorting, pagination, add-to-cart | `VERIFIED` |
| `SCR-CUST-03` | Category Products | `/category/:slug` | Public | Products filtered by category slug with category title & count | `GET /api/products?category=...` | Breadcrumbs, sorting, card interactions | `VERIFIED` |
| `SCR-CUST-04` | Collection Products | `/collection/:slug` | Public | Curated collections (e.g. new arrivals, best sellers) | `GET /api/products` | Collection title resolution, filtering | `VERIFIED` |
| `SCR-CUST-05` | Product Details Page | `/product/:id` | Public | Detailed product view, price tag, strike price, stock quantity, quantity stepper, description, vendor badge, review listing | `GET /api/products/:id`, `GET /api/reviews/product/:id` | Quantity increment/decrement, Add to Cart, Buy Now, review display | `VERIFIED` |
| `SCR-CUST-06` | Shopping Cart Page | `/cart` | Public | Cart review, line item quantity updates, removal, order summary calculation, free shipping progress bar | `localStorage (ecshopping_cart)` | Quantity +/- stepper, line removal, Clear Cart, Proceed to Checkout | `VERIFIED` |
| `SCR-CUST-07` | Cart Slideout Drawer | Global Overlay | Public | Slideout cart from header button for quick access without leaving current page | Global `CartContext` | Item removal, stepper, direct checkout link | `VERIFIED` |
| `SCR-CUST-08` | Checkout Page | `/checkout` | Public / Customer | Shipping address input, saved address picker, delivery method selection, coupon discount calculation, payment method selection | `POST /api/orders`, `POST /api/payments/phonepe/create-payment` | Address prefill from customer session, order creation, PhonePe / COD choice | `VERIFIED` |
| `SCR-CUST-09` | PhonePe Return / Status | `/payment/phonepe/return` | Public / Customer | Post-redirect reconciliation page with automated retry polling schedule | `POST /api/payments/phonepe/verify` | Auto-reconciliation retry (20s, 3s, 3s, 3s...), cart clearing on success, retry on same order ID | `PARTIALLY VERIFIED` (UAT credentials pending) |
| `SCR-CUST-10` | Order Confirmation | `/order-confirmation/:orderId` | Public / Customer | Purchase completion receipt with order number, line items, address, delivery estimate | `GET /api/orders/:id`, `localStorage` | Back to shop link, View Order Details | `VERIFIED` |
| `SCR-CUST-11` | Customer Login / Register | `/login`, `/register` | Public | Email & password customer authentication and registration tabbed card | `POST /api/auth/login`, `POST /api/auth/register` | Form validation, password visibility toggle, token persistence, error alerts | `VERIFIED` |
| `SCR-CUST-12` | Quick Login Modal | Global Modal | Public | Modal version of AuthForm triggered from header or checkout | `POST /api/auth/login` | Sign-in, tab switch to sign-up, session sync | `VERIFIED` |
| `SCR-CUST-13` | Customer Profile & Addresses | `/profile` | Customer (JWT required) | Tabbed customer dashboard: Profile & Security (name, phone, password change), Saved Addresses (CRUD + default selector), Recent Orders | `GET/PUT /api/user/profile`, `PUT /api/user/password`, `GET/POST/PUT/DELETE /api/user/addresses` | Name/phone update, password change (min 8 chars), add/edit address modal, set default, cancel order | `VERIFIED` |
| `SCR-CUST-14` | Customer Orders List | `/orders` | Customer / Guest | Order history with status tags, payment status labels, delivery dates, and direct order details links | `GET /api/orders` | Order filter, server merge, view details | `VERIFIED` |
| `SCR-CUST-15` | Customer Order Details | `/orders/:orderId` | Customer (Scoped) | Single order view with items table, breakdown, shipping destination, delivery timeline, cancellation modal | `GET /api/orders/:id`, `POST /api/orders/:id/cancel` | Cancel order with reason, stock restoration, tracking link | `VERIFIED` |
| `SCR-CUST-16` | Track Order Page | `/track-order` | Public / Customer | Live shipment progress timeline with stages (Ordered, Processing, Shipped, Delivered) | `GET /api/orders/:id` | Order ID search lookup, visual timeline indicator | `VERIFIED` |
| `SCR-CUST-17` | Wishlist Page | `/wishlist` | Public | Saved favorite products with quick "Add to Cart" and removal | `localStorage (ecshopping_wishlist)` | Remove from wishlist, Move to Cart, empty state | `VERIFIED` |
| `SCR-CUST-18` | About Us | `/about` | Public | Brand story, sustainable mission, farmer network info | Static Content | Back navigation, links | `VERIFIED` |
| `SCR-CUST-19` | Contact Us | `/contact` | Public | Contact channels, address, and inquiry form | Form State | Form submission feedback, phone/email links | `VERIFIED` |
| `SCR-CUST-20` | FAQ Page | `/faq` | Public | Accordion questions on ordering, payments, returns, freshness | UI Accordion | Expand/collapse accordion answers | `VERIFIED` |
| `SCR-CUST-21` | Policy Pages | `/shipping`, `/returns`, `/privacy`, `/terms` | Public | Standard policies (shipping rates, 7-day returns, privacy, terms) | Static Policy Layout | Anchor navigation, readable typography | `VERIFIED` |
| `SCR-CUST-22` | Bulk & Wholesale Order | `/bulk-order` | Public | Bulk procurement inquiry form for restaurants, stores, and institutions | Form State | In-app submission confirmation | `VERIFIED` |
| `SCR-CUST-23` | Blog & Blog Post | `/blog`, `/blog/:slug` | Public | Organic lifestyle blog listing and full article readers | Static Blog Registry | Article reading, category tags, back links | `VERIFIED` |
| `SCR-CUST-24` | Store Locator | `/store-locator` | Public | Physical store addresses, working hours, and phone numbers | Static Store Data | City filter, directions trigger | `VERIFIED` |
| `SCR-CUST-25` | 404 Not Found Page | `*` | Public | Friendly missing page with navigation back to Home or Shop | None | "Go to Homepage" and "Browse Catalog" buttons | `VERIFIED` |

---

## 2. Vendor Application Screens

| Screen ID | Screen Name | Route / Path | Role / Access | Purpose | Backend Dependencies | Tested Actions | Status |
|---|---|---|---|---|---|---|---|
| `SCR-VEND-01` | Vendor Login | `/vendor`, `/vendor/login` | Public / Vendor | Secure vendor authentication portal with token persistence | `POST /api/auth/vendor/login` | Form validation, password toggle, remember me, error alerts | `VERIFIED` |
| `SCR-VEND-02` | Vendor Registration | `/vendor/register` | Public | Self-onboarding form for new sellers with automatic pending approval status | `POST /api/auth/vendor/register` | Store name, contact email, phone, password, auto-redirect | `VERIFIED` |
| `SCR-VEND-03` | Vendor Dashboard Overview | `/vendor/dashboard` | Vendor (JWT required) | High-level metrics: total earnings, active catalog count, pending approval items, pending fulfillment orders | `GET /api/products`, `GET /api/orders` | Tab switching, quick-action navigation, metrics calculation | `VERIFIED` |
| `SCR-VEND-04` | Vendor All Products | `/vendor/products` | Vendor (Scoped) | Tabular inventory list with price, stock status toggle, search filter, Edit modal trigger, and delete | `GET /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id` | Stock status toggle, inline edit, delete confirmation, search filter | `VERIFIED` |
| `SCR-VEND-05` | Vendor Add Product | `/vendor/products/add` | Vendor (Scoped) | Multi-field product creation with title, price, strike price, unit, category picker, image upload | `POST /api/products`, `POST /api/upload`, `GET /api/categories` | Magic-byte image validation, Cloudinary/fallback upload, form submit | `VERIFIED` |
| `SCR-VEND-06` | Vendor Edit Product | In-place & `/vendor/products/edit/:id` | Vendor (Scoped) | Dedicated editor for updating pending or rejected products, triggering admin re-review | `PUT /api/products/:id`, `POST /api/upload` | Field modification, discount calculation, image change, save | `VERIFIED` |
| `SCR-VEND-07` | Vendor Pending Products | `/vendor/products/pending` | Vendor (Scoped) | View products currently under admin review | `GET /api/products?status=pending` | Review status inspection, edit action | `VERIFIED` |
| `SCR-VEND-08` | Vendor Rejected Products | `/vendor/products/rejected` | Vendor (Scoped) | View rejected products with rejection feedback and quick "Edit & Resubmit" | `GET /api/products?status=rejected` | Rejection feedback review, edit & resubmit | `VERIFIED` |
| `SCR-VEND-09` | Vendor Category Manager | `/vendor/category` | Vendor (Scoped) | Vendor-scoped category CRUD and active/inactive toggle | `GET /api/categories`, `POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id` | Create category, edit, toggle status, delete (safe deletion enforced) | `VERIFIED` |
| `SCR-VEND-10` | Vendor Stock Management | `/vendor/stocks` | Vendor (Scoped) | Quick inventory overview and in-stock/out-of-stock toggle table | `GET /api/products`, `PUT /api/products/:id` | Search filter, toggle stock availability button | `VERIFIED` |
| `SCR-VEND-11` | Vendor Orders List | `/vendor/orders` | Vendor (Scoped) | Vendor-specific order items, customer delivery details (privacy-preserved), and fulfillment status selector | `GET /api/orders`, `PUT /api/orders/:id/status` | Filter by status (All, Processing, Shipped, Delivered), update status to server | `VERIFIED` |
| `SCR-VEND-12` | Vendor Reviews & Feedback | `/vendor/reviews` | Vendor (Scoped) | Customer star ratings and text feedback for vendor's products | `GET /api/reviews` | Star rating display, product name association | `VERIFIED` |
| `SCR-VEND-13` | Vendor Settings | `/vendor/settings` | Vendor (Scoped) | Vendor store profile, contact phone, and store preferences | `PUT /api/vendors/:id` | Profile update form, save confirmation | `VERIFIED` |

---

## 3. Admin Application Screens

| Screen ID | Screen Name | Route / Path | Role / Access | Purpose | Backend Dependencies | Tested Actions | Status |
|---|---|---|---|---|---|---|---|
| `SCR-ADM-01` | Admin Login | `/admin`, `/admin/login` | Public / Admin | Admin portal login with secure bcrypt verification and admin JWT issuance | `POST /api/auth/admin/login` | Email/password submission, error feedback, token persistence | `VERIFIED` |
| `SCR-ADM-02` | Admin Dashboard Overview | `/admin/dashboard` | Admin (JWT required) | System-wide statistics: total vendors, active catalog count, total orders, customer accounts count, gross sales total | `GET /api/vendors`, `GET /api/products`, `GET /api/orders`, `GET /api/users` | Real statistics computation (no fake stats), tab switching | `VERIFIED` |
| `SCR-ADM-03` | Admin Category Management | Tab: `categories` | Admin (JWT required) | Shared / system-wide category creation, editing, active/inactive deactivation, and product count tracking | `GET /api/categories`, `POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id` | Create shared category, assign to vendor, edit details, safe delete check | `VERIFIED` |
| `SCR-ADM-04` | Admin Product Approval Queue | Tab: `products` | Admin (JWT required) | Review vendor-submitted items; Approve, Reject, or Request Changes | `GET /api/products`, `PUT /api/products/:id` | Approve button, Reject button, status badge reflection | `VERIFIED` |
| `SCR-ADM-05` | Admin Vendor Management | Tab: `vendors` | Admin (JWT required) | View all registered vendors, toggle approval status, and toggle Direct Selling permissions | `GET /api/vendors`, `PUT /api/vendors/:id` | Approve/Reject vendor, Toggle direct selling, search vendors | `VERIFIED` |
| `SCR-ADM-06` | Admin Order Management | Tab: `orders` | Admin (JWT required) | Master orders table showing order ID, customer name, date, payment method/status, gross total, fulfillment status selector | `GET /api/orders`, `PUT /api/orders/:id/status` | Fulfillment status change (Processing, Shipped, Delivered, Cancelled), auto-stock restore on cancel | `VERIFIED` |
| `SCR-ADM-07` | Admin Customer Accounts | Tab: `customers` | Admin (JWT required) | View registered customer accounts (IDs, names, emails, registration timestamps) | `GET /api/users` | Customer listing, count badge | `VERIFIED` |

---

## 4. UI Quality & Verification Summary

- **Total Screens / Routes Discovered**: 45
- **Verified Screens**: 44
- **Partially Verified (External Sandbox Dependent)**: 1 (`/payment/phonepe/return`)
- **Blocked / Incomplete Screens**: 0
- **Dead Controls / Unhandled Placeholders**: 0
