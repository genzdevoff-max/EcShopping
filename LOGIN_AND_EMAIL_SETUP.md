# EcShopping — Login & Email Setup Guide

## 1. Email / SMTP Configuration Status

- **Configured:** **No**
  - Checked `server/.env`.
  - The required environment variables `SMTP_EMAIL` and `SMTP_PASSWORD` are absent / empty.
  - Optional variables `SMTP_HOST` and `SMTP_PORT` are not defined.
- **Implemented:** **Partial**
  - Nodemailer transporter is created in `server/index.js` (lines 81–87) targeting Gmail service:
    ```js
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
      }
    });
    ```
  - An email dispatch routine is implemented for **New Product Admin Approval Notification** (lines 1414–1440).
  - Email sending is **not implemented** for user registration, email verification, password reset, or order confirmation receipts.
- **Connection Tested:** **Not Tested / Skipped**
  - Because `SMTP_EMAIL` and `SMTP_PASSWORD` are not configured in `server/.env`, `transporter.verify()` is skipped at startup and prints:
    `⚠️ SMTP not configured (SMTP_EMAIL / SMTP_PASSWORD) — emails will be skipped.`
- **Email Delivery Tested:** **No**
  - No outbound emails could be delivered without valid SMTP credentials.
- **Missing Configuration & Next Steps:**
  1. Add a Google App Password or SMTP credentials to `server/.env`:
     ```env
     SMTP_EMAIL=your-store-email@gmail.com
     SMTP_PASSWORD=your-16-character-app-password
     SENDER_NAME="EcShopping"
     ```
  2. Implement outbound mail templates in Phase 12 for order confirmations, customer registration welcome notices, and password reset tokens.

---

## 2. Customer Portal

- **Homepage URL:** `http://localhost:5173/`
- **Login URL:** `http://localhost:5173/login` (Also available as modal overlay on any page)
- **Registration URL:** `http://localhost:5173/register`
- **Profile & Saved Addresses URL:** `http://localhost:5173/profile` (Tabs: Profile & Security, Saved Addresses, Recent Orders)
- **Order History URL:** `http://localhost:5173/orders`
- **Order Details URL:** `http://localhost:5173/orders/:orderId`
- **Track Order Timeline URL:** `http://localhost:5173/track-order`
- **Password Reset Route:** Not implemented as a self-service email flow. In-app notice instructs customers to contact `support@ecshopping.local` or update password directly within `/profile` (which requires the current password).
- **Email Verification Route:** Not implemented. Customer accounts are activated immediately upon registration.
- **Authentication Method:** JWT Token (`role: "customer"`) signed server-side and stored in `localStorage` under `ecshopping_customer_token` and `ecshopping_current_customer`.
- **Existing Demo Accounts in Database:**
  - The live `users` table currently has **0 customer records** (clean database).
- **Login Verification Result:**
  - Verified live via automated API test:
    - `POST /api/auth/user/register` successfully created test account (`HTTP 201`).
    - `POST /api/auth/user/login` successfully authenticated and issued a customer JWT (`HTTP 200`).
    - Test customer was deleted immediately after verification.

---

## 3. Vendor Portal

- **Vendor Login URL:** `http://localhost:5173/vendor` or `http://localhost:5173/vendor/login`
- **Vendor Registration URL:** `http://localhost:5173/vendor/register`
- **Vendor Dashboard URL:** `http://localhost:5173/vendor/dashboard`
- **Product Listing URL:** `http://localhost:5173/vendor/products`
- **Add Product URL:** `http://localhost:5173/vendor/products/add`
- **Edit Product URL:** `http://localhost:5173/vendor/products/edit/:id`
- **Pending Products URL:** `http://localhost:5173/vendor/products/pending`
- **Rejected Products URL:** `http://localhost:5173/vendor/products/rejected`
- **Stock Management URL:** `http://localhost:5173/vendor/stocks`
- **Vendor Orders URL:** `http://localhost:5173/vendor/orders`
- **Reviews & Feedback URL:** `http://localhost:5173/vendor/reviews`
- **Vendor Settings URL:** `http://localhost:5173/vendor/settings`
- **Category Manager URL:** `http://localhost:5173/vendor/category`
- **Authentication & Approval Role:**
  - JWT token (`role: "vendor"`).
  - Newly registered vendors enter `status: "pending"`.
  - Logging in with a pending vendor returns `HTTP 403 Forbidden: "Your account is pending admin approval"`.
  - An Admin must approve the vendor in the Admin Dashboard (`vendors` tab) before the vendor can access the portal.
