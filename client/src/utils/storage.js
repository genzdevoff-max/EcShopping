// Storage utility: localStorage cache backed by the TiDB server for
// products and orders. Reads stay synchronous (from the cache); writes
// update the cache immediately and push to the server in the background.

import api, { authSessions } from './api.js';
import { mergeOrderHistory } from './orderSync.js';

const VENDORS_KEY = 'ecshopping_vendors';
const PRODUCTS_KEY = 'ecshopping_products';
const CUSTOMERS_KEY = 'ecshopping_customers';
const ORDERS_KEY = 'ecshopping_orders';
const CURRENT_ADMIN_KEY = 'ecshopping_current_admin';

// Fire-and-forget server push; never blocks the UI.
const pushToServer = (operation) => {
  Promise.resolve()
    .then(operation)
    .catch((err) => console.warn('[api] background sync failed:', err.message));
};

const normalizeProduct = (p) => ({
  id: p.id,
  vendorId: p.vendorId || p.vendor_id || null,
  vendorName: p.vendorName || p.vendor_name || '',
  title: p.title || p.name || 'Untitled product',
  name: p.name || p.title || 'Untitled product',
  description: p.description || '',
  category: p.category || 'General',
  price: Number(p.price) || 0,
  strikePrice: p.strikePrice != null && p.strikePrice !== '' ? Number(p.strikePrice) : null,
  unit: p.unit || '',
  image: p.image || '',
  videoUrl: p.videoUrl || p.video_url || '',
  stockStatus: p.stockStatus || (p.inStock === false ? 'out_of_stock' : 'in_stock'),
  inStock: (p.stockStatus || 'in_stock') !== 'out_of_stock',
  status: p.status || 'pending',
  createdAt: p.createdAt || new Date().toISOString()
});

const normalizeVendor = (v) => ({
  id: v.id,
  name: v.name,
  email: v.email,
  phone: v.phone || '',
  status: v.status || 'pending',
  directSelling: v.directSelling != null ? Boolean(v.directSelling) : Boolean(v.direct_selling),
  createdAt: v.createdAt || v.created_at || new Date().toISOString()
});

const normalizeOrder = (o) => {
  let shippingAddress = o.shippingAddress;
  if (typeof shippingAddress === 'string') {
    try { shippingAddress = JSON.parse(shippingAddress); } catch { shippingAddress = null; }
  }
  return {
    ...o,
    shippingAddress,
    items: Array.isArray(o.items) ? o.items : [],
    totalAmount: o.totalAmount != null ? Number(o.totalAmount) : Number(o.total) || 0,
    status: o.status || 'Processing',
    date: o.date || new Date().toISOString()
  };
};

// Initialize mock data if empty
export const initStorage = () => {
  if (!localStorage.getItem(VENDORS_KEY)) {
    localStorage.setItem(VENDORS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(PRODUCTS_KEY)) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(CUSTOMERS_KEY)) {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(ORDERS_KEY)) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify([]));
  }
};

export const getVendors = () => {
  return JSON.parse(localStorage.getItem(VENDORS_KEY) || '[]');
};

export const addVendor = (vendor) => {
  const vendors = getVendors();
  const newVendor = {
    ...vendor,
    id: 'v' + Date.now(),
    createdAt: new Date().toISOString()
  };
  vendors.push(newVendor);
  localStorage.setItem(VENDORS_KEY, JSON.stringify(vendors));
  return newVendor;
};

export const updateVendorStatus = (id, status) => {
  const vendors = getVendors();
  const updated = vendors.map(v => v.id === id ? { ...v, status } : v);
  localStorage.setItem(VENDORS_KEY, JSON.stringify(updated));
  pushToServer(() => api.updateVendorStatus(id, status));
};

export const toggleVendorDirectSelling = (id, directSelling) => {
  const vendors = getVendors();
  const updated = vendors.map(v => v.id === id ? { ...v, directSelling } : v);
  localStorage.setItem(VENDORS_KEY, JSON.stringify(updated));
  pushToServer(() => api.updateVendorDirectSelling(id, directSelling));
};

export const deleteVendor = (id) => {
  const vendors = getVendors();
  const updated = vendors.filter(v => v.id !== id);
  localStorage.setItem(VENDORS_KEY, JSON.stringify(updated));
};

// --- Product Management ---

export const getProducts = () => {
  return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]');
};

export const addProduct = (vendor, productData) => {
  const products = getProducts();

  const newProduct = {
    ...productData,
    id: 'p' + Date.now(),
    vendorId: vendor.id,
    vendorName: vendor.name,
    status: 'pending', // Every new listing awaits admin approval
    createdAt: new Date().toISOString()
  };

  products.push(newProduct);
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));

  // Persist to the server so admins can review it from any device.
  pushToServer(() => api.createProduct(newProduct));

  return newProduct;
};

