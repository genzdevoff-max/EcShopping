# Phase 1 UI & Architecture Audit: Vendor & Admin Portals, Authentication & Payment Settings

**Project:** EcShopping Multi-Vendor Marketplace  
**Audit Date:** October 27, 2026  
**Audited Domains:** Frontend (`https://ec-shopping.vercel.app`), Backend (`https://ec-shopping-three.vercel.app`)  
**Theme Preservation:** Pine Green (`#0e5c4a`), Terracotta (`#d9663d`), Fraunces Headings, Plus Jakarta Sans Body  

---

## 1. Audit Inventory: Screens, Tables & Components

### A. Admin Portal (`client/src/pages/admin/AdminDashboard.jsx`, `AdminDashboard.css`)
1. **Layout & Sidebar:**
   - **File:** `client/src/pages/admin/AdminDashboard.jsx` (lines 247–277), `AdminDashboard.css` (lines 1–75).
   - **Issues Identified:**
     - `.admin-layout` lacks viewport height constraints (`min-height: 100vh`), allowing long table content to stretch the page vertically and push the sidebar and bottom logout button thousands of pixels down.
     - `.admin-sidebar` lacks independent vertical scrolling (`overflow-y: auto`). On shorter viewports or laptop displays, navigation items and the logout button get clipped.
     - No mobile drawer or toggle. On `< 768px`, the 250px fixed sidebar squashes content or wraps poorly.
     - `.admin-main` lacks `min-width: 0`, which allows wide data tables to blow out the entire dashboard horizontally.

2. **All Products / Approval Queue (Tab `products`):**
   - **File:** `AdminDashboard.jsx` (lines 743–848).
   - **Issues Identified:**
     - Lists all submitted products in a single unpaginated table.
     - Lacks search filter (by title, seller, or SKU) and lacks status filter pills (Pending, Approved, Rejected).
     - Table rows lack a bounded vertical scroll container with sticky headers.
     - Actions column wrapped awkwardly without clear spacing.

3. **Category Management (Tab `categories`):**
   - **File:** `AdminDashboard.jsx` (lines 351–662), `AdminDashboard.css` (lines 288–357).
   - **Issues Identified:**
     - `.admin-cat-form-grid` uses a rigid grid (`1.2fr 1.5fr 160px 130px auto`) that causes input labels to overlap placeholders and dropdowns to clip at medium tablet viewports (768px–1024px).
     - The "Scope / Owner" field is a raw unsearchable `<select>`. With many vendors, finding a specific seller is difficult.
     - Table lacks pagination.
     - Inline edit form fields lack proper grid alignment.

4. **Vendor Management (Tab `vendors`):**
   - **File:** `AdminDashboard.jsx` (lines 664–741).
   - **Issues Identified:**
     - All registered vendors rendered at once without pagination.
     - Lacks search by vendor name/email and status filter.

5. **Order Management (Tab `orders`):**
   - **File:** `AdminDashboard.jsx` (lines 851–918).
   - **Issues Identified:**
     - Unpaginated table.
     - Stacked line items in table cells cause uneven, massive row heights.
     - Lacks search by Order ID or customer email.

6. **Customer Accounts (Tab `customers`):**
   - **File:** `AdminDashboard.jsx` (lines 1153–1184).
   - **Issues Identified:**
     - Unpaginated table with no search filter.

7. **Video Reviews Management (Tab `videos`):**
   - **File:** `AdminDashboard.jsx` (lines 921–1151).
   - **Issues Identified:**
     - Unpaginated table.

8. **Payment & Gateway Configuration:**
   - **Current State:** Completely missing. No tab, view, or settings interface exists in the Admin Portal for reviewing PhonePe credentials, gateway environment (sandbox/production), return URLs, or configuration health.

---

### B. Vendor Portal (`client/src/pages/vendor/`)
1. **Layout & Navigation (`VendorDashboard.jsx`, `VendorDashboard.css`):**
   - **File:** `VendorDashboard.jsx`, `VendorDashboard.css` (lines 1–200).
   - **Issues Identified:**
     - `.vendor-layout` is `height: 100vh; overflow: hidden;`. On mobile (`< 768px`), the sidebar remains open at 230px, suffocating the main content area with zero drawer collapse option.
     - Sidebar user card and bottom links can clip on small vertical screens.

