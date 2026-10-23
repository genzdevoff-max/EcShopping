import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Settings, 
  LogOut, 
  ChevronDown, 
  ChevronRight, 
  FolderTree, 
  PlusCircle, 
  Boxes, 
  Trash2, 
  CheckCircle, 
  TrendingUp, 
  Store, 
  ExternalLink,
  Search,
  Check,
  AlertCircle,
  Star,
  XCircle
} from 'lucide-react';
import brandLogoWithBg from '../../assets/logo/logo.png';
import CategoryManager from './CategoryManager';
import AddProduct from './AddProduct';
import AllProducts from './AllProducts';
import EditProduct from './EditProduct';
import api from '../../utils/api';
import { 
  getProducts, 
  addProduct, 
  deleteProduct, 
  getVendorOrders, 
  updateOrderStatus,
  updateVendor,
  toggleProductStock,
  syncProductsFromServer,
  syncOrdersFromServer
} from '../../utils/storage';
import './VendorDashboard.css';

export default function VendorDashboard({ vendor, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Synchronize active tab from browser URL path
  const getTabFromPath = () => {
    const path = location.pathname.toLowerCase();
    if (path.includes('/vendor/category') || path.includes('/vendor/categories')) return 'products-category';
    if (path.includes('/vendor/products/add') || path.includes('/vendor/add-product')) return 'products-add';
    if (path.includes('/vendor/products/pending')) return 'products-pending';
    if (path.includes('/vendor/products/rejected')) return 'products-rejected';
    if (path.includes('/vendor/products')) return 'products-all';
    if (path.includes('/vendor/orders')) return 'orders';
    if (path.includes('/vendor/stocks')) return 'stocks';
    if (path.includes('/vendor/reviews')) return 'reviews';
    if (path.includes('/vendor/settings')) return 'settings';
    return 'dashboard';
  };

  const activeTab = getTabFromPath();

  const handleNavigate = (tabKey) => {
    switch (tabKey) {
      case 'dashboard':
        navigate('/vendor/dashboard');
        break;
      case 'products-category':
        navigate('/vendor/category');
        break;
      case 'products-add':
        navigate('/vendor/products/add');
        break;
      case 'products-all':
        navigate('/vendor/products');
        break;
      case 'products-pending':
        navigate('/vendor/products/pending');
        break;
      case 'products-rejected':
        navigate('/vendor/products/rejected');
        break;
      case 'orders':
        navigate('/vendor/orders');
        break;
      case 'stocks':
        navigate('/vendor/stocks');
        break;
      case 'reviews':
        navigate('/vendor/reviews');
        break;
      case 'settings':
        navigate('/vendor/settings');
        break;
      default:
        navigate('/vendor/dashboard');
    }
  };

  const [productsOpen, setProductsOpen] = useState(true);

  // Data states
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  // Add Product form state
  const [newProduct, setNewProduct] = useState({
    title: '',
    category: 'Fresh Vegetables',
    price: '',
    unit: '1 kg',
    image: '',
    description: ''
  });
  const [formSuccess, setFormSuccess] = useState('');

  // Settings form state
  const [settingsData, setSettingsData] = useState({
    name: vendor?.name || '',
    email: vendor?.email || '',
    phone: vendor?.phone || '',
    bio: 'Authentic farm-fresh and organic products directly from our farm.',
    address: 'Tamil Nadu, India'
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Sample quick images for adding products easily
  const sampleImages = [
    { label: 'Fresh Tomatoes', url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80' },
    { label: 'Organic Bananas', url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80' },
    { label: 'Farm Milk', url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80' },
    { label: 'Pure Honey', url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80' },
    { label: 'Organic Rice', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80' },
    { label: 'Cold-pressed Oil', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80' }
  ];

  const loadData = async () => {
    if (!vendor) return;
    // Vendor token: pending listings + this vendor's scoped orders.
    await syncProductsFromServer('vendor');
    const allProducts = getProducts();
    setProducts(allProducts.filter(p => p.vendorId === vendor.id || (p.soldBy && p.soldBy.toLowerCase() === vendor.name.toLowerCase())));

    // Fetch only this vendor's orders from the server (scoped for privacy).
    const vendorOrders = await syncOrdersFromServer({ vendorId: vendor.id, vendorName: vendor.name }, 'vendor');
    setOrders(Array.isArray(vendorOrders) ? vendorOrders : getVendorOrders(vendor.id, vendor.name));
  };

  useEffect(() => {
    setEditingProductId(null);
    loadData();
  }, [vendor?.id, activeTab]);

  // Reviews are fetched from the server for this vendor's products only.
  useEffect(() => {
    if (!vendor || activeTab !== 'reviews') return;
    let cancelled = false;
    setReviewsLoading(true);
    api.getReviews({ vendorId: vendor.id })
      .then((data) => {
        if (!cancelled) setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setReviewsLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab, vendor?.id]);

  if (!vendor) return null;

  const pendingProducts = products.filter(p => (p.status || 'pending') === 'pending');
  const rejectedProducts = products.filter(p => p.status === 'rejected');
  const approvedProducts = products.filter(p => p.status === 'approved');

  const handleStockToggle = (product) => {
    toggleProductStock(product.id);
    loadData();
  };

  // Calculate vendor-specific revenue
  const vendorRevenue = orders.reduce((total, order) => {
    const itemsTotal = (order.vendorItems || []).reduce((sum, item) => {
      const priceStr = (item.price || '0').toString().replace(/[^0-9.-]+/g, "");
      const price = parseFloat(priceStr.split('-')[0]) || 0;
      return sum + (price * item.quantity);
    }, 0);
    return total + itemsTotal;
  }, 0);

  // Handle Add Product Submit
  const handleAddProductSubmit = (e) => {
    e.preventDefault();
    if (!newProduct.title || !newProduct.price) return;

    const created = addProduct(vendor, {
      title: newProduct.title.trim(),
      name: newProduct.title.trim(),
      category: newProduct.category,
      price: Number(newProduct.price),
      unit: newProduct.unit,
      image: newProduct.image || 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=500&q=80',
      description: newProduct.description,
      inStock: true
    });

    loadData();
    setFormSuccess(`Product "${created.title}" successfully added!`);
    setNewProduct({
      title: '',
      category: 'Fresh & Natural',
      price: '',
      unit: '1 kg',
      image: '',
      description: ''
    });

    setTimeout(() => {
      setFormSuccess('');
      handleNavigate('products-all');
    }, 1200);
  };

  // Handle Delete Product
  const handleDeleteProduct = (productId, productTitle) => {
    if (window.confirm(`Are you sure you want to delete "${productTitle}"?`)) {
      deleteProduct(productId);
      loadData();
    }
  };

  // Handle Order Status Change
  const handleOrderStatusChange = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      await api.updateOrderStatus(orderId, newStatus, 'vendor');
    } catch (err) {
      console.error('Failed to update order status on server:', err);
    }
    updateOrderStatus(orderId, newStatus);
    await loadData();
    setUpdatingOrderId(null);
  };

  // Handle Save Settings
  const handleSaveSettings = (e) => {
    e.preventDefault();
    updateVendor(vendor.id, {
      name: settingsData.name,
      phone: settingsData.phone,
      bio: settingsData.bio,
      address: settingsData.address
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  // Filter products by search
  const filteredProducts = products.filter(p => 
    (p.title || p.name || '').toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(productSearch.toLowerCase())
  );

  // Filter orders
  const filteredOrders = orders.filter(o => {
    if (orderFilter === 'all') return true;
    return (o.status || 'Processing').toLowerCase() === orderFilter.toLowerCase();
  });

  const statusBadgeStyle = (status) => {
    const colors = {
      approved: { background: '#dcfce7', color: '#166534' },
      pending: { background: '#fef3c7', color: '#92400e' },
      rejected: { background: '#fee2e2', color: '#991b1b' }
    };
    return colors[status] || colors.pending;
  };

  const renderStatusProductTable = (list, emptyText) => (
    <div className="products-table-card">
      <table className="vendor-data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {p.image && (
                    <img
                      src={p.image}
                      alt=""
                      style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }}
                    />
                  )}
                  <strong>{p.title || p.name}</strong>
                </div>
              </td>
              <td>{p.category || '—'}</td>
              <td>₹{Number(p.price) || 0}</td>
              <td>{(p.stockStatus === 'out_of_stock' || p.inStock === false) ? 'Out of stock' : 'In stock'}</td>
              <td>
                <span
                  className="order-status-badge"
                  style={{ ...statusBadgeStyle(p.status), textTransform: 'capitalize' }}
                >
                  {p.status || 'pending'}
                </span>
              </td>
              <td>
                {['pending', 'rejected'].includes(p.status) && (
                  <button
                    type="button"
                    onClick={() => setEditingProductId(p.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#0f172a',
                      cursor: 'pointer'
                    }}
                  >
                    Edit
                  </button>
                )}
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const isProductsActive = ['products-category', 'products-add', 'products-all', 'products-pending', 'products-rejected'].includes(activeTab);

  return (
    <div className="vendor-layout">
      {/* ================= SIDEBAR ================= */}
      <aside className="vendor-sidebar">
        {/* 1. Brand Logo */}
        <div className="vendor-sidebar-header">
          <Link to="/" className="vendor-brand-logo-link" title="Go to Storefront">
            <div className="vendor-brand-logo-card">
              <img src={brandLogoWithBg} alt="EcShopping Logo" className="vendor-brand-logo-img-bg" />
            </div>
          </Link>

          {/* Vendor profile status */}
          <div className="vendor-sidebar-user">
            <div className="vendor-user-avatar-circle">
              {vendor.name?.charAt(0)?.toUpperCase() || 'V'}
            </div>
            <div className="vendor-user-info">
              <span className="vendor-user-name" title={vendor.name}>{vendor.name}</span>
              <span className="vendor-status-online">
                <span className="status-dot"></span> Seller Active
              </span>
            </div>
          </div>
        </div>

        {/* 2. Sidebar Menus */}
        <nav className="vendor-nav">
          <span className="vendor-nav-group-title">Main Menu</span>

          {/* 1. Dashboard */}
          <div className="vendor-menu-item">
            <button 
              className={`vendor-menu-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleNavigate('dashboard')}
            >
              <LayoutDashboard size={19} className="vendor-menu-icon" />
              <span className="vendor-menu-title">Dashboard</span>
            </button>
          </div>

          {/* 2. Products (Expandable Menu with Sub-items: Category, Add product, All products) */}
          <div className="vendor-menu-item">
            <button 
              className={`vendor-menu-btn ${isProductsActive ? 'active' : ''}`}
              onClick={() => {
                setProductsOpen(!productsOpen);
                if (!isProductsActive) handleNavigate('products-all');
              }}
            >
              <Package size={19} className="vendor-menu-icon" />
              <span className="vendor-menu-title">Products</span>
              <ChevronDown 
                size={16} 
                className={`vendor-menu-chevron ${productsOpen ? 'rotated' : ''}`} 
              />
            </button>

            {productsOpen && (
              <div className="vendor-submenu">
                {/* - Category */}
                <button 
                  className={`vendor-submenu-btn ${activeTab === 'products-category' ? 'active' : ''}`}
                  onClick={() => handleNavigate('products-category')}
                >
                  <FolderTree size={16} />
                  <span>Category</span>
                </button>

                {/* - Add product */}
                <button 
                  className={`vendor-submenu-btn ${activeTab === 'products-add' ? 'active' : ''}`}
                  onClick={() => handleNavigate('products-add')}
                >
                  <PlusCircle size={16} />
                  <span>Add product</span>
                </button>

                {/* - All products */}
                <button 
                  className={`vendor-submenu-btn ${activeTab === 'products-all' ? 'active' : ''}`}
                  onClick={() => handleNavigate('products-all')}
                >
                  <Boxes size={16} />
                  <span>All products ({products.length})</span>
                </button>

                {/* - Pending approval */}
                <button 
                  className={`vendor-submenu-btn ${activeTab === 'products-pending' ? 'active' : ''}`}
                  onClick={() => handleNavigate('products-pending')}
                >
                  <AlertCircle size={16} />
                  <span>Pending approval ({pendingProducts.length})</span>
                </button>

                {/* - Rejected by admin */}
                <button 
                  className={`vendor-submenu-btn ${activeTab === 'products-rejected' ? 'active' : ''}`}
                  onClick={() => handleNavigate('products-rejected')}
                >
                  <XCircle size={16} />
                  <span>Rejected ({rejectedProducts.length})</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. Orders */}
          <div className="vendor-menu-item">
            <button 
              className={`vendor-menu-btn ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => handleNavigate('orders')}
            >
              <ShoppingBag size={19} className="vendor-menu-icon" />
              <span className="vendor-menu-title">Orders Received</span>
              {orders.length > 0 && (
                <span className="vendor-badge-count">{orders.length}</span>
              )}
            </button>
          </div>

          {/* 4. Stocks */}
          <div className="vendor-menu-item">
            <button 
              className={`vendor-menu-btn ${activeTab === 'stocks' ? 'active' : ''}`}
              onClick={() => handleNavigate('stocks')}
            >
              <Boxes size={19} className="vendor-menu-icon" />
              <span className="vendor-menu-title">Stocks</span>
            </button>
          </div>

          {/* 5. Reviews */}
          <div className="vendor-menu-item">
            <button 
              className={`vendor-menu-btn ${activeTab === 'reviews' ? 'active' : ''}`}
              onClick={() => handleNavigate('reviews')}
            >
              <Star size={19} className="vendor-menu-icon" />
              <span className="vendor-menu-title">Customer Reviews</span>
              {reviews.length > 0 && (
                <span className="vendor-badge-count">{reviews.length}</span>
              )}
            </button>
          </div>

          {/* 6. Settings */}
          <div className="vendor-menu-item">
            <button 
              className={`vendor-menu-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => handleNavigate('settings')}
            >
              <Settings size={19} className="vendor-menu-icon" />
              <span className="vendor-menu-title">Settings</span>
            </button>
          </div>
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="vendor-sidebar-footer">
          <button className="vendor-logout-btn" onClick={onLogout} title="Sign out of seller account">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="vendor-main">
        {/* Top Header Bar */}
        <header className="vendor-top-header">
          <div className="vendor-header-left">
            <h1>
              {activeTab === 'dashboard' && 'Vendor Dashboard'}
              {activeTab === 'products-category' && 'Product Categories'}
              {activeTab === 'products-add' && 'Add New Product'}
              {activeTab === 'products-all' && 'All Products'}
              {activeTab === 'products-pending' && 'Products Received — Pending Approval'}
              {activeTab === 'products-rejected' && 'Products Rejected by Admin'}
              {activeTab === 'orders' && 'Orders Received'}
              {activeTab === 'stocks' && 'Stock Management'}
              {activeTab === 'reviews' && 'Customer Reviews'}
              {activeTab === 'settings' && 'Vendor Settings'}
            </h1>
            <p>
              {activeTab === 'dashboard' && `Welcome back, ${vendor.name} — Here is your sales & catalog performance overview.`}
              {activeTab === 'products-category' && 'Browse categories and organize your catalog for customers.'}
              {activeTab === 'products-add' && 'Create and list fresh organic items on EcShopping.'}
              {activeTab === 'products-all' && `Manage your existing product listings (${products.length} products).`}
              {activeTab === 'products-pending' && `Products submitted to the admin and awaiting review (${pendingProducts.length}).`}
              {activeTab === 'products-rejected' && `Products the admin did not approve (${rejectedProducts.length}).`}
              {activeTab === 'orders' && `Track orders received for your store (${orders.length} orders). Customer contact details are kept private.`}
              {activeTab === 'stocks' && 'Control which products are in stock and available to customers.'}
              {activeTab === 'reviews' && `Feedback from customers on your products (${reviews.length} reviews).`}
              {activeTab === 'settings' && 'Update your seller profile, contact info, and store preferences.'}
            </p>
          </div>

          <div className="vendor-header-right">
            {vendor.directSelling && (
              <span className="vendor-direct-badge">
                <CheckCircle size={15} /> Direct Selling Approved
              </span>
            )}
            <Link to="/shop" target="_blank" className="vendor-view-shop-btn">
              <span>View Live Shop</span>
              <ExternalLink size={14} />
            </Link>
          </div>
        </header>

        {/* Content Body based on activeTab */}
        <div className="vendor-content-body">
          {editingProductId ? (
            <EditProduct
              productId={editingProductId}
              vendor={vendor}
              onBack={() => setEditingProductId(null)}
              onSaved={() => {
                setEditingProductId(null);
                loadData();
              }}
            />
          ) : (
            <>

          {/* ---------------- 1. DASHBOARD VIEW ---------------- */}
          {activeTab === 'dashboard' && (
            <>
              {/* Stat Cards */}
              <div className="stat-cards-grid">
                <div className="v-stat-card">
                  <div className="v-stat-info">
                    <h3>My Total Sales</h3>
                    <p>₹{vendorRevenue.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="v-stat-icon-wrapper green">
                    <TrendingUp size={24} />
                  </div>
                </div>

                <div className="v-stat-card">
                  <div className="v-stat-info">
                    <h3>Orders Received</h3>
                    <p>{orders.length}</p>
                  </div>
                  <div className="v-stat-icon-wrapper blue">
                    <ShoppingBag size={24} />
                  </div>
                </div>

                <div className="v-stat-card">
                  <div className="v-stat-info">
                    <h3>Active Products</h3>
                    <p>{products.length}</p>
                  </div>
                  <div className="v-stat-icon-wrapper purple">
                    <Boxes size={24} />
                  </div>
                </div>

                <div className="v-stat-card" style={{ cursor: 'pointer' }} onClick={() => handleNavigate('products-category')}>
                  <div className="v-stat-info">
                    <h3>Categories</h3>
                    <p>Manage &rarr;</p>
                  </div>
                  <div className="v-stat-icon-wrapper amber">
                    <FolderTree size={24} />
                  </div>
                </div>
              </div>

              {/* Quick Actions Banner */}
              <div className="v-banner-box">
                <div className="v-banner-content">
                  <h2>Grow Your Farm Storefront 🌿</h2>
                  <p>
                    List fresh vegetables, pure dairy, honey, and handmade organic products directly to customers with zero middlemen.
                  </p>
                </div>
                <div className="v-banner-actions">
                  <button className="btn-primary-action" onClick={() => handleNavigate('products-add')}>
                    <PlusCircle size={17} /> Add Product
                  </button>
                  <button className="btn-secondary-action" onClick={() => handleNavigate('orders')}>
                    <ShoppingBag size={17} /> View Orders ({orders.length})
                  </button>
                </div>
              </div>

              {/* Recent Orders Overview */}
              <div className="products-table-card">
                <div className="table-toolbar">
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Recent Orders Snapshot</h3>
                  <button className="category-add-link" onClick={() => handleNavigate('orders')}>
                    View All Orders &rarr;
                  </button>
                </div>
                <table className="vendor-data-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Products</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 5).map(o => (
                      <tr key={o.id}>
                        <td><strong>{o.id}</strong></td>
                        <td>{(o.vendorItems || o.items || []).length} items</td>
                        <td>
                          <span className={`order-status-badge order-status-${(o.status || 'processing').toLowerCase()}`}>
                            {o.status || 'Processing'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                          No customer orders received yet. New orders will appear here automatically!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ---------------- 2. PRODUCTS: CATEGORY VIEW (Split Component) ---------------- */}
          {activeTab === 'products-category' && (
            <CategoryManager vendor={vendor} />
          )}

          {/* ---------------- 3. PRODUCTS: ADD PRODUCT VIEW (Split Component) ---------------- */}
          {activeTab === 'products-add' && (
            <AddProduct vendor={vendor} />
          )}

          {/* ---------------- 4. PRODUCTS: ALL PRODUCTS VIEW (Split Component) ---------------- */}
          {activeTab === 'products-all' && (
            <AllProducts vendor={vendor} onProductsUpdated={loadData} />
          )}

          {/* ---------------- 4a. PRODUCTS RECEIVED (PENDING ADMIN APPROVAL) ---------------- */}
          {activeTab === 'products-pending' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                <AlertCircle size={16} />
                <span>These products have been received and are waiting for admin approval before they go live.</span>
              </div>
              {renderStatusProductTable(pendingProducts, 'No products are awaiting approval right now.')}
            </>
          )}

          {/* ---------------- 4b. PRODUCTS REJECTED BY ADMIN ---------------- */}
          {activeTab === 'products-rejected' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                <XCircle size={16} />
                <span>These products were rejected by the admin. Update the details and submit a new listing.</span>
              </div>
              {renderStatusProductTable(rejectedProducts, 'No rejected products.')}
            </>
          )}

          {/* ---------------- 4c. STOCK MANAGEMENT ---------------- */}
          {activeTab === 'stocks' && (
            <div className="products-table-card">
              <div className="table-toolbar">
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Stock Levels</h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {approvedProducts.length} live products
                </span>
              </div>
              <table className="vendor-data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Current Stock</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const inStock = p.stockStatus !== 'out_of_stock' && p.inStock !== false;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {p.image && (
                              <img src={p.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} />
                            )}
                            <strong>{p.title || p.name}</strong>
                          </div>
                        </td>
                        <td>{p.category || '—'}</td>
                        <td>₹{Number(p.price) || 0}</td>
                        <td>
                          <span
                            className="order-status-badge"
                            style={inStock
                              ? { background: '#dcfce7', color: '#166534' }
                              : { background: '#fee2e2', color: '#991b1b' }}
                          >
                            {inStock ? 'In stock' : 'Out of stock'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleStockToggle(p)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: '13px',
                              cursor: 'pointer'
                            }}
                          >
                            Mark {inStock ? 'out of stock' : 'in stock'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                        No products to manage yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ---------------- 4d. CUSTOMER REVIEWS ---------------- */}
          {activeTab === 'reviews' && (
            <div className="vendor-reviews-grid">
              {reviewsLoading && (
                <div className="products-table-card" style={{ padding: '28px', textAlign: 'center', color: '#64748b' }}>
                  Loading reviews…
                </div>
              )}
              {!reviewsLoading && reviews.length === 0 && (
                <div className="products-table-card" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  <Star size={34} style={{ marginBottom: '10px', color: '#cbd5e1' }} />
                  <h3 style={{ margin: '0 0 6px', color: '#0f172a' }}>No reviews yet</h3>
                  <p style={{ margin: 0 }}>Customer reviews for your products will appear here.</p>
                </div>
              )}
              {!reviewsLoading && reviews.map((review) => (
                <article key={review.id} className="vendor-review-card">
                  <div className="vendor-review-head">
                    <div>
                      <strong>{review.productTitle || review.title || 'Product'}</strong>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {(review.customerName || 'Customer').split(' ')[0]} · {new Date(review.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="vendor-review-stars" aria-label={`${review.rating} out of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          size={14}
                          fill={n <= review.rating ? 'currentColor' : 'none'}
                          style={{ color: n <= review.rating ? '#f59e0b' : '#cbd5e1' }}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="vendor-review-text">{review.comment}</p>
                </article>
              ))}
            </div>
          )}

          {/* ---------------- 5. ORDERS VIEW ---------------- */}
          {activeTab === 'orders' && (
            <div className="products-table-card">
              <div className="table-toolbar">
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['all', 'processing', 'shipped', 'delivered'].map(status => (
                    <button 
                      key={status}
                      onClick={() => setOrderFilter(status)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: orderFilter === status ? 600 : 500,
                        backgroundColor: orderFilter === status ? '#0f172a' : '#ffffff',
                        color: orderFilter === status ? '#ffffff' : '#475569',
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Total Orders: {filteredOrders.length}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: '8px', margin: '0 18px 14px', fontSize: '13px' }}>
                <CheckCircle size={16} />
                <span>Customer contact and delivery details are protected. EcShopping handles delivery and shares only the items you need to fulfil.</span>
              </div>

              <table className="vendor-data-table">
                <thead>
                  <tr>
                    <th>Order ID & Date</th>
                    <th>Products Ordered</th>
                    <th>Status</th>
                    <th>Update Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => {
                    const itemsForThisVendor = order.vendorItems || order.items || [];
                    const vendorSubtotal = itemsForThisVendor.reduce((sum, item) => {
                      const priceStr = (item.price || '0').toString().replace(/[^0-9.-]+/g, "");
                      const price = parseFloat(priceStr.split('-')[0]) || 0;
                      return sum + (price * item.quantity);
                    }, 0);

                    return (
                      <tr key={order.id}>
                        <td>
                          <strong>{order.id}</strong>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {new Date(order.date).toLocaleDateString()}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {itemsForThisVendor.map((it, idx) => (
                              <div key={idx} style={{ fontSize: '13px' }}>
                                • <strong>{it.title || it.name}</strong> x {it.quantity} - ₹{((parseFloat(String(it.price).replace(/[^0-9.-]+/g, "")) || 0) * it.quantity).toFixed(2)}
                              </div>
                            ))}
                            <div style={{ fontWeight: 600, color: '#166534', marginTop: '4px', fontSize: '13px' }}>
                              Your share: ₹{vendorSubtotal.toFixed(2)}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`order-status-badge order-status-${(order.status || 'processing').toLowerCase()}`}>
                            {order.status || 'Processing'}
                          </span>
                        </td>
                        <td>
                          <select 
                            value={order.status || 'Processing'} 
                            disabled={updatingOrderId === order.id}
                            onChange={(e) => handleOrderStatusChange(order.id, e.target.value)}
                            style={{ 
                              padding: '6px 10px', 
                              borderRadius: '6px', 
                              border: '1px solid #cbd5e1', 
                              fontSize: '13px',
                              backgroundColor: '#ffffff'
                            }}
                          >
                            <option value="Processing">Processing</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                        No orders found for this status.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ---------------- 6. SETTINGS VIEW ---------------- */}
          {activeTab === 'settings' && (
            <div className="settings-container">
              <div className="settings-card">
                <h3 className="settings-card-title">Store & Vendor Profile</h3>
                <p className="settings-card-desc">Keep your farm details and contact information up-to-date.</p>

                {settingsSaved && (
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '10px 16px', borderRadius: '8px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={18} />
                    <span>Settings saved successfully!</span>
                  </div>
                )}

                <form onSubmit={handleSaveSettings}>
                  <div className="form-two-column-grid">
                    <div>
                      <label className="v-input-label">Business / Farm Name</label>
                      <input 
                        type="text" 
                        className="v-input-text" 
                        value={settingsData.name}
                        onChange={e => setSettingsData({ ...settingsData, name: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="v-input-label">Email Address (Read-only)</label>
                      <input 
                        type="email" 
                        className="v-input-text" 
                        value={settingsData.email}
                        disabled
                        style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                      />
                    </div>

                    <div>
                      <label className="v-input-label">Contact Phone</label>
                      <input 
                        type="tel" 
                        className="v-input-text" 
                        value={settingsData.phone}
                        onChange={e => setSettingsData({ ...settingsData, phone: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="v-input-label">Farm / Pickup Location</label>
                      <input 
                        type="text" 
                        className="v-input-text" 
                        value={settingsData.address}
                        onChange={e => setSettingsData({ ...settingsData, address: e.target.value })}
                      />
                    </div>

                    <div className="form-full-column">
                      <label className="v-input-label">Store Bio / Description</label>
                      <textarea 
                        className="v-textarea"
                        value={settingsData.bio}
                        onChange={e => setSettingsData({ ...settingsData, bio: e.target.value })}
                      ></textarea>
                    </div>
                  </div>

                  <div style={{ marginTop: '22px' }}>
                    <button type="submit" className="btn-primary-action">
                      <Check size={16} /> Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

            </>
          )}
        </div>
      </main>
    </div>
  );
}
