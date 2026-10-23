/**
 * Thin REST client for the EcShopping Express API.
 * All server persistence for products and orders flows through here.
 * Requests degrade gracefully: callers should catch errors and fall back
 * to the local cache when the API is unreachable.
 *
 * Authentication: the server issues JWT tokens at /api/auth/{customer,vendor,admin}/login
 * and /api/auth/user/register. Tokens are stored per role under
 * ecshopping_token_<role> and automatically attached as
 * "Authorization: Bearer <token>" on role-scoped requests. A 401 clears
 * the stored token so a stale/expired session never loops.
 */

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TOKEN_KEY_PREFIX = 'ecshopping_token_';
const VALID_ROLES = ['customer', 'vendor', 'admin'];

const tokenKey = (role) => `${TOKEN_KEY_PREFIX}${role}`;

export const authSessions = {
  /** Stored JWT for a role, or null. */
  get(role) {
    try {
      return localStorage.getItem(tokenKey(role));
    } catch {
      return null;
    }
  },
  /** Persists the token (empty string removes it). */
  set(role, token) {
    try {
      if (token) localStorage.setItem(tokenKey(role), token);
      else localStorage.removeItem(tokenKey(role));
    } catch {
      /* storage unavailable — session ends at page unload */
    }
  },
  clear(role) {
    this.set(role, '');
  },
  clearAll() {
    VALID_ROLES.forEach((role) => this.clear(role));
  }
};

async function request(path, { method = 'GET', body, role, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (role && VALID_ROLES.includes(role)) {
    const token = authSessions.get(role);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal
    });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new Error('Network unreachable — please check your connection.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.ok) return data;

  // Expired/invalid tokens: forget the stored token so the next attempt
  // goes out unauthenticated and auth pages show the signed-out state.
  if (role && res.status === 401) authSessions.clear(role);

  const error = new Error((data && data.error) || `Request failed (${res.status})`);
  error.status = res.status;
  throw error;
}

const qs = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.append(key, value);
  });
  const str = search.toString();
  return str ? `?${str}` : '';
};

export const api = {
  /* Auth — public endpoints that mint tokens */
  userLogin: (email, password) => request('/api/auth/user/login', { method: 'POST', body: { email, password } }),
  userRegister: (data) => request('/api/auth/user/register', { method: 'POST', body: data }),
  registerVendor: (data) => request('/api/auth/vendor/register', { method: 'POST', body: data }),
  loginVendor: (email, password) => request('/api/auth/vendor/login', { method: 'POST', body: { email, password } }),
  adminLogin: (email, password) => request('/api/auth/admin/login', { method: 'POST', body: { email, password } }),

  /* Vendors + customers (admin) */
  getVendors: (params) => request(`/api/vendors${qs(params)}`, { role: 'admin' }),
  getUsers: () => request('/api/users', { role: 'admin' }),
  updateVendorStatus: (id, status) => request(`/api/vendors/${encodeURIComponent(id)}/status`, { method: 'PUT', body: { status }, role: 'admin' }),
  updateVendorDirectSelling: (id, directSelling) => request(`/api/vendors/${encodeURIComponent(id)}/direct-selling`, { method: 'PUT', body: { directSelling }, role: 'admin' }),

  /* Categories (vendor or admin) */
  getCategories: (params = {}, role = 'vendor') => request(`/api/categories${qs(params)}`, { role }),
  getPublicCategories: () => request('/api/categories/public'),
  createCategory: (data, role = 'vendor') => request('/api/categories', { method: 'POST', body: data, role }),
  updateCategory: (id, updates, role = 'vendor') => request(`/api/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: updates, role }),
  deleteCategory: (id, role = 'vendor') => request(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE', role }),

  /* Products — reads are public unless a vendor wants their pending items too */
  getProducts: (params = {}, role) => request(`/api/products${qs(params)}`, { role }),
  getProduct: (id) => request(`/api/products/${encodeURIComponent(id)}`),
  getRelatedProducts: (id) => request(`/api/products/${encodeURIComponent(id)}/related`),
  createProduct: (product) => request('/api/products', { method: 'POST', body: product, role: 'vendor' }),
  updateProduct: (id, updates) => request(`/api/products/${encodeURIComponent(id)}`, { method: 'PUT', body: updates, role: 'vendor' }),
  updateProductStatus: (id, status) => request(`/api/products/${encodeURIComponent(id)}/status`, { method: 'PUT', body: { status }, role: 'admin' }),
  deleteProduct: (id) => request(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE', role: 'vendor' }),

  /* Upload (vendor or admin) */
  uploadImage: (file, role = 'vendor') => api.upload(file, role),

  /** Shared multipart upload helper (outside the object literal to keep
   *  the executor warning-free). */
  upload(file, role) {
    return new Promise((resolve, reject) => {
      const headers = {};
      const token = authSessions.get(role);
      if (token) headers.Authorization = `Bearer ${token}`;
      const formData = new FormData();
      formData.append('image', file);

      fetch(`${API_URL}/api/upload`, { method: 'POST', headers, body: formData })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            if (res.status === 401) authSessions.clear(role);
            reject(new Error((data && data.error) || `Upload failed (${res.status})`));
            return;
          }
          resolve(data);
        })
        .catch(reject);
    });
  },

  /* Reviews — listing is public; creating accepts a customer token (optional) */
  getReviews: (params) => request(`/api/reviews${qs(params)}`),
  createReview: (review, role = 'customer') => request('/api/reviews', { method: 'POST', body: review, role }),

  /* Orders — scoped by the authenticated role; guests only create */
  getOrders: (params = {}, role) => request(`/api/orders${qs(params)}`, { role }),
  getOrder: (id, role) => request(`/api/orders/${encodeURIComponent(id)}`, { role }),
  createOrder: (order) => request('/api/orders', { method: 'POST', body: order, role: 'customer' }),
  updateOrderStatus: (id, status, role = 'vendor') => request(`/api/orders/${encodeURIComponent(id)}/status`, { method: 'PUT', body: { status }, role }),
  cancelCustomerOrder: (orderId, reason) => request(`/api/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST', body: { reason }, role: 'customer' }),

  /* Customer Profile & Address Management */
  getUserProfile: () => request('/api/user/profile', { role: 'customer' }),
  updateUserProfile: (profileData) => request('/api/user/profile', { method: 'PUT', body: profileData, role: 'customer' }),
  updateUserPassword: (passwordData) => request('/api/user/password', { method: 'PUT', body: passwordData, role: 'customer' }),
  getUserAddresses: () => request('/api/user/addresses', { role: 'customer' }),
  addUserAddress: (addressData) => request('/api/user/addresses', { method: 'POST', body: addressData, role: 'customer' }),
  updateUserAddress: (id, addressData) => request(`/api/user/addresses/${encodeURIComponent(id)}`, { method: 'PUT', body: addressData, role: 'customer' }),
  deleteUserAddress: (id) => request(`/api/user/addresses/${encodeURIComponent(id)}`, { method: 'DELETE', role: 'customer' }),
  setDefaultUserAddress: (id) => request(`/api/user/addresses/${encodeURIComponent(id)}/default`, { method: 'PUT', role: 'customer' }),

  /* PhonePe payments. The server derives the payable amount from the order
     row; the client only carries the order id and can never mint a success. */
  createPhonePePayment: (orderId) =>
    request('/api/payments/phonepe/create-payment', { method: 'POST', body: { orderId }, role: 'customer' }),
  verifyPhonePePayment: (orderId) =>
    request('/api/payments/phonepe/verify', { method: 'POST', body: { orderId }, role: 'customer' }),
};

export default api;
