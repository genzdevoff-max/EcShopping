import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlusCircle, 
  Tag, 
  Image as ImageIcon, 
  DollarSign, 
  Layers, 
  CheckCircle, 
  AlertCircle, 
  X, 
  ShoppingCart, 
  Sparkles,
  Percent,
  UploadCloud,
  Loader2,
  Trash2,
  RefreshCw,
  Cloud,
  Link as LinkIcon,
  ShieldCheck,
  Store,
  Video,
  PlayCircle
} from 'lucide-react';
import { createProductOnServer } from '../../utils/storage';
import api from '../../utils/api';
import CategorySelect from '../../components/ui/CategorySelect';
import VendorSelect from '../../components/admin/VendorSelect';
import './AddProduct.css';

export function isValidVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  const isYoutube = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/i.test(trimmed);
  const isVimeo = /vimeo\.com\/(?:video\/)?\d+/i.test(trimmed);
  const isDirectVideo = /\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(trimmed);
  const isCloudinaryVideo = /cloudinary\.com\/.*\/video\/upload\//i.test(trimmed);
  return isYoutube || isVimeo || isDirectVideo || isCloudinaryVideo;
}

export function getYoutubeEmbedUrl(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : null;
}

export default function AddProduct({
  vendor = null,
  mode = 'vendor', // 'vendor' | 'admin'
  isAdmin = false,
  vendors = [], // passed in admin mode
  onProductCreated = null,
  onCancel = null
}) {
  const effectiveMode = isAdmin || mode === 'admin' ? 'admin' : 'vendor';
  const navigate = useNavigate();

  // Unit Options explicitly defined by user
  const UNIT_OPTIONS = [
    'Pieces (PCS)',
    'Nos (Numbers)',
    'Kilogram (KG)',
    'Gram (G)',
    'Litre (L)',
    'Millilitre (ML)',
    'Metre (M)',
    'Centimetre (CM)',
    'Feet (FT)',
    'Box',
    'Pack',
    'Set',
    'Pair',
    'Dozen',
    'Roll',
    'Bundle',
    'Carton',
    'Bottle',
    'Packet',
    'Bag'
  ];

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [image, setImage] = useState('');
  const [images, setImages] = useState([]);
  const [sellingPrice, setSellingPrice] = useState('');
  const [strikePrice, setStrikePrice] = useState('');
  const [unit, setUnit] = useState(UNIT_OPTIONS[2]); // Default 'Kilogram (KG)'
  const [stockStatus, setStockStatus] = useState('in_stock');
  const [stockQuantity, setStockQuantity] = useState('50');
  const [categoriesList, setCategoriesList] = useState([]);
  const [showNewCatInline, setShowNewCatInline] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  // Admin-specific state
  const [selectedVendorId, setSelectedVendorId] = useState('admin');
  const [status, setStatus] = useState('approved');

  // Quick inline category creation
  const handleCreateCategoryInline = async () => {
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      const role = effectiveMode === 'admin' ? 'admin' : 'vendor';
      const isVendorTarget = effectiveMode === 'admin' && selectedVendorId && selectedVendorId !== 'admin' && selectedVendorId !== 'null' && selectedVendorId !== 'shared';
      const catVendorId = isVendorTarget
        ? selectedVendorId
        : (effectiveMode === 'admin' ? null : (vendor?.id || null));

      const res = await api.createCategory({ name: newCatName.trim(), vendorId: catVendorId }, role);
      if (res?.success && res.category) {
        setCategoriesList((prev) => [res.category, ...prev]);
        setCategory(res.category.name);
        setNewCatName('');
        setShowNewCatInline(false);
        showToast(`Category "${res.category.name}" created and selected!`, 'success');
      } else {
        showToast(res?.error || 'Could not create category', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Failed to create category', 'error');
    } finally {
      setCreatingCat(false);
    }
  };

  // Cloudinary Upload state
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const fileInputRef = useRef(null);

  // Product Video state
  const [videoUrl, setVideoUrl] = useState('');
  const [videoInputMode, setVideoInputMode] = useState('url'); // 'url' | 'upload'
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoUrlError, setVideoUrlError] = useState('');
  const videoFileInputRef = useRef(null);

  // Floating Toast state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // Sample quick images for fast UI testing
  const SAMPLE_IMAGES = [
    { label: 'Tomatoes', url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80' },
    { label: 'Bananas', url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80' },
    { label: 'Fresh Milk', url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80' },
    { label: 'Pure Honey', url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80' },
    { label: 'Organic Rice', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80' },
    { label: 'Cold-pressed Oil', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80' }
  ];

  // Fetch available categories from TiDB
  useEffect(() => {
    let cancelled = false;
    const fetchCats = async () => {
      try {
        const data = effectiveMode === 'admin'
          ? await api.getCategories({}, 'admin')
          : await api.getCategories({ vendorId: vendor?.id || '' });

        if (cancelled) return;
        if (data?.success && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategoriesList(data.categories);
          setCategory((prev) => prev || data.categories[0].name);
        } else {
          setCategoriesList([{ id: 'default', name: 'General' }]);
          setCategory((prev) => prev || 'General');
        }
      } catch {
        if (cancelled) return;
        setCategoriesList([{ id: 'default', name: 'General' }]);
        setCategory((prev) => prev || 'General');
      }
    };
    fetchCats();
    return () => { cancelled = true; };
  }, [effectiveMode, vendor?.id]);

  // Discount Calculation
  const parsedSelling = parseFloat(sellingPrice) || 0;
  const parsedStrike = parseFloat(strikePrice) || 0;
  const hasDiscount = parsedStrike > parsedSelling && parsedSelling > 0;
  const discountPercent = hasDiscount ? Math.round(((parsedStrike - parsedSelling) / parsedStrike) * 100) : 0;
  const savingsAmount = hasDiscount ? (parsedStrike - parsedSelling).toFixed(2) : 0;

  // Cloudinary File Upload Handler
  const handleFileUpload = async (file) => {
    if (!file) return false;

    if (!file.type.startsWith('image/')) {
      showToast(`"${file.name}" is not an image file (PNG, JPG, WEBP, etc.)`, 'error');
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast(`"${file.name}" exceeds 10MB limit`, 'error');
      return false;
    }

    try {
      const uploadRole = effectiveMode === 'admin' ? 'admin' : 'vendor';
      const data = await api.uploadImage(file, uploadRole);
      if (data && data.success && data.url) {
        setImage((prev) => prev || data.url);
        setImages((prev) => (prev.includes(data.url) ? prev : [...prev, data.url]));
        return true;
      } else {
        showToast((data && data.error) || `Failed to upload "${file.name}"`, 'error');
        return false;
      }
    } catch (err) {
      showToast(`Image upload failed for "${file.name}": ` + (err.message || 'unknown error'), 'error');
      return false;
    }
  };

  const handleFileInputChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const availableSlots = Math.max(0, 8 - images.length);
    if (availableSlots <= 0) {
      showToast('Maximum 8 images allowed per product', 'error');
      return;
    }
    const filesToUpload = files.slice(0, availableSlots);
    setUploading(true);
    let okCount = 0;
    try {
      for (const file of filesToUpload) {
        const ok = await handleFileUpload(file);
        if (ok) okCount++;
      }
      if (okCount > 0) {
        showToast(`Uploaded ${okCount} image${okCount > 1 ? 's' : ''} successfully!`, 'success');
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    const availableSlots = Math.max(0, 8 - images.length);
    if (availableSlots <= 0) {
      showToast('Maximum 8 images allowed per product', 'error');
      return;
    }
    const filesToUpload = files.slice(0, availableSlots);
    setUploading(true);
    let okCount = 0;
    try {
      for (const file of filesToUpload) {
        const ok = await handleFileUpload(file);
        if (ok) okCount++;
      }
      if (okCount > 0) {
        showToast(`Uploaded ${okCount} image${okCount > 1 ? 's' : ''} successfully!`, 'success');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSetPrimaryImage = (index) => {
    if (index < 0 || index >= images.length) return;
    const target = images[index];
    const rest = images.filter((_, i) => i !== index);
    const reordered = [target, ...rest];
    setImages(reordered);
    setImage(target);
    showToast('Primary product image updated', 'success');
  };

  const handleMoveImage = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const next = [...images];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setImages(next);
    setImage(next[0]);
  };

  const handleRemoveGalleryImage = (index) => {
    const next = images.filter((_, i) => i !== index);
    setImages(next);
    setImage(next[0] || '');
  };

  // Video URL and Upload Handlers
  const handleApplyVideoUrl = () => {
    setVideoUrlError('');
    const trimmed = videoUrlInput.trim();
    if (!trimmed) {
      setVideoUrl('');
      return;
    }
    if (!isValidVideoUrl(trimmed)) {
      setVideoUrlError('Please enter a valid YouTube, Vimeo, or direct video (.mp4, .webm) URL.');
      return;
    }
    setVideoUrl(trimmed);
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
      const uploadRole = effectiveMode === 'admin' ? 'admin' : 'vendor';
      const data = await api.uploadVideo(file, uploadRole);
      if (data?.success && data.url) {
        setVideoUrl(data.url);
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

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Form Submit Handler
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;

    if (!name.trim()) {
      showToast('Please enter product name', 'error');
      return;
    }

    if (!sellingPrice || parsedSelling <= 0) {
      showToast('Please enter a valid selling price', 'error');
      return;
    }

    if (!category || !category.trim()) {
      showToast('Please select a category', 'error');
      return;
    }

    const parsedQty = stockStatus === 'out_of_stock' ? 0 : Math.max(0, parseInt(stockQuantity, 10) || 50);

    const newProdData = {
      title: name.trim(),
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      price: parsedSelling,
      strikePrice: parsedStrike > 0 ? parsedStrike : null,
      unit: unit,
      image: (images[0] || image).trim(),
      images: images.length > 0 ? images : (image.trim() ? [image.trim()] : []),
      videoUrl: videoUrl ? videoUrl.trim() : null,
      stockStatus: parsedQty > 0 ? stockStatus : 'out_of_stock',
      stockQuantity: parsedQty
    };

    setSubmitting(true);

    if (effectiveMode === 'admin') {
      try {
        const isSelectedVendor = selectedVendorId && selectedVendorId !== 'admin' && selectedVendorId !== 'null' && selectedVendorId !== 'shared';
        const adminPayload = {
          ...newProdData,
          status: status || 'approved',
          vendorId: isSelectedVendor ? selectedVendorId : null,
          vendorName: isSelectedVendor ? (currentAssignedVendor?.name || '') : 'Admin'
        };
        const res = await api.createProduct(adminPayload, 'admin');
        if (res?.success && res.product) {
          showToast(`Product "${res.product.title}" created (${res.product.status.toUpperCase()})!`, 'success');
          if (typeof onProductCreated === 'function') {
            onProductCreated(res.product);
          }
        } else {
          showToast(res?.error || 'Failed to create product', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Submission error', 'error');
      } finally {
        setSubmitting(false);
      }
    } else {
      // Vendor mode
      const result = await createProductOnServer(vendor, newProdData);
      setSubmitting(false);

      if (result.ok) {
        showToast(`Product "${name}" submitted — waiting for admin approval`, 'success');
        if (typeof onProductCreated === 'function') {
          onProductCreated(result.product);
        } else {
          setTimeout(() => {
            navigate('/vendor/products');
          }, 1200);
        }
      } else {
        showToast(result.error || 'Submission failed. Nothing was saved.', 'error');
      }
    }
  };

  const handleCancel = () => {
    if (typeof onCancel === 'function') {
      onCancel();
    } else {
      navigate(effectiveMode === 'admin' ? '/admin' : '/vendor/products');
    }
  };

  // Derive selected vendor display name for preview
  const isSelectedVendor = effectiveMode === 'admin'
    ? Boolean(selectedVendorId && selectedVendorId !== 'admin' && selectedVendorId !== 'null' && selectedVendorId !== 'shared')
    : true;

  const currentAssignedVendor = effectiveMode === 'admin'
    ? vendors.find((v) => String(v.id) === String(selectedVendorId))
    : vendor;

  const previewSeller = effectiveMode === 'admin'
    ? (isSelectedVendor ? (currentAssignedVendor?.name || 'Assigned Vendor') : 'Admin (EcShopping)')
    : (vendor?.name || 'My Store');

  return (
    <div className="add-prod-root">
      {/* Floating Toast Notification */}
      {toast && (
        <div className="add-prod-toast-wrap">
          <div className={`add-prod-toast-item ${toast.type}`}>
            {toast.type === 'success' && <CheckCircle size={18} className="add-prod-toast-icon" />}
            {toast.type === 'error' && <AlertCircle size={18} className="add-prod-toast-icon" />}
            <span className="add-prod-toast-text">{toast.message}</span>
            <button 
              type="button" 
              className="add-prod-toast-dismiss"
              onClick={() => setToast(null)}
              aria-label="Dismiss toast"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="add-prod-grid">
        {/* ================= LEFT COLUMN: FORM ================= */}
        <div className="add-prod-form-card">
          <form onSubmit={handleSubmit}>
            {/* 0. Admin Ownership & Governance (Admin Mode Only) */}
            {effectiveMode === 'admin' && (
              <div className="add-prod-section admin-governance-section">
                <div className="add-prod-section-header">
                  <ShieldCheck size={18} />
                  <span>Admin Governance & Ownership</span>
                </div>

                <div className="add-prod-row-2col">
                  {/* Vendor / Store Assignment */}
                  <div className="add-prod-field">
                    <label className="add-prod-label">
                      <span>Product Owner</span>
                      <span className="req">*</span>
                    </label>
                    <VendorSelect
                      vendors={vendors}
                      value={selectedVendorId}
                      onChange={(val) => setSelectedVendorId(val)}
                      placeholder="Select product owner (Admin or Vendor)…"
                      includeShared={false}
                    />
                    <span className="add-prod-field-hint">
                      Choose &ldquo;Admin&rdquo; for an Admin-owned listing, or select an approved Vendor.
                    </span>
                  </div>

                  {/* Initial Approval Status */}
                  <div className="add-prod-field">
                    <label htmlFor="prod-status-select" className="add-prod-label">
                      <span>Approval Status</span>
                      <span className="req">*</span>
                    </label>
                    <select
                      id="prod-status-select"
                      className="add-prod-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      required
                    >
                      <option value="approved">Approved (Live on storefront immediately)</option>
                      <option value="pending">Pending Review (Draft / Approval queue)</option>
                      <option value="rejected">Rejected (Unpublished listing)</option>
                    </select>
                    <span className="add-prod-field-hint">
                      {status === 'approved' && '✅ Product will immediately appear in the public catalog.'}
                      {status === 'pending' && '⏳ Product will stay queued in Pending Review.'}
                      {status === 'rejected' && '⛔ Product will be marked rejected and kept hidden.'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 1. Basic Product Info */}
            <div className="add-prod-section">
              <div className="add-prod-section-header">
                <Tag size={18} />
                <span>Basic Details</span>
              </div>

              {/* Product Name */}
              <div className="add-prod-field">
                <label htmlFor="prod-name-input" className="add-prod-label">
                  <span>Product Name</span>
                  <span className="req">*</span>
                </label>
                <input 
                  id="prod-name-input"
                  type="text" 
                  className="add-prod-input"
                  placeholder="Enter product name (e.g. Organic Pure Honey 500g)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {/* Searchable Category Combobox */}
              <div className="add-prod-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="prod-cat-select" className="add-prod-label">
                    <span>Category</span>
                    <span className="req">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewCatInline(!showNewCatInline)}
                    className="add-prod-cat-toggle-btn"
                  >
                    {showNewCatInline ? 'Cancel' : '+ Add New Category'}
                  </button>
                </div>

                {!showNewCatInline ? (
                  <CategorySelect
                    id="prod-cat-select"
                    categories={categoriesList}
                    value={category}
                    onChange={(selectedName) => setCategory(selectedName)}
                    onAddNew={() => setShowNewCatInline(true)}
                    placeholder="Search or select category…"
                  />
                ) : (
                  <div className="add-prod-inline-cat-box">
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        className="add-prod-input"
                        placeholder="New category name (e.g. Cold-Pressed Oils)"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={creatingCat || !newCatName.trim()}
                        onClick={handleCreateCategoryInline}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {creatingCat ? 'Saving…' : 'Create'}
                      </button>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Creates a new category in the database and selects it immediately.
                    </span>
                  </div>
                )}
              </div>

              {/* Product Description */}
              <div className="add-prod-field">
                <label htmlFor="prod-desc-textarea" className="add-prod-label">
                  <span>Product Description</span>
                  <span className="opt">(optional)</span>
                </label>
                <textarea 
                  id="prod-desc-textarea"
                  className="add-prod-textarea"
                  placeholder="Enter detailed product description, ingredients, benefits or harvest origin…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                ></textarea>
              </div>
            </div>

            {/* 2. Pricing & Discount Section */}
            <div className="add-prod-section">
              <div className="add-prod-section-header">
                <DollarSign size={18} />
                <span>Pricing & Discount</span>
              </div>

              <div className="add-prod-row-2col">
                {/* Selling Price */}
                <div className="add-prod-field">
                  <label htmlFor="prod-selling-price" className="add-prod-label">
                    <span>Selling Price (₹)</span>
                    <span className="req">*</span>
                  </label>
                  <input 
                    id="prod-selling-price"
                    type="number" 
                    step="0.01"
                    min="0"
                    className="add-prod-input"
                    placeholder="e.g. 299"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    required
                  />
                </div>

                {/* Strike-out Price */}
                <div className="add-prod-field">
                  <label htmlFor="prod-strike-price" className="add-prod-label">
                    <span>Strike-out Price (₹)</span>
                    <span className="opt">(optional)</span>
                  </label>
                  <input 
                    id="prod-strike-price"
                    type="number" 
                    step="0.01"
                    min="0"
                    className="add-prod-input"
                    placeholder="e.g. 399"
                    value={strikePrice}
                    onChange={(e) => setStrikePrice(e.target.value)}
                  />
                </div>
              </div>

              {/* Live Discount Calculator Badge */}
              {hasDiscount && (
                <div className="add-prod-discount-pill">
                  <Percent size={14} />
                  <span>Save ₹{savingsAmount} ({discountPercent}% OFF)</span>
                </div>
              )}
            </div>

            {/* 3. Unit & Inventory Section */}
            <div className="add-prod-section">
              <div className="add-prod-section-header">
                <Layers size={18} />
                <span>Unit & Inventory</span>
              </div>

              <div className="add-prod-row-3col">
                {/* Unit Options Dropdown */}
                <div className="add-prod-field">
                  <label htmlFor="prod-unit-select" className="add-prod-label">
                    <span>Unit</span>
                    <span className="req">*</span>
                  </label>
                  <select 
                    id="prod-unit-select"
                    className="add-prod-select"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select unit</option>
                    {UNIT_OPTIONS.map((u, idx) => (
                      <option key={idx} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                {/* Stock Status */}
                <div className="add-prod-field">
                  <label htmlFor="prod-stock-select" className="add-prod-label">
                    <span>Stock Status</span>
                    <span className="req">*</span>
                  </label>
                  <select 
                    id="prod-stock-select"
                    className="add-prod-select"
                    value={stockStatus}
                    onChange={(e) => setStockStatus(e.target.value)}
                    required
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>

                {/* Stock Quantity */}
                <div className="add-prod-field">
                  <label htmlFor="prod-stock-qty" className="add-prod-label">
                    <span>Initial Stock Quantity</span>
                    <span className="req">*</span>
                  </label>
                  <input 
                    id="prod-stock-qty"
                    type="number"
                    min="0"
                    step="1"
                    className="add-prod-input"
                    placeholder="e.g. 50"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    required={stockStatus === 'in_stock'}
                    disabled={stockStatus === 'out_of_stock'}
                  />
                </div>
              </div>
            </div>

            {/* 4. Product Image (Cloudinary Upload) */}
            <div className="add-prod-section">
              <div className="add-prod-section-header">
                <ImageIcon size={18} />
                <span>Product Image (Cloudinary CDN)</span>
              </div>

              {/* Hidden file input for Cloudinary upload (supports multiple images) */}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept="image/*"
                multiple
                style={{ display: 'none' }}
              />

              {/* Upload Dropzone when no image is selected */}
              {!image ? (
                <div 
                  className={`add-prod-dropzone ${dragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <div className="add-prod-upload-loading">
                      <Loader2 size={36} className="add-prod-spinner" />
                      <div className="upload-loading-text">
                        <strong>Uploading images to Cloudinary CDN…</strong>
                        <span>Sniffing magic bytes & validating 1:1 format</span>
                      </div>
                    </div>
                  ) : (
                    <div className="add-prod-dropzone-content">
                      <div className="add-prod-dropzone-icon">
                        <UploadCloud size={38} />
                      </div>
                      <div className="add-prod-dropzone-text">
                        <p className="dropzone-main"><strong>Click to select images</strong> or drag & drop multiple files</p>
                        <p className="dropzone-sub">PNG, JPG, WEBP • Select up to 8 images at once (up to 10MB each)</p>
                      </div>
                      <span className="dropzone-badge">
                        <Cloud size={13} /> Cloudinary Multi-Image Storage
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Uploaded Image Preview & Management Card */
                <div className="add-prod-uploaded-box">
                  <div className="add-prod-uploaded-left">
                    <img src={image} alt="Uploaded product preview" className="add-prod-uploaded-img" />
                    <div className="add-prod-uploaded-meta">
                      <div className="add-prod-uploaded-title">
                        <CheckCircle size={15} className="uploaded-check-icon" />
                        <span>Product Image Ready</span>
                      </div>
                      <span className="add-prod-uploaded-url" title={image}>
                        {image.startsWith('data:') ? 'Image selected (Ready for Cloudinary)' : image}
                      </span>
                    </div>
                  </div>
                  <div className="add-prod-uploaded-actions">
                    <button 
                      type="button" 
                      className="add-prod-action-btn replace"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      title="Upload a different image"
                    >
                      <RefreshCw size={13} />
                      <span>Change</span>
                    </button>
                    <button 
                      type="button" 
                      className="add-prod-action-btn remove"
                      onClick={() => setImage('')}
                      disabled={uploading}
                      title="Remove image"
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Product Gallery Strip */}
              {images.length > 0 && (
                <div style={{ marginTop: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Gallery Images ({images.length}/8) • 1200×1200 px (1:1)
                    </span>
                    {images.length < 8 && (
                      <button
                        type="button"
                        style={{ background: '#0e5c4a', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <Plus size={13} /> Add More
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
                    {images.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          aspectRatio: '1/1',
                          borderRadius: 8,
                          overflow: 'hidden',
                          border: idx === 0 ? '2px solid #0e5c4a' : '1px solid #cbd5e1',
                          background: '#fff'
                        }}
                      >
                        <img src={imgUrl} alt={`Thumb ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {idx === 0 && (
                          <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(14, 92, 74, 0.9)', color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'center', padding: '2px 0' }}>
                            PRIMARY
                          </span>
                        )}
                        <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2 }}>
                          {idx !== 0 && (
                            <button
                              type="button"
                              title="Make primary"
                              onClick={() => handleSetPrimaryImage(idx)}
                              style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 4, width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              ★
                            </button>
                          )}
                          <button
                            type="button"
                            title="Remove"
                            onClick={() => handleRemoveGalleryImage(idx)}
                            style={{ background: 'rgba(220,38,38,0.85)', color: '#fff', border: 'none', borderRadius: 4, width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional URL Toggle */}
              <div className="add-prod-url-toggle-wrap">
                <button 
                  type="button" 
                  className="add-prod-url-toggle-btn"
                  onClick={() => setShowManualUrl(!showManualUrl)}
                >
                  <LinkIcon size={12} />
                  <span>{showManualUrl ? 'Hide image URL input' : 'Or paste image URL manually'}</span>
                </button>
              </div>

              {showManualUrl && (
                <div className="add-prod-field add-prod-manual-url">
                  <input 
                    id="prod-image-input"
                    type="url" 
                    className="add-prod-input"
                    placeholder="Enter image URL"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                  />
                </div>
              )}

              {/* Sample Preset Chips */}
              <div className="add-prod-samples-wrap">
                <span className="add-prod-sample-label">Quick samples:</span>
                {SAMPLE_IMAGES.map((sample, idx) => (
                  <button 
                    key={idx}
                    type="button"
                    className="add-prod-chip"
                    onClick={() => setImage(sample.url)}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Product Video (Upload or Link) */}
            <div className="add-prod-section">
              <div className="add-prod-section-header">
                <Video size={18} />
                <span>Product Video (Optional)</span>
              </div>

              {/* Mode switch: URL vs Upload */}
              <div className="prod-video-mode-selector">
                <button
                  type="button"
                  className={`prod-video-mode-btn ${videoInputMode === 'url' ? 'active' : ''}`}
                  onClick={() => setVideoInputMode('url')}
                >
                  <LinkIcon size={14} />
                  <span>Add Video URL</span>
                </button>
                <button
                  type="button"
                  className={`prod-video-mode-btn ${videoInputMode === 'upload' ? 'active' : ''}`}
                  onClick={() => setVideoInputMode('upload')}
                >
                  <UploadCloud size={14} />
                  <span>Upload Video File (MP4/WebM)</span>
                </button>
              </div>

              {/* Option B: Video URL input */}
              {videoInputMode === 'url' && (
                <div className="prod-video-url-block">
                  <label htmlFor="prod-video-url" className="add-prod-label">
                    <span>Product Video URL</span>
                    <span className="opt">(YouTube, Vimeo, or direct MP4/WebM)</span>
                  </label>
                  <div className="prod-video-url-input-row">
                    <input
                      id="prod-video-url"
                      type="url"
                      className="add-prod-input"
                      placeholder="https://www.youtube.com/watch?v=... or https://.../video.mp4"
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

              {/* Option A: Video File Upload */}
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
                  >
                    {videoUploading ? (
                      <div className="add-prod-upload-loading">
                        <Loader2 size={36} className="add-prod-spinner" />
                        <div className="upload-loading-text">
                          <strong>Uploading Video to Cloud CDN…</strong>
                          <span>This might take a moment depending on file size (up to 50MB)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="add-prod-dropzone-content">
                        <div className="add-prod-dropzone-icon">
                          <UploadCloud size={38} />
                        </div>
                        <div className="add-prod-dropzone-text">
                          <p className="dropzone-main"><strong>Click to upload video</strong> or choose file</p>
                          <p className="dropzone-sub">MP4, WebM, MOV (Max 50MB)</p>
                        </div>
                        <span className="dropzone-badge">
                          <Cloud size={13} /> Cloudinary Video Storage
                        </span>
                      </div>
                    )}
                  </div>
                  {videoUploadError && <p className="prod-video-error-text">{videoUploadError}</p>}
                </div>
              )}

              {/* Video Preview Card if videoUrl is set */}
              {videoUrl && (
                <div className="prod-video-preview-card">
                  <div className="prod-video-preview-header">
                    <div className="prod-video-preview-title">
                      <PlayCircle size={16} className="video-preview-icon" />
                      <span>Video Ready &amp; Attached</span>
                    </div>
                    <button
                      type="button"
                      className="add-prod-action-btn remove"
                      onClick={() => {
                        setVideoUrl('');
                        setVideoUrlInput('');
                      }}
                      title="Remove product video"
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  </div>
                  <div className="prod-video-player-container">
                    {getYoutubeEmbedUrl(videoUrl) ? (
                      <iframe
                        src={getYoutubeEmbedUrl(videoUrl)}
                        title="Product Video Preview"
                        className="prod-video-iframe"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={videoUrl}
                        controls
                        playsInline
                        className="prod-video-html5"
                      >
                        Your browser does not support the video tag.
                      </video>
                    )}
                  </div>
                  <span className="prod-video-url-display" title={videoUrl}>
                    {videoUrl}
                  </span>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="add-prod-actions">
              <button type="submit" className="add-prod-submit-btn" disabled={submitting}>
                {submitting ? <Loader2 size={18} className="add-prod-spinner" /> : <PlusCircle size={18} />}
                <span>{submitting ? 'Saving…' : (effectiveMode === 'admin' ? 'Create Product' : 'Publish Product')}</span>
              </button>
              <button 
                type="button" 
                className="add-prod-cancel-btn"
                onClick={handleCancel}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* ================= RIGHT COLUMN: LIVE STOREFRONT PREVIEW ================= */}
        <div className="add-prod-preview-card">
          <div className="add-prod-preview-header">
            <h4>Live Storefront Preview</h4>
            <span className="add-prod-preview-badge">Customer View</span>
          </div>

          {/* Mode-specific status badge */}
          {effectiveMode === 'admin' && (
            <div className="preview-admin-meta">
              <span className={`preview-status-pill status-${status}`}>
                Status: {status.toUpperCase()}
              </span>
              <span className="preview-seller-pill">
                {!isSelectedVendor ? (
                  <><ShieldCheck size={12} style={{ color: '#0e5c4a' }} /> Owner: Admin</>
                ) : (
                  <><Store size={12} /> Owner: {previewSeller}</>
                )}
              </span>
            </div>
          )}

          {/* Mock Product Card identical to storefront */}
          <div className="mockup-product-card">
            {/* Image Box */}
            <div className="mockup-image-box">
              {image ? (
                <img 
                  src={image} 
                  alt={name || 'Preview'} 
                  className="mockup-image"
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80'; }}
                />
              ) : (
                <div className="mockup-no-image">
                  <ImageIcon size={32} />
                  <span>No image selected</span>
                </div>
              )}

              {/* Discount Tag */}
              {hasDiscount && (
                <div className="mockup-discount-tag">
                  {discountPercent}% OFF
                </div>
              )}
            </div>

            {/* Card Body */}
            <div className="mockup-card-body">
              <div className="mockup-header-row">
                <span className="mockup-category-tag">
                  {category || 'CATEGORY'}
                </span>
                <span className="mockup-seller-tag">
                  {previewSeller}
                </span>
              </div>

              <h4 className="mockup-title">
                {name || 'Product Name'}
              </h4>

              <span className="mockup-unit-pill">
                {unit}
              </span>

              <div className="mockup-price-row">
                <span className="mockup-selling-price">
                  ₹{sellingPrice ? Number(sellingPrice).toLocaleString('en-IN') : '0'}
                </span>
                {hasDiscount && (
                  <span className="mockup-strike-price">
                    ₹{Number(strikePrice).toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              <button type="button" className="mockup-cart-btn">
                <ShoppingCart size={15} />
                <span>ADD TO CART</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