/* Server-authoritative product creation for the vendor portal: the listing
 * only exists once the API confirms it (server assigns status 'pending' and
 * owns the identity). Returns { ok: true, product } or { ok: false, error }. */
export const createProductOnServer = async (vendor, productData) => {
  if (!vendor?.id) return { ok: false, error: 'Vendor session expired. Please sign in again.' };
  try {
    const data = await api.createProduct(productData);
    if (data?.success && data.product) {
      const confirmed = { ...normalizeProduct(data.product), serverVerified: true };
      const products = getProducts();
      const idx = products.findIndex((p) => String(p.id) === String(confirmed.id));
      if (idx >= 0) products.splice(idx, 1, confirmed);
      else products.unshift(confirmed);
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
      return { ok: true, product: confirmed };
    }
    return { ok: false, error: data?.error || 'The server did not confirm the product' };
  } catch (err) {
    return { ok: false, error: err?.message || 'Could not reach the server' };
  }
};

export const updateProductStatus = (id, status) => {
  const products = getProducts();
  const updated = products.map(p => p.id === id ? { ...p, status } : p);
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(updated));
  pushToServer(() => api.updateProductStatus(id, status));
  return updated;
};

export const deleteProduct = (id) => {
  const products = getProducts();
  const updated = products.filter(p => p.id !== id);
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(updated));
  pushToServer(() => api.deleteProduct(id));
  return updated;
};

export const updateProduct = (id, updatedData) => {
  const products = getProducts();
  const updated = products.map(p => p.id === id ? { ...p, ...updatedData } : p);
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(updated));
  pushToServer(() => api.updateProduct(id, updatedData));
  return updated.find(p => p.id === id);
};

export const toggleProductStock = async (id) => {
  const products = getProducts();
  const target = products.find(p => p.id === id);
  if (!target) return null;
  const newInStock = target.stockStatus === 'in_stock' ? false : target.inStock === false ? true : false;
  const newStatus = newInStock ? 'in_stock' : 'out_of_stock';
  const updated = products.map(p => p.id === id ? { ...p, inStock: newInStock, stockStatus: newStatus } : p);
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(updated));
  try {
    await api.updateProduct(id, { stockStatus: newStatus }, 'vendor');
  } catch (err) {
    console.warn('[api] toggleProductStock sync failed:', err.message);
  }
  return { ...target, inStock: newInStock, stockStatus: newStatus };
};

export const updateVendor = (id, updatedData) => {
  const vendors = getVendors();
  const updated = vendors.map(v => v.id === id ? { ...v, ...updatedData } : v);
  localStorage.setItem(VENDORS_KEY, JSON.stringify(updated));
  // Also update current vendor session if matching
  const current = JSON.parse(localStorage.getItem('ecshopping_current_vendor') || 'null');
  if (current && current.id === id) {
    localStorage.setItem('ecshopping_current_vendor', JSON.stringify({ ...current, ...updatedData }));
  }
  return { ...updatedData, id };
};

// --- Customer Management ---

const CURRENT_CUSTOMER_KEY = 'ecshopping_current_customer';

