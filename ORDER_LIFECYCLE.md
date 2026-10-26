# EcShopping Order Lifecycle & State Machine Documentation

## 1. Overview
EcShopping enforces a server-authoritative, atomic order lifecycle across Customer, Vendor, and Admin portals. All order creation, stock reservations, transitions, and cancellations are executed with database-level consistency and role-scoped permissions.

```
                  ┌──────────────────────┐
                  │   Order Placed       │
                  │   (Processing)       │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   ┌─────────────────┐               ┌─────────────────┐
   │    Shipped      │               │    Cancelled    │
   │  (Dispatched)   │               │ (Stock Restored)│
   └────────┬────────┘               └─────────────────┘
            │
            ▼
   ┌─────────────────┐
   │    Delivered    │
   │   (Completed)   │
   └─────────────────┘
```

---

## 2. Canonical Order States

| Canonical State | Display Label | Description | Allowed Transitions |
|---|---|---|---|
| `Processing` | Order Placed & Processing | The customer has placed the order. Stock has been atomically deducted. The vendor is notified to pack and prepare dispatch. | `Shipped`, `Cancelled` |
| `Shipped` | Dispatched | The parcel has been handed over to the courier partner and is in transit. | `Delivered`, `Cancelled` (Admin only) |
| `Delivered` | Delivered | Terminal success state. The parcel has been safely handed over to the recipient. | None (Terminal) |
| `Cancelled` | Cancelled | Order was cancelled. Items have been automatically restored to product inventory. | None (Terminal) |

---

## 3. Role-Based Permissions & Endpoints

### Customer
- **Order Placement (`POST /api/orders`):**
  - Authenticated token identity takes precedence over payload values.
  - Verifies live inventory before creating order records.
  - Supports saved delivery address lookup or custom address creation.
- **Order History & Tracking (`GET /api/orders`, `GET /api/orders/:id`):**
  - Scoped strictly to authenticated customer email. Customers cannot query or inspect orders belonging to others.
- **Customer Cancellation (`POST /api/orders/:id/cancel`):**
  - Allowed only while the order is in `Processing` state.
  - Automatically restores quantity back to `products.stock_quantity`.
  - Records the cancellation reason and timestamp.

### Vendor
- **Order Visibility (`GET /api/orders`):**
  - Scoped strictly to orders containing items belonging to the vendor's `vendor_id`.
  - Other vendors' items on shared orders are masked or filtered.
- **Fulfillment & Dispatch (`PUT /api/orders/:id/status`):**
  - Vendors can transition orders containing their items from `Processing` to `Shipped`.
  - Once delivered, can mark as `Delivered`.

### Admin
- **Global Governance (`GET /api/orders`, `PUT /api/orders/:id/status`):**
  - Global overview across all customer orders and vendor fulfillment pipelines.
  - Full audit capability and status overrides when customer support intervention is required.

---

## 4. Delivery Address Integration in Checkout
- Saved addresses are stored in `customer_addresses` table.
- At Checkout:
  - If the customer is signed in, saved addresses are fetched via `GET /api/user/addresses`.
  - The default address is pre-selected and populates name, phone, street, city, state, and postcode.
  - Customers can toggle between saved address cards or choose "+ Deliver to a different address".
  - If a new address is entered, checking "Save this address to my profile" automatically persists it via `POST /api/user/addresses`.

---

## 5. Payment Gateway & Security
- **PhonePe Integration:**
  - Order amount is calculated server-side from database unit prices and validated coupon rules.
  - PhonePe payment request (`POST /api/payments/phonepe/create-payment`) only accepts `orderId`. The client cannot manipulate the payable amount.
  - Payment callback verification (`POST /api/payments/phonepe/verify`) verifies SHA256 checksums and server-to-server gateway status.
- **Cash on Delivery (COD):**
  - Verified and created in `Processing` state with payment status `pending`.
