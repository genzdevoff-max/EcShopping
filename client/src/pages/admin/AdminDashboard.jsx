import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import {
  LogOut, RefreshCw, CheckCircle, XCircle, Package, Users as UsersIcon,
  ShoppingCart, PackageSearch, ClipboardList, Loader2, Plus, Edit2, Trash2,
  Menu, X, CreditCard, ShieldCheck, Globe, AlertTriangle, Save, Eye, EyeOff, Lock, CheckCircle2,
  UploadCloud, Link as LinkIcon, Play, FileVideo, Film, Store,
  Image as ImageIcon, ArrowUp, ArrowDown, Sparkles
} from 'lucide-react';
import api, { authSessions } from '../../utils/api';
import { getCurrentAdmin } from '../../utils/storage';
import Pagination from '../../components/ui/Pagination';
import VendorSelect from '../../components/admin/VendorSelect';
import { FormSkeleton } from '../../components/ui/States';
import './AdminDashboard.css';

const AddProduct = lazy(() => import('../vendor/AddProduct'));

const ORDER_STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
const fmtINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

/* Reads straight from the Express APIs with the admin token — localStorage
 * caches are never used for admin state, and every mutation is confirmed by
 * the server before the list is refreshed. */
export default function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [state, setState] = useState({ loading: true, error: null, vendors: [], products: [], orders: [], users: [], categories: [], videos: [], banners: [] });
  const [attempt, setAttempt] = useState(0);

  /* Admin Add Product state */
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productCreatedMsg, setProductCreatedMsg] = useState(null);

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
  const [vidInputMode, setVidInputMode] = useState('upload'); // 'upload' | 'url'
  const [newVidTitle, setNewVidTitle] = useState('');
  const [newVidDesc, setNewVidDesc] = useState('');
  const [newVidUrl, setNewVidUrl] = useState('');
  const [newVidThumb, setNewVidThumb] = useState('');
  const [newVidProduct, setNewVidProduct] = useState('');
  const [newVidOrder, setNewVidOrder] = useState('0');
  const [creatingVid, setCreatingVid] = useState(false);
  const [vidFormMsg, setVidFormMsg] = useState({ type: null, text: '' });

  // Local Video Upload state
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [localVideoPreview, setLocalVideoPreview] = useState(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const videoFileInputRef = useRef(null);

  // Video Preview Modal in table
  const [previewingVideo, setPreviewingVideo] = useState(null);

  /* Category filters and pagination */
  const [catSearch, setCatSearch] = useState('');
  const [catScopeFilter, setCatScopeFilter] = useState('all');
  const [catStatusFilter, setCatStatusFilter] = useState('all');
  const [catPage, setCatPage] = useState(1);
  const [catPageSize, setCatPageSize] = useState(10);

  /* Products filters and pagination */
  const [prodSearch, setProdSearch] = useState('');
  const [prodStatusFilter, setProdStatusFilter] = useState('all');
  const [prodStockFilter, setProdStockFilter] = useState('all');
  const [prodOwnerFilter, setProdOwnerFilter] = useState('all');
  const [prodPage, setProdPage] = useState(1);
  const [prodPageSize, setProdPageSize] = useState(10);

  /* Vendors filters and pagination */
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorStatusFilter, setVendorStatusFilter] = useState('all');
  const [vendorPage, setVendorPage] = useState(1);
  const [vendorPageSize, setVendorPageSize] = useState(10);

  /* Vendor removal / deactivation modal state */
  const [vendorToRemove, setVendorToRemove] = useState(null);
  const [vendorRemoveLoading, setVendorRemoveLoading] = useState(false);
  const [vendorRemoveError, setVendorRemoveError] = useState('');
  const [vendorRemoveSuccess, setVendorRemoveSuccess] = useState('');

  /* Orders filters and pagination */
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('all');
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);

  /* Customers filters and pagination */
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize, setCustomerPageSize] = useState(10);

  /* Videos filters and pagination */
  const [videoSearch, setVideoSearch] = useState('');
  const [videoPage, setVideoPage] = useState(1);
  const [videoPageSize, setVideoPageSize] = useState(10);

  /* Homepage Banner Management state */
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState(null);
  const [bannerForm, setBannerForm] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    imagePublicId: '',
    ctaText: 'Shop Now',
    ctaLink: '/shop',
    secondaryCtaText: '',
    secondaryCtaLink: '',
    tag: 'Direct Farm Harvest',
    badge: '100% Certified Organic • Free Delivery over ₹499',
    displayOrder: 0,
    isActive: true
  });
  const [bannerFormMsg, setBannerFormMsg] = useState({ type: null, text: '' });
  const [bannerUploadingImg, setBannerUploadingImg] = useState(false);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerSearch, setBannerSearch] = useState('');
  const [bannerStatusFilter, setBannerStatusFilter] = useState('all');
  const [bannerToDelete, setBannerToDelete] = useState(null);
  const [bannerDeleteLoading, setBannerDeleteLoading] = useState(false);
  const bannerFileInputRef = useRef(null);

  /* Payment Gateway Configuration audit & edit state */
  const [paymentConfig, setPaymentConfig] = useState({ loading: false, data: null, error: null });
  const [paymentForm, setPaymentForm] = useState({
    environment: 'production',
    merchantId: '',
    saltKey: '',
    saltIndex: '1',
    redirectUrl: '',
    showSaltKey: false
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentSaveMsg, setPaymentSaveMsg] = useState({ type: null, text: '' });

  // Proactive session validation: reject immediately if token or admin profile is absent or invalid
  useEffect(() => {
    const token = authSessions.get('admin');
    const admin = getCurrentAdmin();
    if (!token || !admin || admin.role !== 'admin') {
      if (typeof onLogout === 'function') onLogout();
    }
  }, [onLogout]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const [vendorRes, productRes, orderRes, userRes, catRes, videoRes, bannerRes] = await Promise.all([
          api.getVendors(),
          api.getProducts({}, 'admin'),
          api.getOrders({}, 'admin'),
          api.getUsers(),
          api.getCategories({}, 'admin'),
          api.getVideos().catch(() => ({ success: true, videos: [] })),
          api.getAdminBanners().catch(() => ({ success: true, banners: [] }))
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
          videos: videoRes?.videos || [],
          banners: bannerRes?.banners || []
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

  /* Fetch Payment Config when Payment Gateway tab is active */
  useEffect(() => {
    if (activeTab !== 'payment') return;
    let cancelled = false;
    setPaymentConfig({ loading: true, data: null, error: null });
    api.getPaymentConfig()
      .then((res) => {
        if (!cancelled) {
          setPaymentConfig({ loading: false, data: res, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPaymentConfig({ loading: false, data: null, error: err.message || 'Failed to load payment configuration' });
        }
      });
    return () => { cancelled = true; };
  }, [activeTab, attempt]);

  /* Pre-fill payment settings form when paymentConfig loads */
  useEffect(() => {
    if (paymentConfig.data) {
      setPaymentForm((prev) => ({
        ...prev,
        environment: paymentConfig.data.environment || 'production',
        merchantId: paymentConfig.data.v1?.merchantId || '',
        saltIndex: paymentConfig.data.v1?.saltIndex || '1',
        redirectUrl: paymentConfig.data.redirectUrl || '',
        saltKey: ''
      }));
    }
  }, [paymentConfig.data]);

  const handleSavePaymentConfig = async (e) => {
    e.preventDefault();
    setSavingPayment(true);
    setPaymentSaveMsg({ type: null, text: '' });
    try {
      const payload = {
        environment: paymentForm.environment,
        merchantId: paymentForm.merchantId.trim(),
        saltIndex: paymentForm.saltIndex.trim() || '1',
        redirectUrl: paymentForm.redirectUrl.trim()
      };
      if (paymentForm.saltKey.trim()) {
        payload.saltKey = paymentForm.saltKey.trim();
      }
      const res = await api.updatePaymentConfig(payload);
      if (res?.success) {
        setPaymentSaveMsg({ type: 'success', text: 'PhonePe gateway configuration saved and active immediately!' });
        setPaymentForm((prev) => ({ ...prev, saltKey: '' }));
        const refreshed = await api.getPaymentConfig();
        setPaymentConfig({ loading: false, data: refreshed, error: null });
      } else {
        setPaymentSaveMsg({ type: 'error', text: res?.error || 'Failed to update payment settings' });
      }
    } catch (err) {
      setPaymentSaveMsg({ type: 'error', text: err.message || 'Error saving payment settings' });
    } finally {
      setSavingPayment(false);
    }
  };

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

  /* Keyboard Escape to dismiss Add Product modal */
  useEffect(() => {
    if (!addProductOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setAddProductOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addProductOpen]);

  /* Handle product created by admin */
  const handleAdminProductCreated = (newProduct) => {
    setState((prev) => {
      const list = prev.products || [];
      const idx = list.findIndex((p) => String(p.id) === String(newProduct.id));
      let next;
      if (idx >= 0) {
        next = [...list];
        next[idx] = newProduct;
      } else {
        next = [newProduct, ...list];
      }
      return { ...prev, products: next };
    });
    setProductCreatedMsg({
      title: newProduct.title || newProduct.name,
      status: newProduct.status || 'approved'
    });
    setAddProductOpen(false);
    setActiveTab('products');
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

  const handleSelectVideoFile = (file) => {
    if (!file) return;

    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
    const validExts = ['.mp4', '.webm', '.mov', '.ogg'];
    const hasValidExt = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!validTypes.includes(file.type) && !hasValidExt) {
      setVidFormMsg({ type: 'error', text: 'Unsupported video format. Please choose an MP4, WebM, MOV, or OGG video file.' });
      return;
    }

    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setVidFormMsg({ type: 'error', text: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed limit of 50MB.` });
      return;
    }

    if (localVideoPreview) {
      URL.revokeObjectURL(localVideoPreview);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedVideoFile(file);
    setLocalVideoPreview(objectUrl);
    setVideoUploadProgress(0);
    setVidFormMsg({ type: null, text: '' });

    if (!newVidTitle.trim()) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      setNewVidTitle(cleanName);
    }
  };

  const handleClearSelectedVideo = () => {
    if (localVideoPreview) {
      URL.revokeObjectURL(localVideoPreview);
    }
    setSelectedVideoFile(null);
    setLocalVideoPreview(null);
    setVideoUploadProgress(0);
    setIsUploadingVideo(false);
    if (videoFileInputRef.current) {
      videoFileInputRef.current.value = '';
    }
  };

  const handleCreateVideo = async (e) => {
    e.preventDefault();
    if (!newVidTitle.trim()) {
      setVidFormMsg({ type: 'error', text: 'Please enter a video title.' });
      return;
    }
    if (!newVidProduct) {
      setVidFormMsg({ type: 'error', text: 'Please select an approved product to attach to this video.' });
      return;
    }

    if (vidInputMode === 'upload' && !selectedVideoFile) {
      setVidFormMsg({ type: 'error', text: 'Please select a local video file from your device, or switch to Video URL.' });
      return;
    }

    if (vidInputMode === 'url') {
      const trimmedUrl = newVidUrl.trim();
      if (!trimmedUrl || (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://'))) {
        setVidFormMsg({ type: 'error', text: 'Please enter a valid http(s) video URL (YouTube, Vimeo, or direct MP4).' });
        return;
      }
    }

    setCreatingVid(true);
    setVidFormMsg({ type: null, text: '' });

    let finalVideoUrl = newVidUrl.trim();
    let uploadMetadata = {};

    try {
      if (vidInputMode === 'upload' && selectedVideoFile) {
        setIsUploadingVideo(true);
        setVideoUploadProgress(10);

        const uploadRes = await api.uploadVideo(
          selectedVideoFile,
          'admin',
          (percent) => setVideoUploadProgress(Math.max(10, percent))
        );

        if (!uploadRes?.success || !uploadRes.url) {
          throw new Error(uploadRes?.error || 'Cloudinary video upload failed. Please try again.');
        }

        finalVideoUrl = uploadRes.url;
        uploadMetadata = {
          publicId: uploadRes.publicId || uploadRes.public_id,
          format: uploadRes.format,
          duration: uploadRes.duration,
          bytes: uploadRes.bytes
        };
        setVideoUploadProgress(100);
      }

      const res = await api.createVideo({
        title: newVidTitle.trim(),
        description: newVidDesc.trim(),
        videoUrl: finalVideoUrl,
        thumbnailUrl: newVidThumb.trim() || null,
        productId: newVidProduct,
        displayOrder: Number(newVidOrder) || 0,
        ...uploadMetadata
      });

      if (res?.success) {
        handleClearSelectedVideo();
        setNewVidTitle('');
        setNewVidDesc('');
        setNewVidUrl('');
        setNewVidThumb('');
        setNewVidProduct('');
        setNewVidOrder('0');
        setVidFormMsg({ type: 'success', text: 'Video review saved successfully!' });
        setAttempt((n) => n + 1);
        setTimeout(() => setVidFormMsg({ type: null, text: '' }), 4000);
      } else {
        setVidFormMsg({ type: 'error', text: res?.error || 'Failed to add video' });
      }
    } catch (err) {
      setVidFormMsg({ type: 'error', text: err?.message || 'Failed to process video review' });
    } finally {
      setCreatingVid(false);
      setIsUploadingVideo(false);
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

  const runRowAction = async (id, action, failMessage) => {
    setBusyId(id);
    setActionError({ id: null, message: '' });
    try {
      await action();
      setAttempt((n) => n + 1);
    } catch (err) {
      setActionError({ id, message: err?.message ? `${failMessage}: ${err.message}` : failMessage });
    } finally {
      setBusyId(null);
    }
  };

  const retry = () => setAttempt((n) => n + 1);

  const handleConfirmRemoveVendor = async () => {
    if (!vendorToRemove) return;
    setVendorRemoveLoading(true);
    setVendorRemoveError('');
    setVendorRemoveSuccess('');
    try {
      const res = await api.deleteVendor(vendorToRemove.id);
      if (res?.success) {
        setVendorRemoveSuccess(res.message || 'Vendor action completed.');
        setAttempt((n) => n + 1);
        setTimeout(() => {
          setVendorToRemove(null);
          setVendorRemoveSuccess('');
        }, 1500);
      } else {
        setVendorRemoveError(res?.error || 'Failed to remove vendor.');
      }
    } catch (err) {
      setVendorRemoveError(err.message || 'Failed to remove vendor.');
    } finally {
      setVendorRemoveLoading(false);
    }
  };

  /* Banner action handlers */
  const handleOpenAddBanner = () => {
    setEditingBannerId(null);
    setBannerForm({
      title: '',
      subtitle: '',
      imageUrl: '',
      imagePublicId: '',
      ctaText: 'Shop Now',
      ctaLink: '/shop',
      secondaryCtaText: '',
      secondaryCtaLink: '',
      tag: 'Direct Farm Harvest',
      badge: '100% Certified Organic • Free Delivery over ₹499',
      displayOrder: (state.banners || []).length,
      isActive: true
    });
    setBannerFormMsg({ type: null, text: '' });
    setBannerModalOpen(true);
  };

  const handleOpenEditBanner = (b) => {
    setEditingBannerId(b.id);
    setBannerForm({
      title: b.title || '',
      subtitle: b.subtitle || '',
      imageUrl: b.image_url || b.imageUrl || '',
      imagePublicId: b.image_public_id || b.imagePublicId || '',
      ctaText: b.cta_text || b.ctaText || 'Shop Now',
      ctaLink: b.cta_link || b.ctaLink || '/shop',
      secondaryCtaText: b.secondary_cta_text || b.secondaryCtaText || '',
      secondaryCtaLink: b.secondary_cta_link || b.secondaryCtaLink || '',
      tag: b.tag || 'Direct Farm Harvest',
      badge: b.badge || '',
      displayOrder: b.display_order ?? b.displayOrder ?? 0,
      isActive: Boolean(b.is_active ?? b.isActive ?? 1)
    });
    setBannerFormMsg({ type: null, text: '' });
    setBannerModalOpen(true);
  };

  const handleBannerImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!validTypes.includes(file.type)) {
      setBannerFormMsg({ type: 'error', text: 'Please select a valid image file (JPEG, PNG, WEBP, AVIF).' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setBannerFormMsg({ type: 'error', text: 'Image file size exceeds 10MB limit.' });
      return;
    }

    setBannerUploadingImg(true);
    setBannerFormMsg({ type: null, text: '' });
    try {
      const res = await api.uploadImage(file, 'admin');
      if (res?.success && res.url) {
        setBannerForm((prev) => ({
          ...prev,
          imageUrl: res.url,
          imagePublicId: res.public_id || res.publicId || ''
        }));
        setBannerFormMsg({ type: 'success', text: 'Image uploaded to Cloudinary CDN successfully!' });
      } else {
        setBannerFormMsg({ type: 'error', text: res?.error || 'Failed to upload image' });
      }
    } catch (err) {
      setBannerFormMsg({ type: 'error', text: err.message || 'Image upload failed' });
    } finally {
      setBannerUploadingImg(false);
    }
  };

  const handleSaveBanner = async (e) => {
    e.preventDefault();
    if (!bannerForm.title.trim()) {
      setBannerFormMsg({ type: 'error', text: 'Banner title is required.' });
      return;
    }
    if (!bannerForm.imageUrl.trim()) {
      setBannerFormMsg({ type: 'error', text: 'Banner image is required (upload or enter URL).' });
      return;
    }

    setBannerSaving(true);
    setBannerFormMsg({ type: null, text: '' });
    try {
      const payload = {
        title: bannerForm.title.trim(),
        subtitle: bannerForm.subtitle.trim(),
        imageUrl: bannerForm.imageUrl.trim(),
        imagePublicId: bannerForm.imagePublicId.trim() || null,
        ctaText: bannerForm.ctaText.trim() || 'Shop Now',
        ctaLink: bannerForm.ctaLink.trim() || '/shop',
        secondaryCtaText: bannerForm.secondaryCtaText.trim() || null,
        secondaryCtaLink: bannerForm.secondaryCtaLink.trim() || null,
        tag: bannerForm.tag.trim() || 'Direct Farm Harvest',
        badge: bannerForm.badge.trim(),
        displayOrder: parseInt(bannerForm.displayOrder, 10) || 0,
        isActive: Boolean(bannerForm.isActive)
      };

      if (editingBannerId) {
        const res = await api.updateBanner(editingBannerId, payload);
        if (!res?.success) throw new Error(res?.error || 'Failed to update banner');
      } else {
        const res = await api.createBanner(payload);
        if (!res?.success) throw new Error(res?.error || 'Failed to create banner');
      }

      setBannerModalOpen(false);
      setAttempt((n) => n + 1);
    } catch (err) {
      setBannerFormMsg({ type: 'error', text: err.message || 'Failed to save banner' });
    } finally {
      setBannerSaving(false);
    }
  };

  const handleToggleBannerStatus = async (banner) => {
    const currentActive = Boolean(banner.is_active ?? banner.isActive ?? 1);
    await runRowAction(banner.id, async () => {
      const res = await api.updateBanner(banner.id, { isActive: !currentActive });
      if (!res?.success) throw new Error(res?.error || 'Failed to toggle banner status');
    }, 'Failed to toggle banner status');
  };

  const handleMoveBanner = async (banner, direction) => {
    const sorted = [...(state.banners || [])].sort((a, b) => (a.display_order ?? a.displayOrder ?? 0) - (b.display_order ?? b.displayOrder ?? 0));
    const currentIndex = sorted.findIndex((b) => b.id === banner.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const temp = sorted[currentIndex];
    sorted[currentIndex] = sorted[targetIndex];
    sorted[targetIndex] = temp;

    const orderPayload = sorted.map((b, idx) => ({
      id: b.id,
      displayOrder: idx
    }));

    await runRowAction(banner.id, async () => {
      const res = await api.reorderBanners(orderPayload);
      if (!res?.success) throw new Error(res?.error || 'Failed to reorder banners');
    }, 'Failed to reorder banners');
  };

  const handleConfirmDeleteBanner = async () => {
    if (!bannerToDelete) return;
    setBannerDeleteLoading(true);
    try {
      const res = await api.deleteBanner(bannerToDelete.id);
      if (res?.success) {
        setBannerToDelete(null);
        setAttempt((n) => n + 1);
      } else {
        alert(res?.error || 'Failed to delete banner');
      }
    } catch (err) {
      alert(err.message || 'Failed to delete banner');
    } finally {
      setBannerDeleteLoading(false);
    }
  };

  /* ---------------- FILTERING LOGIC ---------------- */

  // Homepage Banners
  const filteredBanners = (state.banners || [])
    .filter((b) => {
      const query = bannerSearch.toLowerCase();
      const matchesSearch = !bannerSearch ||
        (b.title || '').toLowerCase().includes(query) ||
        (b.subtitle || '').toLowerCase().includes(query) ||
        (b.tag || '').toLowerCase().includes(query) ||
        (b.badge || '').toLowerCase().includes(query);
      const active = Boolean(b.is_active ?? b.isActive ?? 1);
      const matchesStatus =
        bannerStatusFilter === 'all' ||
        (bannerStatusFilter === 'active' && active) ||
        (bannerStatusFilter === 'inactive' && !active);
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => (a.display_order ?? a.displayOrder ?? 0) - (b.display_order ?? b.displayOrder ?? 0));

  // Categories
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

  const paginatedCategories = filteredCategories.slice(
    (catPage - 1) * catPageSize,
    catPage * catPageSize
  );

  // Products
  const filteredProducts = state.products.filter((prod) => {
    const query = prodSearch.toLowerCase();
    const isAdminProd = !prod.vendorId || prod.vendorId === 'admin' || prod.vendorName === 'Admin' || prod.vendorName === 'Platform Direct';
    const matchesSearch = !prodSearch ||
      (prod.title || '').toLowerCase().includes(query) ||
      (prod.vendorName || '').toLowerCase().includes(query) ||
      (prod.category || '').toLowerCase().includes(query) ||
      (isAdminProd && query.includes('admin'));
    const matchesStatus = prodStatusFilter === 'all' || prod.status === prodStatusFilter;
    const matchesStock = prodStockFilter === 'all' ||
      (prodStockFilter === 'in_stock' && prod.stockStatus !== 'out_of_stock') ||
      (prodStockFilter === 'out_of_stock' && prod.stockStatus === 'out_of_stock');
    const matchesOwner = prodOwnerFilter === 'all' ||
      (prodOwnerFilter === 'admin' && isAdminProd) ||
      (prodOwnerFilter === 'vendor' && !isAdminProd);
    return matchesSearch && matchesStatus && matchesStock && matchesOwner;
  });

  const paginatedProducts = filteredProducts.slice(
    (prodPage - 1) * prodPageSize,
    prodPage * prodPageSize
  );

  // Vendors
  const filteredVendors = state.vendors.filter((v) => {
    const query = vendorSearch.toLowerCase();
    const matchesSearch = !vendorSearch ||
      (v.name || '').toLowerCase().includes(query) ||
      (v.email || '').toLowerCase().includes(query);
    const matchesStatus = vendorStatusFilter === 'all' || v.status === vendorStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const paginatedVendors = filteredVendors.slice(
    (vendorPage - 1) * vendorPageSize,
    vendorPage * vendorPageSize
  );

  // Orders
  const filteredOrders = state.orders.filter((o) => {
    const query = orderSearch.toLowerCase();
    const matchesSearch = !orderSearch ||
      (o.id || '').toLowerCase().includes(query) ||
      (o.customerName || '').toLowerCase().includes(query) ||
      (o.customerEmail || '').toLowerCase().includes(query) ||
      (o.customerPhone || '').toLowerCase().includes(query);
    const matchesStatus = orderStatusFilter === 'all' || (o.status || 'Processing') === orderStatusFilter;
    const matchesPayment = orderPaymentFilter === 'all' || (o.paymentStatus || 'pending') === orderPaymentFilter;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  const paginatedOrders = filteredOrders.slice(
    (orderPage - 1) * orderPageSize,
    orderPage * orderPageSize
  );

  // Customers
  const filteredUsers = state.users.filter((u) => {
    const query = customerSearch.toLowerCase();
    return !customerSearch ||
      (u.name || '').toLowerCase().includes(query) ||
      (u.email || '').toLowerCase().includes(query) ||
      (u.phone || '').toLowerCase().includes(query);
  });

  const paginatedUsers = filteredUsers.slice(
    (customerPage - 1) * customerPageSize,
    customerPage * customerPageSize
  );

  // Videos
  const filteredVideos = (state.videos || []).filter((v) => {
    const query = videoSearch.toLowerCase();
    return !videoSearch ||
      (v.title || '').toLowerCase().includes(query) ||
      (v.productTitle || '').toLowerCase().includes(query);
  });

  const paginatedVideos = filteredVideos.slice(
    (videoPage - 1) * videoPageSize,
    videoPage * videoPageSize
  );

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
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-logo">
          <h2>EcShopping Admin</h2>
          <button
            type="button"
            className="admin-menu-toggle"
            style={{ display: sidebarOpen ? 'inline-flex' : 'none', background: 'transparent', border: 'none', color: '#cbd5e1' }}
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="admin-nav">
          {[
            ['dashboard', 'Dashboard', null],
            ['categories', 'Categories', state.categories.length],
            ['orders', 'Orders', state.orders.length],
            ['vendors', 'Vendors', state.vendors.length],
            ['products', 'Products', state.products.length],
            ['videos', 'Video Reviews', (state.videos || []).length],
            ['banners', 'Homepage Banners', (state.banners || []).length],
            ['customers', 'Customers', state.users.length],
            ['payment', 'Payment Gateway', null]
          ].map(([key, label, count]) => (
            <a
              key={key}
              href="#"
              className={activeTab === key ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab(key);
                setSidebarOpen(false);
              }}
            >
              <span>{label}</span>
              {count != null && <span style={{ opacity: 0.8, fontSize: 12 }}>({count})</span>}
            </a>
          ))}

          <div className="admin-nav-cta-wrap">
            <button
              type="button"
              className="admin-sidebar-add-btn"
              onClick={() => {
                setActiveTab('products');
                setAddProductOpen(true);
                setSidebarOpen(false);
              }}
            >
              <Plus size={15} /> Add Product
            </button>
          </div>
        </nav>
        <div className="admin-sidebar-footer">
          <button className="admin-logout-btn" onClick={onLogout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-header-title-wrap">
            <button
              type="button"
              className="admin-menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle Menu"
            >
              <Menu size={20} />
            </button>
            <h1>
              {activeTab === 'dashboard' && 'Dashboard overview'}
              {activeTab === 'categories' && 'Category & Taxonomy Management'}
              {activeTab === 'orders' && 'All customer orders'}
              {activeTab === 'vendors' && 'Vendor management'}
              {activeTab === 'products' && 'Product approvals'}
              {activeTab === 'customers' && 'Customer accounts'}
              {activeTab === 'videos' && 'Homepage Shorts & Video Reviews'}
              {activeTab === 'banners' && 'Homepage Banner Management'}
              {activeTab === 'payment' && 'Payment Gateway Configuration'}
            </h1>
          </div>
          <div className="admin-header-actions">
            {refreshBtn}
          </div>
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
            {/* ---------------- 1. DASHBOARD OVERVIEW ---------------- */}
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

                <div className="admin-placeholder-box">
                  <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>Quick actions</h3>
                  <p style={{ color: '#64748b', margin: '0 0 15px 0' }}>
                    {pendingProducts.length} product{pendingProducts.length === 1 ? '' : 's'} and{' '}
                    {pendingVendors.length} vendor account{pendingVendors.length === 1 ? '' : 's'} are waiting for review.
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {refreshBtn}
                    <button
                      type="button"
                      className="approve-btn admin-quick-add-btn"
                      onClick={() => { setActiveTab('products'); setAddProductOpen(true); }}
                    >
                      <Plus size={15} /> Add product
                    </button>
                    <button type="button" className="approve-btn" onClick={() => setActiveTab('products')}>
                      <Package size={15} /> Review products ({pendingProducts.length})
                    </button>
                    <button type="button" className="approve-btn" onClick={() => setActiveTab('vendors')}>
                      <UsersIcon size={15} /> Review vendors ({pendingVendors.length})
                    </button>
                    <button type="button" className="approve-btn" onClick={() => setActiveTab('payment')}>
                      <CreditCard size={15} /> Payment Gateway Settings
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ---------------- 2. CATEGORIES TAB ---------------- */}
            {activeTab === 'categories' && (
              <div className="admin-cat-section-wrap">
                {/* Category Creation Form with Searchable VendorSelect */}
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
                    <div className="cat-form-field">
                      <label>Category Name *</label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. Fresh Dairy"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="cat-form-field">
                      <label>Description</label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        placeholder="Short blurb for shoppers..."
                        value={newCatDesc}
                        onChange={(e) => setNewCatDesc(e.target.value)}
                      />
                    </div>

                    <div className="cat-form-field">
                      <label>Image URL (Optional)</label>
                      <input
                        type="url"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        placeholder="https://..."
                        value={newCatImage}
                        onChange={(e) => setNewCatImage(e.target.value)}
                      />
                    </div>

                    <div className="cat-form-field">
                      <label>Scope / Owner</label>
                      <VendorSelect
                        vendors={state.vendors}
                        value={newCatVendor}
                        onChange={setNewCatVendor}
                        includeShared={true}
                      />
                    </div>

                    <div className="cat-form-field">
                      <label>Status</label>
                      <select
                        className="admin-filter-input"
                        style={{ width: '100%' }}
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
                        style={{ height: 38, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        {creatingCat ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                        <span>Add Category</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Filter & Search Toolbar */}
                <div className="admin-filter-bar">
                  <input
                    type="text"
                    className="admin-filter-input"
                    placeholder="Search categories..."
                    value={catSearch}
                    onChange={(e) => { setCatSearch(e.target.value); setCatPage(1); }}
                  />
                  <select
                    className="admin-filter-input"
                    value={catScopeFilter}
                    onChange={(e) => { setCatScopeFilter(e.target.value); setCatPage(1); }}
                  >
                    <option value="all">All Scopes</option>
                    <option value="shared">Shared (Global) only</option>
                    <option value="vendor">Vendor-specific only</option>
                  </select>
                  <select
                    className="admin-filter-input"
                    value={catStatusFilter}
                    onChange={(e) => { setCatStatusFilter(e.target.value); setCatPage(1); }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active only</option>
                    <option value="inactive">Inactive only</option>
                  </select>
                </div>

                {/* Categories Table */}
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
                      {paginatedCategories.map((cat) => {
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
                                  style={{ width: '100%' }}
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
                                  style={{ width: '100%' }}
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

                <Pagination
                  currentPage={catPage}
                  totalPages={Math.ceil(filteredCategories.length / catPageSize) || 1}
                  onPageChange={setCatPage}
                  totalItems={filteredCategories.length}
                  pageSize={catPageSize}
                  onPageSizeChange={(sz) => { setCatPageSize(sz); setCatPage(1); }}
                  pageSizeOptions={[10, 25, 50]}
                />
              </div>
            )}

            {/* ---------------- 3. VENDORS TAB ---------------- */}
            {activeTab === 'vendors' && (
              <div className="admin-vendors-section">
                <div className="vendors-header">
                  <h2>Registered vendors</h2>
                  <p>Approved, rejected and pending vendor accounts in the database</p>
                </div>

                <div className="admin-filter-bar">
                  <input
                    type="text"
                    className="admin-filter-input"
                    placeholder="Search by vendor name or email..."
                    value={vendorSearch}
                    onChange={(e) => { setVendorSearch(e.target.value); setVendorPage(1); }}
                  />
                  <select
                    className="admin-filter-input"
                    value={vendorStatusFilter}
                    onChange={(e) => { setVendorStatusFilter(e.target.value); setVendorPage(1); }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="deactivated">Deactivated</option>
                  </select>
                </div>

                <div className="vendors-table-container">
                  <table className="vendors-table">
                    <thead>
                      <tr>
                        <th>Name</th><th>Email</th><th>Joined</th><th>Status</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedVendors.map((vendor) => (
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {vendor.status === 'pending' && (
                                <div className="action-buttons">
                                  <button
                                    type="button"
                                    className="approve-btn"
                                    disabled={busyId === vendor.id}
                                    onClick={() => runRowAction(vendor.id, () => api.updateVendorStatus(vendor.id, 'approved'), 'Vendor approval failed')}
                                  >
                                    <CheckCircle size={15} /> Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="reject-btn"
                                    disabled={busyId === vendor.id}
                                    onClick={() => runRowAction(vendor.id, () => api.updateVendorStatus(vendor.id, 'rejected'), 'Vendor rejection failed')}
                                  >
                                    <XCircle size={15} /> Reject
                                  </button>
                                </div>
                              )}
                              {vendor.status === 'approved' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                              {vendor.status === 'deactivated' && <span className="text-muted">Deactivated</span>}

                              <button
                                type="button"
                                className="remove-vendor-btn"
                                title="Remove or deactivate vendor"
                                disabled={busyId === vendor.id}
                                onClick={() => {
                                  setVendorToRemove(vendor);
                                  setVendorRemoveError('');
                                  setVendorRemoveSuccess('');
                                }}
                              >
                                <Trash2 size={13} /> Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredVendors.length === 0 && (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '25px', color: '#64748b' }}>No vendor accounts match your filter.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={vendorPage}
                  totalPages={Math.ceil(filteredVendors.length / vendorPageSize) || 1}
                  onPageChange={setVendorPage}
                  totalItems={filteredVendors.length}
                  pageSize={vendorPageSize}
                  onPageSizeChange={(sz) => { setVendorPageSize(sz); setVendorPage(1); }}
                  pageSizeOptions={[10, 25, 50]}
                />
              </div>
            )}

            {/* ---------------- 4. PRODUCTS TAB (ALL PRODUCTS SCREEN) ---------------- */}
            {activeTab === 'products' && (
              <div className="admin-vendors-section">
                <div className="vendors-header admin-products-header">
                  <div className="vendors-header-titles">
                    <h2>Product approvals & catalog management</h2>
                    <p>Vendor submissions from the database — review, approve or manage product visibility</p>
                  </div>
                  <button
                    type="button"
                    className="admin-add-product-main-btn"
                    onClick={() => setAddProductOpen(true)}
                  >
                    <Plus size={16} /> Add Product
                  </button>
                </div>

                {productCreatedMsg && (
                  <div className="admin-created-banner" role="status">
                    <CheckCircle2 size={18} className="banner-icon" />
                    <div className="banner-content">
                      <strong>Product Created Successfully!</strong>
                      <span>
                        &ldquo;{productCreatedMsg.title}&rdquo; has been saved with status <strong>{productCreatedMsg.status.toUpperCase()}</strong>.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="banner-close"
                      onClick={() => setProductCreatedMsg(null)}
                      aria-label="Dismiss message"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                <div className="admin-filter-bar">
                  <input
                    type="text"
                    className="admin-filter-input"
                    placeholder="Search by product title, vendor, category..."
                    value={prodSearch}
                    onChange={(e) => { setProdSearch(e.target.value); setProdPage(1); }}
                  />
                  <select
                    className="admin-filter-input"
                    value={prodStatusFilter}
                    onChange={(e) => { setProdStatusFilter(e.target.value); setProdPage(1); }}
                  >
                    <option value="all">All Statuses ({state.products.length})</option>
                    <option value="pending">Pending Review ({pendingProducts.length})</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <select
                    className="admin-filter-input"
                    value={prodStockFilter}
                    onChange={(e) => { setProdStockFilter(e.target.value); setProdPage(1); }}
                  >
                    <option value="all">All Inventory</option>
                    <option value="in_stock">In Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                  <select
                    className="admin-filter-input"
                    value={prodOwnerFilter}
                    onChange={(e) => { setProdOwnerFilter(e.target.value); setProdPage(1); }}
                  >
                    <option value="all">All Ownership</option>
                    <option value="admin">Admin Products Only</option>
                    <option value="vendor">Vendor Products Only</option>
                  </select>
                </div>

                <div className="vendors-table-container">
                  <table className="vendors-table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Image</th>
                        <th>Title & Ownership</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Approval Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProducts.map((product) => {
                        const isAdminProd = !product.vendorId || product.vendorId === 'admin' || product.vendorName === 'Admin' || product.vendorName === 'Platform Direct';
                        return (
                        <tr key={product.id}>
                          <td>
                            {product.image ? (
                              <img src={product.image} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }} />
                            ) : (
                              <span className="text-muted" style={{ fontSize: 11 }}>No img</span>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>{product.title}</span>
                              {isAdminProd ? (
                                <span className="prod-owner-badge prod-owner-admin" title="Admin-owned product">
                                  <ShieldCheck size={12} /> Admin
                                </span>
                              ) : (
                                <span className="prod-owner-badge prod-owner-vendor" title={`Vendor: ${product.vendorName || 'Assigned Vendor'}`}>
                                  <Store size={12} /> {product.vendorName || 'Vendor'}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 3 }}>
                              <span>{isAdminProd ? 'Owner: Admin (EcShopping)' : `Vendor: ${product.vendorName || 'Assigned Vendor'}`}</span>
                              <span style={{ margin: '0 6px' }}>•</span>
                              <span>Category: {product.category || 'General'}</span>
                            </div>
                          </td>
                          <td>
                            <strong>{fmtINR(product.price)}</strong>
                            {product.strikePrice && Number(product.strikePrice) > Number(product.price) && (
                              <span style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'line-through', marginLeft: 6 }}>
                                {fmtINR(product.strikePrice)}
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '13px' }}>
                            <span className={`status-badge status-${product.stockStatus === 'out_of_stock' ? 'rejected' : 'approved'}`}>
                              {product.stockStatus === 'out_of_stock' ? 'Out of stock' : 'In stock'}
                            </span>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: 3 }}>
                              {product.stockQuantity != null ? `${product.stockQuantity} units` : '—'}
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge status-${product.status}`}>
                              {String(product.status || 'pending').toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
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
                                  style={{ fontSize: 12 }}
                                >
                                  Re-review
                                </button>
                              )}
                              <button
                                type="button"
                                className="reject-btn"
                                style={{ padding: '5px 8px', fontSize: 12 }}
                                disabled={busyId === product.id}
                                onClick={() => handleDeleteProduct(product)}
                                title={`Delete product "${product.title}"`}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                      {filteredProducts.length === 0 && (
                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No products match your search or filter.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={prodPage}
                  totalPages={Math.ceil(filteredProducts.length / prodPageSize) || 1}
                  onPageChange={setProdPage}
                  totalItems={filteredProducts.length}
                  pageSize={prodPageSize}
                  onPageSizeChange={(sz) => { setProdPageSize(sz); setProdPage(1); }}
                  pageSizeOptions={[10, 25, 50]}
                />
              </div>
            )}

            {/* ---------------- 5. ORDERS TAB ---------------- */}
            {activeTab === 'orders' && (
              <div className="admin-vendors-section">
                <div className="vendors-header">
                  <h2>All customer orders</h2>
                  <p>Server rows with per-vendor line items — update fulfilment status</p>
                </div>

                <div className="admin-filter-bar">
                  <input
                    type="text"
                    className="admin-filter-input"
                    placeholder="Search by order ID, customer name, email, phone..."
                    value={orderSearch}
                    onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(1); }}
                  />
                  <select
                    className="admin-filter-input"
                    value={orderStatusFilter}
                    onChange={(e) => { setOrderStatusFilter(e.target.value); setOrderPage(1); }}
                  >
                    <option value="all">All Fulfilment Statuses</option>
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select
                    className="admin-filter-input"
                    value={orderPaymentFilter}
                    onChange={(e) => { setOrderPaymentFilter(e.target.value); setOrderPage(1); }}
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div className="vendors-table-container">
                  <table className="vendors-table">
                    <thead>
                      <tr>
                        <th>Order ID</th><th>Date</th><th>Customer</th><th>Items & Vendors</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOrders.map((order) => (
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {(order.items || []).map((it, idx) => (
                                <div key={it.id || idx} style={{ fontSize: '12.5px' }}>
                                  • <strong>{it.title}</strong> × {it.quantity}
                                  <span style={{ color: '#059669', marginLeft: '6px', fontSize: '11.5px', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>
                                    Vendor: {it.vendorName || 'General'}
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
                            <div className="text-muted" style={{ marginTop: 2 }}>{order.paymentMethod || 'unpaid'}</div>
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
                              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                            >
                              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                      {filteredOrders.length === 0 && (
                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '25px', color: '#64748b' }}>No orders found matching your criteria.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={orderPage}
                  totalPages={Math.ceil(filteredOrders.length / orderPageSize) || 1}
                  onPageChange={setOrderPage}
                  totalItems={filteredOrders.length}
                  pageSize={orderPageSize}
                  onPageSizeChange={(sz) => { setOrderPageSize(sz); setOrderPage(1); }}
                  pageSizeOptions={[10, 25, 50]}
                />
              </div>
            )}

            {/* ---------------- 6. VIDEOS TAB ---------------- */}
            {activeTab === 'videos' && (
              <div className="admin-cat-section-wrap">
                {/* Add Video Review Form */}
                <div className="admin-cat-form-card admin-video-form-card">
                  <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Film size={18} color="#0e5c4a" />
                    <span>Add Video Review or Short</span>
                  </h3>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                    Upload farm harvest reels, customer unboxings, or cooking demonstrations. Videos appear in the 9:16 vertical reels rail on the homepage, linked to your approved products.
                  </p>

                  {vidFormMsg.text && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      marginBottom: 16,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: vidFormMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
                      color: vidFormMsg.type === 'success' ? '#166534' : '#991b1b',
                      border: vidFormMsg.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca'
                    }}>
                      {vidFormMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                      <span>{vidFormMsg.text}</span>
                    </div>
                  )}

                  {/* Mode switch: Local Upload vs URL */}
                  <div className="admin-video-mode-selector" role="tablist" aria-label="Video input source">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={vidInputMode === 'upload'}
                      className={`admin-video-mode-btn ${vidInputMode === 'upload' ? 'active' : ''}`}
                      onClick={() => setVidInputMode('upload')}
                    >
                      <UploadCloud size={15} />
                      <span>Upload Video from Device</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={vidInputMode === 'url'}
                      className={`admin-video-mode-btn ${vidInputMode === 'url' ? 'active' : ''}`}
                      onClick={() => setVidInputMode('url')}
                    >
                      <LinkIcon size={15} />
                      <span>Provide Video URL (YouTube / External)</span>
                    </button>
                  </div>

                  <form onSubmit={handleCreateVideo} className="admin-video-form-layout">
                    {/* OPTION 1: Local Video Upload */}
                    {vidInputMode === 'upload' && (
                      <div className="admin-video-upload-area">
                        <input
                          type="file"
                          ref={videoFileInputRef}
                          accept="video/mp4,video/webm,video/quicktime,video/ogg"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleSelectVideoFile(file);
                          }}
                        />

                        {!selectedVideoFile ? (
                          <div
                            className={`admin-video-dropzone ${isDragActive ? 'drag-active' : ''}`}
                            onClick={() => !creatingVid && videoFileInputRef.current?.click()}
                            onDragEnter={(e) => { e.preventDefault(); setIsDragActive(true); }}
                            onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
                            onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragActive(false);
                              const file = e.dataTransfer.files?.[0];
                              if (file) handleSelectVideoFile(file);
                            }}
                          >
                            <UploadCloud size={36} color="#0e5c4a" />
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>
                              Choose a video file or drag and drop here
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                              Supports MP4, WebM, MOV, or OGG up to 50MB (will be uploaded directly to Cloudinary)
                            </div>
                            <button
                              type="button"
                              className="btn-secondary-sm"
                              style={{ marginTop: 6 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                videoFileInputRef.current?.click();
                              }}
                            >
                              Browse Files
                            </button>
                          </div>
                        ) : (
                          <div className="admin-video-file-card">
                            <div className="admin-video-file-meta">
                              <div className="admin-video-file-info">
                                <div className="admin-video-file-icon">
                                  <FileVideo size={20} />
                                </div>
                                <div>
                                  <div className="admin-video-file-name">{selectedVideoFile.name}</div>
                                  <div className="admin-video-file-size">
                                    {(selectedVideoFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload to Cloudinary
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn-secondary-sm"
                                  disabled={creatingVid}
                                  onClick={() => videoFileInputRef.current?.click()}
                                >
                                  Replace File
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary-sm"
                                  style={{ color: '#dc2626', borderColor: '#fecaca' }}
                                  disabled={creatingVid}
                                  onClick={handleClearSelectedVideo}
                                >
                                  <Trash2 size={13} /> Remove
                                </button>
                              </div>
                            </div>

                            {/* Local Video Player Preview */}
                            {localVideoPreview && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                                  Video Preview:
                                </div>
                                <video
                                  src={localVideoPreview}
                                  controls
                                  playsInline
                                  preload="metadata"
                                  className="admin-video-preview-player"
                                />
                              </div>
                            )}

                            {/* Upload Progress Bar */}
                            {isUploadingVideo && (
                              <div className="admin-upload-progress-wrap">
                                <div className="admin-upload-progress-bar">
                                  <div
                                    className="admin-upload-progress-fill"
                                    style={{ width: `${videoUploadProgress}%` }}
                                  />
                                </div>
                                <div className="admin-upload-progress-text">
                                  <span>Uploading video to Cloudinary CDN (ecshopping/products/videos)...</span>
                                  <span>{videoUploadProgress}%</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* OPTION 2: Video URL */}
                    {vidInputMode === 'url' && (
                      <div className="cat-form-field">
                        <label>Video URL (YouTube, Vimeo, or direct MP4) *</label>
                        <input
                          type="url"
                          className="admin-filter-input"
                          style={{ width: '100%' }}
                          placeholder="https://www.youtube.com/watch?v=... or https://.../video.mp4"
                          value={newVidUrl}
                          onChange={(e) => setNewVidUrl(e.target.value)}
                          required={vidInputMode === 'url'}
                        />
                      </div>
                    )}

                    {/* Form Metadata Fields */}
                    <div className="admin-video-fields-grid">
                      <div className="cat-form-field">
                        <label>Video Title *</label>
                        <input
                          type="text"
                          className="admin-filter-input"
                          style={{ width: '100%' }}
                          placeholder="e.g. Traditional A2 Ghee Churning"
                          value={newVidTitle}
                          onChange={(e) => setNewVidTitle(e.target.value)}
                          required
                        />
                      </div>

                      <div className="cat-form-field">
                        <label>Attached Product *</label>
                        <select
                          className="admin-filter-input"
                          style={{ width: '100%' }}
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

                      <div className="cat-form-field">
                        <label>Thumbnail Poster URL (Optional)</label>
                        <input
                          type="url"
                          className="admin-filter-input"
                          style={{ width: '100%' }}
                          placeholder="https://... (Auto-uses product image if blank)"
                          value={newVidThumb}
                          onChange={(e) => setNewVidThumb(e.target.value)}
                        />
                      </div>

                      <div className="cat-form-field">
                        <label>Display Order</label>
                        <input
                          type="number"
                          min="0"
                          className="admin-filter-input"
                          style={{ width: '100%' }}
                          value={newVidOrder}
                          onChange={(e) => setNewVidOrder(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <button
                        type="submit"
                        disabled={creatingVid}
                        className="approve-btn admin-submit-video-btn"
                        style={{ height: 42, padding: '0 20px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                      >
                        {creatingVid ? (
                          <Loader2 size={16} className="spin" />
                        ) : vidInputMode === 'upload' ? (
                          <UploadCloud size={16} />
                        ) : (
                          <Plus size={16} />
                        )}
                        <span>
                          {creatingVid
                            ? (isUploadingVideo ? `Uploading Video (${videoUploadProgress}%)…` : 'Saving Video Record…')
                            : (vidInputMode === 'upload' ? 'Upload & Save Video Review' : 'Add Video Review')}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>

                <div className="admin-filter-bar">
                  <input
                    type="text"
                    className="admin-filter-input"
                    placeholder="Search videos by title or product..."
                    value={videoSearch}
                    onChange={(e) => { setVideoSearch(e.target.value); setVideoPage(1); }}
                  />
                </div>

                {/* Videos Table */}
                <div className="vendors-table-container">
                  <table className="vendors-table">
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
                      {paginatedVideos.map((vid) => (
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
                            <span className={`status-badge ${vid.status === 'active' ? 'status-approved' : 'status-rejected'}`}>
                              {vid.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                              {vid.videoUrl && (
                                <button
                                  type="button"
                                  className="btn-secondary-sm"
                                  style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  onClick={() => setPreviewingVideo(vid)}
                                  title={`Preview "${vid.title}"`}
                                  aria-label="Preview video"
                                >
                                  <Play size={13} />
                                  <span>Play</span>
                                </button>
                              )}
                              <button
                                type="button"
                                className={vid.status === 'active' ? 'reject-btn' : 'approve-btn'}
                                style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                disabled={busyId === vid.id}
                                onClick={() => handleToggleVideoStatus(vid)}
                                title={vid.status === 'active' ? 'Deactivate video' : 'Activate video'}
                              >
                                {busyId === vid.id ? (
                                  <Loader2 size={13} className="spin" />
                                ) : vid.status === 'active' ? (
                                  <XCircle size={13} />
                                ) : (
                                  <CheckCircle size={13} />
                                )}
                                <span>{busyId === vid.id ? 'Saving...' : vid.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                              </button>
                              <button
                                type="button"
                                className="reject-btn"
                                style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                disabled={busyId === vid.id}
                                onClick={() => handleDeleteVideo(vid.id)}
                                title={`Delete video "${vid.title}"`}
                                aria-label="Delete video"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredVideos.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                            No video reviews or shorts added yet. Use the form above to add your first video!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={videoPage}
                  totalPages={Math.ceil(filteredVideos.length / videoPageSize) || 1}
                  onPageChange={setVideoPage}
                  totalItems={filteredVideos.length}
                  pageSize={videoPageSize}
                  onPageSizeChange={(sz) => { setVideoPageSize(sz); setVideoPage(1); }}
                  pageSizeOptions={[10, 25, 50]}
                />
              </div>
            )}

            {/* ---------------- HOMEPAGE BANNERS TAB ---------------- */}
            {activeTab === 'banners' && (
              <div className="admin-banners-section">
                <div className="vendors-header">
                  <div>
                    <h2>Homepage Promotional Banners</h2>
                    <p>Manage dynamic campaign hero banners displayed on the customer storefront carousel</p>
                  </div>
                  <button
                    type="button"
                    className="admin-sidebar-add-btn"
                    style={{ background: '#0e5c4a', color: 'white', borderRadius: 8, padding: '10px 18px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    onClick={handleOpenAddBanner}
                  >
                    <Plus size={16} /> Add New Banner
                  </button>
                </div>

                {/* Metrics Grid */}
                <div className="admin-banners-metrics-grid">
                  <div className="admin-banner-metric-card">
                    <span className="admin-banner-metric-label">Total Banners</span>
                    <div className="admin-banner-metric-value-wrap">
                      <span className="admin-banner-metric-value">{(state.banners || []).length}</span>
                      <span className="admin-banner-metric-badge info">In Database</span>
                    </div>
                  </div>

                  <div className="admin-banner-metric-card">
                    <span className="admin-banner-metric-label">Active on Storefront</span>
                    <div className="admin-banner-metric-value-wrap">
                      <span className="admin-banner-metric-value" style={{ color: '#059669' }}>
                        {(state.banners || []).filter((b) => Boolean(b.is_active ?? b.isActive ?? 1)).length}
                      </span>
                      <span className="admin-banner-metric-badge">
                        Recommended: 3–4 banners
                      </span>
                    </div>
                  </div>

                  <div className="admin-banner-metric-card">
                    <span className="admin-banner-metric-label">Inactive / Drafts</span>
                    <div className="admin-banner-metric-value-wrap">
                      <span className="admin-banner-metric-value" style={{ color: '#94a3b8' }}>
                        {(state.banners || []).filter((b) => !(b.is_active ?? b.isActive ?? 1)).length}
                      </span>
                      <span className="admin-banner-metric-badge info">Hidden from Store</span>
                    </div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="admin-filter-bar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="admin-filter-input"
                    style={{ flex: '1 1 240px' }}
                    placeholder="Search banners by title, subtitle, tag, or badge..."
                    value={bannerSearch}
                    onChange={(e) => setBannerSearch(e.target.value)}
                  />
                  <select
                    className="admin-filter-select"
                    value={bannerStatusFilter}
                    onChange={(e) => setBannerStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                </div>

                {/* Banner Cards List */}
                <div className="admin-banner-cards-grid">
                  {filteredBanners.map((banner, index) => {
                    const isActive = Boolean(banner.is_active ?? banner.isActive ?? 1);
                    return (
                      <div
                        key={banner.id}
                        className={`admin-banner-card ${!isActive ? 'inactive' : ''}`}
                      >
                        <div className="admin-banner-thumbnail-wrap">
                          <img
                            src={banner.image_url || banner.imageUrl}
                            alt={banner.title}
                            className="admin-banner-thumbnail"
                            loading="lazy"
                          />
                          <div className="admin-banner-thumbnail-order">
                            #{index + 1} • Order: {banner.display_order ?? banner.displayOrder ?? 0}
                          </div>
                        </div>

                        <div className="admin-banner-details">
                          <div className="admin-banner-header-row">
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                {banner.tag && (
                                  <span className="admin-banner-tag-pill">{banner.tag}</span>
                                )}
                                {isActive ? (
                                  <span className="status-badge status-approved" style={{ fontSize: 11, padding: '2px 8px' }}>
                                    <CheckCircle size={12} style={{ marginRight: 4 }} /> Active
                                  </span>
                                ) : (
                                  <span className="status-badge status-rejected" style={{ fontSize: 11, padding: '2px 8px' }}>
                                    <XCircle size={12} style={{ marginRight: 4 }} /> Inactive
                                  </span>
                                )}
                              </div>
                              <h3 className="admin-banner-title">{banner.title}</h3>
                              {banner.subtitle && (
                                <p className="admin-banner-subtitle">{banner.subtitle}</p>
                              )}
                            </div>
                          </div>

                          {banner.badge && (
                            <div className="admin-banner-tags-row">
                              <span className="admin-banner-badge-pill">
                                <Sparkles size={12} style={{ marginRight: 4, display: 'inline' }} />
                                {banner.badge}
                              </span>
                            </div>
                          )}

                          <div className="admin-banner-cta-row">
                            <span className="admin-banner-cta-item">
                              Primary CTA: <strong>{banner.cta_text || banner.ctaText || 'Shop Now'}</strong> ({banner.cta_link || banner.ctaLink || '/shop'})
                            </span>
                            {(banner.secondary_cta_text || banner.secondaryCtaText) && (
                              <span className="admin-banner-cta-item">
                                Secondary CTA: <strong>{banner.secondary_cta_text || banner.secondaryCtaText}</strong> ({banner.secondary_cta_link || banner.secondaryCtaLink || '/shop'})
                              </span>
                            )}
                          </div>

                          <div className="admin-banner-actions-bar">
                            <div className="admin-banner-reorder-group">
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginRight: 4 }}>
                                Reorder:
                              </span>
                              <button
                                type="button"
                                className="admin-banner-reorder-btn"
                                title="Move Banner Up"
                                disabled={index === 0 || busyId === banner.id}
                                onClick={() => handleMoveBanner(banner, 'up')}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                className="admin-banner-reorder-btn"
                                title="Move Banner Down"
                                disabled={index === filteredBanners.length - 1 || busyId === banner.id}
                                onClick={() => handleMoveBanner(banner, 'down')}
                              >
                                <ArrowDown size={14} />
                              </button>
                            </div>

                            <div className="admin-banner-button-group">
                              <button
                                type="button"
                                className={isActive ? 'reject-btn' : 'approve-btn'}
                                style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                disabled={busyId === banner.id}
                                onClick={() => handleToggleBannerStatus(banner)}
                              >
                                {busyId === banner.id ? (
                                  <Loader2 size={13} className="spin" />
                                ) : isActive ? (
                                  <EyeOff size={13} />
                                ) : (
                                  <Eye size={13} />
                                )}
                                <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                              </button>

                              <button
                                type="button"
                                className="btn-secondary-sm"
                                style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                onClick={() => handleOpenEditBanner(banner)}
                              >
                                <Edit2 size={13} /> Edit
                              </button>

                              <button
                                type="button"
                                className="reject-btn"
                                style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center' }}
                                onClick={() => setBannerToDelete(banner)}
                                title={`Delete banner "${banner.title}"`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredBanners.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '48px 20px', background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', color: '#64748b' }}>
                      <ImageIcon size={36} style={{ margin: '0 auto 12px auto', color: '#94a3b8' }} />
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#334155' }}>No homepage banners found</h4>
                      <p style={{ margin: '6px 0 16px 0', fontSize: 13.5 }}>
                        {bannerSearch || bannerStatusFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Add your first promotional banner to showcase on the storefront carousel.'}
                      </p>
                      <button
                        type="button"
                        className="approve-btn"
                        onClick={handleOpenAddBanner}
                      >
                        <Plus size={14} /> Add First Banner
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ---------------- 7. CUSTOMERS TAB ---------------- */}
            {activeTab === 'customers' && (
              <div className="admin-vendors-section">
                <div className="vendors-header">
                  <h2>Registered customers</h2>
                  <p>Accounts from the users table — customer credentials and passwords are never displayed</p>
                </div>

                <div className="admin-filter-bar">
                  <input
                    type="text"
                    className="admin-filter-input"
                    placeholder="Search customers by name, email, phone..."
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setCustomerPage(1); }}
                  />
                </div>

                <div className="vendors-table-container">
                  <table className="vendors-table">
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Phone</th><th>Registered on</th></tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.name}</strong></td>
                          <td>{c.email}</td>
                          <td>{c.phone || '—'}</td>
                          <td style={{ fontSize: '13px', color: '#64748b' }}>
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '25px', color: '#64748b' }}>No customer accounts match your search.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={customerPage}
                  totalPages={Math.ceil(filteredUsers.length / customerPageSize) || 1}
                  onPageChange={setCustomerPage}
                  totalItems={filteredUsers.length}
                  pageSize={customerPageSize}
                  onPageSizeChange={(sz) => { setCustomerPageSize(sz); setCustomerPage(1); }}
                  pageSizeOptions={[10, 25, 50]}
                />
              </div>
            )}

            {/* ---------------- 8. PAYMENT GATEWAY CONFIGURATION & AUDIT ---------------- */}
            {activeTab === 'payment' && (
              <div className="payment-audit-container">
                <div className="payment-card">
                  <div className="payment-card-header">
                    <div>
                      <h3 className="payment-card-title">PhonePe Payment Gateway Status</h3>
                      <p className="payment-card-subtitle">
                        Runtime integration mode, credentials masking, and security perimeter audit
                      </p>
                    </div>
                    {paymentConfig.data?.configured ? (
                      <span className="status-badge status-approved" style={{ fontSize: 13, padding: '6px 14px' }}>
                        <ShieldCheck size={16} style={{ marginRight: 6 }} /> Active & Configured
                      </span>
                    ) : (
                      <span className="status-badge status-rejected" style={{ fontSize: 13, padding: '6px 14px' }}>
                        <AlertTriangle size={16} style={{ marginRight: 6 }} /> Gateway Not Configured
                      </span>
                    )}
                  </div>

                  {paymentConfig.loading && (
                    <p className="admin-loading-note">
                      <Loader2 size={16} className="spin" /> Querying payment gateway status from backend…
                    </p>
                  )}

                  {paymentConfig.error && (
                    <div className="admin-error-box">
                      <strong>Payment Gateway Error:</strong> {paymentConfig.error}
                    </div>
                  )}

                  {paymentConfig.data && (
                    <div className="payment-grid-2col">
                      <div className="payment-kv-item">
                        <span className="payment-kv-label">Environment Mode</span>
                        <div className="payment-kv-value">
                          <span className={`status-badge ${paymentConfig.data.environment === 'production' ? 'status-approved' : 'status-pending'}`}>
                            {paymentConfig.data.environment === 'production' ? 'PRODUCTION (LIVE)' : 'SANDBOX (TEST)'}
                          </span>
                        </div>
                      </div>

                      <div className="payment-kv-item">
                        <span className="payment-kv-label">Integration Protocol</span>
                        <div className="payment-kv-value">
                          {paymentConfig.data.mode === 'v2' && 'Option B — Standard Checkout v2 (OAuth 2.0)'}
                          {paymentConfig.data.mode === 'v1' && 'Option A — Hermes PG v1 (SHA256 Checksum)'}
                          {!paymentConfig.data.mode && 'None detected (Credentials missing)'}
                        </div>
                      </div>

                      <div className="payment-kv-item">
                        <span className="payment-kv-label">Host Endpoint</span>
                        <div className="payment-kv-value">
                          <code>{paymentConfig.data.endpointHost}</code>
                        </div>
                      </div>

                      <div className="payment-kv-item">
                        <span className="payment-kv-label">Return / Redirect URL</span>
                        <div className="payment-kv-value">
                          {paymentConfig.data.redirectUrl ? <code>{paymentConfig.data.redirectUrl}</code> : <span className="text-muted">Not specified in env</span>}
                        </div>
                      </div>

                      {paymentConfig.data.mode === 'v2' && (
                        <>
                          <div className="payment-kv-item">
                            <span className="payment-kv-label">Client ID (PHONEPE_CLIENT_ID)</span>
                            <div className="payment-kv-value">
                              {paymentConfig.data.v2.maskedClientId ? <code>{paymentConfig.data.v2.maskedClientId}</code> : <span className="text-muted">Not set</span>}
                            </div>
                          </div>
                          <div className="payment-kv-item">
                            <span className="payment-kv-label">Client Secret (PHONEPE_CLIENT_SECRET)</span>
                            <div className="payment-kv-value">
                              {paymentConfig.data.v2.hasClientSecret ? <code>•••••••••••••••• (Encrypted in env)</code> : <span className="text-muted">Missing</span>}
                            </div>
                          </div>
                          <div className="payment-kv-item">
                            <span className="payment-kv-label">Client Version</span>
                            <div className="payment-kv-value">
                              {paymentConfig.data.v2.clientVersion ? <code>v{paymentConfig.data.v2.clientVersion}</code> : '1'}
                            </div>
                          </div>
                        </>
                      )}

                      {paymentConfig.data.mode === 'v1' && (
                        <>
                          <div className="payment-kv-item">
                            <span className="payment-kv-label">Merchant ID (PHONEPE_MERCHANT_ID)</span>
                            <div className="payment-kv-value">
                              {paymentConfig.data.v1.maskedMerchantId ? <code>{paymentConfig.data.v1.maskedMerchantId}</code> : <span className="text-muted">Not set</span>}
                            </div>
                          </div>
                          <div className="payment-kv-item">
                            <span className="payment-kv-label">Salt Key (PHONEPE_SALT_KEY)</span>
                            <div className="payment-kv-value">
                              {paymentConfig.data.v1.hasSaltKey ? <code>•••••••••••••••• (Encrypted in env)</code> : <span className="text-muted">Missing</span>}
                            </div>
                          </div>
                          <div className="payment-kv-item">
                            <span className="payment-kv-label">Salt Index</span>
                            <div className="payment-kv-value">
                              <code>{paymentConfig.data.v1.saltIndex || '1'}</code>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Admin Update PhonePe Credentials Card */}
                <div className="payment-card">
                  <div className="payment-card-header">
                    <div>
                      <h3 className="payment-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Lock size={18} color="#0e5c4a" /> Update PhonePe Gateway Credentials
                      </h3>
                      <p className="payment-card-subtitle">
                        Configure PhonePe Merchant ID and Salt Key. Only authorized administrators can view and modify these credentials.
                      </p>
                    </div>
                  </div>

                  {paymentSaveMsg.text && (
                    <div className={`payment-feedback-banner ${paymentSaveMsg.type}`}>
                      {paymentSaveMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                      <span>{paymentSaveMsg.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleSavePaymentConfig} className="payment-edit-form">
                    <div className="payment-form-grid">
                      <div className="payment-form-group">
                        <label className="payment-label">Environment Mode</label>
                        <select
                          className="payment-select"
                          value={paymentForm.environment}
                          onChange={(e) => setPaymentForm({ ...paymentForm, environment: e.target.value })}
                        >
                          <option value="production">Production Live (https://api.phonepe.com)</option>
                          <option value="sandbox">Sandbox Test (https://api-preprod.phonepe.com)</option>
                        </select>
                        <p className="payment-help-text">Select Production for live marketplace checkout.</p>
                      </div>

                      <div className="payment-form-group">
                        <label className="payment-label">PhonePe Merchant ID (MID)</label>
                        <input
                          type="text"
                          className="payment-input"
                          placeholder="e.g. M22K4X0544GUAZ"
                          value={paymentForm.merchantId}
                          onChange={(e) => setPaymentForm({ ...paymentForm, merchantId: e.target.value })}
                          required
                        />
                        <p className="payment-help-text">Unique merchant identifier provided by PhonePe.</p>
                      </div>

                      <div className="payment-form-group">
                        <label className="payment-label">
                          PhonePe Salt Key (Secret)
                          {paymentConfig.data?.v1?.hasSaltKey ? (
                            <span className="payment-key-status active">
                              <CheckCircle2 size={13} /> Active in DB
                            </span>
                          ) : (
                            <span className="payment-key-status missing">
                              <AlertTriangle size={13} /> Missing
                            </span>
                          )}
                        </label>
                        <div className="payment-password-wrap">
                          <input
                            type={paymentForm.showSaltKey ? 'text' : 'password'}
                            className="payment-input"
                            placeholder={paymentConfig.data?.v1?.hasSaltKey ? '•••••••••••••••• (Leave blank to keep existing key)' : 'Enter PhonePe Salt Key'}
                            value={paymentForm.saltKey}
                            onChange={(e) => setPaymentForm({ ...paymentForm, saltKey: e.target.value })}
                          />
                          <button
                            type="button"
                            className="payment-toggle-visibility-btn"
                            onClick={() => setPaymentForm({ ...paymentForm, showSaltKey: !paymentForm.showSaltKey })}
                            title={paymentForm.showSaltKey ? 'Hide Salt Key' : 'Show Salt Key'}
                          >
                            {paymentForm.showSaltKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <p className="payment-help-text">
                          {paymentConfig.data?.v1?.hasSaltKey
                            ? 'Leave empty to preserve active salt key, or enter a new key to update.'
                            : 'Enter the Salt Key provided by PhonePe onboarding team.'}
                        </p>
                      </div>

                      <div className="payment-form-group">
                        <label className="payment-label">Salt Index</label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          className="payment-input"
                          placeholder="1"
                          value={paymentForm.saltIndex}
                          onChange={(e) => setPaymentForm({ ...paymentForm, saltIndex: e.target.value })}
                        />
                        <p className="payment-help-text">Default is 1 (matches the key index in PhonePe).</p>
                      </div>

                      <div className="payment-form-group full-width">
                        <label className="payment-label">Return / Redirect URL</label>
                        <input
                          type="text"
                          className="payment-input"
                          placeholder="https://ecshopping.in/payment/phonepe/return"
                          value={paymentForm.redirectUrl}
                          onChange={(e) => setPaymentForm({ ...paymentForm, redirectUrl: e.target.value })}
                        />
                        <p className="payment-help-text">Customer redirect landing page after hosted checkout.</p>
                      </div>
                    </div>

                    <div className="payment-form-actions">
                      <button
                        type="submit"
                        className="payment-save-btn"
                        disabled={savingPayment || paymentConfig.loading}
                      >
                        {savingPayment ? (
                          <>
                            <RefreshCw size={16} className="spin" /> Saving Settings...
                          </>
                        ) : (
                          <>
                            <Save size={16} /> Save Payment Configuration
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Whitelist and Security Perimeter Advice */}
                <div className="payment-card">
                  <h3 className="payment-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Globe size={18} color="#0e5c4a" /> Whitelisted Origins & Domains Required
                  </h3>
                  <p className="payment-card-subtitle" style={{ marginBottom: 16 }}>
                    PhonePe requires that all transaction initiating origins and redirect targets be registered in the merchant profile.
                  </p>

                  <div className="payment-callout info" style={{ marginBottom: 16 }}>
                    <strong>Registered Production Domains:</strong>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                      <li>Frontend Storefront: <code>https://ecshopping.in</code></li>
                      <li>Backend API: <code>https://ec-shopping-three.vercel.app</code></li>
                    </ul>
                  </div>

                  <div className="payment-callout warning">
                    <strong>Notice on PhonePe Security Firewall (INTERNAL_SECURITY_BLOCK_1):</strong>
                    <p style={{ margin: '6px 0 0' }}>
                      The error <code>INTERNAL_SECURITY_BLOCK_1</code> received during hosted checkout UPI QR generation is enforced by PhonePe&apos;s internal fraud and risk firewall. It occurs when:
                    </p>
                    <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                      <li>The production domain is not explicitly whitelisted in PhonePe Merchant Portal under <em>Developer Settings &gt; Whitelisted Domains</em>.</li>
                      <li>The merchant account has incomplete KYC / compliance approval for dynamic QR issuance.</li>
                      <li>Payment method <code>UPI_QR</code> has not been enabled on the MID by PhonePe operations.</li>
                    </ol>
                    <p style={{ margin: '8px 0 0' }}>
                      <em>Adding payment configuration forms in this admin panel does NOT override PhonePe&apos;s server-side security checks. Please log in to the PhonePe Merchant Portal to submit domain whitelist requests and activate UPI QR.</em>
                    </p>
                  </div>
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

        {/* ---------------- ADD PRODUCT MODAL DIALOG / DRAWER ---------------- */}
        {addProductOpen && (
          <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-add-prod-modal-title">
            <div className="admin-modal-backdrop" onClick={() => setAddProductOpen(false)} />
            <div className="admin-modal-dialog">
              <div className="admin-modal-header">
                <div className="admin-modal-header-text">
                  <div className="admin-modal-badge">
                    <ShieldCheck size={14} /> Catalog Administration
                  </div>
                  <h2 id="admin-add-prod-modal-title">Add New Product</h2>
                  <p>Create a verified product listing for the platform catalog or assign to a vendor.</p>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  onClick={() => setAddProductOpen(false)}
                  aria-label="Close dialog"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="admin-modal-body">
                <Suspense fallback={<FormSkeleton fields={5} />}>
                  <AddProduct
                    mode="admin"
                    vendors={state.vendors}
                    onProductCreated={handleAdminProductCreated}
                    onCancel={() => setAddProductOpen(false)}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- VIDEO PREVIEW MODAL ---------------- */}
        {previewingVideo && (
          <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-video-modal-title">
            <div className="admin-modal-backdrop" onClick={() => setPreviewingVideo(null)} />
            <div className="admin-modal-dialog" style={{ maxWidth: 540 }}>
              <div className="admin-modal-header">
                <div className="admin-modal-header-text">
                  <div className="admin-modal-badge">
                    <Film size={14} /> Video Preview
                  </div>
                  <h2 id="admin-video-modal-title">{previewingVideo.title}</h2>
                  {previewingVideo.productTitle && (
                    <p>Attached to product: <strong>{previewingVideo.productTitle}</strong></p>
                  )}
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  onClick={() => setPreviewingVideo(null)}
                  aria-label="Close dialog"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="admin-modal-body" style={{ padding: 16 }}>
                <div style={{ position: 'relative', width: '100%', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                  <video
                    src={previewingVideo.videoUrl}
                    controls
                    autoPlay
                    playsInline
                    style={{ width: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto' }}
                  />
                </div>
                {previewingVideo.description && (
                  <p style={{ marginTop: 12, fontSize: 13, color: '#475569' }}>
                    {previewingVideo.description}
                  </p>
                )}
                <div style={{ marginTop: 12, fontSize: 12, color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {previewingVideo.format && <span>Format: <strong>{previewingVideo.format}</strong></span>}
                  {previewingVideo.duration && <span>Duration: <strong>{previewingVideo.duration}s</strong></span>}
                  {previewingVideo.bytes && <span>Size: <strong>{(previewingVideo.bytes / (1024 * 1024)).toFixed(2)} MB</strong></span>}
                  {previewingVideo.publicId && <span>Cloudinary ID: <code>{previewingVideo.publicId}</code></span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- VENDOR REMOVAL / DEACTIVATION MODAL ---------------- */}
        {vendorToRemove && (
          <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-remove-vendor-title">
            <div className="admin-modal-backdrop" onClick={() => !vendorRemoveLoading && setVendorToRemove(null)} />
            <div className="admin-modal-dialog" style={{ maxWidth: 540 }}>
              <div className="admin-modal-header" style={{ borderBottomColor: '#fee2e2' }}>
                <div className="admin-modal-header-text">
                  <div className="admin-modal-badge" style={{ color: '#dc2626' }}>
                    <AlertTriangle size={14} /> Security & Vendor Management
                  </div>
                  <h2 id="admin-remove-vendor-title" style={{ color: '#991b1b' }}>
                    Remove or Deactivate Vendor
                  </h2>
                  <p>
                    Target Account: <strong>{vendorToRemove.name}</strong> ({vendorToRemove.email})
                  </p>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  disabled={vendorRemoveLoading}
                  onClick={() => setVendorToRemove(null)}
                  aria-label="Close dialog"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="admin-modal-body" style={{ padding: '20px 24px' }}>
                <div className="admin-danger-notice">
                  <h4>Consequences of this action:</h4>
                  <ul>
                    <li><strong>Portal Access:</strong> The vendor will be immediately deactivated and locked out of the Seller Portal.</li>
                    <li><strong>Store Listings:</strong> All active products owned by this seller will be archived and hidden from the storefront.</li>
                    <li><strong>Order History:</strong> Customer orders containing items from this vendor are safely preserved in the database for auditing and fulfillment.</li>
                    <li><strong>Active Orders:</strong> If this vendor has pending/unfulfilled orders, removal will be prevented until those orders are completed or cancelled.</li>
                  </ul>
                </div>

                {vendorRemoveError && (
                  <div className="admin-modal-alert error">
                    <AlertTriangle size={16} />
                    <span>{vendorRemoveError}</span>
                  </div>
                )}

                {vendorRemoveSuccess && (
                  <div className="admin-modal-alert success">
                    <CheckCircle2 size={16} />
                    <span>{vendorRemoveSuccess}</span>
                  </div>
                )}

                <div className="admin-modal-footer-actions">
                  <button
                    type="button"
                    className="admin-modal-btn cancel"
                    disabled={vendorRemoveLoading}
                    onClick={() => setVendorToRemove(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="admin-modal-btn danger"
                    disabled={vendorRemoveLoading || Boolean(vendorRemoveSuccess)}
                    onClick={handleConfirmRemoveVendor}
                  >
                    {vendorRemoveLoading ? (
                      <>
                        <Loader2 size={15} className="spin" /> Processing...
                      </>
                    ) : (
                      <>
                        <Trash2 size={15} /> Confirm Remove / Deactivate
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- ADD / EDIT BANNER MODAL ---------------- */}
        {bannerModalOpen && (
          <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-banner-modal-title">
            <div className="admin-modal-backdrop" onClick={() => !bannerSaving && setBannerModalOpen(false)} />
            <div className="admin-modal-dialog" style={{ maxWidth: 680 }}>
              <div className="admin-modal-header">
                <div className="admin-modal-header-text">
                  <div className="admin-modal-badge">
                    <Sparkles size={14} /> Homepage Merchandising
                  </div>
                  <h2 id="admin-banner-modal-title">
                    {editingBannerId ? 'Edit Promotional Banner' : 'Create New Promotional Banner'}
                  </h2>
                  <p>Configure banner creative, typography, tags, and click-through destination</p>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  disabled={bannerSaving}
                  onClick={() => setBannerModalOpen(false)}
                  aria-label="Close dialog"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="admin-modal-body" style={{ padding: '20px 24px', maxHeight: '80vh', overflowY: 'auto' }}>
                {bannerFormMsg.text && (
                  <div className={`admin-modal-alert ${bannerFormMsg.type}`}>
                    {bannerFormMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{bannerFormMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handleSaveBanner} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Recommended Aspect Ratio Guidance */}
                  <div className="admin-banner-aspect-notice">
                    <ImageIcon size={18} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>Recommended Dimensions:</strong> 1600 × 380 px (~4.2:1 aspect ratio). High-resolution image (JPEG, WebP, PNG) with centered subject for responsive mobile cropping.
                    </div>
                  </div>

                  {/* Image Upload / URL Section */}
                  <div className="cat-form-field">
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                      Banner Image *
                    </label>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                      <input
                        type="file"
                        ref={bannerFileInputRef}
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        style={{ display: 'none' }}
                        onChange={handleBannerImageUpload}
                        disabled={bannerUploadingImg}
                      />
                      <button
                        type="button"
                        className="btn-secondary-sm"
                        disabled={bannerUploadingImg}
                        onClick={() => bannerFileInputRef.current?.click()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
                      >
                        {bannerUploadingImg ? (
                          <>
                            <Loader2 size={15} className="spin" /> Uploading to Cloudinary...
                          </>
                        ) : (
                          <>
                            <UploadCloud size={15} /> Upload Image File
                          </>
                        )}
                      </button>
                      <span style={{ fontSize: 12, color: '#64748b' }}>or provide direct image URL below:</span>
                    </div>

                    <input
                      type="url"
                      className="admin-filter-input"
                      style={{ width: '100%' }}
                      placeholder="https://images.unsplash.com/... or https://res.cloudinary.com/..."
                      value={bannerForm.imageUrl}
                      onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
                      required
                    />

                    {/* Live Image Preview */}
                    {bannerForm.imageUrl && (
                      <div className="admin-banner-preview-box">
                        <img
                          src={bannerForm.imageUrl}
                          alt="Banner Preview"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Title & Subtitle */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                    <div className="cat-form-field">
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Banner Title *
                      </label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. Pure Organic Produce & Farm Harvests"
                        value={bannerForm.title}
                        onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                        required
                      />
                    </div>

                    <div className="cat-form-field">
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Subtitle / Description
                      </label>
                      <textarea
                        className="admin-filter-input"
                        rows={2}
                        style={{ width: '100%', resize: 'vertical' }}
                        placeholder="e.g. Residue-free vegetables, cold-pressed oils & raw forest honey directly from certified local farmers."
                        value={bannerForm.subtitle}
                        onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Tag and Badge */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="cat-form-field">
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Category Tag Pill
                      </label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. Direct Farm Harvest"
                        value={bannerForm.tag}
                        onChange={(e) => setBannerForm({ ...bannerForm, tag: e.target.value })}
                      />
                    </div>

                    <div className="cat-form-field">
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Special Offer Badge
                      </label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. 100% Certified Organic • Free Delivery over ₹499"
                        value={bannerForm.badge}
                        onChange={(e) => setBannerForm({ ...bannerForm, badge: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Primary CTA */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="cat-form-field">
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Primary Button Text *
                      </label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. Shop Now"
                        value={bannerForm.ctaText}
                        onChange={(e) => setBannerForm({ ...bannerForm, ctaText: e.target.value })}
                        required
                      />
                    </div>

                    <div className="cat-form-field">
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Primary Destination URL / Route *
                      </label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. /shop or /products?category=produce"
                        value={bannerForm.ctaLink}
                        onChange={(e) => setBannerForm({ ...bannerForm, ctaLink: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Secondary CTA */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="cat-form-field">
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Secondary Button Text (Optional)
                      </label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. Explore Deals"
                        value={bannerForm.secondaryCtaText}
                        onChange={(e) => setBannerForm({ ...bannerForm, secondaryCtaText: e.target.value })}
                      />
                    </div>

                    <div className="cat-form-field">
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Secondary Destination URL (Optional)
                      </label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. /collection/deals"
                        value={bannerForm.secondaryCtaLink}
                        onChange={(e) => setBannerForm({ ...bannerForm, secondaryCtaLink: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Display Order and Active Status */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center' }}>
                    <div className="cat-form-field">
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Display Order (Lower appears first)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        value={bannerForm.displayOrder}
                        onChange={(e) => setBannerForm({ ...bannerForm, displayOrder: e.target.value })}
                      />
                    </div>

                    <div style={{ paddingTop: 20 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                        <input
                          type="checkbox"
                          checked={bannerForm.isActive}
                          onChange={(e) => setBannerForm({ ...bannerForm, isActive: e.target.checked })}
                          style={{ width: 18, height: 18, accentColor: '#0e5c4a' }}
                        />
                        <span>Active on Storefront Carousel</span>
                      </label>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="admin-modal-footer-actions" style={{ marginTop: 24 }}>
                    <button
                      type="button"
                      className="admin-modal-btn cancel"
                      disabled={bannerSaving}
                      onClick={() => setBannerModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="admin-modal-btn danger"
                      style={{ background: '#0e5c4a' }}
                      disabled={bannerSaving || bannerUploadingImg}
                    >
                      {bannerSaving ? (
                        <>
                          <Loader2 size={15} className="spin" /> Saving Banner...
                        </>
                      ) : (
                        <>
                          <Save size={15} /> {editingBannerId ? 'Update Banner' : 'Create Banner'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- DELETE BANNER MODAL ---------------- */}
        {bannerToDelete && (
          <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-delete-banner-title">
            <div className="admin-modal-backdrop" onClick={() => !bannerDeleteLoading && setBannerToDelete(null)} />
            <div className="admin-modal-dialog" style={{ maxWidth: 500 }}>
              <div className="admin-modal-header" style={{ borderBottomColor: '#fee2e2' }}>
                <div className="admin-modal-header-text">
                  <div className="admin-modal-badge" style={{ color: '#dc2626' }}>
                    <AlertTriangle size={14} /> Catalog Merchandising
                  </div>
                  <h2 id="admin-delete-banner-title" style={{ color: '#991b1b' }}>
                    Delete Promotional Banner
                  </h2>
                  <p>Are you sure you want to remove banner &quot;{bannerToDelete.title}&quot;?</p>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  disabled={bannerDeleteLoading}
                  onClick={() => setBannerToDelete(null)}
                  aria-label="Close dialog"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="admin-modal-body" style={{ padding: '20px 24px' }}>
                <div className="admin-danger-notice">
                  <h4>Consequences:</h4>
                  <ul>
                    <li>This banner will immediately cease displaying on the homepage carousel.</li>
                    <li>If hosted on Cloudinary, the associated cloud asset will be permanently removed.</li>
                    <li>This action cannot be undone.</li>
                  </ul>
                </div>

                <div className="admin-modal-footer-actions">
                  <button
                    type="button"
                    className="admin-modal-btn cancel"
                    disabled={bannerDeleteLoading}
                    onClick={() => setBannerToDelete(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="admin-modal-btn danger"
                    disabled={bannerDeleteLoading}
                    onClick={handleConfirmDeleteBanner}
                  >
                    {bannerDeleteLoading ? (
                      <>
                        <Loader2 size={15} className="spin" /> Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 size={15} /> Confirm Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