/** Safely extracts and parses JWT payload if formatted as a 3-part token. */
export const parseJwt = (token) => {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

/** Checks whether a token is present, non-expired, and role-matched. */
export const isTokenValid = (token, expectedRole) => {
  if (!token || typeof token !== 'string' || !token.trim()) return false;
  const parts = token.split('.');
  if (parts.length === 3) {
    try {
      const payload = parseJwt(token);
      if (payload) {
        if (expectedRole && payload.role && payload.role !== expectedRole) return false;
        if (payload.exp && payload.exp * 1000 <= Date.now()) return false;
      }
    } catch {
      return false;
    }
  }
  return true;
};

export const getCurrentCustomer = () => {
  try {
    const raw = localStorage.getItem(CURRENT_CUSTOMER_KEY);
    const token = authSessions.get('customer');
    if (!raw || !token || !isTokenValid(token, 'customer')) {
      if (raw || token) {
        localStorage.removeItem(CURRENT_CUSTOMER_KEY);
        authSessions.clear('customer');
      }
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setCurrentCustomer = (customer) => {
  if (customer) {
    localStorage.setItem(CURRENT_CUSTOMER_KEY, JSON.stringify(customer));
  } else {
    localStorage.removeItem(CURRENT_CUSTOMER_KEY);
  }
};

export const updateCustomerProfile = (updates) => {
  const current = getCurrentCustomer();
  if (current) {
    const updated = { ...current, ...updates };
    setCurrentCustomer(updated);
    return updated;
  }
  return null;
};

/* ---- Session helpers (token-backed) ----
 * Every login result from the server carries a JWT; these helpers pair the
 * cached profile with its token so api.js can attach it per role.
 */
export const saveCustomerSession = (customer, token) => {
  if (customer && token) {
    setCurrentCustomer(customer);
    authSessions.set('customer', token);
  } else {
    setCurrentCustomer(null);
    authSessions.clear('customer');
  }
};

export const logoutCustomer = () => saveCustomerSession(null, '');

export const saveVendorSession = (vendor, token) => {
  if (vendor && token) {
    localStorage.setItem('ecshopping_current_vendor', JSON.stringify(vendor));
    authSessions.set('vendor', token);
  } else {
    localStorage.removeItem('ecshopping_current_vendor');
    authSessions.clear('vendor');
  }
};

export const getCurrentVendor = () => {
  try {
    const raw = localStorage.getItem('ecshopping_current_vendor');
    const token = authSessions.get('vendor');
    if (!raw || !token || !isTokenValid(token, 'vendor')) {
      if (raw || token) {
        localStorage.removeItem('ecshopping_current_vendor');
        authSessions.clear('vendor');
      }
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const logoutVendor = () => saveVendorSession(null, '');

export const saveAdminSession = (admin, token) => {
  if (admin && token) {
    localStorage.setItem(CURRENT_ADMIN_KEY, JSON.stringify(admin));
    authSessions.set('admin', token);
  } else {
    localStorage.removeItem(CURRENT_ADMIN_KEY);
    authSessions.clear('admin');
  }
};

export const getCurrentAdmin = () => {
  try {
    const raw = localStorage.getItem(CURRENT_ADMIN_KEY);
    const token = authSessions.get('admin');
    if (!raw || !token || !isTokenValid(token, 'admin')) {
      if (raw || token) {
        localStorage.removeItem(CURRENT_ADMIN_KEY);
        authSessions.clear('admin');
      }
      return null;
    }
    const admin = JSON.parse(raw);
    if (!admin || admin.role !== 'admin') {
      localStorage.removeItem(CURRENT_ADMIN_KEY);
      authSessions.clear('admin');
      return null;
    }
    return admin;
  } catch {
    return null;
  }
};

export const logoutAdmin = () => saveAdminSession(null, '');

export const getCustomers = () => {
  return JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]');
};

export const addCustomer = (customerData) => {
  const customers = getCustomers();

  // Prevent duplicate email
  const existing = customers.find(c => c.email.toLowerCase() === customerData.email.toLowerCase());
  if (existing) {
    return { success: false, message: 'Email already exists', customer: existing };
  }

  // Passwords are hashed server-side only; never persist credentials here.
  const newCustomer = {
    ...customerData,
    id: customerData.id || 'c' + Date.now(),
    createdAt: customerData.createdAt || new Date().toISOString()
  };
  delete newCustomer.password;

  customers.push(newCustomer);
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
  return { success: true, customer: newCustomer };
};

// --- Order Management ---

export const getOrders = () => {
  return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
};

export const getCustomerOrders = (customerEmail) => {
  const orders = getOrders();
  return orders.filter(o => o.customerEmail && o.customerEmail.toLowerCase() === (customerEmail || '').toLowerCase());
};

export const getVendorOrders = (vendorId, vendorName) => {
  const orders = getOrders();
  return orders.filter(o => {
    if (!o.items) return false;
    return o.items.some(item => {
      if (item.vendorId && vendorId && String(item.vendorId) === String(vendorId)) return true;
      const itemSeller = (item.soldBy || item.vendorName || item.seller || '').toLowerCase();
      const vName = (vendorName || '').toLowerCase();
      return itemSeller && vName && (itemSeller.includes(vName) || vName.includes(itemSeller));
    });
  }).map(order => ({
    ...order,
    // Filter only items belonging to this vendor for their breakdown
    vendorItems: order.items.filter(item => {
      if (item.vendorId && vendorId && String(item.vendorId) === String(vendorId)) return true;
      const itemSeller = (item.soldBy || item.vendorName || item.seller || '').toLowerCase();
      const vName = (vendorName || '').toLowerCase();
      return itemSeller && vName && (itemSeller.includes(vName) || vName.includes(itemSeller));
    })
  }));
};

export const addOrder = async (orderData) => {
  // Server-first placement: the server generates the order id and recomputes
  // all prices/totals/payment state. The confirmed row is stored locally and
  // is the only copy presented as server-verified.
  try {
    const data = await api.createOrder(orderData);
    if (data?.success && data.order) {
      const confirmed = { ...normalizeOrder(data.order), serverVerified: true };
      const orders = getOrders();
      const existingIdx = orders.findIndex((o) => String(o.id) === String(confirmed.id));
      if (existingIdx >= 0) orders.splice(existingIdx, 1, confirmed);
      else orders.unshift(confirmed); // newest first
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
      return confirmed;
    }
    throw new Error((data && data.error) || 'Order was not confirmed by the server');
  } catch {
    // Offline fallback: keep an unverified local draft so checkout still
    // completes. It is flagged serverVerified=false and must never be shown
    // as paid or server-confirmed (see utils/orderSync.js).
    let localDraft = {
      ...orderData,
      id: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
      status: 'Processing',
      date: new Date().toISOString(),
      serverVerified: false
    };
    const existing = getOrders();
    while (existing.some((o) => String(o.id) === String(localDraft.id))) {
      localDraft = { ...localDraft, id: 'ORD-' + Math.floor(100000 + Math.random() * 900000) };
    }
    existing.unshift(localDraft); // newest first
    localStorage.setItem(ORDERS_KEY, JSON.stringify(existing));
    return localDraft;
  }
};

export const updateOrderStatus = (orderId, newStatus, role = 'vendor') => {
  const orders = getOrders();
  const updated = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
  pushToServer(() => api.updateOrderStatus(orderId, newStatus, role));
  return updated;
};

// --- Server synchronisation ---

/** Pull every product from the server into the local cache.
 *  A vendor token widens the result to include that vendor's pending items. */
export const syncProductsFromServer = async (role) => {
  try {
    const data = await api.getProducts({}, role);
    if (data?.success && Array.isArray(data.products)) {
      const normalized = data.products.map(normalizeProduct);
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch (err) {
    console.warn('[api] product sync skipped:', err.message);
  }
  return getProducts();
};

/** Pull every vendor from the server into the local cache (admin only). */
export const syncVendorsFromServer = async () => {
  try {
    const data = await api.getVendors();
    if (data?.success && Array.isArray(data.vendors)) {
      const normalized = data.vendors.map(normalizeVendor);
      localStorage.setItem(VENDORS_KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch (err) {
    console.warn('[api] vendor sync skipped:', err.message);
  }
  return getVendors();
};

/** Pull orders from the server and merge them into the local cache.
 *
 * Identity rule (see utils/orderSync.js): `id` — rows the server returned
 * replace local copies with the same id (server data wins); local-only rows
 * survive empty or partial server responses but are re-flagged
 * `serverVerified: false`, so a silent local history is never presented as
 * server-confirmed or paid. Network/auth failures leave the cache untouched.
 * Server requires any authenticated role; callers pass the role whose token
 * should be attached ('customer', 'vendor' or 'admin').
 *
 * Returns { ok: true, orders } on success, { ok: false, status, error }
 * on failure so pages can distinguish loading, auth and network errors.
 */
export const syncOrdersFromServerDetailed = async (params = {}, role) => {
  try {
    const data = await api.getOrders(params, role);
    if (data?.success && Array.isArray(data.orders)) {
      const serverOrders = data.orders.map(normalizeOrder);
      let merged = serverOrders;
      if (Object.keys(params).length === 0) {
        merged = mergeOrderHistory(serverOrders, getOrders());
        localStorage.setItem(ORDERS_KEY, JSON.stringify(merged));
      }
      return { ok: true, orders: merged };
    }
    // Unrecognised payload shape: treat as "no server data", not a failure.
    return { ok: true, orders: getOrders() };
  } catch (err) {
    return { ok: false, status: err?.status || 0, error: err?.message || 'Could not reach the server' };
  }
};

/** Backwards-compatible wrapper: returns the order array (detailed result
 *  is available via syncOrdersFromServerDetailed). */
export const syncOrdersFromServer = async (params = {}, role) => {
  const result = await syncOrdersFromServerDetailed(params, role);
  return result.ok ? result.orders : getOrders();
};

/** Refresh vendors, products and orders from the server.
 *  Vendors are admin-scoped; orders use whichever token is present
 *  (customer -> vendor -> admin) so signed-in visitors stay in sync. */
export const syncFromServer = async ({ ordersRole } = {}) => {
  const resolvedOrdersRole =
    ordersRole ||
    (authSessions.get('customer') ? 'customer' : authSessions.get('vendor') ? 'vendor' : authSessions.get('admin') ? 'admin' : undefined);
  const [vendors, products, orders] = await Promise.all([
    syncVendorsFromServer(),
    syncProductsFromServer(),
    syncOrdersFromServer({}, resolvedOrdersRole)
  ]);
  return { vendors, products, orders };
};
