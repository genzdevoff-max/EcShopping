import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { initStorage, getCurrentCustomer, logoutCustomer, saveVendorSession, getCurrentAdmin, logoutAdmin, syncFromServer } from './utils/storage';
import { CartContext, lineKeyOf } from './context/CartContext';
import Header from './components/Header';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import ScrollToTop from './components/ui/ScrollToTop';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Cart from './pages/Cart';
import ProductDetails from './pages/ProductDetails';
import Login from './pages/Login';
import LoginModal from './components/auth/LoginModal';
import { CheckCircle } from 'lucide-react';
import './App.css';

// Lazy-loaded routes for code splitting
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const VendorLogin = lazy(() => import('./pages/vendor/VendorLogin'));
const VendorDashboard = lazy(() => import('./pages/vendor/VendorDashboard'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'));
const CustomerProfile = lazy(() => import('./pages/CustomerProfile'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetails = lazy(() => import('./pages/OrderDetails'));
const TrackOrder = lazy(() => import('./pages/TrackOrder'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const Faq = lazy(() => import('./pages/Faq'));
const ShippingPolicy = lazy(() => import('./pages/ShippingPolicy'));
const ReturnsRefunds = lazy(() => import('./pages/ReturnsRefunds'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Terms = lazy(() => import('./pages/Terms'));
const BulkOrder = lazy(() => import('./pages/BulkOrder'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const StoreLocator = lazy(() => import('./pages/StoreLocator'));
const NotFound = lazy(() => import('./pages/NotFound'));
const PaymentStatus = lazy(() => import('./pages/PaymentStatus'));

const CART_KEY = 'ecshopping_cart';

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function App() {
  const [cartItems, setCartItems] = useState(loadCart);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [adminUser, setAdminUserState] = useState(() => getCurrentAdmin());
  const [vendorUser, setVendorUser] = useState(() => {
    try {
      const saved = localStorage.getItem('ecshopping_current_vendor');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loggedInCustomer, setLoggedInCustomerState] = useState(() => getCurrentCustomer());
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    initStorage();
    // Pull server-persisted products and orders into the local cache, then
    // bump dataVersion so catalog pages re-read the refreshed catalogue.
    syncFromServer().then(() => setDataVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
    } catch {
      /* storage full or unavailable — cart stays in memory */
    }
  }, [cartItems]);

  const toastTimerRef = useRef(null);

  const showToast = useCallback((message) => {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 2800);
  }, []);

  const addToCart = useCallback(
    (product, quantity = 1, variant = null) => {
      setCartItems((prev) => {
        const key = lineKeyOf(product.id, variant);
        const existing = prev.find((item) => lineKeyOf(item.id, item.variant) === key);
        if (existing) {
          return prev.map((item) =>
            lineKeyOf(item.id, item.variant) === key
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }
        return [
          ...prev,
          {
            id: product.id,
            title: product.title || product.name,
            price: product.price,
            compareAt: product.compareAt ?? null,
            image: product.image,
            seller: product.seller || product.soldBy || product.vendorName || 'EcShopping Seller',
            vendorId: product.vendorId || null,
            variant,
            quantity
          }
        ];
      });

      const variantText = variant ? ` (${variant})` : '';
      showToast(`Added “${product.title || product.name}${variantText}” to cart`);
      setDrawerOpen(true);
    },
    [showToast]
  );

  const setLineQuantity = useCallback((lineKey, quantity) => {
    setCartItems((prev) =>
      prev.map((item) =>
        lineKeyOf(item.id, item.variant) === lineKey
          ? { ...item, quantity: Math.max(1, Math.min(99, quantity)) }
          : item
      )
    );
  }, []);

  const removeLine = useCallback((lineKey) => {
    setCartItems((prev) => prev.filter((item) => lineKeyOf(item.id, item.variant) !== lineKey));
  }, []);

  const clearCart = useCallback(() => setCartItems([]), []);

  /* Legacy helpers kept for pages that still receive cart props */
  const updateQuantity = useCallback((id, newQuantity) => {
    if (newQuantity < 1) return;
    setCartItems((prev) => {
      let updated = false;
      return prev.map((item) => {
        if (!updated && String(item.id) === String(id)) {
          updated = true;
          return { ...item, quantity: newQuantity };
        }
        return item;
      });
    });
  }, []);

  const removeItem = useCallback((id) => {
    setCartItems((prev) => prev.filter((item) => String(item.id) !== String(id)));
  }, []);

  const handleCustomerLogin = (customer) => {
    // AuthForm already persisted the profile + token via saveCustomerSession,
    // so this only mirrors the UI state (fixes P0 ReferenceError regression).
    setLoggedInCustomerState(customer);
  };

  const handleCustomerUpdate = (customer) => {
    setLoggedInCustomerState(customer);
  };

  const handleCustomerLogout = () => {
    logoutCustomer();
    setLoggedInCustomerState(null);
  };

  const handleVendorLogin = (vendor, token) => {
    setVendorUser(vendor);
    saveVendorSession(vendor, token);
  };

  const handleVendorLogout = () => handleVendorLogin(null, '');

  const handleAdminLogin = (admin) => {
    // AdminLogin already persisted the admin profile + token; mirror state.
    setAdminUserState(admin);
  };

  const handleAdminLogout = () => {
    logoutAdmin();
    setAdminUserState(null);
  };

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const cartContext = useMemo(
    () => ({
      items: cartItems,
      count: cartCount,
      add: addToCart,
      setQuantity: setLineQuantity,
      remove: removeLine,
      clear: clearCart,
      updateQuantity,
      removeItem,
      drawerOpen,
      setDrawerOpen,
      dataVersion,
      lineKeyOf
    }),
    [cartItems, cartCount, addToCart, setLineQuantity, removeLine, clearCart, updateQuantity, removeItem, drawerOpen, dataVersion]
  );

  return (
    <Router>
      <ScrollToTop />
      <CartContext.Provider value={cartContext}>
        <div className="app-wrapper">
          <Suspense fallback={<div className="page-route-loading" aria-busy="true" />}>
            <Routes>
              <Route
                path="/admin/*"
                element={
                  adminUser ? (
                    <AdminDashboard admin={adminUser} onLogout={handleAdminLogout} />
                  ) : (
                    <AdminLogin onLogin={handleAdminLogin} />
                  )
                }
              />

            <Route
              path="/vendor/register"
              element={
                vendorUser ? (
                  <VendorDashboard vendor={vendorUser} onLogout={handleVendorLogout} />
                ) : (
                  <VendorLogin onLogin={handleVendorLogin} initialSignUp={true} />
                )
              }
            />
            <Route
              path="/vendor/*"
              element={
                vendorUser ? (
                  <VendorDashboard vendor={vendorUser} onLogout={handleVendorLogout} />
                ) : (
                  <VendorLogin onLogin={handleVendorLogin} />
                )
              }
            />

            <Route
              path="/*"
              element={
                <>
                  <Header
                    cartCount={cartCount}
                    loggedInCustomer={loggedInCustomer}
                    onCustomerLogout={handleCustomerLogout}
                    onOpenLogin={() => setLoginOpen(true)}
                  />
                  <main id="main-content">
                    <Routes>
                      <Route path="/" element={<Home onAddToCart={addToCart} />} />
                      <Route path="/shop" element={<Shop onAddToCart={addToCart} />} />
                      <Route path="/category/:slug" element={<Shop onAddToCart={addToCart} />} />
                      <Route path="/collection/:slug" element={<Shop onAddToCart={addToCart} />} />
                      <Route path="/product/:id" element={<ProductDetails onAddToCart={addToCart} />} />
                      <Route
                        path="/cart"
                        element={<Cart cartItems={cartItems} updateQuantity={updateQuantity} removeItem={removeItem} />}
                      />
                      <Route
                        path="/checkout"
                        element={
                          <Checkout
                            cartItems={cartItems}
                            clearCart={clearCart}
                            loggedInCustomer={loggedInCustomer}
                            onCustomerLogin={handleCustomerLogin}
                          />
                        }
                      />
                      <Route
                        path="/order-confirmation/:orderId"
                        element={<OrderConfirmation loggedInCustomer={loggedInCustomer} />}
                      />
                      <Route
                        path="/profile"
                        element={
                          <CustomerProfile
                            loggedInCustomer={loggedInCustomer}
                            onCustomerUpdate={handleCustomerUpdate}
                            onLogout={handleCustomerLogout}
                            onOpenLogin={() => setLoginOpen(true)}
                          />
                        }
                      />
                      <Route
                        path="/login"
                        element={<Login onCustomerLogin={handleCustomerLogin} loggedInCustomer={loggedInCustomer} />}
                      />
                      <Route
                        path="/register"
                        element={<Login onCustomerLogin={handleCustomerLogin} loggedInCustomer={loggedInCustomer} />}
                      />
                      <Route
                        path="/reset-password"
                        element={<ResetPassword />}
                      />
                      <Route path="/orders" element={<Orders loggedInCustomer={loggedInCustomer} onOpenLogin={() => setLoginOpen(true)} />} />
                      <Route path="/orders/:orderId" element={<OrderDetails loggedInCustomer={loggedInCustomer} onOpenLogin={() => setLoginOpen(true)} />} />
                      <Route path="/track-order" element={<TrackOrder loggedInCustomer={loggedInCustomer} onOpenLogin={() => setLoginOpen(true)} />} />
                      <Route path="/wishlist" element={<Wishlist onAddToCart={addToCart} />} />
                      <Route path="/about" element={<AboutUs />} />
                      <Route path="/contact" element={<ContactUs />} />
                      <Route path="/faq" element={<Faq />} />
                      <Route path="/shipping" element={<ShippingPolicy />} />
                      <Route path="/returns" element={<ReturnsRefunds />} />
                      <Route path="/privacy" element={<PrivacyPolicy />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/bulk-order" element={<BulkOrder />} />
                      <Route path="/blog" element={<Blog />} />
                      <Route path="/blog/:slug" element={<BlogPost />} />
                      <Route path="/store-locator" element={<StoreLocator />} />
                      <Route
                        path="/payment/phonepe/return"
                        element={<PaymentStatus />}
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                  <Footer />
                  <CartDrawer />
                  <LoginModal
                    open={loginOpen}
                    onClose={() => setLoginOpen(false)}
                    onCustomerLogin={handleCustomerLogin}
                  />
                </>
              }
            />
          </Routes>
          </Suspense>

          {toastMessage && (
            <div className="cart-toast" role="status" aria-live="polite">
              <CheckCircle size={18} className="toast-icon" />
              <span>{toastMessage}</span>
            </div>
          )}
        </div>
      </CartContext.Provider>
    </Router>
  );
}

export default App;
