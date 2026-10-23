import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  PlusCircle,
  Search,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  List,
  Eye,
  Edit3,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
  Tag,
  Percent,
  Layers,
  ShoppingBag,
  ExternalLink,
  RotateCcw,
  Sparkles,
  TrendingUp,
  PackageCheck,
  PackageX
} from 'lucide-react';
import api from '../../utils/api';
import {
  getProducts,
  deleteProduct,
  updateProduct,
  syncProductsFromServer
} from '../../utils/storage';
import './AllProducts.css';

export default function AllProducts({ vendor, onProductsUpdated }) {
  const navigate = useNavigate();

  // Products and Categories
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // Modals state
  const [previewProduct, setPreviewProduct] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  /* Row-level server action bookkeeping: buttons stay honest while a mutation
   * is in flight and API failures are surfaced instead of silently lost. */
  const [busyId, setBusyId] = useState(null);

  // Toast state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Load products from storage
  const loadVendorProducts = () => {
    if (!vendor) return;
    const all = getProducts();
    const vendorProds = all.filter(
      p => p.vendorId === vendor.id || (p.soldBy && p.soldBy.toLowerCase() === vendor.name.toLowerCase())
    );
    setProducts(vendorProds);
    if (typeof onProductsUpdated === 'function') {
      onProductsUpdated();
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Vendor token widens the sync to the vendor's own pending listings.
      await syncProductsFromServer('vendor');
      if (!cancelled) loadVendorProducts();
    })();
    return () => { cancelled = true; };
  }, [vendor?.id]);

  // Load categories for filter
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await api.getCategories({ vendorId: vendor?.id || '' });
        if (data?.success && Array.isArray(data.categories)) {
          setCategories(data.categories);
          return;
        }
        setCategories(distinctFromProducts());
      } catch {
        // Fallback to distinct product categories
        setCategories(distinctFromProducts());
      }
    };
    const distinctFromProducts = () => {
      const all = getProducts();
      const scoped = all.filter(p => p.vendorId === vendor?.id);
      return [...new Set(scoped.map(p => p.category).filter(Boolean))].map(name => ({ id: name, name }));
    };
    fetchCategories();
  }, [vendor?.id, products.length]);

  // Toggle in-stock / out-of-stock — server-confirmed before the UI believes it.
  const handleToggleStock = (product) => {
    if (!vendor || busyId === product.id) return;
    if (!product) return;
    // Only the server's stockStatus drives availability; rewrite it there.
    const serverStatus = product.stockStatus === 'out_of_stock'
      ? 'in_stock'
      : product.stockStatus === 'in_stock' ? 'out_of_stock'
        : (product.inStock === false ? 'in_stock' : 'out_of_stock');

    setBusyId(product.id);
    (async () => {
      try {
        await api.updateProduct(product.id, { stockStatus: serverStatus });
        updateProduct(product.id, { stockStatus: serverStatus, inStock: serverStatus === 'in_stock' });
        loadVendorProducts();
        showToast(`"${product.title || product.name}" marked as ${serverStatus === 'in_stock' ? 'In Stock 🟢' : 'Out of Stock 🔴'}`, 'success');
      } catch (err) {
        showToast(err?.message || 'The stock update was not accepted by the server', 'error');
      } finally {
        setBusyId(null);
      }
    })();
  };

  // Delete handler — server-confirmed; local cache is only updated afterwards.
  const confirmDelete = async () => {
    if (!deleteCandidate || busyId === deleteCandidate.id) return;
    const candidate = deleteCandidate;
    setBusyId(candidate.id);
    try {
      await api.deleteProduct(candidate.id);
      deleteProduct(candidate.id);
      loadVendorProducts();
      showToast(`Product "${candidate.title || candidate.name}" deleted`, 'success');
    } catch (err) {
      showToast(err?.message || 'The server did not confirm the deletion', 'error');
    } finally {
      setBusyId(null);
      setDeleteCandidate(null);
    }
  };

  // Edit form save handler — server update is awaited first; the local cache
  // is only mutated after the API accepts the change.
  const [savingEdit, setSavingEdit] = useState(false);
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingProduct || savingEdit) return;

    if (!editingProduct.title?.trim()) {
      showToast('Product title cannot be empty', 'error');
      return;
    }

    const price = parseFloat(editingProduct.price);
    if (isNaN(price) || price <= 0) {
      showToast('Please enter a valid price', 'error');
      return;
    }

    const updates = {
      title: editingProduct.title.trim(),
      name: editingProduct.title.trim(),
      price: price,
      strikePrice: editingProduct.strikePrice ? parseFloat(editingProduct.strikePrice) : null,
      category: editingProduct.category || 'General',
      unit: editingProduct.unit || '1 unit',
      description: editingProduct.description || '',
      stockStatus: editingProduct.stockStatus || 'in_stock'
    };

    setSavingEdit(true);
    try {
      await api.updateProduct(editingProduct.id, updates);
      updateProduct(editingProduct.id, {
        ...updates,
        inStock: updates.stockStatus !== 'out_of_stock'
      });
      loadVendorProducts();
      showToast(`Product "${updates.title}" updated successfully!`, 'success');
      setEditingProduct(null);
    } catch (err) {
      showToast(err?.message || 'The server did not accept the update', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Filter & Sort Logic
  const filteredProducts = products.filter(p => {
    const titleMatch = (p.title || p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const catMatch = (p.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = titleMatch || catMatch;

    const matchesCategory = selectedCategory === 'all' || (p.category || '').toLowerCase() === selectedCategory.toLowerCase();

    const isItemInStock = p.stockStatus === 'in_stock' || p.inStock === true || p.inStock === undefined;
    const matchesStock = 
      stockFilter === 'all' || 
      (stockFilter === 'in_stock' && isItemInStock) || 
      (stockFilter === 'out_of_stock' && !isItemInStock);

    return matchesSearch && matchesCategory && matchesStock;
  }).sort((a, b) => {
    if (sortBy === 'price_asc') return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
    if (sortBy === 'price_desc') return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
    if (sortBy === 'name_asc') return (a.title || a.name || '').localeCompare(b.title || b.name || '');
    // Default newest
    return (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0));
  });

  // KPI counts
  const totalCount = products.length;
  const inStockCount = products.filter(p => p.stockStatus === 'in_stock' || p.inStock === true || p.inStock === undefined).length;
  const outOfStockCount = products.filter(p => p.stockStatus === 'out_of_stock' || p.inStock === false).length;
  const distinctCategoriesCount = new Set(products.map(p => p.category).filter(Boolean)).size;

  return (
    <div className="all-prod-root">
      {/* Floating Toast Notification */}
      {toast && (
        <div className="all-prod-toast-wrap">
          <div className={`all-prod-toast-item ${toast.type}`}>
            {toast.type === 'success' && <CheckCircle size={18} className="all-prod-toast-icon" />}
            {toast.type === 'error' && <AlertCircle size={18} className="all-prod-toast-icon" />}
            <span className="all-prod-toast-text">{toast.message}</span>
            <button 
              type="button" 
              className="all-prod-toast-dismiss"
              onClick={() => setToast(null)}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* 1. TOP SUMMARY KPI CARDS */}
      <div className="all-prod-kpi-grid">
        <div className="all-prod-kpi-card">
          <div className="kpi-info">
            <span className="kpi-label">Total Listed</span>
            <h3 className="kpi-value">{totalCount}</h3>
            <span className="kpi-sub">Products in catalog</span>
          </div>
          <div className="kpi-icon-badge purple">
            <Boxes size={22} />
          </div>
        </div>

        <div className="all-prod-kpi-card">
          <div className="kpi-info">
            <span className="kpi-label">In Stock</span>
            <h3 className="kpi-value text-green">{inStockCount}</h3>
            <span className="kpi-sub">Ready for purchase</span>
          </div>
          <div className="kpi-icon-badge green">
            <PackageCheck size={22} />
          </div>
        </div>

        <div className="all-prod-kpi-card">
          <div className="kpi-info">
            <span className="kpi-label">Out of Stock</span>
            <h3 className="kpi-value text-amber">{outOfStockCount}</h3>
            <span className="kpi-sub">Needs replenishment</span>
          </div>
          <div className="kpi-icon-badge amber">
            <PackageX size={22} />
          </div>
        </div>

        <div className="all-prod-kpi-card cta-card" onClick={() => navigate('/vendor/products/add')}>
          <div className="kpi-info">
            <span className="kpi-label">Catalog Quick Action</span>
            <h3 className="kpi-value cta-text">+ Add Product</h3>
            <span className="kpi-sub">Upload image & publish</span>
          </div>
          <div className="kpi-icon-badge emerald">
            <PlusCircle size={22} />
          </div>
        </div>
      </div>

      {/* 2. SEARCH, FILTER & TOOLBAR CONTROLS */}
      <div className="all-prod-toolbar-card">
        <div className="toolbar-left-group">
          {/* Search bar */}
          <div className="all-prod-search-box">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              className="all-prod-search-input"
              placeholder="Search product name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                type="button" 
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="all-prod-select-wrap">
            <Filter size={15} className="select-icon" />
            <select 
              className="all-prod-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories ({distinctCategoriesCount})</option>
              {categories.map((cat, idx) => (
                <option key={cat.id || idx} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Stock Filter */}
          <div className="all-prod-select-wrap">
            <Layers size={15} className="select-icon" />
            <select 
              className="all-prod-select"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="all">All Stock Status</option>
              <option value="in_stock">In Stock ({inStockCount})</option>
              <option value="out_of_stock">Out of Stock ({outOfStockCount})</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="all-prod-select-wrap">
            <ArrowUpDown size={15} className="select-icon" />
            <select 
              className="all-prod-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">Name: A to Z</option>
            </select>
          </div>
        </div>

        <div className="toolbar-right-group">
          {/* View Mode Switcher */}
          <div className="all-prod-view-toggle">
            <button 
              type="button" 
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <List size={17} />
            </button>
            <button 
              type="button" 
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Card Grid View"
            >
              <LayoutGrid size={17} />
            </button>
          </div>

          {/* Add Product Button */}
          <button 
            type="button" 
            className="all-prod-add-btn"
            onClick={() => navigate('/vendor/products/add')}
          >
            <PlusCircle size={16} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* 3. PRODUCTS CONTENT (TABLE OR GRID) */}
      {filteredProducts.length === 0 ? (
        /* Empty State */
        <div className="all-prod-empty-box">
          <div className="empty-icon-circle">
            <Boxes size={42} />
          </div>
          {products.length === 0 ? (
            <>
              <h3>No products listed yet</h3>
              <p>Start adding your organic, farm-fresh items to your storefront.</p>
              <button 
                type="button" 
                className="all-prod-add-btn"
                onClick={() => navigate('/vendor/products/add')}
              >
                <PlusCircle size={16} />
                <span>Add Your First Product</span>
              </button>
            </>
          ) : (
            <>
              <h3>No matching products found</h3>
              <p>No products match your search or filter criteria. Try resetting filters.</p>
              <button 
                type="button" 
                className="empty-reset-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setStockFilter('all');
                  setSortBy('newest');
                }}
              >
                <RotateCcw size={15} />
                <span>Reset All Filters</span>
              </button>
            </>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="all-prod-table-card">
          <div className="table-meta-header">
            <span className="results-count-text">
              Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> products
            </span>
          </div>

          <div className="table-responsive-wrapper">
            <table className="all-prod-table">
              <thead>
                <tr>
                  <th style={{ width: '38%' }}>Product</th>
                  <th style={{ width: '16%' }}>Category</th>
                  <th style={{ width: '18%' }}>Price & Discount</th>
                  <th style={{ width: '14%' }}>Stock Status</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => {
                  const isInStock = p.stockStatus === 'in_stock' || p.inStock === true || p.inStock === undefined;
                  const price = parseFloat(p.price) || 0;
                  const strikePrice = parseFloat(p.strikePrice) || 0;
                  const hasDiscount = strikePrice > price && price > 0;
                  const discountPct = hasDiscount ? Math.round(((strikePrice - price) / strikePrice) * 100) : 0;

                  return (
                    <tr key={p.id}>
                      {/* Product details */}
                      <td>
                        <div className="prod-table-item">
                          <img 
                            src={p.image || 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=120&q=80'} 
                            alt={p.title || p.name} 
                            className="prod-table-thumb"
                            onError={(e) => {
                              e.target.src = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=120&q=80';
                            }}
                          />
                          <div className="prod-table-info">
                            <span className="prod-table-name" title={p.title || p.name}>
                              {p.title || p.name}
                            </span>
                            <span className="prod-table-unit">
                              Unit: <strong>{p.unit || '1 unit'}</strong>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td>
                        <span className="prod-category-pill">
                          {p.category || 'General'}
                        </span>
                      </td>

                      {/* Pricing */}
                      <td>
                        <div className="prod-price-cell">
                          <span className="prod-price-current">₹{price}</span>
                          {hasDiscount && (
                            <div className="prod-price-strike-wrap">
                              <span className="prod-price-strike">₹{strikePrice}</span>
                              <span className="prod-discount-badge">{discountPct}% OFF</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Stock Toggle Switch */}
                      <td>
                        <button
                          type="button"
                          className={`stock-toggle-pill ${isInStock ? 'in-stock' : 'out-of-stock'}`}
                          onClick={() => handleToggleStock(p)}
                          disabled={busyId === p.id}
                          title="Click to toggle stock status"
                        >
                          <span className="stock-dot"></span>
                          <span>{isInStock ? 'In Stock' : 'Out of Stock'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-actions-cell">
                          <button 
                            type="button"
                            className="action-icon-btn view"
                            onClick={() => setPreviewProduct(p)}
                            title="Quick View Details"
                          >
                            <Eye size={15} />
                          </button>
                          <button 
                            type="button"
                            className="action-icon-btn edit"
                            onClick={() => setEditingProduct({ ...p })}
                            title="Edit Product"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button 
                            type="button"
                            className="action-icon-btn delete"
                            onClick={() => setDeleteCandidate(p)}
                            title="Delete Product"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="all-prod-cards-grid">
          {filteredProducts.map(p => {
            const isInStock = p.stockStatus === 'in_stock' || p.inStock === true || p.inStock === undefined;
            const price = parseFloat(p.price) || 0;
            const strikePrice = parseFloat(p.strikePrice) || 0;
            const hasDiscount = strikePrice > price && price > 0;
            const discountPct = hasDiscount ? Math.round(((strikePrice - price) / strikePrice) * 100) : 0;

            return (
              <div key={p.id} className="prod-card-item">
                <div className="prod-card-image-box">
                  <img 
                    src={p.image || 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80'} 
                    alt={p.title || p.name} 
                    className="prod-card-img"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80';
                    }}
                  />
                  {hasDiscount && (
                    <span className="prod-card-discount-tag">
                      {discountPct}% OFF
                    </span>
                  )}
                  <button
                    type="button"
                    className={`prod-card-stock-badge ${isInStock ? 'in-stock' : 'out-of-stock'}`}
                    onClick={() => handleToggleStock(p)}
                    disabled={busyId === p.id}
                    title="Click to switch status"
                  >
                    <span className="stock-dot"></span>
                    <span>{isInStock ? 'In Stock' : 'Out of Stock'}</span>
                  </button>
                </div>

                <div className="prod-card-body">
                  <div className="prod-card-header">
                    <span className="prod-card-cat">{p.category || 'General'}</span>
                    <span className="prod-card-unit">{p.unit || '1 unit'}</span>
                  </div>

                  <h4 className="prod-card-title" title={p.title || p.name}>
                    {p.title || p.name}
                  </h4>

                  <div className="prod-card-pricing">
                    <span className="prod-card-price">₹{price}</span>
                    {hasDiscount && (
                      <span className="prod-card-strike">₹{strikePrice}</span>
                    )}
                  </div>

                  <div className="prod-card-footer">
                    <button 
                      type="button"
                      className="card-action-btn view"
                      onClick={() => setPreviewProduct(p)}
                      title="Quick View"
                    >
                      <Eye size={15} />
                      <span>View</span>
                    </button>
                    <button 
                      type="button"
                      className="card-action-btn edit"
                      onClick={() => setEditingProduct({ ...p })}
                      title="Edit Product"
                    >
                      <Edit3 size={15} />
                      <span>Edit</span>
                    </button>
                    <button 
                      type="button"
                      className="card-action-btn delete"
                      onClick={() => setDeleteCandidate(p)}
                      title="Delete Product"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= 4. QUICK VIEW MODAL ================= */}
      {previewProduct && (
        <div className="all-prod-modal-overlay" onClick={() => setPreviewProduct(null)}>
          <div className="all-prod-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Eye size={18} className="text-green" />
                <h3>Product Quick View</h3>
              </div>
              <button 
                type="button" 
                className="modal-close-btn"
                onClick={() => setPreviewProduct(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-preview-body">
              <div className="preview-image-col">
                <img 
                  src={previewProduct.image || 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=500&q=80'} 
                  alt={previewProduct.title || previewProduct.name}
                  className="preview-full-img"
                />
              </div>

              <div className="preview-details-col">
                <span className="preview-cat-badge">{previewProduct.category || 'General'}</span>
                <h2 className="preview-title">{previewProduct.title || previewProduct.name}</h2>

                <div className="preview-price-row">
                  <span className="preview-selling-price">₹{previewProduct.price}</span>
                  {previewProduct.strikePrice && (
                    <span className="preview-strike-price">₹{previewProduct.strikePrice}</span>
                  )}
                  <span className="preview-unit-tag">{previewProduct.unit || '1 unit'}</span>
                </div>

                <div className="preview-stock-info">
                  <strong>Stock Status:</strong>
                  <span className={`status-badge ${(previewProduct.stockStatus === 'in_stock' || previewProduct.inStock) ? 'in' : 'out'}`}>
                    {(previewProduct.stockStatus === 'in_stock' || previewProduct.inStock) ? 'In Stock 🟢' : 'Out of Stock 🔴'}
                  </span>
                </div>

                {previewProduct.description && (
                  <div className="preview-desc-box">
                    <strong>Description:</strong>
                    <p>{previewProduct.description}</p>
                  </div>
                )}

                <div className="preview-modal-actions">
                  <button 
                    type="button" 
                    className="modal-edit-btn"
                    onClick={() => {
                      const toEdit = { ...previewProduct };
                      setPreviewProduct(null);
                      setEditingProduct(toEdit);
                    }}
                  >
                    <Edit3 size={15} />
                    <span>Edit This Product</span>
                  </button>
                  <button 
                    type="button" 
                    className="modal-dismiss-btn"
                    onClick={() => setPreviewProduct(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 5. EDIT PRODUCT MODAL ================= */}
      {editingProduct && (
        <div className="all-prod-modal-overlay" onClick={() => setEditingProduct(null)}>
          <div className="all-prod-modal-card edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Edit3 size={18} className="text-green" />
                <h3>Edit Product Details</h3>
              </div>
              <button 
                type="button" 
                className="modal-close-btn"
                onClick={() => setEditingProduct(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-edit-form">
              <div className="edit-form-field">
                <label className="edit-form-label">Product Name *</label>
                <input 
                  type="text" 
                  className="edit-form-input"
                  value={editingProduct.title || editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value, name: e.target.value })}
                  required
                />
              </div>

              <div className="edit-form-row-2">
                <div className="edit-form-field">
                  <label className="edit-form-label">Selling Price (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="edit-form-input"
                    value={editingProduct.price || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                    required
                  />
                </div>

                <div className="edit-form-field">
                  <label className="edit-form-label">Strike-out Price (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="edit-form-input"
                    value={editingProduct.strikePrice || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, strikePrice: e.target.value })}
                  />
                </div>
              </div>

              <div className="edit-form-row-2">
                <div className="edit-form-field">
                  <label className="edit-form-label">Category</label>
                  <input 
                    type="text" 
                    className="edit-form-input"
                    value={editingProduct.category || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  />
                </div>

                <div className="edit-form-field">
                  <label className="edit-form-label">Unit</label>
                  <input 
                    type="text" 
                    className="edit-form-input"
                    value={editingProduct.unit || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                  />
                </div>
              </div>

              <div className="edit-form-field">
                <label className="edit-form-label">Stock Status</label>
                <select 
                  className="edit-form-select"
                  value={editingProduct.stockStatus || (editingProduct.inStock ? 'in_stock' : 'out_of_stock')}
                  onChange={(e) => setEditingProduct({ ...editingProduct, stockStatus: e.target.value, inStock: e.target.value === 'in_stock' })}
                >
                  <option value="in_stock">In Stock (Available)</option>
                  <option value="out_of_stock">Out of Stock (Unavailable)</option>
                </select>
              </div>

              <div className="edit-form-field">
                <label className="edit-form-label">Description (Optional)</label>
                <textarea 
                  rows="3"
                  className="edit-form-textarea"
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                ></textarea>
              </div>

              <div className="modal-footer-actions">
                <button type="submit" className="modal-save-btn" disabled={savingEdit}>
                  {savingEdit ? <RotateCcw size={16} className="modal-spin" /> : <CheckCircle size={16} />}
                  <span>{savingEdit ? 'Saving…' : 'Save Changes'}</span>
                </button>
                <button 
                  type="button" 
                  className="modal-cancel-btn"
                  onClick={() => setEditingProduct(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 6. DELETE CONFIRMATION MODAL ================= */}
      {deleteCandidate && (
        <div className="all-prod-modal-overlay" onClick={() => setDeleteCandidate(null)}>
          <div className="all-prod-modal-card confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon-wrap">
              <Trash2 size={28} />
            </div>
            <h3>Delete Product?</h3>
            <p>
              Are you sure you want to delete <strong>"{deleteCandidate.title || deleteCandidate.name}"</strong>? This item will be removed from your catalog.
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-delete-btn"
                onClick={confirmDelete}
                disabled={busyId === deleteCandidate.id}
              >
                {busyId === deleteCandidate.id ? 'Deleting…' : 'Yes, Delete'}
              </button>
              <button
                type="button"
                className="confirm-cancel-btn"
                onClick={() => setDeleteCandidate(null)}
                disabled={busyId === deleteCandidate.id}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
