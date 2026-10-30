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
  PlayCircle
} from 'lucide-react';
import api from '../../utils/api';
import { getProducts } from '../../utils/storage';
import { isValidVideoUrl, getYoutubeEmbedUrl } from './AddProduct';
import './AddProduct.css';

const UNIT_OPTIONS = [
  'Pieces (PCS)', 'Nos (Numbers)', 'Kilogram (KG)', 'Gram (G)',
  'Litre (L)', 'Millilitre (ML)', 'Metre (M)', 'Centimetre (CM)',
  'Feet (FT)', 'Box', 'Pack', 'Set', 'Pair', 'Dozen',
  'Roll', 'Bundle', 'Carton', 'Bottle', 'Packet', 'Bag'
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
  const [sellingPrice, setSellingPrice] = useState('');
  const [strikePrice, setStrikePrice] = useState('');
  const [unit, setUnit] = useState(UNIT_OPTIONS[2]);
  const [stockStatus, setStockStatus] = useState('in_stock');
  const [categoriesList, setCategoriesList] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showManualUrl, setShowManualUrl] = useState(false);
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
    api.getProduct(productId, 'vendor')
      .then((res) => {
        if (!res?.success || !res.product) throw new Error(res?.error || 'Product not found');
        const p = res.product;
        setProduct(p);
        setName(p.title || p.name || '');
        setDescription(p.description || '');
        setCategory(p.category || '');
        setImage(p.image || '');
        setSellingPrice(p.price ? String(p.price) : '');
        setStrikePrice(p.strikePrice ? String(p.strikePrice) : '');
        setUnit(p.unit || UNIT_OPTIONS[2]);
        setStockStatus(p.stockStatus || 'in_stock');
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
          setSellingPrice(local.price ? String(local.price) : '');
          setStrikePrice(local.strikePrice ? String(local.strikePrice) : '');
          setUnit(local.unit || UNIT_OPTIONS[2]);
          setStockStatus(local.stockStatus || 'in_stock');
          setVideoUrl(local.videoUrl || local.video_url || '');
          setVideoUrlInput(local.videoUrl || local.video_url || '');
          setLoading(false);
          return;
        }
        setLoadError(err.message || 'Could not load product');
        setLoading(false);
      });

    // Load categories
    api.getCategories({ vendorId: vendor?.id || '' })
      .then((data) => {
        if (data?.success && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategoriesList(data.categories);
        } else {
          setCategoriesList([{ id: 'default', name: 'General' }]);
        }
      })
      .catch(() => setCategoriesList([{ id: 'default', name: 'General' }]));
  }, [productId, vendor?.id]);

  const parsedSelling = parseFloat(sellingPrice) || 0;
  const parsedStrike = parseFloat(strikePrice) || 0;
  const hasDiscount = parsedStrike > parsedSelling && parsedSelling > 0;
  const discountPercent = hasDiscount ? Math.round(((parsedStrike - parsedSelling) / parsedStrike) * 100) : 0;
  const savingsAmount = hasDiscount ? (parsedStrike - parsedSelling).toFixed(2) : 0;

  // File upload
  const handleFileUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please upload an image file (PNG, JPG, WEBP, etc.)', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('Image size should be less than 10MB', 'error'); return; }
    setUploading(true);
    try {
      const uploadRole = effectiveMode === 'admin' ? 'admin' : 'vendor';
      const data = await api.uploadImage(file, uploadRole);
      if (data?.success && data.url) {
        setImage(data.url);
        showToast('Image uploaded successfully!', 'success');
      } else {
        showToast((data?.error) || 'Upload failed', 'error');
      }
    } catch (err) {
      showToast('Upload failed: ' + (err.message || 'unknown error'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileUpload(file);
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
      const res = await api.updateProduct(productId, {
        title: name.trim(),
        name: name.trim(),
        description: description.trim(),
        category: category || 'General',
        price: parsedSelling,
        strikePrice: parsedStrike > 0 ? parsedStrike : null,
        unit,
        image: image.trim(),
        videoUrl: videoUrl ? videoUrl.trim() : null,
        stockStatus
      });
      if (res?.success) {
        showToast('Product updated successfully!', 'success');
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
        <ArrowLeft size={14} /> Back to products
      </button>

      {/* Status notices */}
      {isRejected && (
        <div style={styles.warningBanner}>
          <AlertCircle size={15} />
          <span>This product was rejected by the admin. Editing and saving will reset its status to <strong>pending review</strong>.</span>
        </div>
      )}
      {isApproved && (
        <div style={styles.infoBanner}>
          <AlertCircle size={15} />
          <span>This product is <strong>approved</strong> and live. Vendors cannot edit approved products — contact support if changes are needed.</span>
        </div>
      )}

      <div className="add-prod-grid">
        <div className="add-prod-form-card">
          <form onSubmit={handleSubmit}>
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
                  onChange={(e) => setName(e.target.value)} required disabled={isApproved} />
              </div>
              <div className="add-prod-field">
                <label htmlFor="ep-cat" className="add-prod-label">
                  <span>Category</span><span className="req">*</span>
                </label>
                <select id="ep-cat" className="add-prod-select" value={category}
                  onChange={(e) => setCategory(e.target.value)} required disabled={isApproved}>
                  <option value="" disabled>Select category</option>
                  {categoriesList.map((cat) => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="add-prod-field">
                <label htmlFor="ep-desc" className="add-prod-label">
                  <span>Description</span><span className="opt">(optional)</span>
                </label>
                <textarea id="ep-desc" className="add-prod-textarea" value={description}
                  onChange={(e) => setDescription(e.target.value)} disabled={isApproved} />
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
                    required disabled={isApproved} />
                </div>
                <div className="add-prod-field">
                  <label htmlFor="ep-strike" className="add-prod-label">
                    <span>Strike-out Price (₹)</span><span className="opt">(optional)</span>
                  </label>
                  <input id="ep-strike" type="number" step="0.01" min="0" className="add-prod-input"
                    value={strikePrice} onChange={(e) => setStrikePrice(e.target.value)}
                    disabled={isApproved} />
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
                    <span>Unit</span><span className="req">*</span>
                  </label>
                  <select id="ep-unit" className="add-prod-select" value={unit}
                    onChange={(e) => setUnit(e.target.value)} required disabled={isApproved}>
                    {UNIT_OPTIONS.map((u, i) => <option key={i} value={u}>{u}</option>)}
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
            </div>

            {/* Image */}
            {!isApproved && (
              <div className="add-prod-section">
                <div className="add-prod-section-header">
                  <ImageIcon size={18} /><span>Product Image</span>
                </div>
                <input type="file" ref={fileInputRef}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                  accept="image/*" style={{ display: 'none' }} />
                {!image ? (
                  <div
                    className={`add-prod-dropzone ${dragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
                    onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <div className="add-prod-upload-loading">
                        <Loader2 size={36} className="add-prod-spinner" />
                        <div className="upload-loading-text">
                          <strong>Uploading…</strong>
                          <span>Storing securely on Cloudinary CDN</span>
                        </div>
                      </div>
                    ) : (
                      <div className="add-prod-dropzone-content">
                        <div className="add-prod-dropzone-icon"><UploadCloud size={38} /></div>
                        <div className="add-prod-dropzone-text">
                          <p className="dropzone-main"><strong>Click to upload</strong> or drag &amp; drop</p>
                          <p className="dropzone-sub">PNG, JPG, WEBP, GIF (up to 10MB)</p>
                        </div>
                        <span className="dropzone-badge"><Cloud size={13} /> Cloudinary Direct Storage</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="add-prod-uploaded-box">
                    <div className="add-prod-uploaded-left">
                      <img src={image} alt="Product preview" className="add-prod-uploaded-img" />
                      <div className="add-prod-uploaded-meta">
                        <div className="add-prod-uploaded-title">
                          <CheckCircle size={15} className="uploaded-check-icon" />
                          <span>Product Image Ready</span>
                        </div>
                        <span className="add-prod-uploaded-url" title={image}>
                          {image.startsWith('data:') ? 'Image selected' : image}
                        </span>
                      </div>
                    </div>
                    <div className="add-prod-uploaded-actions">
                      <button type="button" className="add-prod-action-btn replace"
                        onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        <RefreshCw size={13} /><span>Change</span>
                      </button>
                      <button type="button" className="add-prod-action-btn remove"
                        onClick={() => setImage('')} disabled={uploading}>
                        <Trash2 size={13} /><span>Remove</span>
                      </button>
                    </div>
                  </div>
                )}
                <div className="add-prod-url-toggle-wrap">
                  <button type="button" className="add-prod-url-toggle-btn"
                    onClick={() => setShowManualUrl(!showManualUrl)}>
                    <LinkIcon size={12} />
                    <span>{showManualUrl ? 'Hide image URL input' : 'Or paste image URL manually'}</span>
                  </button>
                </div>
                {showManualUrl && (
                  <div className="add-prod-field add-prod-manual-url">
                    <input type="url" className="add-prod-input" placeholder="Enter image URL"
                      value={image} onChange={(e) => setImage(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            {/* Product Video */}
            {!isApproved && (
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
            )}

            {/* Actions */}
            {!isApproved && (
              <div className="add-prod-actions">
                <button type="submit" className="add-prod-submit-btn" disabled={submitting}>
                  {submitting ? <Loader2 size={18} className="add-prod-spinner" /> : <CheckCircle size={18} />}
                  <span>{submitting ? 'Saving…' : 'Save Changes'}</span>
                </button>
                <button type="button" className="add-prod-cancel-btn" onClick={onBack}>
                  Cancel
                </button>
              </div>
            )}
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
