import React, { useState, useEffect, useRef } from 'react';
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
  Layers,
  RotateCcw,
  PackageCheck,
  PackageX,
  Video,
  PlayCircle,
  Cloud,
  UploadCloud,
  Loader2,
  Store,
  Image as ImageIcon,
  Link as LinkIcon,
  RefreshCw,
  Plus
} from 'lucide-react';
import CategorySelect from '../../components/ui/CategorySelect';
import api from '../../utils/api';
import {
  getProducts,
  deleteProduct,
  updateProduct,
  syncProductsFromServer
} from '../../utils/storage';
import { isValidVideoUrl, getYoutubeEmbedUrl } from './AddProduct';
import Pagination from '../../components/ui/Pagination';
import './AllProducts.css';
import './AddProduct.css';

const QUICK_UNITS = [
  'Kilogram (KG)',
  'Gram (G)',
  '500g',
  '1 kg',
  'Litre (L)',
  'Millilitre (ML)',
  '500ml',
  'Pieces (PCS)',
  'Pack',
  'Box',
  'Bottle',
  'Dozen'
];

const UNIT_OPTIONS = [
  'Pieces (PCS)', 'Nos (Numbers)', 'Kilogram (KG)', 'Gram (G)',
  '500g', '250g', '100g', '1 kg', '2 kg', '5 kg',
  'Litre (L)', 'Millilitre (ML)', '500ml', '1 L', '5 L',
  'Metre (M)', 'Centimetre (CM)',
  'Feet (FT)', 'Box', 'Pack', 'Pack of 2', 'Pack of 4', 'Set', 'Pair', 'Dozen',
  'Roll', 'Bundle', 'Carton', 'Bottle', 'Packet', 'Bag', 'Pouch', 'Jar', 'Tin'
];

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  // Category & Image state for inline edit modal
  const [categoriesList, setCategoriesList] = useState([]);
  const [editImages, setEditImages] = useState([]);
  const [editInitialImages, setEditInitialImages] = useState([]);
  const [editImageInputMode, setEditImageInputMode] = useState('upload'); // 'upload' | 'url'
  const [editImageUrlInput, setEditImageUrlInput] = useState('');
  const [editImageUrlError, setEditImageUrlError] = useState('');
  const [editImageUploading, setEditImageUploading] = useState(false);
  const [editDragActive, setEditDragActive] = useState(false);
  const [editReplacingIndex, setEditReplacingIndex] = useState(null);
  const editImageFileInputRef = useRef(null);
  const editReplacingIndexRef = useRef(null);

  useEffect(() => {
    api.getCategories({ vendorId: vendor?.id || '' }, 'vendor')
      .then((data) => {
        if (data?.success && Array.isArray(data.categories)) {
          setCategoriesList(data.categories);
        }
      })
      .catch(() => {});
  }, [vendor?.id]);

  // Video management state for inline edit modal
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState('');
  const [videoInputMode, setVideoInputMode] = useState('url');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoUrlError, setVideoUrlError] = useState('');
  const videoFileInputRef = useRef(null);

  const openEditModal = (prod) => {
    const currentVid = prod.videoUrl || prod.video_url || '';
    const rawImgs = Array.isArray(prod.images) && prod.images.length > 0
      ? prod.images
      : (prod.image ? [prod.image] : []);
    setEditImages(rawImgs);
    setEditInitialImages(rawImgs);
    setEditImageInputMode('upload');
    setEditImageUrlInput('');
    setEditImageUrlError('');
    setEditReplacingIndex(null);
    editReplacingIndexRef.current = null;

    setEditingProduct({
      ...prod,
      image: prod.image || rawImgs[0] || '',
      images: rawImgs,
      videoUrl: currentVid
    });
    setVideoUrlInput(currentVid);
    setVideoUrlError('');
    setVideoUploadError('');
  };

  const triggerEditImageFileInput = (idx = null) => {
    editReplacingIndexRef.current = idx;
    setEditReplacingIndex(idx);
    setEditImageInputMode('upload');
    if (editImageFileInputRef.current) {
      editImageFileInputRef.current.click();
    } else {
      setTimeout(() => editImageFileInputRef.current?.click(), 20);
    }
  };

  const handleApplyEditImageUrl = () => {
    setEditImageUrlError('');
    const trimmed = editImageUrlInput.trim();
    if (!trimmed) {
      setEditImageUrlError('Please enter a valid image URL');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image/')) {
      setEditImageUrlError('URL must start with http://, https://, or data:image/');
      return;
    }
    const idxToReplace = editReplacingIndexRef.current;
    if (idxToReplace !== null && idxToReplace >= 0 && idxToReplace < editImages.length) {
      const nextImages = [...editImages];
      nextImages[idxToReplace] = trimmed;
      setEditImages(nextImages);
      setEditingProduct((prev) => (prev ? { ...prev, image: idxToReplace === 0 ? trimmed : prev.image, images: nextImages } : null));
      editReplacingIndexRef.current = null;
      setEditReplacingIndex(null);
      showToast('Image replaced successfully!', 'success');
    } else {
      if (editImages.length >= 8) {
        showToast('Maximum 8 images allowed per product', 'error');
        return;
      }
      const updated = editImages.includes(trimmed) ? editImages : [...editImages, trimmed];
      setEditImages(updated);
      setEditingProduct((prev) => (prev ? { ...prev, image: prev.image || trimmed, images: updated } : null));
      showToast('Image added to gallery!', 'success');
    }
    setEditImageUrlInput('');
  };

  const handleMultipleEditFiles = async (filesList) => {
    const rawFiles = Array.from(filesList || []);
    const validFiles = rawFiles.filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      showToast('Please select valid image files (PNG, JPG, WEBP)', 'error');
      editReplacingIndexRef.current = null;
      setEditReplacingIndex(null);
      return;
    }

    const idxToReplace = editReplacingIndexRef.current;
    if (idxToReplace !== null && idxToReplace >= 0 && idxToReplace < editImages.length) {
      const file = validFiles[0];
      if (file.size > 10 * 1024 * 1024) {
        showToast('Selected file exceeds 10MB limit', 'error');
        editReplacingIndexRef.current = null;
        setEditReplacingIndex(null);
        return;
      }
      setEditImageUploading(true);
      try {
        const data = await api.uploadImage(file, 'vendor');
        if (data?.success && data.url) {
          const nextImages = [...editImages];
          nextImages[idxToReplace] = data.url;
          setEditImages(nextImages);
          setEditingProduct((prev) => (prev ? { ...prev, image: idxToReplace === 0 ? data.url : prev.image, images: nextImages } : null));
          showToast('Image replaced successfully!', 'success');
        } else {
          showToast(data?.error || 'Failed to replace image', 'error');
        }
      } catch (err) {
        showToast('Replace error: ' + (err.message || 'unknown error'), 'error');
      } finally {
        setEditImageUploading(false);
        editReplacingIndexRef.current = null;
        setEditReplacingIndex(null);
      }
      return;
    }

    const remainingSlots = Math.max(0, 8 - editImages.length);
    if (remainingSlots <= 0) {
      showToast('Maximum 8 images allowed per product', 'error');
      return;
    }
    const toUpload = validFiles.slice(0, remainingSlots);
    if (validFiles.length > remainingSlots) {
      showToast(`Only uploading first ${remainingSlots} images (max 8 allowed)`, 'error');
    }
    setEditImageUploading(true);
    let okCount = 0;
    try {
      for (const file of toUpload) {
        if (file.size > 10 * 1024 * 1024) {
          showToast(`Skipped ${file.name}: exceeds 10MB`, 'error');
          continue;
        }
        const data = await api.uploadImage(file, 'vendor');
        if (data?.success && data.url) {
          okCount++;
          setEditImages((prev) => {
            const next = prev.includes(data.url) ? prev : [...prev, data.url];
            setEditingProduct((p) => (p ? { ...p, image: p.image || data.url, images: next } : null));
            return next;
          });
        }
      }
      if (okCount > 0) {
        showToast(`${okCount} image${okCount > 1 ? 's' : ''} uploaded successfully!`, 'success');
      }
    } catch (err) {
      showToast('Upload error: ' + (err.message || 'unknown error'), 'error');
    } finally {
      setEditImageUploading(false);
      editReplacingIndexRef.current = null;
      setEditReplacingIndex(null);
    }
  };

  const handleSetPrimaryEditImage = (index) => {
    if (index < 0 || index >= editImages.length) return;
    const target = editImages[index];
    const rest = editImages.filter((_, i) => i !== index);
    const reordered = [target, ...rest];
    setEditImages(reordered);
    setEditingProduct((prev) => (prev ? { ...prev, image: target, images: reordered } : null));
    showToast('Primary product image updated', 'success');
  };

  const handleRemoveEditImage = (index) => {
    const next = editImages.filter((_, i) => i !== index);
    setEditImages(next);
    setEditingProduct((prev) => (prev ? { ...prev, image: next[0] || '', images: next } : null));
  };

  const handleApplyVideoUrl = () => {
    setVideoUrlError('');
    const trimmed = videoUrlInput.trim();
    if (!trimmed) {
      setEditingProduct(prev => (prev ? { ...prev, videoUrl: '' } : null));
      return;
    }
    if (!isValidVideoUrl(trimmed)) {
      setVideoUrlError('Please enter a valid YouTube, Vimeo, or direct video (.mp4, .webm) URL.');
      return;
    }
    setEditingProduct(prev => (prev ? { ...prev, videoUrl: trimmed } : null));
    showToast('Product video link applied!', 'success');
  };

  const handleVideoFileUpload = async (file) => {
    if (!file) return;
    setVideoUploadError('');
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
    const ext = (file.name || '').split('.').pop().toLowerCase();
    const allowedExts = ['mp4', 'webm', 'mov', 'ogg', 'm4v'];

    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      setVideoUploadError('Unsupported format. Please select an MP4, WebM, MOV, or OGG video.');
      showToast('Unsupported video format', 'error');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setVideoUploadError('Video file exceeds maximum allowed size of 50MB.');
      showToast('Video exceeds 50MB limit', 'error');
      return;
    }

    setVideoUploading(true);
    try {
      const data = await api.uploadVideo(file, 'vendor');
      if (data?.success && data.url) {
        setEditingProduct(prev => (prev ? { ...prev, videoUrl: data.url } : null));
        setVideoUrlInput(data.url);
        showToast('Video uploaded successfully! 🎬', 'success');
      } else {
        const err = data?.error || 'Video upload failed';
        setVideoUploadError(err);
        showToast(err, 'error');
      }
    } catch (err) {
      const msg = err.message || 'Video upload failed';
      setVideoUploadError(msg);
      showToast(msg, 'error');
    } finally {
      setVideoUploading(false);
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

    const primaryImg = editImages[0] || editingProduct.image || '';
    const updates = {
      title: editingProduct.title.trim(),
      name: editingProduct.title.trim(),
      price: price,
      strikePrice: editingProduct.strikePrice ? parseFloat(editingProduct.strikePrice) : null,
      category: editingProduct.category || 'General',
      unit: editingProduct.unit || '1 unit',
      description: editingProduct.description || '',
      stockStatus: editingProduct.stockStatus || 'in_stock',
      image: primaryImg,
      images: editImages.length > 0 ? editImages : (primaryImg ? [primaryImg] : []),
      videoUrl: editingProduct.videoUrl ? editingProduct.videoUrl.trim() : null
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

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory, stockFilter, sortBy]);

  const paginatedProducts = filteredProducts.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

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
                {paginatedProducts.map(p => {
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                              <span className="prod-table-unit">
                                Unit: <strong>{p.unit || '1 unit'}</strong>
                              </span>
                              <span className="prod-owner-badge prod-owner-vendor" style={{ fontSize: 10, padding: '1px 5px' }}>
                                <Store size={10} /> {vendor?.name || 'My Store'}
                              </span>
                            </div>
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
                            onClick={() => openEditModal(p)}
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
          <div style={{ padding: '16px 20px' }}>
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(filteredProducts.length / pageSize) || 1}
              onPageChange={setPage}
              totalItems={filteredProducts.length}
              pageSize={pageSize}
              onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
              pageSizeOptions={[10, 25, 50]}
            />
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="all-prod-grid-wrap">
          <div className="all-prod-cards-grid">
            {paginatedProducts.map(p => {
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
                    <span className="prod-owner-badge prod-owner-vendor" style={{ fontSize: 10, padding: '1px 5px' }}>
                      <Store size={10} /> {vendor?.name || 'My Store'}
                    </span>
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
                      onClick={() => openEditModal(p)}
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
          <div style={{ marginTop: 20 }}>
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(filteredProducts.length / pageSize) || 1}
              onPageChange={setPage}
              totalItems={filteredProducts.length}
              pageSize={pageSize}
              onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
              pageSizeOptions={[10, 25, 50]}
            />
          </div>
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

                {(previewProduct.videoUrl || previewProduct.video_url) && (
                  <div className="preview-desc-box" style={{ marginTop: '12px' }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Video size={15} />
                      <span>Product Video:</span>
                    </strong>
                    <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden' }}>
                      {getYoutubeEmbedUrl(previewProduct.videoUrl || previewProduct.video_url) ? (
                        <iframe
                          src={getYoutubeEmbedUrl(previewProduct.videoUrl || previewProduct.video_url)}
                          title="Preview Product Video"
                          style={{ width: '100%', height: '220px', border: 'none', borderRadius: '8px' }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video
                          src={previewProduct.videoUrl || previewProduct.video_url}
                          controls
                          playsInline
                          style={{ width: '100%', maxHeight: '220px', borderRadius: '8px', background: '#000' }}
                        >
                          Your browser does not support the video tag.
                        </video>
                      )}
                    </div>
                  </div>
                )}

                <div className="preview-modal-actions">
                  <button 
                    type="button" 
                    className="modal-edit-btn"
                    onClick={() => {
                      const toEdit = { ...previewProduct };
                      setPreviewProduct(null);
                      openEditModal(toEdit);
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
              <div className="modal-edit-form-body">
                {/* 1. Basic details */}
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

                {/* 2. Category Field Selector */}
                <div className="edit-form-field">
                  <label className="edit-form-label">Category *</label>
                  <CategorySelect
                    value={editingProduct.category || ''}
                    onChange={(cat) => setEditingProduct({ ...editingProduct, category: cat })}
                    vendorId={vendor?.id || ''}
                    placeholder="Search or choose a category..."
                  />
                  {categoriesList.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {categoriesList.slice(0, 6).map((c) => {
                        const cName = typeof c === 'string' ? c : (c.name || c.title || '');
                        if (!cName) return null;
                        const isSel = (editingProduct.category || '').toLowerCase() === cName.toLowerCase();
                        return (
                          <button
                            key={cName}
                            type="button"
                            onClick={() => setEditingProduct({ ...editingProduct, category: cName })}
                            style={{
                              padding: '3px 9px',
                              borderRadius: 12,
                              fontSize: 11.5,
                              fontWeight: 500,
                              border: isSel ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                              background: isSel ? '#ecfdf5' : '#f8fafc',
                              color: isSel ? '#166534' : '#475569',
                              cursor: 'pointer'
                            }}
                          >
                            {isSel ? '✓ ' : ''}{cName}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Units Field Selector */}
                <div className="edit-form-field">
                  <label className="edit-form-label">Unit *</label>
                  <select
                    className="edit-form-select"
                    value={editingProduct.unit || '1 unit'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {QUICK_UNITS.map((u) => {
                      const isSel = (editingProduct.unit || '').toLowerCase() === u.toLowerCase();
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setEditingProduct({ ...editingProduct, unit: u })}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 500,
                            border: isSel ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                            background: isSel ? '#ecfdf5' : '#f8fafc',
                            color: isSel ? '#166534' : '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          {isSel ? '✓ ' : ''}{u}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Product Images Section */}
                <div className="edit-form-field" style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#fafafa' }}>
                  <label className="edit-form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <ImageIcon size={15} style={{ color: '#0e5c4a' }} />
                    <span>Product Images ({editImages.length}/8) *</span>
                  </label>
                  <p style={{ fontSize: 11.5, color: '#64748b', margin: '0 0 10px 0' }}>
                    Upload or link high-resolution photos. First image is the primary cover image.
                  </p>

                  {/* Mode switcher */}
                  <div className="prod-video-mode-selector" style={{ marginBottom: 12 }}>
                    <button
                      type="button"
                      className={`prod-video-mode-btn ${editImageInputMode === 'upload' ? 'active' : ''}`}
                      onClick={() => setEditImageInputMode('upload')}
                    >
                      <UploadCloud size={13} />
                      <span>Upload Image File(s)</span>
                    </button>
                    <button
                      type="button"
                      className={`prod-video-mode-btn ${editImageInputMode === 'url' ? 'active' : ''}`}
                      onClick={() => setEditImageInputMode('url')}
                    >
                      <LinkIcon size={13} />
                      <span>Add Image by URL</span>
                    </button>
                  </div>

                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={editImageFileInputRef}
                    multiple={editReplacingIndex === null}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleMultipleEditFiles(e.target.files);
                      }
                      e.target.value = '';
                    }}
                  />

                  {/* Mode A: URL input */}
                  {editImageInputMode === 'url' && (
                    <div style={{ marginBottom: 12 }}>
                      <div className="prod-video-url-input-row">
                        <input
                          type="url"
                          className="edit-form-input"
                          placeholder="https://images.unsplash.com/... or direct image URL"
                          value={editImageUrlInput}
                          onChange={(e) => {
                            setEditImageUrlInput(e.target.value);
                            setEditImageUrlError('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyEditImageUrl();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="prod-video-apply-btn"
                          onClick={handleApplyEditImageUrl}
                        >
                          <Plus size={13} /> Add
                        </button>
                      </div>
                      {editImageUrlError && <p className="prod-video-error-text">{editImageUrlError}</p>}
                    </div>
                  )}

                  {/* Mode B: Dropzone */}
                  {editImageInputMode === 'upload' && (
                    <div style={{ marginBottom: 12 }}>
                      <div
                        className={`add-prod-dropzone ${editDragActive ? 'drag-active' : ''} ${editImageUploading ? 'uploading' : ''}`}
                        onDragEnter={(e) => { e.preventDefault(); setEditDragActive(true); }}
                        onDragOver={(e) => { e.preventDefault(); setEditDragActive(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setEditDragActive(false); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setEditDragActive(false);
                          if (e.dataTransfer?.files?.length) handleMultipleEditFiles(e.dataTransfer.files);
                        }}
                        onClick={() => !editImageUploading && triggerEditImageFileInput(null)}
                        style={{ padding: '16px', textAlign: 'center', cursor: editImageUploading ? 'default' : 'pointer' }}
                      >
                        {editImageUploading ? (
                          <div>
                            <Loader2 size={24} className="dropzone-spin" />
                            <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 600 }}>Uploading image to CDN…</p>
                          </div>
                        ) : (
                          <div>
                            <UploadCloud size={28} style={{ color: '#0e5c4a', margin: '0 auto 6px auto' }} />
                            <p style={{ margin: 0, fontSize: 13 }}>
                              <strong>{editImages.length > 0 ? 'Click to add more images' : 'Click to select images'}</strong> or drag & drop
                            </p>
                            <span style={{ fontSize: 11, color: '#64748b' }}>PNG, JPG, WEBP (Max 10MB • Up to 8 total)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Primary Cover Image Preview */}
                  {editImages.length > 0 && (
                    <div className="add-prod-uploaded-box" style={{ padding: '10px 14px', marginBottom: 10 }}>
                      <div className="add-prod-uploaded-left">
                        <img src={editImages[0]} alt="Cover" className="add-prod-uploaded-img" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                        <div className="add-prod-uploaded-meta">
                          <div className="add-prod-uploaded-title" style={{ fontSize: 12 }}>
                            <CheckCircle size={14} className="uploaded-check-icon" />
                            <span>Primary Cover Image ({editImages.length}/8)</span>
                          </div>
                          <span className="add-prod-uploaded-url" title={editImages[0]} style={{ fontSize: 11, maxWidth: 220 }}>
                            {editImages[0]}
                          </span>
                        </div>
                      </div>
                      <div className="add-prod-uploaded-actions">
                        <button
                          type="button"
                          className="add-prod-action-btn replace"
                          onClick={() => triggerEditImageFileInput(0)}
                          disabled={editImageUploading}
                          title="Replace primary image"
                          style={{ padding: '4px 8px', fontSize: 11.5 }}
                        >
                          <RefreshCw size={11} /> Replace
                        </button>
                        {editImages.length < 8 && (
                          <button
                            type="button"
                            className="add-prod-action-btn replace"
                            onClick={() => triggerEditImageFileInput(null)}
                            disabled={editImageUploading}
                            title="Add another image"
                            style={{ padding: '4px 8px', fontSize: 11.5 }}
                          >
                            <Plus size={11} /> Add
                          </button>
                        )}
                        <button
                          type="button"
                          className="add-prod-action-btn remove"
                          onClick={() => {
                            setEditImages([]);
                            setEditingProduct((prev) => (prev ? { ...prev, image: '', images: [] } : null));
                            editReplacingIndexRef.current = null;
                            setEditReplacingIndex(null);
                          }}
                          disabled={editImageUploading}
                          title="Clear all images"
                          style={{ padding: '4px 8px', fontSize: 11.5 }}
                        >
                          <Trash2 size={11} /> Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Gallery Thumbnails Strip */}
                  {editImages.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8, marginTop: 8 }}>
                      {editImages.map((imgUrl, idx) => {
                        const isExisting = editInitialImages.includes(imgUrl);
                        return (
                          <div
                            key={idx}
                            style={{
                              position: 'relative',
                              aspectRatio: '1/1',
                              borderRadius: 6,
                              overflow: 'hidden',
                              border: idx === 0 ? '2px solid #0e5c4a' : '1px solid #cbd5e1',
                              background: '#fff'
                            }}
                          >
                            <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: idx === 0 ? 'rgba(14, 92, 74, 0.95)' : (isExisting ? 'rgba(30, 41, 59, 0.85)' : 'rgba(2, 132, 199, 0.85)'),
                                color: '#fff',
                                fontSize: 8.5,
                                fontWeight: 700,
                                textAlign: 'center',
                                padding: '1px 0'
                              }}
                            >
                              {idx === 0 ? 'PRIMARY' : (isExisting ? 'SAVED' : 'NEW')}
                            </span>
                            <div style={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 2 }}>
                              {idx !== 0 && (
                                <button
                                  type="button"
                                  title="Set as primary cover"
                                  onClick={() => handleSetPrimaryEditImage(idx)}
                                  style={{ background: 'rgba(0,0,0,0.7)', color: '#fbbf24', border: 'none', borderRadius: 3, width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}
                                >
                                  ★
                                </button>
                              )}
                              <button
                                type="button"
                                title="Replace this image"
                                onClick={() => triggerEditImageFileInput(idx)}
                                disabled={editImageUploading}
                                style={{ background: 'rgba(14,92,74,0.9)', color: '#fff', border: 'none', borderRadius: 3, width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <RefreshCw size={9} />
                              </button>
                              <button
                                type="button"
                                title="Remove image"
                                onClick={() => handleRemoveEditImage(idx)}
                                disabled={editImageUploading}
                                style={{ background: 'rgba(220,38,38,0.9)', color: '#fff', border: 'none', borderRadius: 3, width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, lineHeight: 1 }}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5. Stock Status & Description */}
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

                {/* 6. Product Video Section */}
                <div className="edit-form-field" style={{ marginTop: '8px' }}>
                  <label className="edit-form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Video size={16} />
                    <span>Product Demonstration Video (Optional)</span>
                  </label>

                  <div className="prod-video-mode-selector" style={{ marginBottom: '10px' }}>
                    <button
                      type="button"
                      className={`prod-video-mode-btn ${videoInputMode === 'url' ? 'active' : ''}`}
                      onClick={() => setVideoInputMode('url')}
                    >
                      Add Video URL
                    </button>
                    <button
                      type="button"
                      className={`prod-video-mode-btn ${videoInputMode === 'upload' ? 'active' : ''}`}
                      onClick={() => setVideoInputMode('upload')}
                    >
                      Upload Video (MP4/WebM)
                    </button>
                  </div>

                  {videoInputMode === 'url' && (
                    <div className="prod-video-url-block">
                      <div className="prod-video-url-input-row">
                        <input
                          type="url"
                          className="edit-form-input"
                          placeholder="https://www.youtube.com/watch?v=... or direct MP4 URL"
                          value={videoUrlInput}
                          onChange={(e) => {
                            setVideoUrlInput(e.target.value);
                            setVideoUrlError('');
                          }}
                        />
                        <button
                          type="button"
                          className="prod-video-apply-btn"
                          onClick={handleApplyVideoUrl}
                        >
                          Apply Link
                        </button>
                      </div>
                      {videoUrlError && <p className="prod-video-error-text">{videoUrlError}</p>}
                    </div>
                  )}

                  {videoInputMode === 'upload' && (
                    <div className="prod-video-upload-block">
                      <input
                        type="file"
                        ref={videoFileInputRef}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleVideoFileUpload(f);
                        }}
                        accept="video/mp4,video/webm,video/quicktime,video/ogg"
                        style={{ display: 'none' }}
                      />
                      <div
                        className={`add-prod-dropzone ${videoUploading ? 'uploading' : ''}`}
                        onClick={() => !videoUploading && videoFileInputRef.current?.click()}
                        style={{ padding: '16px', textAlign: 'center', cursor: videoUploading ? 'default' : 'pointer' }}
                      >
                        {videoUploading ? (
                          <div>
                            <Loader2 size={24} className="dropzone-spin" />
                            <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: 600 }}>Uploading to Cloud CDN…</p>
                          </div>
                        ) : (
                          <div>
                            <Cloud size={24} style={{ color: '#0d5c3a' }} />
                            <p style={{ margin: '4px 0 0', fontSize: '13px' }}><strong>Click to upload video file</strong> (Max 50MB)</p>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Cloudinary persistent storage</span>
                          </div>
                        )}
                      </div>
                      {videoUploadError && <p className="prod-video-error-text">{videoUploadError}</p>}
                    </div>
                  )}

                  {editingProduct.videoUrl && (
                    <div className="prod-video-preview-card" style={{ marginTop: '10px' }}>
                      <div className="prod-video-preview-header">
                        <div className="prod-video-preview-title">
                          <PlayCircle size={15} className="video-preview-icon" />
                          <span>Attached Video</span>
                        </div>
                        <button
                          type="button"
                          className="action-icon-btn delete"
                          onClick={() => {
                            setEditingProduct(prev => (prev ? { ...prev, videoUrl: '' } : null));
                            setVideoUrlInput('');
                          }}
                          title="Remove video"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="prod-video-player-container">
                        {getYoutubeEmbedUrl(editingProduct.videoUrl) ? (
                          <iframe
                            src={getYoutubeEmbedUrl(editingProduct.videoUrl)}
                            title="Video Preview"
                            className="prod-video-iframe"
                            allowFullScreen
                          />
                        ) : (
                          <video
                            src={editingProduct.videoUrl}
                            controls
                            playsInline
                            className="prod-video-html5"
                          >
                            Your browser does not support the video tag.
                          </video>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Modal Footer Actions */}
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
