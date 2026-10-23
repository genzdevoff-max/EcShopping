# EcShopping — Customer Login Report

_Generated from the current repository (`client/` + `server/`). This report describes what is implemented today, not a proposed design._

---

## 1. Theme and Visual Language

The customer authentication UI uses the shared **EcShopping design system** declared in `client/src/index.css`.

| Token | Value | Usage |
|---|---|---|
| Primary brand | `--brand: #0e5c4a` (deep pine green) | Primary buttons, links, active states |
| Brand dark | `--brand-900: #07322a` | Login brand panel gradient |
| Brand tint | `--brand-50: #eaf5f2` | Focus rings, icon backgrounds |
| Accent | `--accent: #d9663d` (terracotta) | Required-field markers, highlights |
| Gold | `--gold: #e6a93c` | Success/trust accents |
| Paper | `--paper: #faf8f3` (warm off-white) | Page background |
| Surface | `#ffffff` | Card and form surface |
| Ink | `--ink: #1f2a26` | Headings |
| Muted | `--muted: #6b7d76` | Secondary copy |
| Border | `--line: #e6e1d7` | Card, input and divider borders |

**Typography**

- Display / headings: `Fraunces`, Georgia serif.
- UI / body: `Plus Jakarta Sans`, system sans fallback.
- Radii: 6–28px (`--r-xs` … `--r-xl`), pill buttons (`--r-pill`).
- Elevation: soft warm shadows (`--sh-xs` … `--sh-lg`).

**Layout style**

- Rounded elevated auth card (max width 1040px) split into a green brand panel and a white form panel.
- Decorative background: soft radial brand tint over the warm paper background.
- Modal variant uses a dark blurred overlay with a white rounded dialog; on mobile it becomes a bottom sheet.

---

## 2. Routes and Entry Points

| Route | Component | Purpose |
|---|---|---|
| `/login` | `src/pages/Login.jsx` | Full-page customer login / registration |
| `/register` | `src/pages/Login.jsx` | Same component; registration is reached by toggling inside the form |
| Any storefront page | `src/components/auth/LoginModal.jsx` | Header account icon opens the login popup over the current page |
| `/profile` | `src/pages/CustomerProfile.jsx` | Post-login account area (order history, personal details, logout) |
| `/orders` | `src/pages/Orders.jsx` | Full order history for the logged-in customer |
| `/orders/:orderId` | `src/pages/OrderDetails.jsx` | Individual order details |
| `/track-order` | `src/pages/TrackOrder.jsx` | Order tracking; prompts login if needed |
| `/checkout` | `src/pages/Checkout.jsx` | Can create a customer account automatically from checkout details |

Login state is lifted into `App.jsx` (`loggedInCustomer`) and passed to `Header`, `Login`, `LoginModal`, `CustomerProfile`, `Orders`, `TrackOrder`, `Checkout` and `OrderConfirmation`.

---

## 3. Screen Details

### 3.1 Full-page login — `/login`

**File:** `client/src/pages/Login.jsx` + `client/src/pages/Login.css`

**Left brand panel (`.auth-brand-side`)**

- Gradient from brand-900 to brand-600.
- Pill label: “Customer portal” with a small green status dot.
- Illustration: `src/assets/login-page/user-login.png`.
- Caption: “Fresh & organic, every day” plus a short marketplace description.

**Right form panel (`.auth-form-side`)**

- Shared `AuthForm` component, max width 430px.
- Header switches between:
  - Login: **“Welcome back”** — “Log in with your email to continue to your orders and wishlist.”
  - Sign-up: **“Create your account”** — “Join EcShopping to order fresh goods and track every delivery.”

**Login fields**

- Email address (required, mail icon, inline check icon once an `@` is present).
- Password (required, lock icon, show/hide eye toggle).
- “Remember me” checkbox (default checked). Currently visual only — it does not change storage behaviour.
- “Forgot password?” link. Currently shows an alert: contact support / check welcome email. No reset flow exists.
- Buttons: **Log in** (primary) and **Create account** (outline).
- Loading label: “Logging in…”; button disabled while loading.

**Sign-up fields**

- Full name (required).
- Email address (required).
- Phone number (optional).
- Password (required, show/hide toggle).
- Buttons: **Register** (primary) and **Back to login** (outline).
- Loading label: “Creating account…”.

**Shared**

- Inline error alert (`role="alert"`) and success alert (`role="status"`).
- Footer portal switcher: “Are you a registered seller?” → **Switch to vendor login** (`/vendor`).
- Responsive: below 900px the brand panel stacks above the form, the caption hides, and buttons stack.