2. **All Products (`AllProducts.jsx`, `AllProducts.css`):**
   - **File:** `client/src/pages/vendor/AllProducts.jsx` (lines 205–600).
   - **Issues Identified:**
     - Filters and sorts work locally, but ALL matching products are rendered simultaneously with zero pagination controls.
     - Table view has no sticky column headers or bounded scroll area.

3. **Category Manager (`CategoryManager.jsx`, `CategoryManager.css`):**
   - **File:** `client/src/pages/vendor/CategoryManager.jsx`.
   - **Issues Identified:**
     - Lacks table pagination. Form inputs can collide on narrow screens.

4. **Orders, Stocks, Reviews (`VendorDashboard.jsx`):**
   - **Issues Identified:**
     - Orders and stocks tables display all records in a single table with no pagination or page-size selector.

---

### C. Authentication Screens & Login Popups
1. **Customer Login Modal (`LoginModal.jsx`, `AuthForm.jsx`, `Login.css`):**
   - **File:** `client/src/components/auth/LoginModal.jsx`, `client/src/components/auth/AuthForm.jsx`, `client/src/pages/Login.css` (lines 458–549).
   - **Issues Identified:**
     - `.auth-modal` has a fixed `max-height: calc(100vh - 40px)` with internal `overflow-y: auto`, which triggers an unsightly vertical scrollbar on standard desktop screens (1080p browser windows and laptops) due to excessive top brand padding (`clamp(22px, 4vw, 32px)`), large header margins, and sprawling form spacing.
     - On mobile devices, the modal snaps to the bottom but scrolling conflicts with the background page.
     - Lacks compact, polished layout tailored for an overlay dialog.

2. **Admin & Vendor Login (`AdminLogin.jsx`, `VendorLogin.jsx`):**
   - Functional with proper security and password eye toggles; needs consistent focus rings and spacing polish.

---

## 2. Shared Components & Architectural Solutions

To resolve these issues cleanly and consistently across both portals without code duplication, the following shared solutions will be implemented:

1. **Enhanced Shared Pagination Component (`client/src/components/ui/Pagination.jsx`):**
   - Upgrade existing `Pagination.jsx` to support:
     - Page size selection (`10`, `25`, `50` rows per page).
     - Accurate record range indicator ("Showing 1–10 of 48 items").
     - Mobile-compact layout.
     - Reset-to-page-1 on filter/search change.

2. **Searchable Vendor Assignment Selector (`client/src/components/admin/VendorSelect.jsx`):**
   - Replaces unsearchable raw `<select>` elements with a searchable combobox.
   - Real-time search across vendor store name and contact email.
   - Selected vendor badge with clear action.
   - High z-index dropdown rendering above table and container overflow boundaries.

3. **Dashboard Shell Architecture (`AdminDashboard.css`, `VendorDashboard.css`):**
   - Viewport-aware layout: `height: 100vh; display: flex; overflow: hidden;`.
   - Sidebar: `height: 100vh; display: flex; flex-direction: column; flex-shrink: 0;`.
   - Sidebar Nav: `flex: 1 1 auto; overflow-y: auto; overflow-x: hidden;`.
   - Responsive mobile drawer with hamburger toggle button and backdrop dismissal on `< 768px`.
   - Main content: `flex: 1; min-width: 0; overflow-y: auto;`.
   - Data tables: `overflow-x: auto; max-height: calc(100vh - 280px); overflow-y: auto;` with sticky `<thead>`.

4. **Polished Compact Authentication Modal (`LoginModal.jsx`, `Login.css`):**
   - Centered desktop dialog (`max-width: 440px`), smooth bottom-sheet on mobile (`< 480px`).
   - Compact brand header, discrete close button, background scroll lock.
   - Sleek segmented tab bar for Sign In / Sign Up.
   - Zero vertical scrolling on standard desktop screens.

5. **Admin Payment & Gateway Configuration Management:**
   - Backend admin API: `GET /api/admin/payment-config` and `PUT /api/admin/payment-config`.
   - Safe `platform_settings` table in TiDB Cloud.
   - Masked credentials, environment indicators (Production vs Sandbox), return URL validation, and explicit guidance regarding `INTERNAL_SECURITY_BLOCK_1`.