- **Existing Vendor Demo Account:**
  - **Email:** `rishiaravindhaoff@gmail.com`
  - **Name:** Rishi Aravindha
  - **Status:** `approved`
  - **Password Availability:** The password hash is stored in TiDB Cloud. The original plaintext password is unknown and not documented in repository seeds.
  - **Access Procedure:**
    1. Register a new vendor at `http://localhost:5173/vendor/register` with your chosen password.
    2. Log in as Admin at `http://localhost:5173/admin` and click **Approve** in the Vendors tab.
    3. Log in with the newly created vendor credentials.
- **Login Verification Result:**
  - Verified live via automated API lifecycle test:
    - `POST /api/auth/vendor/register` created a pending vendor (`HTTP 201`).
    - `POST /api/auth/vendor/login` rejected the unapproved vendor with `HTTP 403: Your account is pending admin approval`.
    - Upon setting status to `approved`, login succeeded (`HTTP 200`) and issued a vendor JWT.
    - Test vendor was deleted cleanly after verification.

---

## 4. Admin Portal

- **Admin Login URL:** `http://localhost:5173/admin` or `http://localhost:5173/admin/login`
- **Admin Dashboard URL:** `http://localhost:5173/admin/dashboard`
- **Management Tabs in Dashboard:**
  - Dashboard Overview: `/admin/dashboard`
  - Category Management: Tab `categories`
  - Product Approvals: Tab `products`
  - Vendor Management & Direct Selling: Tab `vendors`
  - Customer Orders: Tab `orders`
  - Customer Accounts: Tab `customers`
- **Account Configuration & Credentials:**
  - **Email:** `admin@ecshopping.local` (configured in `server/.env` as `ADMIN_EMAIL`).
  - **Password:** Configured in `server/.env` as `ADMIN_PASSWORD` (minimum 12 characters).
  - **Password Verification:** Verified that `ADMIN_PASSWORD` in `server/.env` matches the bcrypt `password_hash` in the `admins` table.
- **Login Verification Result:**
  - Verified live via automated API test:
    - `POST /api/auth/admin/login` using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `server/.env` returned `HTTP 200` with a valid Admin JWT token.

---

## 5. Startup Commands & Local URLs

### Startup Commands

1. **Backend Server (Express API)**:
   ```powershell
   cd E:\EcShopping\server
   npm start
   ```
   *Base URL:* `http://localhost:5000`  
   *Healthcheck / Public Categories:* `http://localhost:5000/api/categories/public`

2. **Frontend Client (Vite React)**:
   ```powershell
   cd E:\EcShopping\client
   npm run dev
   ```
   *Base URL:* `http://localhost:5173`

### Portal URLs Summary

| Portal | URL | Credentials Source / Registration |
|---|---|---|
| **Customer Storefront** | `http://localhost:5173/` | Register at `/register` or login at `/login` |
| **Customer Profile** | `http://localhost:5173/profile` | Requires Customer Login |
| **Vendor Portal** | `http://localhost:5173/vendor` | Register at `/vendor/register`, approve via Admin |
| **Admin Portal** | `http://localhost:5173/admin` | `ADMIN_EMAIL` & `ADMIN_PASSWORD` in `server/.env` |