### 3.2 Login popup — header account icon

**File:** `client/src/components/auth/LoginModal.jsx`

- Opened from the header user icon or mobile “Login / Register” button.
- Rendered over the current page; no route change.
- Uses the same `AuthForm`, so fields and validation are identical.
- Dark blurred backdrop, white dialog, brand logo header, circular close button.
- Close via X, Escape, or clicking the backdrop.
- Body scroll is locked while open; first input/button receives focus.
- On successful login the modal closes and the user stays on the current page.
- On mobile (≤480px) it becomes a bottom sheet with a 92vh max height.

### 3.3 Customer profile — `/profile`

**File:** `client/src/pages/CustomerProfile.jsx` + `CustomerProfile.css`

- If signed out: “My Account” empty state with **Sign in** (opens modal) and **Continue shopping**.
- If signed in:
  - Sidebar user card: avatar, name, email, optional phone.
  - Navigation: **My Orders (count)**, **Personal Details**, **Logout**.
  - Orders tab: order cards with ID, date, status badge, item thumbnails/quantities, per-item seller label, line total, and delivery address.
  - Empty orders state links to `/shop`.
  - “View all orders” links to `/orders`.
- Note: this page uses older slate/green hard-coded colours in places rather than the newer design tokens, so it is visually less aligned than the login screens.

### 3.4 Orders and tracking screens

- `Orders.jsx` lists the logged-in customer’s orders (via `getCustomerOrders`), with empty/login states.
- `OrderDetails.jsx` shows a single order; it relies on the customer session and order cache.
- `TrackOrder.jsx` allows tracking and prompts login if the customer is not signed in.

### 3.5 Checkout-created accounts

`Checkout.jsx` receives `onCustomerLogin`. When an order is placed with an email, the app can create/attach a customer session automatically (see project history: “Add auto account creation, customer order history…”). This is separate from the explicit login form.

---

## 4. Functional Behaviour

### 4.1 Login flow

1. User submits email + password.
2. `AuthForm` calls `POST {VITE_API_URL}/api/auth/user/login` (default `http://localhost:5000`).
3. Server checks `users` table with `LOWER(email) = LOWER(?) AND password = ?`.
4. On success the server returns `{ success, user: { id, name, email, phone, created_at } }`.
5. Client:
   - calls `onCustomerLogin(user)` → `App.handleCustomerLogin`;
   - stores the session via `setCurrentCustomer` under `localStorage['ecshopping_current_customer']`;
   - caches the customer in `localStorage['ecshopping_customers']` via `addCustomer`;
   - shows a success alert for ~500ms, then navigates to `/profile` (or closes the modal when `onSuccess` is supplied).
6. On invalid credentials the API returns 401 and the message is shown inline.
7. If the API is unreachable, the client falls back to a **local customer cache** and compares email + password from `localStorage`.

### 4.2 Registration flow

1. Required-field check for name, email and password.
2. `POST /api/auth/user/register`.
3. Server rejects duplicate emails (`Email is already registered`), otherwise inserts into `users` with an id like `c<timestamp>`.
4. On success the user is logged in immediately (same sequence as login).
5. If the API is unreachable, the client uses `addCustomer` locally; duplicate emails are rejected with “Email already exists”.
6. “Remember me” does not currently alter persistence — the session is always written to localStorage.

### 4.3 Logout flow

- `Header` calls `onCustomerLogout` from the profile page or mobile drawer.
- `App.handleCustomerLogout` clears `localStorage['ecshopping_current_customer']` and resets `loggedInCustomer`.
- Cart contents are **not** cleared on logout (cart is a separate localStorage key).
- Wishlist contents are **not** cleared on logout.

### 4.4 Header integration

- Signed out: user icon opens the login modal.
- Signed in: the icon becomes a circular initial avatar linking to `/profile`.
- Mobile drawer shows the customer name or “Login / Register”.
- After login, the header updates immediately because `loggedInCustomer` is React state.

### 4.5 Persistence

| Key | Stored by | Contents |
|---|---|---|
| `ecshopping_current_customer` | `utils/storage.js` | Active customer session |
| `ecshopping_customers` | `utils/storage.js` | Local cache of customer accounts |
| `ecshopping_cart` | `App.jsx` | Cart lines |
| `ecshopping_wishlist` | `ProductCard.jsx` | Wishlist items |
| `ecshopping_current_vendor` | `App.jsx` | Vendor session (separate portal) |

