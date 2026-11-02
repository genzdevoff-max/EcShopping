/**
 * EditProduct — lets a vendor edit their own pending or rejected product.
 * Approved products cannot be edited by the vendor.
 *
 * Props:
 *   productId  — string id of the product to edit
 *   vendor     — the logged-in vendor object
 *   onBack     — callback to return to the product list
 *   onSaved    — callback called after a successful save
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Tag,
  Image as ImageIcon,
  DollarSign,
  Layers,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  Loader2,
  Trash2,
  Cloud,
  UploadCloud,
  Link as LinkIcon,
  ArrowLeft,
  Percent,
  Video,
  PlayCircle,
  Plus,
  ShieldCheck,
  Clock,
  Check
} from 'lucide-react';
import api from '../../utils/api';
import { getProducts } from '../../utils/storage';
import CategorySelect from '../../components/ui/CategorySelect';
import { isValidVideoUrl, getYoutubeEmbedUrl } from './AddProduct';
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

export default function EditProduct({ productId, vendor, onBack, onSaved, mode = 'vendor', isAdmin = false }) {
  const effectiveMode = isAdmin || mode === 'admin' ? 'admin' : 'vendor';
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [product, setProduct] = useState(null);

  // Form state (populated after load)
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [image, setImage] = useState('');
  const [images, setImages] = useState([]);
  const [initialImages, setInitialImages] = useState([]);
  const [replacingIndex, setReplacingIndex] = useState(null);
  const replacingIndexRef = useRef(null);
  const [imageInputMode, setImageInputMode] = useState('upload'); // 'upload' | 'url'
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageUrlError, setImageUrlError] = useState('');
  const [adminStatus, setAdminStatus] = useState('pending');
  const [adminReason, setAdminReason] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [strikePrice, setStrikePrice] = useState('');
  const [unit, setUnit] = useState(UNIT_OPTIONS[2]);
  const [stockStatus, setStockStatus] = useState('in_stock');
  const [stockQuantity, setStockQuantity] = useState(50);
  const [categoriesList, setCategoriesList] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Video state
  const [videoUrl, setVideoUrl] = useState('');
  const [videoInputMode, setVideoInputMode] = useState('url');
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoUrlError, setVideoUrlError] = useState('');
  const videoFileInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3200);
  };

  // Load the product on mount
  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setLoadError(null);
    api.getProduct(productId, effectiveMode)
      .then((res) => {
        if (!res?.success || !res.product) throw new Error(res?.error || 'Product not found');
        const p = res.product;
        setProduct(p);
        setName(p.title || p.name || '');
        setDescription(p.description || '');
        setCategory(p.category || '');
        setImage(p.image || '');
        const loadedImgs = Array.isArray(p.images) && p.images.length > 0 ? p.images : (p.image ? [p.image] : []);
        setImages(loadedImgs);
        setInitialImages(loadedImgs);
        setAdminStatus(p.status || 'pending');
        setSellingPrice(p.price ? String(p.price) : '');
        setStrikePrice(p.strikePrice ? String(p.strikePrice) : '');
        setUnit(p.unit || UNIT_OPTIONS[2]);
        setStockStatus(p.stockStatus || 'in_stock');
        setStockQuantity(p.stockQuantity != null ? p.stockQuantity : (p.stock_quantity != null ? p.stock_quantity : 50));
        setVideoUrl(p.videoUrl || p.video_url || '');
        setVideoUrlInput(p.videoUrl || p.video_url || '');
        setLoading(false);
      })
      .catch((err) => {
        // Fallback to locally cached product if present
        const local = getProducts().find((p) => String(p.id) === String(productId));
        if (local) {
          setProduct(local);
          setName(local.title || local.name || '');
          setDescription(local.description || '');
          setCategory(local.category || '');
          setImage(local.image || '');
          const loadedImgs = Array.isArray(local.images) && local.images.length > 0 ? local.images : (local.image ? [local.image] : []);
          setImages(loadedImgs);
          setInitialImages(loadedImgs);
          setAdminStatus(local.status || 'pending');
          setSellingPrice(local.price ? String(local.price) : '');
          setStrikePrice(local.strikePrice ? String(local.strikePrice) : '');
          setUnit(local.unit || UNIT_OPTIONS[2]);
          setStockStatus(local.stockStatus || 'in_stock');
          setStockQuantity(local.stockQuantity != null ? local.stockQuantity : 50);
          setVideoUrl(local.videoUrl || local.video_url || '');
          setVideoUrlInput(local.videoUrl || local.video_url || '');
          setLoading(false);
          return;
        }
        setLoadError(err.message || 'Could not load product');
        setLoading(false);
      });

    // Load categories
    api.getCategories({ vendorId: effectiveMode === 'admin' ? '' : (vendor?.id || '') }, effectiveMode)
      .then((data) => {
        if (data?.success && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategoriesList(data.categories);
        } else {
          setCategoriesList([{ id: 'default', name: 'General' }]);
        }
      })
      .catch(() => setCategoriesList([{ id: 'default', name: 'General' }]));
  }, [productId, vendor?.id, effectiveMode]);

  // Ensure the edit product form container smoothly scrolls to top when opened
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const modalBody = document.querySelector('.admin-modal-body');
      if (modalBody) modalBody.scrollTo({ top: 0, behavior: 'smooth' });
      const vendorMain = document.querySelector('.vendor-main');
      if (vendorMain) vendorMain.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // Fallback
    }
  }, [productId]);

  const parsedSelling = parseFloat(sellingPrice) || 0;
  const parsedStrike = parseFloat(strikePrice) || 0;
  const hasDiscount = parsedStrike > parsedSelling && parsedSelling > 0;
  const discountPercent = hasDiscount ? Math.round(((parsedStrike - parsedSelling) / parsedStrike) * 100) : 0;
  const savingsAmount = hasDiscount ? (parsedStrike - parsedSelling).toFixed(2) : 0;

  const unitOptions = React.useMemo(() => {
    if (unit && !UNIT_OPTIONS.includes(unit)) {
      return [unit, ...UNIT_OPTIONS];
    }
    return UNIT_OPTIONS;
  }, [unit]);

  const triggerFileInput = (idx = null) => {
    replacingIndexRef.current = idx;
    setReplacingIndex(idx);
    setImageInputMode('upload');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      setTimeout(() => fileInputRef.current?.click(), 20);
    }
  };

  const handleApplyImageUrl = () => {
    setImageUrlError('');
    const trimmed = imageUrlInput.trim();
    if (!trimmed) {
      setImageUrlError('Please enter a valid image URL');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image/')) {
      setImageUrlError('URL must start with http://, https://, or data:image/');
      return;
    }
    const idxToReplace = replacingIndexRef.current;
    if (idxToReplace !== null && idxToReplace >= 0 && idxToReplace < images.length) {
      const nextImages = [...images];
      nextImages[idxToReplace] = trimmed;
      setImages(nextImages);
      if (idxToReplace === 0) setImage(trimmed);
      replacingIndexRef.current = null;
      setReplacingIndex(null);
      showToast('Image replaced successfully!', 'success');
    } else {
      if (images.length >= 8) {
        showToast('Maximum 8 images allowed per product', 'error');
        return;
      }
      setImages((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
      setImage((prev) => prev || trimmed);
      showToast('Image added to gallery!', 'success');
    }
    setImageUrlInput('');
  };

  // File upload and replacement
  const handleMultipleFiles = async (filesList) => {
    const rawFiles = Array.from(filesList || []);
    const validFiles = rawFiles.filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      showToast('Please select valid image files (PNG, JPG, WEBP)', 'error');
      replacingIndexRef.current = null;
      setReplacingIndex(null);
      return;
    }

    const idxToReplace = replacingIndexRef.current;
    // Single image replacement mode
    if (idxToReplace !== null && idxToReplace >= 0 && idxToReplace < images.length) {
      const file = validFiles[0];
      if (file.size > 10 * 1024 * 1024) {
        showToast('Selected file exceeds 10MB limit', 'error');
        replacingIndexRef.current = null;
        setReplacingIndex(null);
        return;
      }
      setUploading(true);
      try {
        const uploadRole = effectiveMode === 'admin' ? 'admin' : 'vendor';
        const data = await api.uploadImage(file, uploadRole);
        if (data?.success && data.url) {
          const nextImages = [...images];
          nextImages[idxToReplace] = data.url;
          setImages(nextImages);
          if (idxToReplace === 0) {
            setImage(data.url);
          }
          showToast('Image replaced successfully!', 'success');
        } else {
          showToast(data?.error || 'Failed to replace image', 'error');
        }
      } catch (err) {
        showToast('Replace error: ' + (err.message || 'unknown error'), 'error');
      } finally {
        setUploading(false);
        replacingIndexRef.current = null;
        setReplacingIndex(null);
      }
      return;
    }

    const remainingSlots = Math.max(0, 8 - images.length);
    if (remainingSlots <= 0) {
      showToast('Maximum 8 images allowed per product', 'error');
      return;
    }
    const toUpload = validFiles.slice(0, remainingSlots);
    if (validFiles.length > remainingSlots) {
      showToast(`Only uploading first ${remainingSlots} images (max 8 allowed)`, 'error');
    }
    setUploading(true);
    let uploadedCount = 0;
    try {
      const uploadRole = effectiveMode === 'admin' ? 'admin' : 'vendor';
      for (const file of toUpload) {
        if (file.size > 10 * 1024 * 1024) {
          showToast(`Skipped ${file.name}: exceeds 10MB`, 'error');
          continue;
        }
        const data = await api.uploadImage(file, uploadRole);
        if (data?.success && data.url) {
          uploadedCount++;
          setImage((prev) => prev || data.url);
          setImages((prev) => (prev.includes(data.url) ? prev : [...prev, data.url]));
        }
      }
      if (uploadedCount > 0) {
        showToast(`${uploadedCount} image${uploadedCount > 1 ? 's' : ''} uploaded successfully!`, 'success');
      }
    } catch (err) {
      showToast('Upload error: ' + (err.message || 'unknown error'), 'error');
    } finally {
      setUploading(false);
      replacingIndexRef.current = null;
      setReplacingIndex(null);
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

  const handleRemoveGalleryImage = (index) => {
    const next = images.filter((_, i) => i !== index);
    setImages(next);
    setImage(next[0] || '');
  };

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) handleMultipleFiles(files);
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) { showToast('Please enter product name', 'error'); return; }
    if (!sellingPrice || parsedSelling <= 0) { showToast('Please enter a valid selling price', 'error'); return; }

    setSubmitting(true);
    try {
      const isVendorEditingApproved = effectiveMode === 'vendor' && product?.status === 'approved';
      const payload = {
        title: name.trim(),
        name: name.trim(),
        description: description.trim(),
        category: category || 'General',
        price: parsedSelling,
        strikePrice: parsedStrike > 0 ? parsedStrike : null,
        unit,
        image: (images[0] || image).trim(),
        images: images.length > 0 ? images : (image.trim() ? [image.trim()] : []),
        stockQuantity: Number(stockQuantity) || 0,
        videoUrl: videoUrl ? videoUrl.trim() : null,
        stockStatus
      };

      if (effectiveMode === 'admin') {
        payload.status = adminStatus;
        if (adminReason) payload.reason = adminReason.trim();
      }

      const res = await api.updateProduct(productId, payload, effectiveMode);
      if (res?.success) {
        if (effectiveMode === 'admin') {
          showToast(`Product updated successfully! Status: ${adminStatus.toUpperCase()}`, 'success');
        } else if (isVendorEditingApproved) {
          showToast('Product revisions submitted! Sent to Admin for re-approval.', 'success');
        } else {
          showToast('Product updated successfully!', 'success');
        }
        setTimeout(() => onSaved?.(res.product), 1000);
      } else {
        showToast(res?.error || 'Update failed. Please try again.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Update failed. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
        <p>Loading product…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
        <AlertCircle size={32} style={{ marginBottom: 8 }} />
        <p>{loadError}</p>
        <button onClick={onBack} style={styles.backBtn}><ArrowLeft size={14} /> Back</button>
      </div>
    );
  }

  const isRejected = product?.status === 'rejected';
  const isApproved = product?.status === 'approved';

  return (
    <div className="add-prod-root">
      {/* Toast */}
      {toast && (
        <div className="add-prod-toast-wrap">
          <div className={`add-prod-toast-item ${toast.type}`}>
            {toast.type === 'success' && <CheckCircle size={18} className="add-prod-toast-icon" />}
            {toast.type === 'error' && <AlertCircle size={18} className="add-prod-toast-icon" />}
            <span className="add-prod-toast-text">{toast.message}</span>
            <button type="button" className="add-prod-toast-dismiss" onClick={() => setToast(null)}>
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Back button */}
      <button type="button" onClick={onBack} style={styles.backBtn}>
        <ArrowLeft size={14} /> {effectiveMode === 'admin' ? 'Back to Admin Products' : 'Back to products'}
      </button>

      {/* Status notices */}
      {effectiveMode === 'admin' && (
        <div style={styles.adminBanner}>
          <ShieldCheck size={16} />
          <span><strong>Admin Editing Mode</strong> — You have full rights to modify this product. Changes apply live to the storefront immediately.</span>
        </div>
      )}
      {effectiveMode === 'vendor' && isApproved && (
        <div style={styles.reapprovalBanner}>
          <Clock size={16} />
          <span>This product is currently <strong>Live &amp; Approved</strong>. Any modifications to details, pricing, stock, images or description will automatically be submitted to the Admin for <strong>re-approval</strong> before updating on the storefront.</span>
        </div>
      )}
      {effectiveMode === 'vendor' && isRejected && (
        <div style={styles.warningBanner}>
          <AlertCircle size={15} />
          <span>This product was rejected by the admin. Editing and saving will reset its status to <strong>pending review</strong>.</span>
        </div>
      )}

      <div className="add-prod-grid">
        <div className="add-prod-form-card">
          <form onSubmit={handleSubmit}>
            {/* Admin Review & Moderation Section (Admin Mode Only) */}
            {effectiveMode === 'admin' && (
              <div className="add-prod-section" style={{ background: '#f8fafc', padding: 18, borderRadius: 12, border: '1px solid #cbd5e1' }}>
                <div className="add-prod-section-header" style={{ color: '#0f172a' }}>
                  <ShieldCheck size={18} style={{ color: '#0284c7' }} />
                  <span>Admin Moderation &amp; Ownership Controls</span>
                </div>
                <div className="add-prod-row-2col">
                  <div className="add-prod-field">
                    <label className="add-prod-label">Product Owner / Vendor</label>
                    <div style={{ padding: '9px 12px', background: '#e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      {product?.vendorName || product?.vendor_name || product?.vendorId || vendor?.name || 'Platform Store'}
                    </div>
                  </div>
                  <div className="add-prod-field">
                    <label htmlFor="admin-status-sel" className="add-prod-label">Approval Status *</label>
                    <select
                      id="admin-status-sel"
                      className="add-prod-select"
                      value={adminStatus}
                      onChange={(e) => setAdminStatus(e.target.value)}
                      style={{ fontWeight: 600 }}
                    >
                      <option value="approved">Approved (Live on storefront)</option>
                      <option value="pending">Pending Review</option>
                      <option value="rejected">Rejected (Needs fixes)</option>
                      <option value="archived">Archived (Hidden)</option>
                    </select>
                  </div>
                </div>
                {adminStatus === 'rejected' && (
                  <div className="add-prod-field" style={{ marginTop: 10 }}>
                    <label htmlFor="admin-reason-input" className="add-prod-label">Feedback / Rejection Reason</label>
                    <input
                      id="admin-reason-input"
                      type="text"
                      className="add-prod-input"
                      placeholder="e.g. Please upload higher resolution photos and clarify package size."
                      value={adminReason}
                      onChange={(e) => setAdminReason(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Basic Details */}
            <div className="add-prod-section">
              <div className="add-prod-section-header">
                <Tag size={18} /><span>Basic Details</span>
              </div>
              <div className="add-prod-field">
                <label htmlFor="ep-name" className="add-prod-label">
                  <span>Product Name</span><span className="req">*</span>
                </label>
                <input id="ep-name" type="text" className="add-prod-input" value={name}
                  onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="add-prod-field">
                <label htmlFor="ep-cat" className="add-prod-label">
                  <span>Category</span><span className="req">*</span>
                </label>
                <CategorySelect
                  id="ep-cat"
                  categories={categoriesList}
                  value={category}
                  onChange={(selectedName) => setCategory(selectedName)}
                  placeholder="Search or select category..."
                />
                {categoriesList.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Quick select:</span>
                    {categoriesList.slice(0, 10).map((cat) => {
                      const catName = typeof cat === 'string' ? cat : (cat?.name || '');
                      const isSelected = String(category).toLowerCase() === catName.toLowerCase();
                      return (
                        <button
                          key={cat.id || catName}
                          type="button"
                          onClick={() => setCategory(catName)}
                          style={{
                            padding: '3px 10px',
                            borderRadius: 16,
                            fontSize: 12,
                            fontWeight: isSelected ? 700 : 500,
                            border: isSelected ? '1.5px solid #0e5c4a' : '1px solid #cbd5e1',
                            background: isSelected ? '#ecfdf5' : '#ffffff',
                            color: isSelected ? '#065f46' : '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {isSelected && <Check size={12} />}
                          <span>{catName}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="add-prod-field">
                <label htmlFor="ep-desc" className="add-prod-label">
                  <span>Description</span><span className="opt">(optional)</span>
                </label>
                <textarea id="ep-desc" className="add-prod-textarea" value={description}
                  onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            {/* Pricing */}
            <div className="add-prod-section">
              <div className="add-prod-section-header">
                <DollarSign size={18} /><span>Pricing &amp; Discount</span>
              </div>
              <div className="add-prod-row-2col">
                <div className="add-prod-field">
                  <label htmlFor="ep-price" className="add-prod-label">
                    <span>Selling Price (₹)</span><span className="req">*</span>
                  </label>
                  <input id="ep-price" type="number" step="0.01" min="0" className="add-prod-input"
                    value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)}
                    required />
                </div>
                <div className="add-prod-field">
                  <label htmlFor="ep-strike" className="add-prod-label">
                    <span>Strike-out Price (₹)</span><span className="opt">(optional)</span>
                  </label>
                  <input id="ep-strike" type="number" step="0.01" min="0" className="add-prod-input"
                    value={strikePrice} onChange={(e) => setStrikePrice(e.target.value)} />
                </div>
              </div>
              {hasDiscount && (
                <div className="add-prod-discount-pill">
                  <Percent size={14} />
                  <span>Save ₹{savingsAmount} ({discountPercent}% OFF)</span>
                </div>
              )}
            </div>

            {/* Unit & Inventory */}
            <div className="add-prod-section">
              <div className="add-prod-section-header">
                <Layers size={18} /><span>Unit &amp; Inventory</span>
              </div>
              <div className="add-prod-row-2col">
                <div className="add-prod-field">
                  <label htmlFor="ep-unit" className="add-prod-label">
                    <span>Unit of Measurement</span><span className="req">*</span>
                  </label>
                  
                  {/* Quick Select Unit Pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                    {QUICK_UNITS.map((u) => {
                      const isSelected = unit === u || unit?.toLowerCase() === u.toLowerCase();
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setUnit(u)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: isSelected ? 700 : 500,
                            border: isSelected ? '1.5px solid #0e5c4a' : '1px solid #cbd5e1',
                            background: isSelected ? '#ecfdf5' : '#ffffff',
                            color: isSelected ? '#065f46' : '#334155',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {isSelected && <Check size={11} style={{ color: '#059669' }} />}
                          <span>{u}</span>
                        </button>
                      );
                    })}
                  </div>

                  <select id="ep-unit" className="add-prod-select" value={unit}
                    onChange={(e) => setUnit(e.target.value)} required>
                    {unitOptions.map((u, i) => <option key={i} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="add-prod-field">
                  <label htmlFor="ep-stock" className="add-prod-label">
                    <span>Stock Status</span><span className="req">*</span>
                  </label>
                  <select id="ep-stock" className="add-prod-select" value={stockStatus}
                    onChange={(e) => setStockStatus(e.target.value)} required>
                    <option value="in_stock">In Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
              </div>
              <div className="add-prod-field" style={{ marginTop: 12 }}>
                <label htmlFor="ep-stock-qty" className="add-prod-label">
                  <span>Available Stock Quantity</span><span className="opt">(units)</span>
                </label>
                <input
                  id="ep-stock-qty"
                  type="number"
                  min="0"
                  step="1"
                  className="add-prod-input"
                  placeholder="e.g. 50"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </div>
            </div>

            {/* Image */}
            <div className="add-prod-section">
              <div className="add-prod-section-header">
                <ImageIcon size={18} /><span>Product Images ({images.length}/8) *</span>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: -4, marginBottom: 12 }}>
                Upload or link up to 8 high-resolution images. Recommended: <strong>1200×1200 px (1:1 square)</strong>. The first image is the Primary storefront image.
              </p>

              {/* Image Input Mode Switch: Upload File vs Image URL */}
              <div className="prod-video-mode-selector" style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  className={`prod-video-mode-btn ${imageInputMode === 'upload' ? 'active' : ''}`}
                  onClick={() => setImageInputMode('upload')}
                >
                  <UploadCloud size={14} />
                  <span>Upload Image File(s)</span>
                </button>
                <button
                  type="button"
                  className={`prod-video-mode-btn ${imageInputMode === 'url' ? 'active' : ''}`}
                  onClick={() => setImageInputMode('url')}
                >
                  <LinkIcon size={14} />
                  <span>Add Image by URL</span>
                </button>
              </div>

              {/* Invisible native file input - permanently mounted for reliable ref access */}
              <input
                type="file"
                ref={fileInputRef}
                multiple={replacingIndex === null}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleMultipleFiles(e.target.files);
                  }
                  e.target.value = '';
                }}
              />

              {/* Mode A: URL input with Add button */}
              {imageInputMode === 'url' && (
                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="ep-img-url" className="add-prod-label">
                    <span>Direct Image URL</span>
                    <span className="opt">(JPG, PNG, WEBP, or HTTPS CDN link)</span>
                  </label>
                  <div className="prod-video-url-input-row">
                    <input
                      id="ep-img-url"
                      type="url"
                      className="add-prod-input"
                      placeholder="https://images.unsplash.com/... or https://cdn.../product.jpg"
                      value={imageUrlInput}
                      onChange={(e) => {
                        setImageUrlInput(e.target.value);
                        setImageUrlError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyImageUrl();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="prod-video-apply-btn"
                      onClick={handleApplyImageUrl}
                    >
                      <Plus size={14} /> Add Image
                    </button>
                  </div>
                  {imageUrlError && <p className="prod-video-error-text">{imageUrlError}</p>}
                </div>
              )}

              {/* Mode B: File upload dropzone */}
              {imageInputMode === 'upload' && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    className={`add-prod-dropzone ${dragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => !uploading && triggerFileInput(null)}
                  >
                    {uploading ? (
                      <div className="add-prod-upload-loading">
                        <Loader2 size={36} className="add-prod-spinner" />
                        <div className="upload-loading-text">
                          <strong>Uploading Image to CDN…</strong>
                          <span>Storing securely on Cloudinary CDN</span>
                        </div>
                      </div>
                    ) : (
                      <div className="add-prod-dropzone-content">
                        <div className="add-prod-dropzone-icon">
                          <UploadCloud size={38} />
                        </div>
                        <div className="add-prod-dropzone-text">
                          <p className="dropzone-main">
                            <strong>{images.length > 0 ? 'Click to add more images' : 'Click to select images'}</strong> or drag &amp; drop
                          </p>
                          <p className="dropzone-sub">PNG, JPG, WEBP (Max 10MB per image • Up to 8 total)</p>
                        </div>
                        <span className="dropzone-badge">
                          <Cloud size={13} /> Cloudinary Direct Storage
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Primary Image Box (if any image exists) */}
              {images.length > 0 && (
                <div className="add-prod-uploaded-box">
                  <div className="add-prod-uploaded-left">
                    <img src={images[0] || image} alt="Product primary" className="add-prod-uploaded-img" />
                    <div className="add-prod-uploaded-meta">
                      <div className="add-prod-uploaded-title">
                        <CheckCircle size={15} className="uploaded-check-icon" />
                        <span>Primary Cover Image ({images.length}/8 total)</span>
                      </div>
                      <span className="add-prod-uploaded-url" title={images[0] || image}>
                        {images[0] || image}
                      </span>
                    </div>
                  </div>
                  <div className="add-prod-uploaded-actions">
                    <button
                      type="button"
                      className="add-prod-action-btn replace"
                      onClick={() => triggerFileInput(0)}
                      disabled={uploading}
                      title="Replace primary image"
                    >
                      <RefreshCw size={13} />
                      <span>Replace</span>
                    </button>
                    {images.length < 8 && (
                      <button
                        type="button"
                        className="add-prod-action-btn replace"
                        onClick={() => triggerFileInput(null)}
                        disabled={uploading}
                        title="Add another image"
                      >
                        <Plus size={13} />
                        <span>Add More</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="add-prod-action-btn remove"
                      onClick={() => {
                        setImages([]);
                        setImage('');
                        replacingIndexRef.current = null;
                        setReplacingIndex(null);
                      }}
                      disabled={uploading}
                      title="Clear all images"
                    >
                      <Trash2 size={13} />
                      <span>Clear All</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Gallery Thumbnails Strip */}
              {images.length > 0 && (
                <div style={{ marginTop: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Gallery Images ({images.length}/8) • First image is Primary
                    </span>
                    {images.length < 8 && (
                      <button
                        type="button"
                        style={{ background: '#0e5c4a', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => triggerFileInput(null)}
                        disabled={uploading}
                      >
                        <Plus size={13} /> Add More
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 10 }}>
                    {images.map((imgUrl, idx) => {
                      const isExisting = initialImages.includes(imgUrl);
                      return (
                        <div
                          key={idx}
                          style={{
                            position: 'relative',
                            aspectRatio: '1/1',
                            borderRadius: 8,
                            overflow: 'hidden',
                            border: idx === 0 ? '2.5px solid #0e5c4a' : '1px solid #cbd5e1',
                            background: '#fff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                          }}
                        >
                          <img src={imgUrl} alt={`Gallery ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              background: idx === 0 ? 'rgba(14, 92, 74, 0.95)' : (isExisting ? 'rgba(30, 41, 59, 0.85)' : 'rgba(2, 132, 199, 0.85)'),
                              color: '#fff',
                              fontSize: 9.5,
                              fontWeight: 700,
                              textAlign: 'center',
                              padding: '2px 0',
                              letterSpacing: '0.05em'
                            }}
                          >
                            {idx === 0 ? 'PRIMARY' : (isExisting ? 'SAVED' : 'NEW')}
                          </span>
                          <div style={{ position: 'absolute', top: 3, right: 3, display: 'flex', gap: 3 }}>
                            {idx !== 0 && (
                              <button
                                type="button"
                                title="Make Primary Image"
                                onClick={() => handleSetPrimaryImage(idx)}
                                style={{ background: 'rgba(0,0,0,0.7)', color: '#fbbf24', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
                              >
                                ★
                              </button>
                            )}
                            <button
                              type="button"
                              title="Replace this image"
                              onClick={() => triggerFileInput(idx)}
                              disabled={uploading}
                              style={{ background: 'rgba(14,92,74,0.9)', color: '#fff', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <RefreshCw size={11} />
                            </button>
                            <button
                              type="button"
                              title="Remove image"
                              onClick={() => handleRemoveGalleryImage(idx)}
                              disabled={uploading}
                              style={{ background: 'rgba(220,38,38,0.9)', color: '#fff', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, lineHeight: 1 }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Product Video */}
            <div className="add-prod-section">
              <div className="add-prod-section-header">
                <Video size={18} /><span>Product Video (Optional)</span>
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
                  <label htmlFor="ep-video-url" className="add-prod-label">
                    <span>Product Video URL</span>
                    <span className="opt">(YouTube, Vimeo, or direct MP4/WebM)</span>
                  </label>
                  <div className="prod-video-url-input-row">
                    <input
                      id="ep-video-url"
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
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="add-prod-action-btn replace"
                        onClick={() => {
                          setVideoUrl('');
                          setVideoUrlInput(videoUrl);
                        }}
                        title="Replace product video"
                      >
                        <RefreshCw size={13} />
                        <span>Replace Video</span>
                      </button>
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

            {/* Actions */}
            <div className="add-prod-actions">
              <button type="submit" className="add-prod-submit-btn" disabled={submitting}>
                {submitting ? (
                  <Loader2 size={18} className="add-prod-spinner" />
                ) : (
                  <CheckCircle size={18} />
                )}
                <span>
                  {submitting
                    ? 'Saving…'
                    : effectiveMode === 'admin'
                    ? 'Save Product Changes (Live Update)'
                    : isApproved
                    ? 'Submit Revisions for Admin Approval'
                    : 'Save Changes'}
                </span>
              </button>
              <button type="button" className="add-prod-cancel-btn" onClick={onBack}>
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Live preview */}
        <div className="add-prod-preview-card">
          <div className="add-prod-preview-header">
            <h4>Product Preview</h4>
            <span className="add-prod-preview-badge">Current State</span>
          </div>
          <div className="mockup-product-card">
            <div className="mockup-image-box">
              {image ? (
                <img src={image} alt={name || 'Preview'} className="mockup-image"
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80'; }} />
              ) : (
                <div className="mockup-no-image">
                  <ImageIcon size={32} /><span>No image</span>
                </div>
              )}
              {hasDiscount && <div className="mockup-discount-tag">{discountPercent}% OFF</div>}
            </div>
            <div className="mockup-card-body">
              <span className="mockup-category-tag">{category || 'CATEGORY'}</span>
              <h4 className="mockup-title">{name || 'Product Name'}</h4>
              <span className="mockup-unit-pill">{unit}</span>
              <div className="mockup-price-row">
                <span className="mockup-selling-price">
                  ₹{sellingPrice ? Number(sellingPrice).toLocaleString('en-IN') : '0'}
                </span>
                {hasDiscount && (
                  <span className="mockup-strike-price">₹{Number(strikePrice).toLocaleString('en-IN')}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: 16,
    color: '#475569'
  },
  adminBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
    padding: '10px 14px',
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13
  },
  reapprovalBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e',
    padding: '10px 14px',
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13
  },
  warningBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    padding: '10px 14px',
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13
  },
  infoBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1e40af',
    padding: '10px 14px',
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13
  }
};
