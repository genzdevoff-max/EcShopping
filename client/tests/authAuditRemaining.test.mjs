// Targeted tests resolving remaining authentication uncertainties
// (Customer/vendor/admin logout, session expiry, registration navigation, password recovery audit)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(HERE, rel), 'utf8');

// --------------------------------------------------------------------------
// 1. Customer, Vendor, and Admin Logout Invariants & Token Scope Isolation
// --------------------------------------------------------------------------

test('storage helpers enforce role-isolated session persistence and logout', async () => {
  // Mock localStorage for test environment
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };

  const {
    saveCustomerSession,
    logoutCustomer,
    getCurrentCustomer,
    saveVendorSession,
    logoutVendor,
    saveAdminSession,
    logoutAdmin,
    getCurrentAdmin
  } = await import('../src/utils/storage.js');
  const { authSessions } = await import('../src/utils/api.js');

  // Seed all three sessions simultaneously
  saveCustomerSession({ id: 'c1', name: 'Cust One', email: 'c1@test.local' }, 'jwt-cust-123');
  saveVendorSession({ id: 'v1', name: 'Vend One', email: 'v1@test.local' }, 'jwt-vend-456');
  saveAdminSession({ id: 'a1', email: 'admin@ecshopping.local' }, 'jwt-admin-789');

  // Verify all 3 sessions exist
  assert.equal(getCurrentCustomer()?.email, 'c1@test.local');
  assert.equal(authSessions.get('customer'), 'jwt-cust-123');
  assert.equal(authSessions.get('vendor'), 'jwt-vend-456');
  assert.equal(authSessions.get('admin'), 'jwt-admin-789');

  // --- Test Customer Logout ---
  logoutCustomer();
  assert.equal(getCurrentCustomer(), null, 'Customer profile must be cleared');
  assert.equal(authSessions.get('customer'), null, 'Customer token must be cleared');
  // Vendor and Admin tokens MUST NOT be touched
  assert.equal(authSessions.get('vendor'), 'jwt-vend-456', 'Vendor token must survive customer logout');
  assert.equal(authSessions.get('admin'), 'jwt-admin-789', 'Admin token must survive customer logout');

  // --- Test Vendor Logout ---
  logoutVendor();
  assert.equal(store.get('ecshopping_current_vendor'), undefined, 'Vendor profile must be cleared');
  assert.equal(authSessions.get('vendor'), null, 'Vendor token must be cleared');
  // Admin token MUST NOT be touched
  assert.equal(authSessions.get('admin'), 'jwt-admin-789', 'Admin token must survive vendor logout');

  // --- Test Admin Logout ---
  logoutAdmin();
  assert.equal(getCurrentAdmin(), null, 'Admin profile must be cleared');
  assert.equal(authSessions.get('admin'), null, 'Admin token must be cleared');
});

// --------------------------------------------------------------------------
// 2. Session Expiry & Stale Session Clearance
// --------------------------------------------------------------------------

test('authSessions.clear purges both token and cached profile on 401 session expiry', async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };

  const { authSessions } = await import('../src/utils/api.js');

  // Setup customer session
  store.set('ecshopping_token_customer', 'expired-token');
  store.set('ecshopping_current_customer', JSON.stringify({ id: 'c1', name: 'Expired User' }));

  // Clear customer role
  authSessions.clear('customer');
  assert.equal(store.get('ecshopping_token_customer'), undefined, 'Customer token must be evicted');
  assert.equal(store.get('ecshopping_current_customer'), undefined, 'Customer cached profile must be evicted');

  // Setup vendor session
  store.set('ecshopping_token_vendor', 'expired-vend-token');
  store.set('ecshopping_current_vendor', JSON.stringify({ id: 'v1', name: 'Expired Vendor' }));
  authSessions.clear('vendor');
  assert.equal(store.get('ecshopping_token_vendor'), undefined, 'Vendor token must be evicted');
  assert.equal(store.get('ecshopping_current_vendor'), undefined, 'Vendor cached profile must be evicted');

  // Setup admin session
  store.set('ecshopping_token_admin', 'expired-admin-token');
  store.set('ecshopping_current_admin', JSON.stringify({ id: 'a1', email: 'admin@test.local' }));
  authSessions.clear('admin');
  assert.equal(store.get('ecshopping_token_admin'), undefined, 'Admin token must be evicted');
  assert.equal(store.get('ecshopping_current_admin'), undefined, 'Admin cached profile must be evicted');
});

// --------------------------------------------------------------------------
// 3. Protected Route Guards & Logout Enforcement
// --------------------------------------------------------------------------

