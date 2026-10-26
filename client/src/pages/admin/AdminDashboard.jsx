import { useEffect, useState } from 'react';
import {
  LogOut, RefreshCw, CheckCircle, XCircle, Package, Users as UsersIcon,
  ShoppingCart, PackageSearch, ClipboardList, Loader2, Plus, Edit2, Trash2, Video, Film
} from 'lucide-react';
import api from '../../utils/api';
import './AdminDashboard.css';

const ORDER_STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
const fmtINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

/* Reads straight from the Express APIs with the admin token — localStorage
 * caches are never used for admin state, and every mutation is confirmed by
 * the server before the list is refreshed. */
export default function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [state, setState] = useState({ loading: true, error: null, vendors: [], products: [], orders: [], users: [], categories: [], videos: [] });
  const [attempt, setAttempt] = useState(0);
  /* Per-row action bookkeeping: the in-flight action id and its latest error. */
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState({ id: null, message: '' });

  /* Category management form and filter state */
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatVendor, setNewCatVendor] = useState('shared');
  const [newCatStatus, setNewCatStatus] = useState('active');
  const [newCatImage, setNewCatImage] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);
  const [catFormMsg, setCatFormMsg] = useState({ type: null, text: '' });

  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [editCatStatus, setEditCatStatus] = useState('active');
  const [editCatImage, setEditCatImage] = useState('');

  /* Video review management form state */
  const [newVidTitle, setNewVidTitle] = useState('');
  const [newVidDesc, setNewVidDesc] = useState('');
  const [newVidUrl, setNewVidUrl] = useState('');
  const [newVidThumb, setNewVidThumb] = useState('');
  const [newVidProduct, setNewVidProduct] = useState('');
  const [newVidOrder, setNewVidOrder] = useState('0');
  const [creatingVid, setCreatingVid] = useState(false);
  const [vidFormMsg, setVidFormMsg] = useState({ type: null, text: '' });

  const [catSearch, setCatSearch] = useState('');
  const [catScopeFilter, setCatScopeFilter] = useState('all');
  const [catStatusFilter, setCatStatusFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const [vendorRes, productRes, orderRes, userRes, catRes, videoRes] = await Promise.all([
          api.getVendors(),
          api.getProducts({}, 'admin'),
          api.getOrders({}, 'admin'),
          api.getUsers(),
          api.getCategories({}, 'admin'),
          api.getVideos().catch(() => ({ success: true, videos: [] }))
        ]);
        if (cancelled) return;
        if (!vendorRes.success || !productRes.success || !orderRes.success || !userRes.success || !catRes.success) {
          throw new Error(vendorRes.error || productRes.error || orderRes.error || userRes.error || catRes.error || 'Some admin data could not be loaded');
        }
        setState({
          loading: false,
          error: null,
          vendors: vendorRes.vendors || [],
          products: productRes.products || [],
          orders: orderRes.orders || [],
          users: userRes.users || [],
          categories: catRes.categories || [],
          videos: videoRes?.videos || []
        });
      } catch (err) {
        if (cancelled) return;
        if (err?.status === 401 && typeof onLogout === 'function') {
          onLogout();
          return;
        }
        setState((s) => ({ ...s, loading: false, error: err.message || 'Could not reach the server' }));
      }
    })();
    return () => { cancelled = true; };
  }, [attempt, activeTab, onLogout]);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    setCatFormMsg({ type: null, text: '' });
    try {
      const res = await api.createCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim(),
        image: newCatImage.trim() || null,
        status: newCatStatus,
        vendorId: newCatVendor === 'shared' ? null : newCatVendor
      }, 'admin');
      if (res?.success) {
        setNewCatName('');
        setNewCatDesc('');
        setNewCatImage('');
        setNewCatVendor('shared');
        setNewCatStatus('active');
        setCatFormMsg({ type: 'success', text: `Category "${res.category.name}" created successfully!` });
        setAttempt((n) => n + 1);
        setTimeout(() => setCatFormMsg({ type: null, text: '' }), 3000);
      } else {
        setCatFormMsg({ type: 'error', text: res?.error || 'Failed to create category' });
      }
    } catch (err) {
      setCatFormMsg({ type: 'error', text: err?.message || 'Failed to create category' });
    } finally {
      setCreatingCat(false);
    }
  };

  const handleStartEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description || '');
    setEditCatImage(cat.image || '');
    setEditCatStatus(cat.status || 'active');
  };

  const handleSaveEditCategory = async (e) => {
    e.preventDefault();
    if (!editCatName.trim()) return;
    await runRowAction(editingCatId, async () => {
      const res = await api.updateCategory(editingCatId, {
        name: editCatName.trim(),
        description: editCatDesc.trim(),
        image: editCatImage.trim() || null,
        status: editCatStatus
      }, 'admin');
      if (!res?.success) throw new Error(res?.error || 'Failed to update category');
      setEditingCatId(null);
    }, 'Category update failed');
  };


  const handleCreateVideo = async (e) => {
    e.preventDefault();
    if (!newVidTitle.trim() || !newVidUrl.trim() || !newVidProduct) {
      setVidFormMsg({ type: 'error', text: 'Title, Video URL, and attached product are required.' });
      return;
    }
    setCreatingVid(true);
    setVidFormMsg({ type: null, text: '' });
    try {
      const res = await api.createVideo({
        title: newVidTitle.trim(),
        description: newVidDesc.trim(),
        videoUrl: newVidUrl.trim(),
        thumbnailUrl: newVidThumb.trim() || null,
        productId: newVidProduct,
        displayOrder: Number(newVidOrder) || 0
      });
      if (res?.success) {
        setNewVidTitle('');
        setNewVidDesc('');
        setNewVidUrl('');
        setNewVidThumb('');
        setNewVidProduct('');
        setNewVidOrder('0');
        setVidFormMsg({ type: 'success', text: 'Video review added successfully!' });
        setAttempt((n) => n + 1);
        setTimeout(() => setVidFormMsg({ type: null, text: '' }), 3000);
      } else {
        setVidFormMsg({ type: 'error', text: res?.error || 'Failed to add video' });
      }
    } catch (err) {
      setVidFormMsg({ type: 'error', text: err?.message || 'Failed to add video' });
    } finally {
      setCreatingVid(false);
    }
  };

  const handleToggleVideoStatus = async (vid) => {
    const nextStatus = vid.status === 'active' ? 'inactive' : 'active';
    await runRowAction(vid.id, async () => {
      const res = await api.updateVideo(vid.id, { status: nextStatus });
      if (!res?.success) throw new Error(res?.error || 'Failed to update video status');
    }, 'Failed to toggle video status');
  };

  const handleDeleteVideo = async (vidId) => {
    if (!window.confirm('Delete this video review?')) return;
    await runRowAction(vidId, async () => {
      const res = await api.deleteVideo(vidId);
      if (!res?.success) throw new Error(res?.error || 'Failed to delete video');
    }, 'Failed to delete video');
  };

  const handleDeleteProduct = async (prod) => {
    if (!window.confirm(`Are you sure you want to delete product "${prod.title}"?`)) return;
    await runRowAction(prod.id, async () => {
      const res = await api.deleteProduct(prod.id, 'admin');
      if (!res?.success) throw new Error(res?.error || 'Failed to delete product');
    }, 'Failed to delete product');
  };

  const filteredCategories = state.categories.filter((cat) => {
    const matchesSearch = (cat.name || '').toLowerCase().includes(catSearch.toLowerCase()) ||
                          (cat.description || '').toLowerCase().includes(catSearch.toLowerCase());
    const matchesScope =
      catScopeFilter === 'all' ||
      (catScopeFilter === 'shared' && !cat.vendorId) ||
      (catScopeFilter === 'vendor' && !!cat.vendorId);
    const matchesStatus =
      catStatusFilter === 'all' ||
      cat.status === catStatusFilter;
    return matchesSearch && matchesScope && matchesStatus;
  });

  const runRowAction = async (id, action, failMessage) => {
    setBusyId(id);
    setActionError({ id: null, message: '' });
    try {
      await action();
      setAttempt((n) => n + 1); // single authoritative refresh from the server
    } catch (err) {
      setActionError({ id, message: err?.message ? `${failMessage}: ${err.message}` : failMessage });
    } finally {
      setBusyId(null);
    }
  };

  const retry = () => setAttempt((n) => n + 1);

  const pendingProducts = state.products.filter((p) => p.status === 'pending');
  const pendingVendors = state.vendors.filter((v) => v.status === 'pending');
  const grossOrderTotal = state.orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  const refreshBtn = (
    <button type="button" className="approve-btn" onClick={retry} title="Refresh from the server">
      <RefreshCw size={15} /> Refresh
    </button>
  );

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <h2>EcShopping Admin</h2>
        </div>
        <nav className="admin-nav">
          {[
            ['dashboard', 'Dashboard', null],
            ['categories', 'Categories', state.categories.length],
            ['orders', 'Orders', state.orders.length],
            ['vendors', 'Vendors', state.vendors.length],
            ['products', 'Products', state.products.length],
            ['videos', 'Video Reviews', (state.videos || []).length],
            ['customers', 'Customers', state.users.length]
          ].map(([key, label, count]) => (
            <a
              key={key}
              href="#"
              className={activeTab === key ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); setActiveTab(key); }}
            >
              {label}{count != null ? ` (${count})` : ''}
            </a>
          ))}
        </nav>
        <button className="admin-logout-btn" onClick={onLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <h1>
            {activeTab === 'dashboard' && 'Dashboard overview'}
            {activeTab === 'categories' && 'Category & Taxonomy Management'}
            {activeTab === 'orders' && 'All customer orders'}
            {activeTab === 'vendors' && 'Vendor management'}
            {activeTab === 'products' && 'Product approvals'}
            {activeTab === 'customers' && 'Customer accounts'}
            {activeTab === 'videos' && 'Homepage Shorts & Video Reviews'}
          </h1>
        </header>

        {state.error && (
          <div className="admin-content">
            <div className="vendors-section-pad admin-error-box" role="alert">
              <h3>Admin data could not be loaded</h3>
              <p>{state.error}</p>
              <button type="button" className="approve-btn" onClick={retry}>
                <RefreshCw size={15} /> Try again
              </button>
            </div>
          </div>
        )}

        {state.loading && (
          <div className="admin-content">
            <p className="admin-loading-note" role="status" aria-busy="true">
              <Loader2 size={16} className="spin" /> Loading admin data from the server…
            </p>
          </div>
        )}

        {!state.loading && !state.error && (
          <div className="admin-content">
            {activeTab === 'dashboard' && (
              <>
                <div className="stat-cards">
                  <div className="stat-card">
                    <h3><ShoppingCart size={16} /> Orders</h3>
                    <p>{state.orders.length}</p>
                  </div>
                  <div className="stat-card">
                    <h3><ClipboardList size={16} /> Gross order total</h3>
                    <p>{fmtINR(grossOrderTotal)}</p>
                    <small>Sum of every order row, including not-yet-paid ones</small>
                  </div>
                  <div className="stat-card">
                    <h3><PackageSearch size={16} /> Products awaiting approval</h3>
                    <p>{pendingProducts.length}</p>
                  </div>
                  <div className="stat-card">
                    <h3><UsersIcon size={16} /> Vendors awaiting approval</h3>
                    <p>{pendingVendors.length}</p>
                  </div>
                </div>

                <div className="admin-placeholder-box" style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '25px' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>Quick actions</h3>
                  <p style={{ color: '#64748b', margin: '0 0 15px 0' }}>
                    {pendingProducts.length} product{pendingProducts.length === 1 ? '' : 's'} and{' '}
                    {pendingVendors.length} vendor account{pendingVendors.length === 1 ? '' : 's'} are waiting for review.
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {refreshBtn}
                    <button type="button" className="approve-btn" onClick={() => setActiveTab('products')}>
                      <Package size={15} /> Review products
                    </button>
                    <button type="button" className="approve-btn" onClick={() => setActiveTab('vendors')}>
                      <UsersIcon size={15} /> Review vendors
                    </button>
                  </div>
                </div>
              </>
            )}


            {activeTab === 'categories' && (
              <div className="admin-cat-section-wrap">
                {/* 1. Category Creation Form */}
                <div className="admin-cat-form-card">
                  <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#0f172a' }}>
                    <Plus size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />
                    Create New Category
                  </h3>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                    Shared categories are visible across the entire storefront and can be used by all vendors.
                  </p>

                  {catFormMsg.text && (
                    <div style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      marginBottom: 14,
                      fontSize: 13,
                      background: catFormMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
                      color: catFormMsg.type === 'success' ? '#166534' : '#991b1b',
                      border: catFormMsg.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca'
                    }}>
                      {catFormMsg.text}
                    </div>
                  )}

                  <form onSubmit={handleCreateCategory} className="admin-cat-form-grid">
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Category Name *
                      </label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        placeholder="e.g. Fresh Dairy"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Description
                      </label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        placeholder="Short blurb for shoppers..."
                        value={newCatDesc}
                        onChange={(e) => setNewCatDesc(e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Image URL
                      </label>
                      <input
                        type="url"
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        placeholder="https://... (Optional)"
                        value={newCatImage}
                        onChange={(e) => setNewCatImage(e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Scope / Owner
                      </label>
                      <select
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        value={newCatVendor}
                        onChange={(e) => setNewCatVendor(e.target.value)}
                      >
                        <option value="shared">Shared (Global)</option>
                        {state.vendors.map((v) => (
                          <option key={v.id} value={v.id}>Vendor: {v.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Status
                      </label>
                      <select
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        value={newCatStatus}
                        onChange={(e) => setNewCatStatus(e.target.value)}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="approve-btn"
                        disabled={creatingCat}
                        style={{ height: 36, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        {creatingCat ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                        <span>Add Category</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* 2. Filter & Search Toolbar */}
                <div className="admin-filter-bar">
                  <input
                    type="text"
                    className="admin-filter-input"
                    placeholder="Search categories..."
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                  />
                  <select
                    className="admin-filter-input"
                    value={catScopeFilter}
                    onChange={(e) => setCatScopeFilter(e.target.value)}
                  >
                    <option value="all">All Scopes</option>
                    <option value="shared">Shared (Global) only</option>
                    <option value="vendor">Vendor-specific only</option>
                  </select>
                  <select
                    className="admin-filter-input"
                    value={catStatusFilter}
                    onChange={(e) => setCatStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active only</option>
                    <option value="inactive">Inactive only</option>
                  </select>
                  <span style={{ fontSize: 13, color: '#64748b', marginLeft: 'auto' }}>
                    Showing {filteredCategories.length} of {state.categories.length} categories
                  </span>
                </div>

                {/* 3. Categories Listing Table */}
                <div className="vendors-table-container">
                  <table className="vendors-table">
                    <thead>
                      <tr>
                        <th>Category Name</th>
                        <th>Scope / Owner</th>
                        <th>Description</th>
                        <th>Assigned Products</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCategories.map((cat) => {
                        const isEditing = editingCatId === cat.id;
                        const ownerVendor = cat.vendorId ? state.vendors.find((v) => String(v.id) === String(cat.vendorId)) : null;

                        if (isEditing) {
                          return (
                            <tr key={cat.id} style={{ background: '#f8fafc' }}>
                              <td>
                                <input
                                  type="text"
                                  className="admin-filter-input"
                                  value={editCatName}
                                  onChange={(e) => setEditCatName(e.target.value)}
                                  style={{ width: '100%', boxSizing: 'border-box' }}
                                  required
                                />
                              </td>
                              <td>
                                <span className={cat.vendorId ? 'cat-scope-badge cat-scope-vendor' : 'cat-scope-badge cat-scope-shared'}>
                                  {cat.vendorId ? (ownerVendor ? `Vendor: ${ownerVendor.name}` : `Vendor: ${cat.vendorId}`) : 'Shared (Global)'}
                                </span>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="admin-filter-input"
                                  value={editCatDesc}
                                  onChange={(e) => setEditCatDesc(e.target.value)}
                                  style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                              </td>
                              <td>{cat.productsCount || 0} products</td>
                              <td>
                                <select
                                  className="admin-filter-input"
                                  value={editCatStatus}
                                  onChange={(e) => setEditCatStatus(e.target.value)}
                                >
                                  <option value="active">Active</option>
                                  <option value="inactive">Inactive</option>
                                </select>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    className="approve-btn"
                                    onClick={handleSaveEditCategory}
                                    disabled={busyId === cat.id}
                                    style={{ padding: '4px 10px', fontSize: 12 }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCatId(null)}
                                    style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #cbd5e1', background: '#fff', borderRadius: 6, cursor: 'pointer' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={cat.id}>
                            <td>
                              <strong>{cat.name}</strong>
                              {busyId === cat.id && <Loader2 size={13} className="spin" style={{ marginLeft: 6 }} />}
                            </td>
                            <td>
                              <span className={cat.vendorId ? 'cat-scope-badge cat-scope-vendor' : 'cat-scope-badge cat-scope-shared'}>
                                {cat.vendorId ? (ownerVendor ? `Vendor: ${ownerVendor.name}` : `Vendor: ${cat.vendorId}`) : 'Shared (Global)'}
                              </span>
                            </td>
                            <td style={{ color: cat.description ? '#334155' : '#94a3b8', fontSize: 13 }}>
                              {cat.description || '—'}
                            </td>
                            <td>
                              <span style={{ fontWeight: 600, color: (cat.productsCount || 0) > 0 ? '#166534' : '#64748b' }}>
                                {cat.productsCount || 0} product{(cat.productsCount || 0) === 1 ? '' : 's'}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${cat.status === 'active' ? 'status-approved' : 'status-rejected'}`}>
                                {String(cat.status || 'active').toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditCategory(cat)}
                                  disabled={busyId === cat.id}
                                  title="Edit category"
                                  style={{ padding: '5px 10px', fontSize: 12, border: '1px solid #cbd5e1', background: '#fff', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                >
                                  <Edit2 size={12} /> Edit
                                </button>
                                <button
                                  type="button"
                                  className={cat.status === 'active' ? 'reject-btn' : 'approve-btn'}
                                  disabled={busyId === cat.id}
                                  onClick={() => runRowAction(
                                    cat.id,
                                    () => api.updateCategory(cat.id, { status: cat.status === 'active' ? 'inactive' : 'active' }, 'admin'),
                                    'Status toggle failed'
                                  )}
                                  style={{ padding: '5px 10px', fontSize: 12 }}
                                >
                                  {cat.status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  type="button"
                                  className="reject-btn"
                                  disabled={busyId === cat.id}
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
                                      runRowAction(cat.id, () => api.deleteCategory(cat.id, 'admin'), 'Delete failed');
                                    }
                                  }}
                                  title="Delete category"
                                  style={{ padding: '5px 8px', fontSize: 12 }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredCategories.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                            No categories found matching your criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'vendors' && (
              <div className="admin-vendors-section">
                <div className="vendors-header">
                  <h2>Registered vendors</h2>
                  <p>Approved, rejected and pending vendor accounts live in the database</p>
                </div>

                <div className="vendors-table-container">
                  <table className="vendors-table">
                    <thead>
                      <tr>
                        <th>Name</th><th>Email</th><th>Joined</th><th>Status</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.vendors.map((vendor) => (
                        <tr key={vendor.id}>
                          <td>{vendor.name}{busyId === vendor.id && <Loader2 size={13} className="spin" style={{ marginLeft: 6 }} />}</td>
                          <td>{vendor.email}</td>
                          <td style={{ fontSize: '13px', color: '#64748b' }}>
                            {vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td>
                            <span className={`status-badge status-${vendor.status}`}>
                              {String(vendor.status || 'pending').toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {vendor.status === 'pending' && (
                              <div className="action-buttons">
                                <button
                                  type="button"
                                  className="approve-btn"
                                  disabled={busyId === vendor.id}
                                  onClick={() => runRowAction(vendor.id, () => api.updateVendorStatus(vendor.id, 'approved'), 'Vendor approval failed')}
                                >
                                  <CheckCircle size={17} /> Approve
                                </button>
                                <button
                                  type="button"
                                  className="reject-btn"
                                  disabled={busyId === vendor.id}
                                  onClick={() => runRowAction(vendor.id, () => api.updateVendorStatus(vendor.id, 'rejected'), 'Vendor rejection failed')}
                                >
                                  <XCircle size={17} /> Reject
                                </button>
                              </div>
                            )}
                            {vendor.status === 'approved' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span className="text-muted">Approved</span>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(vendor.directSelling)}
                                    disabled={busyId === vendor.id}
                                    onChange={() => runRowAction(
                                      vendor.id,
                                      () => api.updateVendorDirectSelling(vendor.id, !vendor.directSelling),
                                      'Direct-selling update failed'
                                    )}
                                  />
                                  Direct selling
                                </label>
                              </div>
                            )}
                            {vendor.status === 'rejected' && <span className="text-muted">Rejected</span>}
                          </td>
                        </tr>
                      ))}
                      {state.vendors.length === 0 && (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No vendor accounts exist yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div className="admin-vendors-section">
                <div className="vendors-header">
                  <h2>Product approvals</h2>
                  <p>Vendor submissions from the database — approve to list, reject to keep hidden</p>
                </div>

                <div className="vendors-table-container">
                  <table className="vendors-table">
                    <thead>
                      <tr><th>Image</th><th>Title & vendor</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {state.products.map((product) => (
                        <tr key={product.id}>
                          <td>
                            {product.image
                              ? <img src={product.image} alt="" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '5px' }} />
                              : <span className="text-muted">No image</span>}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{product.title}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              {product.vendorName || 'Vendor name missing'}
                            </div>
                          </td>
                          <td>{fmtINR(product.price)}</td>
                          <td style={{ fontSize: '13px' }}>
                            <span className={`status-badge status-${product.stockStatus === 'out_of_stock' ? 'rejected' : 'approved'}`}>
                              {product.stockStatus === 'out_of_stock' ? 'Out of stock' : 'In stock'}
                            </span>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: 2 }}>
                              {product.stockQuantity != null ? `${product.stockQuantity} units` : '—'}
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge status-${product.status}`}>
                              {String(product.status || 'pending').toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {product.status === 'pending' ? (
                                <>
                                  <button
                                    type="button"
                                    className="approve-btn"
                                    disabled={busyId === product.id}
                                    onClick={() => runRowAction(product.id, () => api.updateProductStatus(product.id, 'approved'), 'Product approval failed')}
                                  >
                                    <CheckCircle size={14} /> Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="reject-btn"
                                    disabled={busyId === product.id}
                                    onClick={() => runRowAction(product.id, () => api.updateProductStatus(product.id, 'rejected'), 'Product rejection failed')}
                                  >
                                    <XCircle size={14} /> Reject
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="reject-btn"
                                  disabled={busyId === product.id}
                                  onClick={() => runRowAction(product.id, () => api.updateProductStatus(product.id, 'pending'), 'Status reset failed')}
                                  title="Move back to pending for another review"
                                >
                                  Re-review
                                </button>
                              )}
                              <button
                                type="button"
                                className="delete-btn"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  color: '#dc2626',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                                disabled={busyId === product.id}
                                onClick={() => handleDeleteProduct(product)}
                                title={`Delete product "${product.title}"`}
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {state.products.length === 0 && (
                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No products have been submitted yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="admin-vendors-section">
                <div className="vendors-header">
                  <h2>All orders placed</h2>
                  <p>Server rows with per-vendor line items — update fulfilment status</p>
                </div>

                <div className="vendors-table-container">
                  <table className="vendors-table">
                    <thead>
                      <tr><th>Order id</th><th>Date</th><th>Customer</th><th>Items & vendors</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {state.orders.map((order) => (
                        <tr key={order.id}>
                          <td><strong>{order.id}</strong></td>
                          <td style={{ fontSize: '13px', color: '#64748b' }}>
                            {order.date ? new Date(order.date).toLocaleString() : '—'}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{order.customerName || 'Guest'}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{order.customerEmail || 'Guest checkout'}</div>
                            {order.customerPhone && <div style={{ fontSize: '12px', color: '#64748b' }}>{order.customerPhone}</div>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {(order.items || []).map((it, idx) => (
                                <div key={it.id || idx} style={{ fontSize: '13px' }}>
                                  • <strong>{it.title}</strong> × {it.quantity}
                                  <span style={{ color: '#059669', marginLeft: '6px', fontSize: '12px', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>
                                    Vendor: {it.vendorName || 'Not recorded'}
                                  </span>
                                </div>
                              ))}
                              {!(order.items || []).length && <span className="text-muted">No line items recorded</span>}
                            </div>
                          </td>
                          <td><strong style={{ color: '#0f172a' }}>{fmtINR(order.totalAmount)}</strong></td>
                          <td style={{ fontSize: '12px' }}>
                            {order.paymentStatus
                              ? <span className={`status-badge status-payment-${order.paymentStatus}`}>{order.paymentStatus}</span>
                              : <span className="text-muted">Pending</span>}
                            <div className="text-muted">{order.paymentMethod || 'unpaid'}</div>
                          </td>
                          <td>
                            <span className={`status-badge status-${(order.status || 'processing').toLowerCase()}`}>
                              {order.status || 'Processing'}
                            </span>
                          </td>
                          <td>
                            <select
                              value={order.status || 'Processing'}
                              disabled={busyId === order.id}
                              onChange={(e) => runRowAction(order.id, () => api.updateOrderStatus(order.id, e.target.value, 'admin'), 'Fulfilment update failed')}
                              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                            >
                              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                      {state.orders.length === 0 && (
                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '25px', color: '#64748b' }}>No orders have been placed yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            
            {activeTab === 'videos' && (
              <div className="admin-cat-section-wrap">
                {/* 1. Add Video Review Form */}
                <div className="admin-cat-form-card">
                  <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#0f172a' }}>
                    <Plus size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />
                    Add Video Review or Short
                  </h3>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                    Active videos appear in the 9:16 vertical reels rail on the homepage, linked to your approved products.
                  </p>

                  {vidFormMsg.text && (
                    <div style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      marginBottom: 14,
                      fontSize: 13,
                      background: vidFormMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
                      color: vidFormMsg.type === 'success' ? '#166534' : '#991b1b',
                      border: vidFormMsg.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca'
                    }}>
                      {vidFormMsg.text}
                    </div>
                  )}

                  <form onSubmit={handleCreateVideo} className="admin-cat-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)) auto' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Video Title *
                      </label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        placeholder="e.g. Traditional A2 Ghee Churning"
                        value={newVidTitle}
                        onChange={(e) => setNewVidTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Video URL (MP4 or YouTube) *
                      </label>
                      <input
                        type="url"
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        placeholder="https://...mp4 or YouTube URL"
                        value={newVidUrl}
                        onChange={(e) => setNewVidUrl(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Thumbnail Poster URL
                      </label>
                      <input
                        type="url"
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        placeholder="https://... (Optional for YouTube)"
                        value={newVidThumb}
                        onChange={(e) => setNewVidThumb(e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Attached Product *
                      </label>
                      <select
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        value={newVidProduct}
                        onChange={(e) => setNewVidProduct(e.target.value)}
                        required
                      >
                        <option value="">Select an approved product...</option>
                        {state.products.filter(p => p.status === 'approved').map((p) => (
                          <option key={p.id} value={p.id}>{p.title} (₹{p.price})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Display Order
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        value={newVidOrder}
                        onChange={(e) => setNewVidOrder(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={creatingVid}
                      style={{
                        padding: '9px 18px',
                        background: '#0e5c4a',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {creatingVid ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                      Add Video
                    </button>
                  </form>
                </div>

                {/* 2. Video Reviews Table */}
                <div className="admin-cat-section">
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: 80 }}>Thumbnail</th>
                          <th>Title</th>
                          <th>Attached Product</th>
                          <th>Order</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(state.videos || []).map((vid) => (
                          <tr key={vid.id}>
                            <td>
                              <img
                                src={vid.thumbnailUrl || '/placeholder.png'}
                                alt=""
                                style={{ width: 44, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }}
                                onError={(e) => { e.currentTarget.src = '/placeholder.png'; }}
                              />
                            </td>
                            <td>
                              <strong>{vid.title}</strong>
                              {vid.description && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{vid.description}</p>}
                            </td>
                            <td>
                              {vid.productTitle ? (
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#0e5c4a' }}>
                                  {vid.productTitle} (₹{vid.productPrice})
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>None</span>
                              )}
                            </td>
                            <td>{vid.displayOrder}</td>
                            <td>
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                background: vid.status === 'active' ? '#dcfce7' : '#f1f5f9',
                                color: vid.status === 'active' ? '#166534' : '#64748b'
                              }}>
                                {vid.status === 'active' ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="approve-btn"
                                style={{
                                  background: vid.status === 'active' ? '#fef3c7' : '#dcfce7',
                                  color: vid.status === 'active' ? '#92400e' : '#166534',
                                  border: 'none',
                                  padding: '5px 10px',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  marginRight: 8,
                                  fontSize: 12,
                                  fontWeight: 600
                                }}
                                disabled={busyId === vid.id}
                                onClick={() => handleToggleVideoStatus(vid)}
                              >
                                {busyId === vid.id ? 'Saving...' : vid.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                className="reject-btn"
                                style={{
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  border: 'none',
                                  padding: '5px 10px',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 600
                                }}
                                disabled={busyId === vid.id}
                                onClick={() => handleDeleteVideo(vid.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!state.videos || state.videos.length === 0) && (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                              No video reviews or shorts added yet. Use the form above to add your first video!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="admin-vendors-section">
                <div className="vendors-header">
                  <h2>Registered customers</h2>
                  <p>Accounts from the users table — credentials are never displayed</p>
                </div>

                <div className="vendors-table-container">
                  <table className="vendors-table">
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Phone</th><th>Registered on</th></tr>
                    </thead>
                    <tbody>
                      {state.users.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.name}</strong></td>
                          <td>{c.email}</td>
                          <td>{c.phone || '—'}</td>
                          <td style={{ fontSize: '13px', color: '#64748b' }}>
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                      {state.users.length === 0 && (
                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '25px', color: '#64748b' }}>No registered customer accounts yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {actionError.id && (
          <div className="admin-content">
            <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: 16, color: '#c2410c', marginTop: 16 }}>
              <strong>{actionError.message}</strong>
              <br />
              <small>Nothing changed — the server rejected the update. Try again once the issue is resolved.</small>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}