### 4.6 API endpoints involved

| Method | Endpoint | Notes |
|---|---|---|
| `POST` | `/api/auth/user/register` | Name, email, password, optional phone |
| `POST` | `/api/auth/user/login` | Email + password |
| `POST` | `/api/auth/vendor/register` | Vendor portal (not customer) |
| `POST` | `/api/auth/vendor/login` | Vendor portal (not customer) |
| `GET` | `/api/orders?customerEmail=…` | Customer order sync |
| `POST` | `/api/orders` | Order creation |

---

## 5. Validation, Accessibility and Responsiveness

**Validation**

- Required attributes on inputs, plus manual checks for name/email/password on registration.
- No minimum password length, strength meter, email format check beyond `type="email"`, or confirm-password field.
- No rate limiting / lockout in the UI.
- Forgot-password is a placeholder alert only.

**Accessibility**

- Labels are associated with inputs (`htmlFor` / `id`).
- Required fields marked with `*` and `aria-hidden`.
- Errors use `role="alert"`; success uses `role="status"`.
- Password toggle has `aria-label` and `aria-pressed`-style text (“Show/Hide password”).
- Modal: `role="dialog"`, `aria-modal="true"`, Escape to close, backdrop click to close, focus moved into the dialog, body scroll locked.
- Global `:focus-visible` outline is defined in `index.css`.
- Missing: full focus trap inside the modal (focus can tab outside), no explicit `aria-labelledby` on the dialog, and the backdrop is a `div` with a click handler rather than a button.

**Responsive**

- Full page: single column under 900px.
- Modal: bottom sheet under 480px.
- Form buttons stack on narrow screens.
- Auth card padding and illustration scale down at 900px.

---

## 6. Security and Production Readiness Notes

These are observations from the current code, not claims that the feature is production-ready.

1. **Plain-text passwords** — `users.password` and `vendors.password` are stored and compared as plain text (`SELECT … WHERE password = ?`). No hashing (bcrypt/argon2) is used.
2. **Client-side fallback auth** — if the API is unreachable, the client authenticates against `localStorage`, where passwords are also stored in plain text. Anyone with local access can read them.
3. **No session tokens** — login returns a user object; there is no JWT, cookie session, expiry, or server-side authorization check on subsequent requests.
4. **No server-side route protection** — profile/orders pages rely on client state; API endpoints do not verify the caller’s identity.
5. **Vendor password leakage risk** — vendor passwords are stored in localStorage for the vendor portal; customer auth should not follow that pattern.
6. **No password reset or email verification** — the welcome-email endpoint exists in the server (`sendWelcomeEmail`), but reset/verification flows are not implemented.
7. **Remember me is cosmetic** — the checkbox does not change `localStorage` vs `sessionStorage`.
8. **`console.log` of backend errors in the client** — acceptable for development, should be removed/replaced for production.
9. **Default database credentials in `server/db.js`** — environment defaults should not ship credentials.

---

## 7. File Map

```
client/src/
├─ App.jsx                          # session state, routes, login/logout handlers
├─ pages/
│  ├─ Login.jsx                     # full-page customer auth
│  ├─ Login.css                     # auth page, modal, responsive styles
│  ├─ CustomerProfile.jsx/.css      # post-login account area
│  ├─ Orders.jsx                    # customer order history
│  ├─ OrderDetails.jsx              # single order
│  ├─ TrackOrder.jsx                # tracking + login prompt
│  └─ Checkout.jsx                  # can auto-create customer session
├─ components/
│  ├─ Header.jsx                    # account icon / avatar, opens modal
│  └─ auth/
│     ├─ AuthForm.jsx               # shared login + sign-up logic and fields
│     └─ LoginModal.jsx             # popup wrapper around AuthForm
├─ utils/
│  ├─ storage.js                    # customer/session localStorage helpers
│  └─ api.js                        # REST client
└─ data/content.js                  # site copy / support details

server/
├─ index.js                         # /api/auth/user/register, /api/auth/user/login
└─ db.js                            # users, vendors, orders, reviews tables
```

---

## 8. Summary

The customer login feature is a working, visually polished two-mode auth flow (login + registration) available both as a full page and as a header popup. It uses the project’s warm green/cream design system, writes a customer session to localStorage, and feeds the profile, orders, tracking and checkout screens. It is suitable for a demo/prototype, but it currently stores passwords in plain text, falls back to client-side credential checks, and has no token-based session or password reset. Those must be addressed before production use.