test('App.jsx prevents access to protected routes when user state is null', () => {
  const appSource = read('../src/App.jsx');

  // Admin route guard: if not adminUser, renders AdminLogin
  assert.ok(
    appSource.includes('adminUser ? (') && appSource.includes('<AdminLogin onLogin={handleAdminLogin} />'),
    'App.jsx must guard /admin/* behind adminUser'
  );

  // Vendor route guard: if not vendorUser, renders VendorLogin
  assert.ok(
    appSource.includes('vendorUser ? (') && appSource.includes('<VendorLogin onLogin={handleVendorLogin} />'),
    'App.jsx must guard /vendor/* behind vendorUser'
  );

  // Logout handlers must reset state to null
  assert.ok(appSource.includes('setAdminUserState(null)'), 'handleAdminLogout resets admin state');
  assert.ok(appSource.includes("handleVendorLogout = () => handleVendorLogin(null, '')"), 'handleVendorLogout resets vendor state');
  assert.ok(appSource.includes('setLoggedInCustomerState(null)'), 'handleCustomerLogout resets customer state');
});

// --------------------------------------------------------------------------
// 4. Registration Navigation (No Manual Tab Selection Required)
// --------------------------------------------------------------------------

test('/register automatically opens customer Sign Up form', () => {
  const loginSource = read('../src/pages/Login.jsx');
  assert.ok(
    loginSource.includes("location.pathname === '/register'"),
    'Login.jsx must detect /register path'
  );
  assert.ok(
    loginSource.includes("initialMode={isRegisterRoute ? 'signup' : 'login'}"),
    'Login.jsx must pass signup mode on /register'
  );

  const authFormSource = read('../src/components/auth/AuthForm.jsx');
  assert.ok(
    authFormSource.includes("useState(initialMode === 'signup')"),
    'AuthForm must initialize isSignUp from initialMode'
  );
});

test('/vendor/register automatically opens vendor registration form', () => {
  const appSource = read('../src/App.jsx');
  assert.ok(
    appSource.includes('<VendorLogin onLogin={handleVendorLogin} initialSignUp={true} />'),
    'App.jsx must route /vendor/register with initialSignUp={true}'
  );

  const vendorLoginSource = read('../src/pages/vendor/VendorLogin.jsx');
  assert.ok(
    vendorLoginSource.includes('initialSignUp = false'),
    'VendorLogin must accept initialSignUp prop'
  );
  assert.ok(
    vendorLoginSource.includes('useState(initialSignUp)'),
    'VendorLogin must initialize isSignUp from initialSignUp prop'
  );
});

// --------------------------------------------------------------------------
// 5. Password Recovery & Email Verification Requirements Audit
// --------------------------------------------------------------------------

test('password recovery and email verification align with documented design', () => {
  // Login form provides support guidance notice instead of broken mock reset
  const authFormSource = read('../src/components/auth/AuthForm.jsx');
  assert.ok(
    authFormSource.includes('support@ecshopping.local'),
    'AuthForm must provide support recovery guidance'
  );

  // CustomerProfile provides authenticated self-service password update
  const profileSource = read('../src/pages/CustomerProfile.jsx');
  assert.ok(
    profileSource.includes('api.updateUserPassword'),
    'CustomerProfile must call api.updateUserPassword'
  );

  // Server implements authenticated password update endpoint
  const serverSource = read('../../server/index.js');
  assert.ok(
    serverSource.includes("app.put('/api/user/password'"),
    'Server must implement PUT /api/user/password'
  );
  assert.ok(
    serverSource.includes('passwordMeetsPolicy'),
    'Server password update must enforce policy'
  );
});

// --------------------------------------------------------------------------
// 6. 401 Interceptor Precision & Credential Error Exemption
// --------------------------------------------------------------------------

test('api.js 401 interceptor distinguishes session expiry from current-password mismatch', () => {
  const apiSource = read('../src/utils/api.js');

  // Verify the interceptor guards against clearing on current password error
  assert.ok(
    apiSource.includes("!data?.error?.toLowerCase().includes('current password')"),
    'api.js must exempt current password mismatches from session eviction'
  );

  // Verify authSessions.clear is scoped strictly to the calling role
  assert.ok(
    apiSource.includes('authSessions.clear(role)'),
    'api.js must clear only the affected role'
  );
});

// --------------------------------------------------------------------------
// 7. Direct & Back Navigation Guard Invariants
// --------------------------------------------------------------------------

test('direct and back navigation cannot reopen protected content after logout', () => {
  // Customer Profile unauthenticated state
  const profileSource = read('../src/pages/CustomerProfile.jsx');
  assert.ok(
    profileSource.includes('if (!loggedInCustomer)'),
    'CustomerProfile must guard render when loggedInCustomer is falsy'
  );
  assert.ok(
    profileSource.includes('You are not signed in'),
    'CustomerProfile renders guest state when unauthenticated'
  );

  // Vendor Dashboard auto-exit on cleared token
  const vendorDashboardSource = read('../src/pages/vendor/VendorDashboard.jsx');
  assert.ok(
    vendorDashboardSource.includes("!authSessions.get('vendor') && typeof onLogout === 'function'"),
    'VendorDashboard must invoke onLogout if token is missing'
  );

  // Admin Dashboard 401 auto-exit
  const adminDashboardSource = read('../src/pages/admin/AdminDashboard.jsx');
  assert.ok(
    adminDashboardSource.includes("err?.status === 401 && typeof onLogout === 'function'"),
    'AdminDashboard must invoke onLogout on 401'
  );
});
