import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import {
  LogOut, RefreshCw, CheckCircle, XCircle, Package, Users as UsersIcon,
  ShoppingCart, PackageSearch, ClipboardList, Loader2, Plus, Edit2, Edit3, Trash2,
  Menu, X, CreditCard, ShieldCheck, ShieldAlert, Globe, AlertTriangle, Save, Eye, EyeOff, Lock, CheckCircle2,
  UploadCloud, Link as LinkIcon, Play, FileVideo, Film, Store,
  Image as ImageIcon, ArrowUp, ArrowDown, Sparkles, Tag, Flame,
  FileText, ExternalLink, AlertCircle, Search, Mail, Download
} from 'lucide-react';
import api, { authSessions } from '../../utils/api';
import { getCurrentAdmin } from '../../utils/storage';
import Pagination from '../../components/ui/Pagination';
import VendorSelect from '../../components/admin/VendorSelect';
import { FormSkeleton } from '../../components/ui/States';
import { DEFAULT_CATEGORY_IMAGE } from '../../data/content';
import { clearCategoriesCache } from '../../data/storefront';
import './AdminDashboard.css';

const AddProduct = lazy(() => import('../vendor/AddProduct'));
const EditProduct = lazy(() => import('../vendor/EditProduct'));

const ORDER_STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
const fmtINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

/* Reads straight from the Express APIs with the admin token — localStorage
 * caches are never used for admin state, and every mutation is confirmed by
 * the server before the list is refreshed. */
export default function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [state, setState] = useState({
    loading: true,
    error: null,
    vendors: [],
    products: [],
    orders: [],
    users: [],
    categories: [],
    videos: [],
    banners: [],
    coupons: [],
    deals: [],
    commissionConfig: { defaultCommissionRate: 10, vendors: [] }
  });
  const [attempt, setAttempt] = useState(0);

  /* Admin Add & Edit Product state */
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
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
  const [uploadingNewCatImage, setUploadingNewCatImage] = useState(false);
  const newCatFileInputRef = useRef(null);
  const [creatingCat, setCreatingCat] = useState(false);
  const [catFormMsg, setCatFormMsg] = useState({ type: null, text: '' });

  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [editCatStatus, setEditCatStatus] = useState('active');
  const [editCatImage, setEditCatImage] = useState('');
  const [uploadingEditCatImage, setUploadingEditCatImage] = useState(false);
  const editCatFileInputRef = useRef(null);

  /* Vendor Review / Verification Modal State */
  const [reviewingVendor, setReviewingVendor] = useState(null);
  const [vendorReviewNotes, setVendorReviewNotes] = useState('');
  const [vendorCustomCommission, setVendorCustomCommission] = useState('');
  const [showBankAccount, setShowBankAccount] = useState(false);
  const [submittingVendorReview, setSubmittingVendorReview] = useState(false);
  const [vendorReviewMsg, setVendorReviewMsg] = useState({ type: null, text: '' });

  /* Customer Management, Blocking & Deletion State */
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [customerDeleteLoading, setCustomerDeleteLoading] = useState(false);
  const [customerToBlock, setCustomerToBlock] = useState(null);
  const [customerBlockLoading, setCustomerBlockLoading] = useState(false);
  const [customerActionMsg, setCustomerActionMsg] = useState({ type: null, text: '' });

  /* Coupons Engine State */
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [couponProductSearch, setCouponProductSearch] = useState('');
  const [editingCouponCode, setEditingCouponCode] = useState(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    discountType: 'percent',
    discountValue: 10,
    maxDiscountAmount: '',
    minOrderAmount: 299,
    usageLimit: '',
    startDate: '',
    endDate: '',
    isActive: true
  });
  const [couponSaving, setCouponSaving] = useState(false);
  const [couponFormMsg, setCouponFormMsg] = useState({ type: null, text: '' });
  const [couponSearch, setCouponSearch] = useState('');
  const [couponToDelete, setCouponToDelete] = useState(null);
  const [couponDeleteLoading, setCouponDeleteLoading] = useState(false);

  /* Deals of the Day State */
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState(null);
  const [dealForm, setDealForm] = useState({
    productId: '',
    dealPrice: '',
    stockLimit: '',
    startTime: '',
    endTime: '',
    status: 'active'
  });
  const [dealSaving, setDealSaving] = useState(false);
  const [dealFormMsg, setDealFormMsg] = useState({ type: null, text: '' });
  const [dealToDelete, setDealToDelete] = useState(null);
  const [dealDeleteLoading, setDealDeleteLoading] = useState(false);

  /* Commission & Payouts State */
  const [globalCommissionRate, setGlobalCommissionRate] = useState(10);
  const [savingGlobalCommission, setSavingGlobalCommission] = useState(false);
  const [commissionMsg, setCommissionMsg] = useState({ type: null, text: '' });
  const [editingVendorCommId, setEditingVendorCommId] = useState(null);
  const [vendorCommRateInput, setVendorCommRateInput] = useState('');
  const [savingVendorComm, setSavingVendorComm] = useState(false);
  const [vendorCommSearch, setVendorCommSearch] = useState('');

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

  /* Customer sub-tabs: 'registered' | 'subscribers' | 'enquiries' */
  const [customerSubTab, setCustomerSubTab] = useState('registered');
  const [newsletterSubscribers, setNewsletterSubscribers] = useState([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [subscriberPage, setSubscriberPage] = useState(1);
  const [subscriberPageSize, setSubscriberPageSize] = useState(10);

  const [bulkEnquiries, setBulkEnquiries] = useState([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState(false);
  const [enquirySearch, setEnquirySearch] = useState('');
  const [enquiryPage, setEnquiryPage] = useState(1);
  const [enquiryPageSize, setEnquiryPageSize] = useState(10);

  /* Videos filters and pagination */
  const [videoSearch, setVideoSearch] = useState('');
  const [videoStatusFilter, setVideoStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
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
    mobileImageUrl: '',
    tabletImageUrl: '',
    imageAspectRatio: '16:5',
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
  const [bannerUploadTarget, setBannerUploadTarget] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [bannerAspectWarning, setBannerAspectWarning] = useState('');
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
        const [vendorRes, productRes, orderRes, userRes, catRes, videoRes, bannerRes, couponRes, dealRes, commRes] = await Promise.all([
          api.getVendors(),
          api.getProducts({}, 'admin'),
          api.getOrders({}, 'admin'),
          api.getUsers(),
          api.getCategories({}, 'admin'),
          api.getVideos().catch(() => ({ success: true, videos: [] })),
          api.getAdminBanners().catch(() => ({ success: true, banners: [] })),
          api.getAdminCoupons().catch(() => ({ success: true, coupons: [] })),
          api.getAdminDeals().catch(() => ({ success: true, deals: [] })),
          api.getCommissionConfig().catch(() => ({ success: true, defaultCommissionRate: 10, vendors: [] }))
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
          banners: bannerRes?.banners || [],
          coupons: couponRes?.coupons || [],
          deals: dealRes?.deals || [],
          commissionConfig: commRes || { defaultCommissionRate: 10, vendors: [] }
        });
        if (commRes?.defaultCommissionRate != null) {
          setGlobalCommissionRate(commRes.defaultCommissionRate);
        }
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
  }, [attempt, onLogout]);

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

  const handleNewCatImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!validTypes.includes(file.type)) {
      setCatFormMsg({ type: 'error', text: 'Please select a valid image file (JPEG, PNG, WEBP, AVIF).' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setCatFormMsg({ type: 'error', text: 'Image file size exceeds 10MB limit.' });
      return;
    }

    setUploadingNewCatImage(true);
    setCatFormMsg({ type: null, text: '' });
    try {
      const res = await api.uploadImage(file, 'admin');
      if (res?.success && res.url) {
        setNewCatImage(res.url);
        setCatFormMsg({ type: 'success', text: 'Category image uploaded successfully!' });
      } else {
        setCatFormMsg({ type: 'error', text: res?.error || 'Failed to upload category image' });
      }
    } catch (err) {
      setCatFormMsg({ type: 'error', text: err.message || 'Image upload failed' });
    } finally {
      setUploadingNewCatImage(false);
      if (newCatFileInputRef.current) newCatFileInputRef.current.value = '';
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
        status: newCatStatus,
        vendorId: newCatVendor === 'shared' ? null : newCatVendor,
        imageUrl: newCatImage.trim() || null
      }, 'admin');
      if (res?.success) {
        setNewCatName('');
        setNewCatDesc('');
        setNewCatVendor('shared');
        setNewCatStatus('active');
        setNewCatImage('');
        clearCategoriesCache();
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

  /* Vendor Review & Verification handlers */
  const handleOpenVendorReview = (vendor) => {
    setReviewingVendor(vendor);
    setVendorReviewNotes(vendor.verificationNotes || vendor.verification_notes || '');
    setVendorCustomCommission(vendor.commissionRate != null ? String(vendor.commissionRate) : '');
    setShowBankAccount(false);
    setVendorReviewMsg({ type: null, text: '' });
  };

  const handleVendorReviewAction = async (newStatus) => {
    if (!reviewingVendor) return;
    setSubmittingVendorReview(true);
    setVendorReviewMsg({ type: null, text: '' });
    try {
      const payload = {
        status: newStatus,
        verificationNotes: vendorReviewNotes.trim() || undefined,
        commissionRate: vendorCustomCommission !== '' ? Number(vendorCustomCommission) : null
      };
      const res = await api.verifyVendorApplication(reviewingVendor.id, payload);
      if (res?.success) {
        setVendorReviewMsg({ type: 'success', text: `Vendor status successfully updated to ${newStatus}` });
        setAttempt((n) => n + 1);
        setTimeout(() => {
          setReviewingVendor(null);
          setVendorReviewMsg({ type: null, text: '' });
        }, 1200);
      } else {
        setVendorReviewMsg({ type: 'error', text: res?.error || 'Failed to update vendor' });
      }
    } catch (err) {
      setVendorReviewMsg({ type: 'error', text: err?.message || 'Action failed' });
    } finally {
      setSubmittingVendorReview(false);
    }
  };

  /* Customer Management Actions */
  const handleToggleCustomerStatus = async (user, nextStatus) => {
    try {
      const res = await api.updateCustomerStatus(user.id, nextStatus);
      if (res?.success) {
        setAttempt((n) => n + 1);
        setCustomerActionMsg({ type: 'success', text: `Customer account ${nextStatus === 'active' ? 'reactivated' : 'deactivated'} successfully` });
        setTimeout(() => setCustomerActionMsg({ type: null, text: '' }), 3000);
      } else {
        setCustomerActionMsg({ type: 'error', text: res?.error || 'Failed to update customer status' });
      }
    } catch (err) {
      setCustomerActionMsg({ type: 'error', text: err.message || 'Failed to update customer status' });
    }
  };

  const handleConfirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    setCustomerDeleteLoading(true);
    try {
      const res = await api.deleteCustomer(customerToDelete.id);
      if (res?.success) {
        setAttempt((n) => n + 1);
        setCustomerActionMsg({ type: 'success', text: res.message || 'Customer account processed' });
        setCustomerToDelete(null);
        setTimeout(() => setCustomerActionMsg({ type: null, text: '' }), 3000);
      } else {
        setCustomerActionMsg({ type: 'error', text: res?.error || 'Failed to delete customer' });
      }
    } catch (err) {
      setCustomerActionMsg({ type: 'error', text: err.message || 'Failed to delete customer' });
    } finally {
      setCustomerDeleteLoading(false);
    }
  };

  const handleConfirmBlockCustomer = async () => {
    if (!customerToBlock) return;
    setCustomerBlockLoading(true);
    try {
      const isAlreadyBlocked = customerToBlock.status === 'blocked';
      const nextStatus = isAlreadyBlocked ? 'active' : 'blocked';
      const res = await api.updateCustomerStatus(customerToBlock.id, nextStatus);
      if (res?.success) {
        setAttempt((n) => n + 1);
        setCustomerActionMsg({
          type: 'success',
          text: `Customer "${customerToBlock.name}" has been ${isAlreadyBlocked ? 'unblocked' : 'blocked'} successfully.`
        });
        setCustomerToBlock(null);
        setTimeout(() => setCustomerActionMsg({ type: null, text: '' }), 3000);
      } else {
        setCustomerActionMsg({ type: 'error', text: res?.error || 'Failed to update customer status' });
      }
    } catch (err) {
      setCustomerActionMsg({ type: 'error', text: err.message || 'Failed to update customer status' });
    } finally {
      setCustomerBlockLoading(false);
    }
  };

  /* Newsletter Subscribers & Bulk Enquiries Handlers */
  const fetchSubscribers = async () => {
    setLoadingSubscribers(true);
    try {
      const res = await api.getAdminNewsletterSubscribers();
      if (res?.success) {
        setNewsletterSubscribers(res.subscribers || []);
      }
    } catch (err) {
      console.error('Failed to fetch newsletter subscribers:', err);
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const fetchEnquiries = async () => {
    setLoadingEnquiries(true);
    try {
      const res = await api.getAdminBulkEnquiries();
      if (res?.success) {
        setBulkEnquiries(res.enquiries || []);
      }
    } catch (err) {
      console.error('Failed to fetch bulk enquiries:', err);
    } finally {
      setLoadingEnquiries(false);
    }
  };

  const exportSubscribersCSV = () => {
    if (!newsletterSubscribers.length) return;
    const headers = ['ID', 'Email', 'Status', 'Subscribed Date'];
    const rows = newsletterSubscribers.map((s) => [
      s.id,
      `"${(s.email || '').replace(/"/g, '""')}"`,
      `"${s.status || 'subscribed'}"`,
      `"${s.created_at ? new Date(s.created_at).toLocaleString() : ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `newsletter_subscribers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportEnquiriesCSV = () => {
    if (!bulkEnquiries.length) return;
    const headers = ['ID', 'Date', 'Name', 'Email', 'Phone', 'Product / Category', 'Quantity', 'Status', 'Message'];
    const rows = bulkEnquiries.map((e) => [
      e.id,
      `"${e.created_at ? new Date(e.created_at).toLocaleString() : ''}"`,
      `"${(e.name || '').replace(/"/g, '""')}"`,
      `"${(e.email || '').replace(/"/g, '""')}"`,
      `"${(e.phone || '').replace(/"/g, '""')}"`,
      `"${(e.product || '').replace(/"/g, '""')}"`,
      e.quantity || 1,
      `"${e.status || 'pending'}"`,
      `"${(e.message || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bulk_order_enquiries_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* Coupons Action Handlers */
  const handleOpenAddCoupon = () => {
    setEditingCouponCode(null);
    setCouponForm({
      code: '',
      description: '',
      discountType: 'percent',
      discountValue: 10,
      maxDiscountAmount: '',
      minOrderAmount: 299,
      applicableTo: 'all',
      selectedProducts: [],
      perCustomerLimit: 1,
      usageLimit: '',
      startDate: '',
      endDate: '',
      isActive: true
    });
    setCouponFormMsg({ type: null, text: '' });
    setCouponModalOpen(true);
  };

  const updateCouponForm = (patch) => {
    setCouponForm((prev) => ({ ...prev, ...patch }));
    if (couponFormMsg.text) setCouponFormMsg({ type: null, text: '' });
  };

  const handleOpenEditCoupon = (c) => {
    setEditingCouponCode(c.code);
    let prodIds = [];
    if (c.productIds || c.product_ids) {
      const raw = c.productIds || c.product_ids;
      try {
        prodIds = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        prodIds = [];
      }
    }
    setCouponForm({
      code: c.code,
      description: c.description || c.title || '',
      discountType: c.discountType || c.discount_type || c.type || 'percent',
      discountValue: c.discountValue ?? c.discount_value ?? c.value ?? 10,
      maxDiscountAmount: c.maxDiscountAmount ?? c.max_discount_amount ?? c.max_discount ?? '',
      minOrderAmount: c.minOrderAmount ?? c.min_order_amount ?? c.min_order ?? 0,
      applicableTo: c.applicableTo || c.applicable_to || (prodIds.length > 0 ? 'selected' : 'all'),
      selectedProducts: prodIds,
      perCustomerLimit: c.perCustomerLimit ?? c.per_customer_limit ?? 1,
      usageLimit: c.usageLimit ?? c.usage_limit ?? '',
      startDate: c.startDate || c.start_date ? new Date(c.startDate || c.start_date).toISOString().slice(0, 10) : '',
      endDate: c.endDate || c.end_date ? new Date(c.endDate || c.end_date).toISOString().slice(0, 10) : '',
      isActive: Boolean(c.isActive ?? c.is_active ?? 1)
    });
    setCouponFormMsg({ type: null, text: '' });
    setCouponModalOpen(true);
  };

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    if (!couponForm.code.trim()) {
      setCouponFormMsg({ type: 'error', text: 'Coupon code is required.' });
      return;
    }
    setCouponSaving(true);
    setCouponFormMsg({ type: null, text: '' });
    try {
      const payload = {
        code: couponForm.code.trim().toUpperCase(),
        title: couponForm.description.trim(),
        description: couponForm.description.trim(),
        discountType: couponForm.discountType,
        discountValue: Number(couponForm.discountValue) || 0,
        maxDiscountAmount: couponForm.maxDiscountAmount !== '' ? Number(couponForm.maxDiscountAmount) : null,
        minOrderAmount: Number(couponForm.minOrderAmount) || 0,
        applicableTo: couponForm.applicableTo || 'all',
        productIds: couponForm.applicableTo === 'selected' ? couponForm.selectedProducts : [],
        perCustomerLimit: couponForm.perCustomerLimit !== '' ? parseInt(couponForm.perCustomerLimit, 10) : 1,
        usageLimit: couponForm.usageLimit !== '' ? parseInt(couponForm.usageLimit, 10) : null,
        startDate: couponForm.startDate || null,
        endDate: couponForm.endDate || null,
        isActive: Boolean(couponForm.isActive)
      };

      if (editingCouponCode) {
        const res = await api.updateCoupon(editingCouponCode, payload);
        if (!res?.success) throw new Error(res?.error || 'Failed to update coupon');
      } else {
        const res = await api.createCoupon(payload);
        if (!res?.success) throw new Error(res?.error || 'Failed to create coupon');
      }

      setAttempt((n) => n + 1);
      setCouponFormMsg({ type: 'success', text: `Coupon ${payload.code} saved successfully!` });
      setTimeout(() => {
        setCouponModalOpen(false);
      }, 1000);
    } catch (err) {
      setCouponFormMsg({ type: 'error', text: err.message || 'Failed to save coupon' });
    } finally {
      setCouponSaving(false);
    }
  };

  const handleConfirmDeleteCoupon = async () => {
    if (!couponToDelete) return;
    setCouponDeleteLoading(true);
    try {
      const res = await api.deleteCoupon(couponToDelete.code);
      if (res?.success) {
        setAttempt((n) => n + 1);
        setCouponToDelete(null);
      } else {
        alert(res?.error || 'Failed to delete coupon');
      }
    } catch (err) {
      alert(err.message || 'Failed to delete coupon');
    } finally {
      setCouponDeleteLoading(false);
    }
  };

  /* Deals of the Day Action Handlers */
  const handleOpenAddDeal = () => {
    setEditingDealId(null);
    setDealForm({
      productId: (state.products || [])[0]?.id || '',
      dealPrice: '',
      stockLimit: '',
      startTime: '',
      endTime: '',
      status: 'active'
    });
    setDealFormMsg({ type: null, text: '' });
    setDealModalOpen(true);
  };

  const handleOpenEditDeal = (d) => {
    setEditingDealId(d.id);
    setDealForm({
      productId: d.productId || d.product_id,
      dealPrice: d.dealPrice ?? d.deal_price ?? '',
      stockLimit: d.stockLimit ?? d.stock_limit ?? '',
      startTime: d.startTime || d.start_time ? new Date(d.startTime || d.start_time).toISOString().slice(0, 16) : '',
      endTime: d.endTime || d.end_time ? new Date(d.endTime || d.end_time).toISOString().slice(0, 16) : '',
      status: d.status || 'active'
    });
    setDealFormMsg({ type: null, text: '' });
    setDealModalOpen(true);
  };

  const handleSaveDeal = async (e) => {
    e.preventDefault();
    if (!dealForm.productId) {
      setDealFormMsg({ type: 'error', text: 'Please select a product for the deal.' });
      return;
    }
    const numPrice = Number(dealForm.dealPrice);
    if (!dealForm.dealPrice || isNaN(numPrice) || numPrice <= 0) {
      setDealFormMsg({ type: 'error', text: 'Please enter a valid deal price.' });
      return;
    }
    setDealSaving(true);
    setDealFormMsg({ type: null, text: '' });
    try {
      const payload = {
        productId: dealForm.productId,
        dealPrice: numPrice,
        stockLimit: dealForm.stockLimit !== '' ? parseInt(dealForm.stockLimit, 10) : null,
        startTime: dealForm.startTime || null,
        endTime: dealForm.endTime || null,
        status: dealForm.status
      };

      if (editingDealId) {
        const res = await api.updateDeal(editingDealId, payload);
        if (!res?.success) throw new Error(res?.error || 'Failed to update deal');
      } else {
        const res = await api.createDeal(payload);
        if (!res?.success) throw new Error(res?.error || 'Failed to create deal');
      }

      setAttempt((n) => n + 1);
      setDealFormMsg({ type: 'success', text: 'Deal saved successfully!' });
      setTimeout(() => {
        setDealModalOpen(false);
      }, 1000);
    } catch (err) {
      setDealFormMsg({ type: 'error', text: err.message || 'Failed to save deal' });
    } finally {
      setDealSaving(false);
    }
  };

  /* Shipping & Handling Configuration Handlers */
  const [shippingConfig, setShippingConfig] = useState({
    standardCharge: 50,
    standardFreeThreshold: 499,
    standardDeliveryEnabled: true,
    expressCharge: 120,
    expressDeliveryEnabled: true,
    handlingFee: 0,
    handlingFeeEnabled: false
  });
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingSaved, setShippingSaved] = useState(false);

  useEffect(() => {
    if (activeTab === 'shipping') {
      setShippingLoading(true);
      api.getAdminShippingConfig()
        .then((res) => {
          if (res?.success && res.config) {
            setShippingConfig(res.config);
          }
        })
        .catch(() => {})
        .finally(() => setShippingLoading(false));
    }
  }, [activeTab]);

  const handleSaveShippingConfig = async (e) => {
    e.preventDefault();
    setShippingLoading(true);
    setShippingSaved(false);
    try {
      const res = await api.updateAdminShippingConfig(shippingConfig);
      if (res?.success) {
        setShippingSaved(true);
        setTimeout(() => setShippingSaved(false), 3500);
      } else {
        alert(res?.error || 'Failed to update delivery settings');
      }
    } catch (err) {
      alert(err?.message || 'Error updating delivery settings');
    } finally {
      setShippingLoading(false);
    }
  };

  const handleConfirmDeleteDeal = async () => {
    if (!dealToDelete) return;
    setDealDeleteLoading(true);
    try {
      const res = await api.deleteDeal(dealToDelete.id);
      if (res?.success) {
        setAttempt((n) => n + 1);
        setDealToDelete(null);
      } else {
        alert(res?.error || 'Failed to delete deal');
      }
    } catch (err) {
      alert(err.message || 'Failed to delete deal');
    } finally {
      setDealDeleteLoading(false);
    }
  };

  /* Commission Handlers */
  const handleSaveGlobalCommission = async (e) => {
    e.preventDefault();
    const rate = Number(globalCommissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setCommissionMsg({ type: 'error', text: 'Commission rate must be between 0% and 100%.' });
      return;
    }
    setSavingGlobalCommission(true);
    setCommissionMsg({ type: null, text: '' });
    try {
      const res = await api.updateCommissionConfig({ defaultCommissionRate: rate });
      if (res?.success) {
        setCommissionMsg({ type: 'success', text: `Global default commission updated to ${rate}%!` });
        setAttempt((n) => n + 1);
        setTimeout(() => setCommissionMsg({ type: null, text: '' }), 3000);
      } else {
        setCommissionMsg({ type: 'error', text: res?.error || 'Failed to update commission rate' });
      }
    } catch (err) {
      setCommissionMsg({ type: 'error', text: err.message || 'Failed to update commission rate' });
    } finally {
      setSavingGlobalCommission(false);
    }
  };

  const handleSaveVendorCommission = async (vendorId) => {
    setSavingVendorComm(true);
    try {
      const rateVal = vendorCommRateInput === '' ? null : Number(vendorCommRateInput);
      const res = await api.updateVendorCommission(vendorId, rateVal);
      if (res?.success) {
        setAttempt((n) => n + 1);
        setEditingVendorCommId(null);
        setVendorCommRateInput('');
      } else {
        alert(res?.error || 'Failed to update vendor commission');
      }
    } catch (err) {
      alert(err.message || 'Failed to update vendor commission');
    } finally {
      setSavingVendorComm(false);
    }
  };

  /* Keyboard Escape to dismiss Add/Edit Product modal */
  useEffect(() => {
    if (!addProductOpen && !editingProductId) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setAddProductOpen(false);
        setEditingProductId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addProductOpen, editingProductId]);

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
    setEditCatStatus(cat.status || 'active');
    setEditCatImage(cat.image || '');
  };

  const handleEditCatImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!validTypes.includes(file.type)) {
      setActionError({ id: editingCatId, message: 'Please select a valid image file (JPEG, PNG, WEBP, AVIF).' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setActionError({ id: editingCatId, message: 'Image file size exceeds 10MB limit.' });
      return;
    }

    setUploadingEditCatImage(true);
    try {
      const res = await api.uploadImage(file, 'admin');
      if (res?.success && res.url) {
        setEditCatImage(res.url);
      } else {
        setActionError({ id: editingCatId, message: res?.error || 'Failed to upload category image' });
      }
    } catch (err) {
      setActionError({ id: editingCatId, message: err.message || 'Image upload failed' });
    } finally {
      setUploadingEditCatImage(false);
      if (editCatFileInputRef.current) editCatFileInputRef.current.value = '';
    }
  };

  const handleSaveEditCategory = async (e) => {
    e.preventDefault();
    if (!editCatName.trim()) return;
    await runRowAction(editingCatId, async () => {
      const res = await api.updateCategory(editingCatId, {
        name: editCatName.trim(),
        description: editCatDesc.trim(),
        status: editCatStatus,
        imageUrl: editCatImage.trim() || null
      }, 'admin');
      if (!res?.success) throw new Error(res?.error || 'Failed to update category');
      clearCategoriesCache();
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

  const handleApproveVideo = async (vid) => {
    await runRowAction(vid.id, async () => {
      const res = await api.updateVideoStatus(vid.id, 'approved');
      if (!res?.success) throw new Error(res?.error || 'Failed to approve video');
    }, 'Failed to approve video');
  };

  const handleRejectVideo = async (vid) => {
    const reason = window.prompt(`Enter rejection reason for "${vid.title}":`, 'Does not meet video quality guidelines');
    if (reason === null) return;
    await runRowAction(vid.id, async () => {
      const res = await api.updateVideoStatus(vid.id, 'rejected', reason);
      if (!res?.success) throw new Error(res?.error || 'Failed to reject video');
    }, 'Failed to reject video');
  };

  const handleToggleVideoStatus = async (vid) => {
    const isLive = vid.status === 'active' || vid.status === 'approved';
    const nextStatus = isLive ? 'inactive' : 'approved';
    await runRowAction(vid.id, async () => {
      const res = await api.updateVideoStatus(vid.id, nextStatus);
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
      mobileImageUrl: '',
      tabletImageUrl: '',
      imageAspectRatio: '16:5',
      ctaText: 'Shop Now',
      ctaLink: '/shop',
      secondaryCtaText: '',
      secondaryCtaLink: '',
      tag: 'Direct Farm Harvest',
      badge: '100% Certified Organic • Free Delivery over ₹499',
      displayOrder: (state.banners || []).length,
      isActive: true
    });
    setBannerAspectWarning('');
    setBannerUploadTarget('desktop');
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
      mobileImageUrl: b.mobile_image_url || b.mobileImageUrl || b.mobileImage || '',
      tabletImageUrl: b.tablet_image_url || b.tabletImageUrl || b.tabletImage || '',
      imageAspectRatio: b.image_aspect_ratio || b.imageAspectRatio || '16:5',
      ctaText: b.cta_text || b.ctaText || 'Shop Now',
      ctaLink: b.cta_link || b.ctaLink || '/shop',
      secondaryCtaText: b.secondary_cta_text || b.secondaryCtaText || '',
      secondaryCtaLink: b.secondary_cta_link || b.secondaryCtaLink || '',
      tag: b.tag || 'Direct Farm Harvest',
      badge: b.badge || '',
      displayOrder: b.display_order ?? b.displayOrder ?? 0,
      isActive: Boolean(b.is_active ?? b.isActive ?? 1)
    });
    setBannerAspectWarning('');
    setBannerUploadTarget('desktop');
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
    setBannerAspectWarning('');

    if (typeof window !== 'undefined' && window.Image && window.URL?.createObjectURL) {
      try {
        const objectUrl = window.URL.createObjectURL(file);
        const testImg = new window.Image();
        testImg.onload = () => {
          const ratio = testImg.width / testImg.height;
          if (bannerUploadTarget === 'desktop' && (ratio < 2.5 || ratio > 3.8)) {
            setBannerAspectWarning(`⚠️ Aspect Ratio Warning: Recommended desktop banner ratio is 16:5 (1920×600 px). Uploaded image is ${testImg.width}×${testImg.height} px (ratio ${(ratio).toFixed(2)}). It will be fitted without distortion.`);
          } else if (bannerUploadTarget === 'mobile' && (ratio < 0.6 || ratio > 1.0)) {
            setBannerAspectWarning(`⚠️ Aspect Ratio Warning: Recommended mobile banner ratio is 5:6 (750×900 px). Uploaded image is ${testImg.width}×${testImg.height} px (ratio ${(ratio).toFixed(2)}).`);
          } else if (bannerUploadTarget === 'tablet' && (ratio < 2.0 || ratio > 2.8)) {
            setBannerAspectWarning(`⚠️ Aspect Ratio Warning: Recommended tablet banner ratio is 12:5 (1200×500 px). Uploaded image is ${testImg.width}×${testImg.height} px (ratio ${(ratio).toFixed(2)}).`);
          }
          window.URL.revokeObjectURL(objectUrl);
        };
        testImg.src = objectUrl;
      } catch {
        /* ignore */
      }
    }

    try {
      const res = await api.uploadImage(file, 'admin');
      if (res?.success && res.url) {
        if (bannerUploadTarget === 'desktop') {
          setBannerForm((prev) => ({
            ...prev,
            imageUrl: res.url,
            imagePublicId: res.public_id || res.publicId || ''
          }));
        } else if (bannerUploadTarget === 'tablet') {
          setBannerForm((prev) => ({
            ...prev,
            tabletImageUrl: res.url
          }));
        } else if (bannerUploadTarget === 'mobile') {
          setBannerForm((prev) => ({
            ...prev,
            mobileImageUrl: res.url
          }));
        }
        setBannerFormMsg({ type: 'success', text: `${bannerUploadTarget.toUpperCase()} image uploaded to Cloudinary CDN successfully!` });
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
      setBannerFormMsg({ type: 'error', text: 'Desktop banner image is required (upload or enter URL).' });
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
        mobileImageUrl: bannerForm.mobileImageUrl.trim() || null,
        tabletImageUrl: bannerForm.tabletImageUrl.trim() || null,
        imageAspectRatio: bannerForm.imageAspectRatio || '16:5',
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

  // Newsletter Subscribers
  const filteredSubscribers = newsletterSubscribers.filter((s) => {
    const query = subscriberSearch.toLowerCase();
    return !subscriberSearch || (s.email || '').toLowerCase().includes(query);
  });

  const paginatedSubscribers = filteredSubscribers.slice(
    (subscriberPage - 1) * subscriberPageSize,
    subscriberPage * subscriberPageSize
  );

  // Bulk Order Enquiries
  const filteredEnquiries = bulkEnquiries.filter((e) => {
    const query = enquirySearch.toLowerCase();
    return !enquirySearch ||
      (e.name || '').toLowerCase().includes(query) ||
      (e.email || '').toLowerCase().includes(query) ||
      (e.phone || '').toLowerCase().includes(query) ||
      (e.product || '').toLowerCase().includes(query) ||
      (e.message || '').toLowerCase().includes(query);
  });

  const paginatedEnquiries = filteredEnquiries.slice(
    (enquiryPage - 1) * enquiryPageSize,
    enquiryPage * enquiryPageSize
  );

  // Videos
  const filteredVideos = (state.videos || []).filter((v) => {
    const query = videoSearch.toLowerCase();
    const matchesSearch = !videoSearch ||
      (v.title || '').toLowerCase().includes(query) ||
      (v.productTitle || '').toLowerCase().includes(query) ||
      (v.vendorName || '').toLowerCase().includes(query) ||
      (v.dbVendorName || '').toLowerCase().includes(query) ||
      (v.dbVendorBusiness || '').toLowerCase().includes(query);

    const isPending = v.status === 'pending';
    const isApproved = v.status === 'approved' || v.status === 'active';
    const isRejected = v.status === 'rejected';

    let matchesStatus = true;
    if (videoStatusFilter === 'pending') matchesStatus = isPending;
    else if (videoStatusFilter === 'approved') matchesStatus = isApproved;
    else if (videoStatusFilter === 'rejected') matchesStatus = isRejected;

    return matchesSearch && matchesStatus;
  });

  const pendingVideosCount = (state.videos || []).filter((v) => v.status === 'pending').length;

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
            ['vendors', 'Vendors & Approvals', (state.vendors || []).filter((v) => v.status === 'pending' || v.status === 'corrections_requested').length > 0 ? `${state.vendors.length} (${(state.vendors || []).filter((v) => v.status === 'pending' || v.status === 'corrections_requested').length} pending)` : state.vendors.length],
            ['products', 'Products', state.products.length],
            ['coupons', 'Coupons', (state.coupons || []).length],
            ['deals', 'Deals of the Day', (state.deals || []).length],
            ['commission', 'Commission & Payouts', null],
            ['videos', 'Video Reviews', (state.videos || []).length],
            ['banners', 'Homepage Banners', (state.banners || []).length],
            ['customers', 'Customers', state.users.length],
            ['shipping', 'Delivery & Charges', null],
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
              {activeTab === 'vendors' && 'Vendor applications & seller management'}
              {activeTab === 'products' && 'Product approvals'}
              {activeTab === 'coupons' && 'Promotional coupons & discount engine'}
              {activeTab === 'deals' && 'Deals of the Day management'}
              {activeTab === 'commission' && 'Platform commission & vendor settlement'}
              {activeTab === 'customers' && 'Customer accounts'}
              {activeTab === 'videos' && 'Homepage Shorts & Video Reviews'}
              {activeTab === 'banners' && 'Homepage Banner Management'}
              {activeTab === 'shipping' && 'Delivery Methods & Handling Charges Configuration'}
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

                    <div className="cat-form-field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label>Category Image</label>
                        <button
                          type="button"
                          className="btn-secondary-sm"
                          disabled={uploadingNewCatImage || creatingCat}
                          onClick={() => newCatFileInputRef.current?.click()}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
                        >
                          {uploadingNewCatImage ? (
                            <><Loader2 size={12} className="spin" /> Uploading...</>
                          ) : (
                            <><UploadCloud size={12} /> Upload File</>
                          )}
                        </button>
                      </div>
                      <input
                        type="file"
                        ref={newCatFileInputRef}
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        style={{ display: 'none' }}
                        onChange={handleNewCatImageUpload}
                        disabled={uploadingNewCatImage || creatingCat}
                      />
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="text"
                          className="admin-filter-input"
                          style={{ width: '100%' }}
                          placeholder="Image URL or upload file..."
                          value={newCatImage}
                          onChange={(e) => setNewCatImage(e.target.value)}
                        />
                        {newCatImage && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <img
                              src={newCatImage}
                              alt="Preview"
                              style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #0e5c4a' }}
                              onError={(e) => { e.currentTarget.style.opacity = '0.3'; }}
                            />
                            <button
                              type="button"
                              onClick={() => setNewCatImage('')}
                              title="Clear image"
                              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </div>
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
                        <th style={{ width: 64, textAlign: 'center' }}>Image</th>
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
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="file"
                                  ref={editCatFileInputRef}
                                  accept="image/jpeg,image/png,image/webp,image/avif"
                                  style={{ display: 'none' }}
                                  onChange={handleEditCatImageUpload}
                                  disabled={uploadingEditCatImage}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                  <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', border: '1.5px solid #0e5c4a', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img
                                      src={editCatImage || DEFAULT_CATEGORY_IMAGE}
                                      alt={editCatName}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      onError={(e) => {
                                        if (e.currentTarget.src !== DEFAULT_CATEGORY_IMAGE) {
                                          e.currentTarget.src = DEFAULT_CATEGORY_IMAGE;
                                        }
                                      }}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => editCatFileInputRef.current?.click()}
                                    disabled={uploadingEditCatImage}
                                    style={{ fontSize: 10, padding: '2px 6px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                  >
                                    {uploadingEditCatImage ? '...' : 'Upload'}
                                  </button>
                                  {editCatImage && (
                                    <button
                                      type="button"
                                      onClick={() => setEditCatImage('')}
                                      style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              </td>
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
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', margin: '0 auto', border: '1.5px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img
                                  src={cat.image || DEFAULT_CATEGORY_IMAGE}
                                  alt={cat.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  onError={(e) => {
                                    if (e.currentTarget.src !== DEFAULT_CATEGORY_IMAGE) {
                                      e.currentTarget.src = DEFAULT_CATEGORY_IMAGE;
                                    }
                                  }}
                                />
                              </div>
                            </td>
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
                          <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
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
                    <option value="corrections_requested">Corrections Requested</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="deactivated">Deactivated</option>
                  </select>
                </div>

                <div className="vendors-table-container">
                  <table className="vendors-table">
                    <thead>
                      <tr>
                        <th>Business / Shop</th><th>Contact</th><th>Location</th><th>Tax / Food</th><th>Joined</th><th>Status</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedVendors.map((vendor) => (
                        <tr key={vendor.id}>
                          <td>
                            <strong>{vendor.businessName || vendor.name}</strong>
                            {vendor.registeredName && <div style={{ fontSize: 11, color: '#64748b' }}>{vendor.registeredName}</div>}
                            {busyId === vendor.id && <Loader2 size={13} className="spin" style={{ marginLeft: 6 }} />}
                          </td>
                          <td>
                            <div>{vendor.ownerName || vendor.name}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{vendor.email}</div>
                            {vendor.phone && <div style={{ fontSize: 11, color: '#64748b' }}>{vendor.phone}</div>}
                          </td>
                          <td style={{ fontSize: 13 }}>
                            {vendor.city ? `${vendor.city}, ${vendor.state || ''}` : '—'}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {vendor.gstStatus === 'Registered' ? <span style={{ color: '#16a34a', fontWeight: 600 }}>GST: {vendor.gstin || 'Yes'}</span> : <span style={{ color: '#64748b' }}>No GST</span>}
                            <br />
                            {vendor.fssaiStatus === 'Applicable' ? <span style={{ color: '#0e5c4a', fontWeight: 600 }}>FSSAI: {vendor.fssaiNumber || 'Yes'}</span> : <span style={{ color: '#64748b' }}>No FSSAI</span>}
                          </td>
                          <td style={{ fontSize: '13px', color: '#64748b' }}>
                            {vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td>
                            <span className={`status-badge status-${vendor.status} ${vendor.status === 'corrections_requested' ? 'admin-badge-corrections' : ''}`}>
                              {vendor.status === 'corrections_requested' ? 'CORRECTIONS' : String(vendor.status || 'pending').toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="approve-btn"
                                style={{ background: '#0e5c4a', color: '#fff', padding: '5px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                onClick={() => handleOpenVendorReview(vendor)}
                              >
                                <FileText size={13} /> Review Details
                              </button>

                              {vendor.status === 'pending' && (
                                <div className="action-buttons" style={{ display: 'inline-flex', gap: 4 }}>
                                  <button
                                    type="button"
                                    className="approve-btn"
                                    disabled={busyId === vendor.id}
                                    onClick={() => runRowAction(vendor.id, () => api.updateVendorStatus(vendor.id, 'approved'), 'Vendor approval failed')}
                                  >
                                    <CheckCircle size={14} /> Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="reject-btn"
                                    disabled={busyId === vendor.id}
                                    onClick={() => runRowAction(vendor.id, () => api.updateVendorStatus(vendor.id, 'rejected'), 'Vendor rejection failed')}
                                  >
                                    <XCircle size={14} /> Reject
                                  </button>
                                </div>
                              )}
                              {vendor.status === 'approved' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '25px', color: '#64748b' }}>No vendor accounts match your filter.</td></tr>
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
                              <button
                                type="button"
                                className="approve-btn"
                                style={{
                                  background: '#0e5c4a',
                                  color: '#ffffff',
                                  borderColor: '#0e5c4a',
                                  padding: '5px 10px',
                                  fontSize: 12,
                                  fontWeight: 500,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                                onClick={() => setEditingProductId(product.id)}
                                title={`Edit product "${product.title}"`}
                              >
                                <Edit2 size={13} /> Edit
                              </button>
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

                {/* Video Review Status Tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary-sm"
                    style={{
                      background: videoStatusFilter === 'all' ? '#0e5c4a' : '#f1f5f9',
                      color: videoStatusFilter === 'all' ? '#ffffff' : '#334155',
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none'
                    }}
                    onClick={() => { setVideoStatusFilter('all'); setVideoPage(1); }}
                  >
                    All Videos ({(state.videos || []).length})
                  </button>
                  <button
                    type="button"
                    className="btn-secondary-sm"
                    style={{
                      background: videoStatusFilter === 'pending' ? '#d97706' : '#f1f5f9',
                      color: videoStatusFilter === 'pending' ? '#ffffff' : '#334155',
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                    onClick={() => { setVideoStatusFilter('pending'); setVideoPage(1); }}
                  >
                    <span>Pending Approval</span>
                    {pendingVideosCount > 0 && (
                      <span style={{ background: '#ffffff', color: '#d97706', padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                        {pendingVideosCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary-sm"
                    style={{
                      background: videoStatusFilter === 'approved' ? '#0e5c4a' : '#f1f5f9',
                      color: videoStatusFilter === 'approved' ? '#ffffff' : '#334155',
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none'
                    }}
                    onClick={() => { setVideoStatusFilter('approved'); setVideoPage(1); }}
                  >
                    Approved &amp; Live
                  </button>
                  <button
                    type="button"
                    className="btn-secondary-sm"
                    style={{
                      background: videoStatusFilter === 'rejected' ? '#dc2626' : '#f1f5f9',
                      color: videoStatusFilter === 'rejected' ? '#ffffff' : '#334155',
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none'
                    }}
                    onClick={() => { setVideoStatusFilter('rejected'); setVideoPage(1); }}
                  >
                    Rejected
                  </button>
                </div>

                <div className="admin-filter-bar">
                  <input
                    type="text"
                    className="admin-filter-input"
                    placeholder="Search videos by title, product, or vendor..."
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
                        <th>Uploaded By</th>
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
                          <td>
                            <span style={{ fontSize: 13, fontWeight: 500, color: vid.vendorId ? '#0e5c4a' : '#64748b' }}>
                              {vid.vendorName || vid.dbVendorBusiness || vid.dbVendorName || (vid.vendorId ? `Vendor (${vid.vendorId})` : 'Platform Admin')}
                            </span>
                          </td>
                          <td>{vid.displayOrder}</td>
                          <td>
                            {vid.status === 'pending' ? (
                              <span className="status-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                                PENDING REVIEW
                              </span>
                            ) : vid.status === 'rejected' ? (
                              <span className="status-badge status-rejected" title={vid.rejectionReason || 'Rejected'}>
                                REJECTED
                              </span>
                            ) : vid.status === 'inactive' ? (
                              <span className="status-badge" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' }}>
                                INACTIVE
                              </span>
                            ) : (
                              <span className="status-badge status-approved">
                                APPROVED
                              </span>
                            )}
                            {vid.rejectionReason && (
                              <p style={{ margin: '3px 0 0', fontSize: 11, color: '#dc2626' }}>
                                {vid.rejectionReason}
                              </p>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
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

                              {vid.status === 'pending' ? (
                                <>
                                  <button
                                    type="button"
                                    className="approve-btn"
                                    style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    disabled={busyId === vid.id}
                                    onClick={() => handleApproveVideo(vid)}
                                    title="Approve video for customer homepage"
                                  >
                                    {busyId === vid.id ? <Loader2 size={13} className="spin" /> : <CheckCircle size={13} />}
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="reject-btn"
                                    style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    disabled={busyId === vid.id}
                                    onClick={() => handleRejectVideo(vid)}
                                    title="Reject submitted video"
                                  >
                                    {busyId === vid.id ? <Loader2 size={13} className="spin" /> : <XCircle size={13} />}
                                    <span>Reject</span>
                                  </button>
                                </>
                              ) : vid.status === 'rejected' ? (
                                <button
                                  type="button"
                                  className="approve-btn"
                                  style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  disabled={busyId === vid.id}
                                  onClick={() => handleApproveVideo(vid)}
                                  title="Re-approve video"
                                >
                                  {busyId === vid.id ? <Loader2 size={13} className="spin" /> : <CheckCircle size={13} />}
                                  <span>Re-Approve</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className={vid.status === 'inactive' ? 'approve-btn' : 'btn-secondary-sm'}
                                    style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    disabled={busyId === vid.id}
                                    onClick={() => handleToggleVideoStatus(vid)}
                                    title={vid.status === 'inactive' ? 'Activate video' : 'Deactivate video'}
                                  >
                                    {busyId === vid.id ? <Loader2 size={13} className="spin" /> : vid.status === 'inactive' ? <CheckCircle size={13} /> : <XCircle size={13} />}
                                    <span>{vid.status === 'inactive' ? 'Activate' : 'Deactivate'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="reject-btn"
                                    style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    disabled={busyId === vid.id}
                                    onClick={() => handleRejectVideo(vid)}
                                    title="Reject video"
                                  >
                                    <XCircle size={13} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

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
                          <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                            No videos found matching your filter. Use the form above to add a video!
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
                <div className="vendors-header admin-products-header">
                  <div>
                    <h2>Homepage Promotional Banners</h2>
                    <p>Manage dynamic campaign hero banners displayed on the customer storefront carousel</p>
                  </div>
                  <button
                    type="button"
                    className="admin-add-product-main-btn"
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

            {/* ---------------- 5. COUPONS TAB ---------------- */}
            {activeTab === 'coupons' && (
              <div className="admin-vendors-section">
                <div className="vendors-header admin-products-header">
                  <div>
                    <h2>Promotional Coupons Engine</h2>
                    <p>Create and manage discount codes, percentage cuts, minimum order values, and usage caps</p>
                  </div>
                  <button
                    type="button"
                    className="admin-add-product-main-btn"
                    onClick={handleOpenAddCoupon}
                  >
                    <Plus size={16} /> Create New Coupon
                  </button>
                </div>

                <div className="admin-filter-bar">
                  <input
                    type="text"
                    className="admin-filter-input"
                    placeholder="Search coupons by code or description..."
                    value={couponSearch}
                    onChange={(e) => setCouponSearch(e.target.value)}
                  />
                </div>

                <div className="vendors-table-container">
                  <table className="vendors-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Type & Discount</th>
                        <th>Min Order / Max Cap</th>
                        <th>Usage Limit</th>
                        <th>Validity Window</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(state.coupons || [])
                        .filter((c) => {
                          if (!couponSearch.trim()) return true;
                          const q = couponSearch.toLowerCase();
                          return c.code?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q);
                        })
                        .map((c) => {
                          const isActive = Boolean(c.is_active ?? c.isActive ?? 1);
                          return (
                            <tr key={c.code}>
                              <td>
                                <strong style={{ color: '#0e5c4a', letterSpacing: 1, fontFamily: 'monospace', fontSize: 14 }}>{c.code}</strong>
                                {c.description && <div style={{ fontSize: 12, color: '#64748b' }}>{c.description}</div>}
                              </td>
                              <td>
                                <span style={{ fontWeight: 600 }}>
                                  {(c.discount_type || c.discountType) === 'percent'
                                    ? `${c.discount_value || c.discountValue}% OFF`
                                    : (c.discount_type || c.discountType) === 'flat'
                                    ? `₹${c.discount_value || c.discountValue} FLAT OFF`
                                    : 'FREE SHIPPING'}
                                </span>
                              </td>
                              <td style={{ fontSize: 13 }}>
                                <div>Min Order: ₹{c.min_order_amount ?? c.minOrderAmount ?? 0}</div>
                                {c.max_discount_amount || c.maxDiscountAmount ? (
                                  <div style={{ fontSize: 11, color: '#64748b' }}>Max Cap: ₹{c.max_discount_amount ?? c.maxDiscountAmount}</div>
                                ) : null}
                              </td>
                              <td style={{ fontSize: 13 }}>
                                <div>Used: <strong>{c.used_count ?? c.usedCount ?? 0}</strong></div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>
                                  {c.usage_limit || c.usageLimit ? `Limit: ${c.usage_limit || c.usageLimit}` : 'Unlimited'}
                                </div>
                              </td>
                              <td style={{ fontSize: 12, color: '#64748b' }}>
                                {(c.start_date || c.startDate) ? new Date(c.start_date || c.startDate).toLocaleDateString() : 'Start: Immediate'}
                                <br />
                                {(c.end_date || c.endDate) ? `Expires: ${new Date(c.end_date || c.endDate).toLocaleDateString()}` : 'No expiry'}
                              </td>
                              <td>
                                <span className={`status-badge ${isActive ? 'status-approved' : 'status-rejected'}`}>
                                  {isActive ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    className="btn-secondary-sm"
                                    style={{ fontSize: 12, padding: '4px 8px' }}
                                    onClick={() => handleOpenEditCoupon(c)}
                                    title="Edit coupon"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="reject-btn"
                                    style={{ padding: '4px 8px', fontSize: 12 }}
                                    onClick={() => setCouponToDelete(c)}
                                    title="Delete coupon"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      {(!state.coupons || state.coupons.length === 0) && (
                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>No coupons configured yet. Click &quot;Create New Coupon&quot; to add one.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ---------------- 6. DEALS OF THE DAY TAB ---------------- */}
            {activeTab === 'deals' && (
              <div className="admin-vendors-section">
                <div className="vendors-header admin-products-header">
                  <div>
                    <h2>Deals of the Day &amp; Flash Sales</h2>
                    <p>Highlight timed promotions, countdown-driven discounts, and inventory caps</p>
                  </div>
                  <button
                    type="button"
                    className="admin-add-product-main-btn"
                    onClick={handleOpenAddDeal}
                  >
                    <Plus size={16} /> Create New Deal
                  </button>
                </div>

                <div className="vendors-table-container">
                  <table className="vendors-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Regular Price</th>
                        <th>Deal Price</th>
                        <th>Discount</th>
                        <th>Stock / Sold</th>
                        <th>Schedule</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(state.deals || []).map((d) => {
                        const originalPrice = Number(d.product_price ?? d.originalPrice ?? 0);
                        const dealPrice = Number(d.deal_price ?? d.dealPrice ?? 0);
                        const discountPct = originalPrice > 0 ? Math.round(((originalPrice - dealPrice) / originalPrice) * 100) : 0;
                        const status = d.status || 'active';
                        return (
                          <tr key={d.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {(d.product_image || d.productImage) && (
                                  <img
                                    src={d.product_image || d.productImage}
                                    alt=""
                                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }}
                                  />
                                )}
                                <div>
                                  <strong>{d.product_title || d.productTitle || `Product #${d.product_id || d.productId}`}</strong>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>ID: {d.product_id || d.productId}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ textDecoration: 'line-through', color: '#94a3b8' }}>
                              ₹{originalPrice}
                            </td>
                            <td>
                              <strong style={{ color: '#0e5c4a', fontSize: 15 }}>₹{dealPrice}</strong>
                            </td>
                            <td>
                              <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: 12, fontWeight: 700, fontSize: 12 }}>
                                {discountPct}% OFF
                              </span>
                            </td>
                            <td style={{ fontSize: 13 }}>
                              <div>Sold: <strong>{d.sold_count ?? d.soldCount ?? 0}</strong></div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{d.stock_limit || d.stockLimit ? `Cap: ${d.stock_limit || d.stockLimit}` : 'No cap'}</div>
                            </td>
                            <td style={{ fontSize: 12, color: '#64748b' }}>
                              {(d.start_time || d.startTime) ? `Starts: ${new Date(d.start_time || d.startTime).toLocaleDateString()}` : 'Immediate'}
                              <br />
                              {(d.end_time || d.endTime) ? `Ends: ${new Date(d.end_time || d.endTime).toLocaleDateString()}` : 'Indefinite'}
                            </td>
                            <td>
                              <span className={`status-badge ${status === 'active' ? 'status-approved' : 'status-pending'}`}>
                                {status.toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn-secondary-sm"
                                  style={{ fontSize: 12, padding: '4px 8px' }}
                                  onClick={() => handleOpenEditDeal(d)}
                                  title="Edit deal"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="reject-btn"
                                  style={{ padding: '4px 8px', fontSize: 12 }}
                                  onClick={() => setDealToDelete(d)}
                                  title="Delete deal"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {(!state.deals || state.deals.length === 0) && (
                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>No active deals found. Click &quot;Create New Deal&quot; to configure a daily deal.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ---------------- 7. COMMISSION TAB ---------------- */}
            {activeTab === 'commission' && (
              <div className="admin-vendors-section">
                <div className="vendors-header">
                  <h2>Platform Commission & Vendor Settlement</h2>
                  <p>Configure the default marketplace commission fee and inspect or customize individual vendor percentage overrides.</p>
                </div>

                {commissionMsg.text && (
                  <div className={`admin-modal-alert ${commissionMsg.type}`} style={{ marginBottom: 16 }}>
                    {commissionMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{commissionMsg.text}</span>
                  </div>
                )}

                {/* Global Default Card */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 24, maxWidth: 640 }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#1e293b' }}>Global Default Commission Rate</h3>
                  <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748b' }}>
                    Applied across all vendor order line items automatically, unless an individual vendor has an approved override configured below.
                  </p>
                  <form onSubmit={handleSaveGlobalCommission} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', width: 140, minWidth: 120 }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        className="admin-number-input"
                        style={{ width: '100%', minWidth: 0, paddingRight: 32, fontWeight: 700, fontSize: 16 }}
                        value={globalCommissionRate}
                        onChange={(e) => setGlobalCommissionRate(e.target.value)}
                        required
                      />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#64748b', pointerEvents: 'none' }}>%</span>
                    </div>
                    <button
                      type="submit"
                      className="approve-btn"
                      disabled={savingGlobalCommission}
                      style={{ padding: '9px 20px', fontSize: 13.5, whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {savingGlobalCommission ? <Loader2 size={15} className="spin" /> : 'Save Default Rate'}
                    </button>
                  </form>
                </div>

                {/* Vendor Override Header & Search */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, margin: '20px 0 12px 0' }}>
                  <div>
                    <h3 style={{ fontSize: 16, margin: 0 }}>Vendor Custom Commission Overrides</h3>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      Configure custom commission rates per vendor store.
                    </span>
                  </div>
                  <div style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      className="admin-filter-input"
                      style={{ width: '100%', paddingLeft: 34, paddingRight: vendorCommSearch ? 32 : 12, fontSize: 13, minWidth: 0 }}
                      placeholder="Search vendor by name, shop, or email..."
                      value={vendorCommSearch}
                      onChange={(e) => setVendorCommSearch(e.target.value)}
                    />
                    {vendorCommSearch && (
                      <button
                        type="button"
                        onClick={() => setVendorCommSearch('')}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 4 }}
                        title="Clear vendor search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="vendors-table-container">
                  <table className="vendors-table">
                    <thead>
                      <tr>
                        <th>Vendor / Shop</th>
                        <th>Status</th>
                        <th>Standard Rate</th>
                        <th>Current Custom Rate</th>
                        <th>Effective Commission</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const list = (state.vendors || []).filter((v) => {
                          const q = vendorCommSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            (v.businessName && v.businessName.toLowerCase().includes(q)) ||
                            (v.name && v.name.toLowerCase().includes(q)) ||
                            (v.email && v.email.toLowerCase().includes(q)) ||
                            (v.phone && v.phone.includes(q)) ||
                            (v.id && String(v.id).toLowerCase().includes(q))
                          );
                        });

                        if (list.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                                No vendors found matching "{vendorCommSearch}".
                              </td>
                            </tr>
                          );
                        }

                        return list.map((v) => {
                          const isEditing = editingVendorCommId === v.id;
                          const hasCustom = v.commissionRate != null || v.commission_rate != null;
                          const customVal = v.commissionRate ?? v.commission_rate;
                          const effectiveRate = hasCustom ? customVal : (state.commissionConfig?.defaultCommissionRate ?? 10);
                          return (
                            <tr key={v.id}>
                              <td>
                                <strong>{v.businessName || v.name}</strong>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{v.email}</div>
                              </td>
                              <td>
                                <span className={`status-badge status-${v.status || 'pending'}`}>
                                  {(v.status || 'pending').toUpperCase()}
                                </span>
                              </td>
                              <td style={{ color: '#64748b' }}>
                                {state.commissionConfig?.defaultCommissionRate ?? 10}%
                              </td>
                              <td>
                                {isEditing ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.5"
                                      className="admin-number-input"
                                      style={{ width: 75, minWidth: 0, padding: '5px 8px', fontSize: 13 }}
                                      placeholder="e.g. 8"
                                      value={vendorCommRateInput}
                                      onChange={(e) => setVendorCommRateInput(e.target.value)}
                                    />
                                    <span style={{ fontWeight: 600, color: '#64748b' }}>%</span>
                                  </div>
                                ) : (
                                  hasCustom ? (
                                    <strong style={{ color: '#0e5c4a' }}>{customVal}% (Custom)</strong>
                                  ) : (
                                    <span style={{ color: '#94a3b8' }}>Default</span>
                                  )
                                )}
                              </td>
                              <td>
                                <strong style={{ fontSize: 14 }}>{effectiveRate}%</strong>
                              </td>
                              <td>
                                {isEditing ? (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', alignItems: 'center' }}>
                                    <button
                                      type="button"
                                      className="approve-btn"
                                      style={{ fontSize: 12, padding: '5px 12px', whiteSpace: 'nowrap' }}
                                      disabled={savingVendorComm}
                                      onClick={() => handleSaveVendorCommission(v.id)}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-secondary-sm"
                                      style={{ fontSize: 12, padding: '5px 10px', whiteSpace: 'nowrap' }}
                                      onClick={() => { setEditingVendorCommId(null); setVendorCommRateInput(''); }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', alignItems: 'center' }}>
                                    <button
                                      type="button"
                                      className="btn-secondary-sm"
                                      style={{ fontSize: 12, padding: '5px 10px', whiteSpace: 'nowrap' }}
                                      onClick={() => {
                                        setEditingVendorCommId(v.id);
                                        setVendorCommRateInput(customVal != null ? String(customVal) : '');
                                      }}
                                    >
                                      Edit Rate
                                    </button>
                                    {hasCustom && (
                                      <button
                                        type="button"
                                        className="reject-btn"
                                        style={{ fontSize: 11, padding: '5px 8px', whiteSpace: 'nowrap' }}
                                        title="Reset to default rate"
                                        disabled={savingVendorComm}
                                        onClick={async () => {
                                          await api.updateVendorCommission(v.id, null);
                                          setAttempt((n) => n + 1);
                                        }}
                                      >
                                        Reset
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ---------------- 8. CUSTOMERS TAB ---------------- */}
            {activeTab === 'customers' && (
              <div className="admin-vendors-section">
                <div className="vendors-header" style={{ marginBottom: 16 }}>
                  <h2>Customer Audience & Inquiries</h2>
                  <p>Registered customer accounts, newsletter subscribers, and wholesale bulk order inquiries</p>
                </div>

                {/* Customer Sub-tab Switcher */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => setCustomerSubTab('registered')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: customerSubTab === 'registered' ? '#07502a' : '#cbd5e1',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: customerSubTab === 'registered' ? '#07502a' : '#ffffff',
                      color: customerSubTab === 'registered' ? '#ffffff' : '#334155',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <UsersIcon size={15} /> Registered Accounts ({state.users.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSubTab('subscribers');
                      if (newsletterSubscribers.length === 0) fetchSubscribers();
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: customerSubTab === 'subscribers' ? '#07502a' : '#cbd5e1',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: customerSubTab === 'subscribers' ? '#07502a' : '#ffffff',
                      color: customerSubTab === 'subscribers' ? '#ffffff' : '#334155',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Mail size={15} /> Newsletter Subscribers {newsletterSubscribers.length > 0 ? `(${newsletterSubscribers.length})` : ''}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSubTab('enquiries');
                      if (bulkEnquiries.length === 0) fetchEnquiries();
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: customerSubTab === 'enquiries' ? '#07502a' : '#cbd5e1',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: customerSubTab === 'enquiries' ? '#07502a' : '#ffffff',
                      color: customerSubTab === 'enquiries' ? '#ffffff' : '#334155',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <FileText size={15} /> Bulk Order Enquiries {bulkEnquiries.length > 0 ? `(${bulkEnquiries.length})` : ''}
                  </button>
                </div>

                {customerActionMsg.text && (
                  <div className={`admin-modal-alert ${customerActionMsg.type}`} style={{ marginBottom: 16 }}>
                    {customerActionMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{customerActionMsg.text}</span>
                  </div>
                )}

                {/* Subtab 1: Registered Accounts */}
                {customerSubTab === 'registered' && (
                  <>
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
                          <tr><th>Name</th><th>Email</th><th>Phone</th><th>Registered on</th><th>Status</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                          {paginatedUsers.map((c) => {
                            const isDeactivated = c.status === 'deactivated';
                            const isBlocked = c.status === 'blocked';
                            return (
                              <tr key={c.id}>
                                <td><strong>{c.name}</strong></td>
                                <td>{c.email}</td>
                                <td>{c.phone || '—'}</td>
                                <td style={{ fontSize: '13px', color: '#64748b' }}>
                                  {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                                </td>
                                <td>
                                  {isBlocked ? (
                                    <span className="status-badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 700 }}>
                                      BLOCKED
                                    </span>
                                  ) : isDeactivated ? (
                                    <span className="status-badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                                      DEACTIVATED
                                    </span>
                                  ) : (
                                    <span className="status-badge status-approved">
                                      ACTIVE
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    {isBlocked ? (
                                      <button
                                        type="button"
                                        className="btn-secondary-sm"
                                        style={{ fontSize: 12, padding: '4px 10px', background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0', fontWeight: 600 }}
                                        onClick={() => handleToggleCustomerStatus(c, 'active')}
                                        title="Unblock customer account"
                                      >
                                        Unblock
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn-secondary-sm"
                                        style={{ fontSize: 12, padding: '4px 8px', color: '#b91c1c', borderColor: '#fca5a5', background: '#fff' }}
                                        onClick={() => setCustomerToBlock(c)}
                                        title="Block customer account"
                                      >
                                        <ShieldAlert size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                                        Block
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="btn-secondary-sm"
                                      style={{ fontSize: 12, padding: '4px 8px' }}
                                      onClick={() => handleToggleCustomerStatus(c, isDeactivated ? 'active' : 'deactivated')}
                                      title={isDeactivated ? 'Reactivate customer account' : 'Deactivate customer account'}
                                    >
                                      {isDeactivated ? 'Reactivate' : 'Deactivate'}
                                    </button>
                                    <button
                                      type="button"
                                      className="reject-btn"
                                      style={{ padding: '4px 8px', fontSize: 12 }}
                                      onClick={() => setCustomerToDelete(c)}
                                      title="Delete or de-anonymize customer"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredUsers.length === 0 && (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '25px', color: '#64748b' }}>No customer accounts match your search.</td></tr>
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
                  </>
                )}

                {/* Subtab 2: Newsletter Subscribers */}
                {customerSubTab === 'subscribers' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                      <div className="admin-filter-bar" style={{ margin: 0, flex: '1 1 300px' }}>
                        <input
                          type="text"
                          className="admin-filter-input"
                          placeholder="Search subscribers by email address..."
                          value={subscriberSearch}
                          onChange={(e) => { setSubscriberSearch(e.target.value); setSubscriberPage(1); }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn-secondary-sm"
                          onClick={fetchSubscribers}
                          disabled={loadingSubscribers}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 13 }}
                          title="Refresh subscribers"
                        >
                          <RefreshCw size={14} className={loadingSubscribers ? 'animate-spin' : ''} />
                          Refresh
                        </button>
                        <button
                          type="button"
                          className="admin-add-product-main-btn"
                          onClick={exportSubscribersCSV}
                          disabled={!newsletterSubscribers.length}
                          style={{ margin: 0, padding: '7px 14px', fontSize: 13, gap: 6 }}
                          title="Export subscribers as CSV"
                        >
                          <Download size={14} />
                          Export CSV ({newsletterSubscribers.length})
                        </button>
                      </div>
                    </div>

                    <div className="vendors-table-container">
                      <table className="vendors-table">
                        <thead>
                          <tr>
                            <th>Subscriber Email</th>
                            <th>Status</th>
                            <th>Subscribed Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingSubscribers ? (
                            <tr>
                              <td colSpan="3" style={{ textAlign: 'center', padding: '35px', color: '#64748b' }}>
                                <Loader2 size={22} className="animate-spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
                                Loading newsletter subscribers from database...
                              </td>
                            </tr>
                          ) : paginatedSubscribers.map((s) => (
                            <tr key={s.id}>
                              <td>
                                <strong style={{ color: '#0f172a' }}>{s.email}</strong>
                              </td>
                              <td>
                                <span className="status-badge status-approved" style={{ fontSize: 11, padding: '3px 8px', fontWeight: 600 }}>
                                  {s.status ? s.status.toUpperCase() : 'SUBSCRIBED'}
                                </span>
                              </td>
                              <td style={{ fontSize: 13, color: '#64748b' }}>
                                {s.created_at ? new Date(s.created_at).toLocaleString() : '—'}
                              </td>
                            </tr>
                          ))}
                          {!loadingSubscribers && filteredSubscribers.length === 0 && (
                            <tr>
                              <td colSpan="3" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                No newsletter subscribers found {subscriberSearch ? 'matching your search' : 'yet'}.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <Pagination
                      currentPage={subscriberPage}
                      totalPages={Math.ceil(filteredSubscribers.length / subscriberPageSize) || 1}
                      onPageChange={setSubscriberPage}
                      totalItems={filteredSubscribers.length}
                      pageSize={subscriberPageSize}
                      onPageSizeChange={(sz) => { setSubscriberPageSize(sz); setSubscriberPage(1); }}
                      pageSizeOptions={[10, 25, 50]}
                    />
                  </>
                )}

                {/* Subtab 3: Bulk Order Enquiries */}
                {customerSubTab === 'enquiries' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                      <div className="admin-filter-bar" style={{ margin: 0, flex: '1 1 300px' }}>
                        <input
                          type="text"
                          className="admin-filter-input"
                          placeholder="Search enquiries by name, email, phone, product..."
                          value={enquirySearch}
                          onChange={(e) => { setEnquirySearch(e.target.value); setEnquiryPage(1); }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn-secondary-sm"
                          onClick={fetchEnquiries}
                          disabled={loadingEnquiries}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 13 }}
                          title="Refresh enquiries"
                        >
                          <RefreshCw size={14} className={loadingEnquiries ? 'animate-spin' : ''} />
                          Refresh
                        </button>
                        <button
                          type="button"
                          className="admin-add-product-main-btn"
                          onClick={exportEnquiriesCSV}
                          disabled={!bulkEnquiries.length}
                          style={{ margin: 0, padding: '7px 14px', fontSize: 13, gap: 6 }}
                          title="Export enquiries as CSV"
                        >
                          <Download size={14} />
                          Export CSV ({bulkEnquiries.length})
                        </button>
                      </div>
                    </div>

                    <div className="vendors-table-container">
                      <table className="vendors-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Contact Person</th>
                            <th>Product / Category</th>
                            <th>Qty</th>
                            <th>Status</th>
                            <th>Message & Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingEnquiries ? (
                            <tr>
                              <td colSpan="6" style={{ textAlign: 'center', padding: '35px', color: '#64748b' }}>
                                <Loader2 size={22} className="animate-spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
                                Loading bulk enquiries from database...
                              </td>
                            </tr>
                          ) : paginatedEnquiries.map((e) => (
                            <tr key={e.id}>
                              <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                                {e.created_at ? new Date(e.created_at).toLocaleDateString() : '—'}<br />
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                  {e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </td>
                              <td>
                                <strong style={{ color: '#0f172a' }}>{e.name}</strong>
                                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                                  <a href={`mailto:${e.email}`} style={{ color: '#0369a1', textDecoration: 'none' }}>{e.email}</a>
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>
                                  <a href={`tel:${e.phone}`} style={{ color: '#475569', textDecoration: 'none' }}>{e.phone}</a>
                                </div>
                              </td>
                              <td>
                                <strong style={{ color: '#07502a' }}>{e.product || 'General / Unspecified'}</strong>
                              </td>
                              <td>
                                <span style={{ display: 'inline-block', padding: '2px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, fontWeight: 700, fontSize: 13 }}>
                                  {e.quantity || 1} units
                                </span>
                              </td>
                              <td>
                                <span className={`status-badge ${e.status === 'completed' ? 'status-approved' : 'status-pending'}`} style={{ fontSize: 11, padding: '3px 8px', fontWeight: 600 }}>
                                  {(e.status || 'pending').toUpperCase()}
                                </span>
                              </td>
                              <td style={{ maxWidth: 280 }}>
                                <p style={{ margin: 0, fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                  {e.message}
                                </p>
                              </td>
                            </tr>
                          ))}
                          {!loadingEnquiries && filteredEnquiries.length === 0 && (
                            <tr>
                              <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                No bulk order enquiries found {enquirySearch ? 'matching your search' : 'yet'}.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <Pagination
                      currentPage={enquiryPage}
                      totalPages={Math.ceil(filteredEnquiries.length / enquiryPageSize) || 1}
                      onPageChange={setEnquiryPage}
                      totalItems={filteredEnquiries.length}
                      pageSize={enquiryPageSize}
                      onPageSizeChange={(sz) => { setEnquiryPageSize(sz); setEnquiryPage(1); }}
                      pageSizeOptions={[10, 25, 50]}
                    />
                  </>
                )}
              </div>
            )}

            {/* ---------------- 7b. SHIPPING & HANDLING CONFIGURATION ---------------- */}
            {activeTab === 'shipping' && (
              <div className="payment-audit-container">
                <div className="payment-card">
                  <div className="payment-card-header">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                        <h3 className="payment-card-title" style={{ margin: 0 }}>Delivery Methods & Charges (Platform / Admin-Owned Products)</h3>
                        <span className="status-badge status-pending" style={{ fontSize: 11, padding: '3px 10px', fontWeight: 600 }}>
                          Admin Products Only
                        </span>
                      </div>
                      <p className="payment-card-subtitle">
                        Configure delivery fees, free delivery order thresholds, and handling fees for Admin direct / platform products.
                        For vendor products, each vendor configures their own delivery charges independently in their Vendor Portal.
                      </p>
                    </div>
                  </div>

                  {shippingSaved && (
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '12px 18px', borderRadius: 8, margin: '16px 24px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle2 size={18} />
                      <strong style={{ fontSize: 14 }}>Delivery & handling charges updated successfully!</strong>
                    </div>
                  )}

                  <form onSubmit={handleSaveShippingConfig} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Standard Delivery Box */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, background: '#f8fafc' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 14 }}>
                        <input
                          type="checkbox"
                          checked={shippingConfig.standardDeliveryEnabled}
                          onChange={(e) => setShippingConfig({ ...shippingConfig, standardDeliveryEnabled: e.target.checked })}
                          style={{ width: 18, height: 18, accentColor: '#0e5c4a' }}
                        />
                        <span>Enable Standard Delivery (3–5 business days)</span>
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                        <div>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#475569', marginBottom: 6 }}>
                            Standard Delivery Charge (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            className="admin-filter-input"
                            style={{ width: '100%', background: '#fff' }}
                            value={shippingConfig.standardCharge}
                            onChange={(e) => setShippingConfig({ ...shippingConfig, standardCharge: Number(e.target.value) })}
                            disabled={!shippingConfig.standardDeliveryEnabled}
                            required
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#475569', marginBottom: 6 }}>
                            Free Shipping Threshold (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            className="admin-filter-input"
                            style={{ width: '100%', background: '#fff' }}
                            value={shippingConfig.standardFreeThreshold}
                            onChange={(e) => setShippingConfig({ ...shippingConfig, standardFreeThreshold: Number(e.target.value) })}
                            disabled={!shippingConfig.standardDeliveryEnabled}
                            placeholder="e.g. 499 (0 for always free)"
                          />
                          <small style={{ color: '#64748b', fontSize: 11, display: 'block', marginTop: 4 }}>
                            Orders at or above this cart value receive free standard delivery.
                          </small>
                        </div>
                      </div>
                    </div>

                    {/* Express Delivery Box */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, background: '#f8fafc' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 14 }}>
                        <input
                          type="checkbox"
                          checked={shippingConfig.expressDeliveryEnabled}
                          onChange={(e) => setShippingConfig({ ...shippingConfig, expressDeliveryEnabled: e.target.checked })}
                          style={{ width: 18, height: 18, accentColor: '#0e5c4a' }}
                        />
                        <span>Enable Express Delivery (1–2 business days)</span>
                      </label>
                      <div style={{ maxWidth: 320 }}>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#475569', marginBottom: 6 }}>
                          Express Delivery Charge (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          className="admin-filter-input"
                          style={{ width: '100%', background: '#fff' }}
                          value={shippingConfig.expressCharge}
                          onChange={(e) => setShippingConfig({ ...shippingConfig, expressCharge: Number(e.target.value) })}
                          disabled={!shippingConfig.expressDeliveryEnabled}
                          required
                        />
                      </div>
                    </div>

                    {/* Handling Fee Box */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, background: '#f8fafc' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 14 }}>
                        <input
                          type="checkbox"
                          checked={shippingConfig.handlingFeeEnabled}
                          onChange={(e) => setShippingConfig({ ...shippingConfig, handlingFeeEnabled: e.target.checked })}
                          style={{ width: 18, height: 18, accentColor: '#0e5c4a' }}
                        />
                        <span>Apply Handling & Packaging Fee</span>
                      </label>
                      <div style={{ maxWidth: 320 }}>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#475569', marginBottom: 6 }}>
                          Handling / Packaging Fee (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="admin-filter-input"
                          style={{ width: '100%', background: '#fff' }}
                          value={shippingConfig.handlingFee}
                          onChange={(e) => setShippingConfig({ ...shippingConfig, handlingFee: Number(e.target.value) })}
                          disabled={!shippingConfig.handlingFeeEnabled}
                          placeholder="e.g. 10"
                        />
                        <small style={{ color: '#64748b', fontSize: 11, display: 'block', marginTop: 4 }}>
                          Added as a dedicated line item in cart and checkout summary.
                        </small>
                      </div>
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="admin-sidebar-add-btn"
                        style={{ background: '#0e5c4a', color: '#fff', borderRadius: 8, padding: '12px 24px', fontWeight: 600, fontSize: 14 }}
                        disabled={shippingLoading}
                      >
                        {shippingLoading ? 'Saving Settings…' : 'Save Delivery & Handling Settings'}
                      </button>
                    </div>
                  </form>
                </div>
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

        {/* ---------------- EDIT PRODUCT MODAL DIALOG / DRAWER ---------------- */}
        {editingProductId && (
          <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-edit-prod-modal-title">
            <div className="admin-modal-backdrop" onClick={() => setEditingProductId(null)} />
            <div className="admin-modal-dialog">
              <div className="admin-modal-header">
                <div className="admin-modal-header-text">
                  <div className="admin-modal-badge">
                    <ShieldCheck size={14} /> Catalog Administration
                  </div>
                  <h2 id="admin-edit-prod-modal-title">Edit Product Details</h2>
                  <p>Update product title, description, category, pricing, stock, images and video. Changes are applied directly.</p>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  onClick={() => setEditingProductId(null)}
                  aria-label="Close dialog"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="admin-modal-body">
                <Suspense fallback={<FormSkeleton fields={5} />}>
                  <EditProduct
                    productId={editingProductId}
                    isAdmin={true}
                    mode="admin"
                    onBack={() => setEditingProductId(null)}
                    onSaved={(updated) => {
                      setEditingProductId(null);
                      setProductCreatedMsg({
                        title: updated?.title || 'Product',
                        status: updated?.status || 'approved'
                      });
                      setAttempt((c) => c + 1);
                    }}
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
                    <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                      <strong>Banner Dimension Guidelines:</strong><br />
                      • <strong>Desktop:</strong> 1920 × 600 px (16:5 ratio)<br />
                      • <strong>Tablet:</strong> 1200 × 500 px (12:5 ratio)<br />
                      • <strong>Mobile:</strong> 750 × 900 px (5:6 ratio)<br />
                      Images are fitted without distortion or cropping. Separate mobile creatives ensure clear product visibility on small screens.
                    </div>
                  </div>

                  {bannerAspectWarning && (
                    <div className="admin-modal-alert" style={{ background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                      {bannerAspectWarning}
                    </div>
                  )}

                  {/* Hidden single file input used for whichever target is active */}
                  <input
                    type="file"
                    ref={bannerFileInputRef}
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    style={{ display: 'none' }}
                    onChange={handleBannerImageUpload}
                    disabled={bannerUploadingImg}
                  />

                  {/* Desktop Banner Image Upload */}
                  <div className="cat-form-field" style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>
                        1. Desktop Banner Image * (1920 × 600 px, 16:5)
                      </label>
                      <button
                        type="button"
                        className="btn-secondary-sm"
                        disabled={bannerUploadingImg}
                        onClick={() => {
                          setBannerUploadTarget('desktop');
                          bannerFileInputRef.current?.click();
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 12 }}
                      >
                        {bannerUploadingImg && bannerUploadTarget === 'desktop' ? (
                          <><Loader2 size={13} className="spin" /> Uploading...</>
                        ) : (
                          <><UploadCloud size={13} /> Upload Desktop File</>
                        )}
                      </button>
                    </div>
                    <input
                      type="url"
                      className="admin-filter-input"
                      style={{ width: '100%', marginBottom: 8 }}
                      placeholder="Desktop image URL or Cloudinary CDN link"
                      value={bannerForm.imageUrl}
                      onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
                      required
                    />
                    {bannerForm.imageUrl && (
                      <div className="admin-banner-preview-box" style={{ maxHeight: 120 }}>
                        <img
                          src={bannerForm.imageUrl}
                          alt="Desktop Banner Preview"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Tablet Banner Image Upload */}
                  <div className="cat-form-field" style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>
                        2. Tablet Banner Image (Optional, 1200 × 500 px, 12:5)
                      </label>
                      <button
                        type="button"
                        className="btn-secondary-sm"
                        disabled={bannerUploadingImg}
                        onClick={() => {
                          setBannerUploadTarget('tablet');
                          bannerFileInputRef.current?.click();
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 12 }}
                      >
                        {bannerUploadingImg && bannerUploadTarget === 'tablet' ? (
                          <><Loader2 size={13} className="spin" /> Uploading...</>
                        ) : (
                          <><UploadCloud size={13} /> Upload Tablet File</>
                        )}
                      </button>
                    </div>
                    <input
                      type="url"
                      className="admin-filter-input"
                      style={{ width: '100%', marginBottom: 8 }}
                      placeholder="Tablet image URL (falls back to desktop if blank)"
                      value={bannerForm.tabletImageUrl}
                      onChange={(e) => setBannerForm({ ...bannerForm, tabletImageUrl: e.target.value })}
                    />
                    {bannerForm.tabletImageUrl && (
                      <div className="admin-banner-preview-box" style={{ maxHeight: 100 }}>
                        <img
                          src={bannerForm.tabletImageUrl}
                          alt="Tablet Banner Preview"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Mobile Banner Image Upload */}
                  <div className="cat-form-field" style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>
                        3. Mobile Banner Image (Recommended, 750 × 900 px, 5:6)
                      </label>
                      <button
                        type="button"
                        className="btn-secondary-sm"
                        disabled={bannerUploadingImg}
                        onClick={() => {
                          setBannerUploadTarget('mobile');
                          bannerFileInputRef.current?.click();
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 12 }}
                      >
                        {bannerUploadingImg && bannerUploadTarget === 'mobile' ? (
                          <><Loader2 size={13} className="spin" /> Uploading...</>
                        ) : (
                          <><UploadCloud size={13} /> Upload Mobile File</>
                        )}
                      </button>
                    </div>
                    <input
                      type="url"
                      className="admin-filter-input"
                      style={{ width: '100%', marginBottom: 8 }}
                      placeholder="Mobile portrait image URL"
                      value={bannerForm.mobileImageUrl}
                      onChange={(e) => setBannerForm({ ...bannerForm, mobileImageUrl: e.target.value })}
                    />
                    {bannerForm.mobileImageUrl && (
                      <div className="admin-banner-preview-box" style={{ maxHeight: 150, maxWidth: 200, margin: '0 auto' }}>
                        <img
                          src={bannerForm.mobileImageUrl}
                          alt="Mobile Banner Preview"
                          style={{ objectFit: 'contain' }}
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

        {/* ---------------- VENDOR APPLICATION REVIEW MODAL ---------------- */}
        {reviewingVendor && (
          <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="vendor-review-title">
            <div className="admin-modal-backdrop" onClick={() => !submittingVendorReview && setReviewingVendor(null)} />
            <div className="admin-modal-dialog" style={{ maxWidth: 840 }}>
              <div className="admin-modal-header">
                <div className="admin-modal-header-text">
                  <div className="admin-modal-badge">
                    <Store size={14} /> Vendor Application & Verification Audit
                  </div>
                  <h2 id="vendor-review-title">
                    {reviewingVendor.businessName || reviewingVendor.name}
                  </h2>
                  <p>Comprehensive regulatory compliance, identity, tax documents, and payout settlement audit</p>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  disabled={submittingVendorReview}
                  onClick={() => setReviewingVendor(null)}
                  aria-label="Close dialog"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="admin-modal-body" style={{ padding: '20px 24px', maxHeight: '82vh', overflowY: 'auto' }}>
                {vendorReviewMsg.text && (
                  <div className={`admin-modal-alert ${vendorReviewMsg.type}`} style={{ marginBottom: 16 }}>
                    {vendorReviewMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{vendorReviewMsg.text}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, marginBottom: 20 }}>
                  {/* Business & Owner Info */}
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#0e5c4a', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Store size={16} /> Business & Contact Profile
                    </h4>
                    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div><strong style={{ color: '#475569' }}>Business / Shop Name:</strong> {reviewingVendor.businessName || reviewingVendor.name}</div>
                      {reviewingVendor.registeredName && (
                        <div><strong style={{ color: '#475569' }}>Registered Legal Name:</strong> {reviewingVendor.registeredName}</div>
                      )}
                      <div><strong style={{ color: '#475569' }}>Business Type:</strong> {reviewingVendor.businessType || 'Retailer / Merchant'}</div>
                      <div><strong style={{ color: '#475569' }}>Owner Full Name:</strong> {reviewingVendor.ownerName || reviewingVendor.name}</div>
                      <div><strong style={{ color: '#475569' }}>Email Address:</strong> <a href={`mailto:${reviewingVendor.email}`}>{reviewingVendor.email}</a></div>
                      <div><strong style={{ color: '#475569' }}>Contact Phone:</strong> {reviewingVendor.phone || '—'}</div>
                    </div>
                  </div>

                  {/* Business Address */}
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#0e5c4a', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Globe size={16} /> Business Address & Location
                    </h4>
                    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div><strong style={{ color: '#475569' }}>Street Address:</strong> {reviewingVendor.businessAddress || reviewingVendor.address || '—'}</div>
                      <div><strong style={{ color: '#475569' }}>City:</strong> {reviewingVendor.city || '—'}</div>
                      <div><strong style={{ color: '#475569' }}>District:</strong> {reviewingVendor.district || '—'}</div>
                      <div><strong style={{ color: '#475569' }}>State:</strong> {reviewingVendor.state || '—'}</div>
                      <div><strong style={{ color: '#475569' }}>PIN Code:</strong> {reviewingVendor.pincode || reviewingVendor.pin_code || '—'}</div>
                      <div><strong style={{ color: '#475569' }}>Country:</strong> {reviewingVendor.country || 'India'}</div>
                    </div>
                  </div>

                  {/* Tax & Regulatory Compliance */}
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#0e5c4a', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ShieldCheck size={16} /> Tax & Regulatory Documents
                    </h4>
                    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <strong style={{ color: '#475569' }}>GST Registration:</strong>{' '}
                        <span className={`status-badge ${reviewingVendor.gstStatus === 'Registered' ? 'status-approved' : 'status-pending'}`}>
                          {reviewingVendor.gstStatus || 'Not Registered'}
                        </span>
                        {reviewingVendor.gstin && (
                          <div style={{ marginTop: 4, fontFamily: 'monospace', fontWeight: 600 }}>GSTIN: {reviewingVendor.gstin}</div>
                        )}
                        {reviewingVendor.gstCertificateUrl ? (
                          <div style={{ marginTop: 6 }}>
                            <a
                              href={reviewingVendor.gstCertificateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px' }}
                            >
                              <ExternalLink size={13} /> View GST Certificate (A4)
                            </a>
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>No GST document attached</div>
                        )}
                      </div>

                      <hr style={{ border: 'none', borderTop: '1px dashed #e2e8f0', margin: '4px 0' }} />

                      <div>
                        <strong style={{ color: '#475569' }}>FSSAI Food License:</strong>{' '}
                        <span className={`status-badge ${reviewingVendor.fssaiStatus === 'Applicable' ? 'status-approved' : 'status-pending'}`}>
                          {reviewingVendor.fssaiStatus || 'Not Applicable'}
                        </span>
                        {reviewingVendor.fssaiNumber && (
                          <div style={{ marginTop: 4, fontFamily: 'monospace', fontWeight: 600 }}>FSSAI No: {reviewingVendor.fssaiNumber}</div>
                        )}
                        {reviewingVendor.fssaiCertificateUrl ? (
                          <div style={{ marginTop: 6 }}>
                            <a
                              href={reviewingVendor.fssaiCertificateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px' }}
                            >
                              <ExternalLink size={13} /> View FSSAI License (A4)
                            </a>
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>No FSSAI document attached</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bank & Settlement Details */}
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0e5c4a', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CreditCard size={16} /> Settlement Bank Account
                      </h4>
                      <button
                        type="button"
                        className="btn-secondary-sm"
                        style={{ padding: '3px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setShowBankAccount(!showBankAccount)}
                      >
                        {showBankAccount ? <EyeOff size={12} /> : <Eye size={12} />}
                        {showBankAccount ? 'Mask Number' : 'Reveal Number'}
                      </button>
                    </div>
                    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div><strong style={{ color: '#475569' }}>Account Holder:</strong> {reviewingVendor.bankAccountName || '—'}</div>
                      <div><strong style={{ color: '#475569' }}>Bank Name:</strong> {reviewingVendor.bankName || '—'}</div>
                      <div><strong style={{ color: '#475569' }}>IFSC Code:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{reviewingVendor.bankIfsc || '—'}</span></div>
                      <div>
                        <strong style={{ color: '#475569' }}>Account Number:</strong>{' '}
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {showBankAccount
                            ? reviewingVendor.bankAccountNumber || '—'
                            : (reviewingVendor.bankAccountNumber ? `•••• •••• ${reviewingVendor.bankAccountNumber.slice(-4)}` : '—')}
                        </span>
                      </div>
                      {reviewingVendor.bankDocumentUrl && (
                        <div style={{ marginTop: 4 }}>
                          <a
                            href={reviewingVendor.bankDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px' }}
                          >
                            <ExternalLink size={13} /> View Supporting Bank Document
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Audit Trail & Commission Settings */}
                <div style={{ background: '#f1f5f9', padding: 16, borderRadius: 10, border: '1px solid #cbd5e1', marginBottom: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Custom Vendor Commission Rate (%)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          className="admin-number-input"
                          style={{ width: 120, minWidth: 0, fontWeight: 700 }}
                          placeholder={`Default (${state.commissionConfig?.defaultCommissionRate ?? 10}%)`}
                          value={vendorCustomCommission}
                          onChange={(e) => setVendorCustomCommission(e.target.value)}
                        />
                        <span style={{ fontSize: 13, color: '#64748b' }}>Leave blank to inherit global default ({state.commissionConfig?.defaultCommissionRate ?? 10}%)</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        <div><strong>Current Status:</strong> <span className={`status-badge status-${reviewingVendor.status}`}>{String(reviewingVendor.status).toUpperCase()}</span></div>
                        <div style={{ marginTop: 4 }}><strong>Application Date:</strong> {reviewingVendor.createdAt ? new Date(reviewingVendor.createdAt).toLocaleString() : '—'}</div>
                        {reviewingVendor.reviewedBy && (
                          <div style={{ marginTop: 4 }}><strong>Last Reviewed By:</strong> {reviewingVendor.reviewedBy} on {new Date(reviewingVendor.reviewedAt || reviewingVendor.approvedAt).toLocaleDateString()}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                      Internal Verification Notes & Remarks
                    </label>
                    <textarea
                      className="admin-filter-input"
                      rows={2}
                      style={{ width: '100%', resize: 'vertical' }}
                      placeholder="e.g. Verified GSTIN on government portal. FSSAI food handler certificate valid. Approved standard 10% commission."
                      value={vendorReviewNotes}
                      onChange={(e) => setVendorReviewNotes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Verification Decision Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                  <button
                    type="button"
                    className="admin-modal-btn cancel"
                    disabled={submittingVendorReview}
                    onClick={() => setReviewingVendor(null)}
                  >
                    Close
                  </button>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="reject-btn"
                      style={{ padding: '8px 14px', fontSize: 13 }}
                      disabled={submittingVendorReview}
                      onClick={() => handleVendorReviewAction('rejected')}
                    >
                      <XCircle size={15} /> Reject Application
                    </button>

                    <button
                      type="button"
                      className="btn-secondary-sm"
                      style={{ background: '#fef3c7', color: '#b45309', borderColor: '#fde68a', padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      disabled={submittingVendorReview}
                      onClick={() => handleVendorReviewAction('corrections_requested')}
                    >
                      <AlertCircle size={15} /> Request Corrections
                    </button>

                    {reviewingVendor.status === 'approved' ? (
                      <button
                        type="button"
                        className="btn-secondary-sm"
                        style={{ padding: '8px 14px', fontSize: 13, color: '#dc2626' }}
                        disabled={submittingVendorReview}
                        onClick={() => handleVendorReviewAction('deactivated')}
                      >
                        Deactivate Vendor
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="approve-btn"
                      style={{ padding: '8px 18px', fontSize: 13 }}
                      disabled={submittingVendorReview}
                      onClick={() => handleVendorReviewAction('approved')}
                    >
                      {submittingVendorReview ? (
                        <><Loader2 size={15} className="spin" /> Updating...</>
                      ) : (
                        <><CheckCircle size={15} /> Approve & Activate Vendor</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- CUSTOMER DELETE / DEACTIVATE MODAL ---------------- */}
        {customerToDelete && (
          <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-customer-title">
            <div className="admin-modal-backdrop" onClick={() => !customerDeleteLoading && setCustomerToDelete(null)} />
            <div className="admin-modal-dialog" style={{ maxWidth: 520 }}>
              <div className="admin-modal-header">
                <div className="admin-modal-header-text">
                  <div className="admin-modal-badge" style={{ color: '#dc2626' }}>
                    <AlertTriangle size={14} /> Customer Account Management
                  </div>
                  <h2 id="delete-customer-title" style={{ color: '#991b1b' }}>
                    Process Customer Account Deletion
                  </h2>
                  <p>Account: {customerToDelete.name} ({customerToDelete.email})</p>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  disabled={customerDeleteLoading}
                  onClick={() => setCustomerToDelete(null)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="admin-modal-body" style={{ padding: '20px 24px' }}>
                <div className="admin-danger-notice">
                  <h4>Relational Integrity & Financial Compliance:</h4>
                  <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: 13, lineHeight: 1.5 }}>
                    <li>If this customer has past order records, their login credentials and contact details will be <strong>soft-deactivated and anonymized</strong> to preserve order invoices, tax audits, and vendor payouts.</li>
                    <li>If the customer has 0 orders, their account row will be cleanly and permanently purged.</li>
                  </ul>
                </div>

                <div className="admin-modal-footer-actions" style={{ marginTop: 20 }}>
                  <button
                    type="button"
                    className="admin-modal-btn cancel"
                    disabled={customerDeleteLoading}
                    onClick={() => setCustomerToDelete(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="admin-modal-btn danger"
                    disabled={customerDeleteLoading}
                    onClick={handleConfirmDeleteCustomer}
                  >
                    {customerDeleteLoading ? <Loader2 size={15} className="spin" /> : 'Confirm Deletion / Deactivation'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- CUSTOMER BLOCK / UNBLOCK MODAL ---------------- */}
        {customerToBlock && (
          <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="block-customer-title">
            <div className="admin-modal-backdrop" onClick={() => !customerBlockLoading && setCustomerToBlock(null)} />
            <div className="admin-modal-dialog" style={{ maxWidth: 500 }}>
              <div className="admin-modal-header">
                <div className="admin-modal-header-text">
                  <div className="admin-modal-badge" style={{ color: '#dc2626' }}>
                    <ShieldAlert size={14} /> Customer Account Security
                  </div>
                  <h2 id="block-customer-title" style={{ color: customerToBlock.status === 'blocked' ? '#065f46' : '#991b1b' }}>
                    {customerToBlock.status === 'blocked' ? 'Unblock Customer Account' : 'Block Customer Account'}
                  </h2>
                  <p>Customer: <strong>{customerToBlock.name}</strong> ({customerToBlock.email})</p>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  disabled={customerBlockLoading}
                  onClick={() => setCustomerToBlock(null)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="admin-modal-body" style={{ padding: '20px 24px', fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
                {customerToBlock.status === 'blocked' ? (
                  <p>
                    Reactivating this customer account will restore their ability to log in, view order history, and place new orders on the storefront.
                  </p>
                ) : (
                  <div>
                    <p style={{ marginBottom: 12, fontWeight: 500 }}>
                      Are you sure you want to <strong>block</strong> this customer account?
                    </p>
                    <ul style={{ paddingLeft: 20, color: '#64748b', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6, margin: 0 }}>
                      <li>The customer is immediately prevented from logging into the platform.</li>
                      <li>They cannot checkout or place any new orders.</li>
                      <li>Past orders and invoice records remain securely preserved for audit and GST accounting.</li>
                      <li>You can unblock this account at any time from this dashboard.</li>
                    </ul>
                  </div>
                )}

                <div className="admin-modal-footer-actions" style={{ marginTop: 22 }}>
                  <button
                    type="button"
                    className="admin-modal-btn cancel"
                    disabled={customerBlockLoading}
                    onClick={() => setCustomerToBlock(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`admin-modal-btn ${customerToBlock.status === 'blocked' ? 'primary' : 'danger'}`}
                    disabled={customerBlockLoading}
                    onClick={handleConfirmBlockCustomer}
                  >
                    {customerBlockLoading ? <Loader2 size={15} className="spin" /> : (customerToBlock.status === 'blocked' ? 'Confirm Unblock' : 'Confirm Block')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- ADD / EDIT COUPON MODAL ---------------- */}
        {couponModalOpen && (
          <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="coupon-modal-title">
            <div className="admin-modal-backdrop" onClick={() => !couponSaving && setCouponModalOpen(false)} />
            <div className="admin-modal-dialog" style={{ maxWidth: 580 }}>
              <div className="admin-modal-header">
                <div className="admin-modal-header-text">
                  <div className="admin-modal-badge">
                    <Tag size={14} /> Promotional Discount Engine
                  </div>
                  <h2 id="coupon-modal-title">
                    {editingCouponCode ? `Edit Coupon: ${editingCouponCode}` : 'Create New Promotional Coupon'}
                  </h2>
                  <p>Configure discount type, minimum cart values, usage caps, and validity windows</p>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  disabled={couponSaving}
                  onClick={() => setCouponModalOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="admin-modal-body" style={{ padding: '20px 24px' }}>
                {couponFormMsg.text && (
                  <div className={`admin-modal-alert ${couponFormMsg.type}`} style={{ marginBottom: 16 }}>
                    {couponFormMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{couponFormMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handleSaveCoupon} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Coupon Code *
                      </label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}
                        placeholder="e.g. HARVEST20"
                        value={couponForm.code}
                        disabled={Boolean(editingCouponCode)}
                        onChange={(e) => updateCouponForm({ code: e.target.value.toUpperCase() })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Discount Type *
                      </label>
                      <select
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        value={couponForm.discountType}
                        onChange={(e) => updateCouponForm({ discountType: e.target.value })}
                      >
                        <option value="percent">Percentage Discount (%)</option>
                        <option value="flat">Flat Cash Discount (₹)</option>
                        <option value="shipping">Free Shipping</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                      Description / Terms
                    </label>
                    <input
                      type="text"
                      className="admin-filter-input"
                      style={{ width: '100%' }}
                      placeholder="e.g. 20% off all organic vegetables on orders over ₹499"
                      value={couponForm.description}
                      onChange={(e) => updateCouponForm({ description: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Discount Value *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        value={couponForm.discountValue}
                        onChange={(e) => updateCouponForm({ discountValue: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Min Order (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        value={couponForm.minOrderAmount}
                        onChange={(e) => updateCouponForm({ minOrderAmount: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Max Cap (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        placeholder="Optional"
                        value={couponForm.maxDiscountAmount}
                        onChange={(e) => setCouponForm({ ...couponForm, maxDiscountAmount: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Usage Limit
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        placeholder="Unlimited"
                        value={couponForm.usageLimit}
                        onChange={(e) => setCouponForm({ ...couponForm, usageLimit: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Per-Customer Cap
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        value={couponForm.perCustomerLimit}
                        onChange={(e) => setCouponForm({ ...couponForm, perCustomerLimit: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Start Date
                      </label>
                      <input
                        type="date"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        value={couponForm.startDate}
                        onChange={(e) => setCouponForm({ ...couponForm, startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        End Date
                      </label>
                      <input
                        type="date"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        value={couponForm.endDate}
                        onChange={(e) => setCouponForm({ ...couponForm, endDate: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Applicable Products Selection */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#334155', marginBottom: 8 }}>
                      Applicable Products Scope
                    </label>
                    <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                        <input
                          type="radio"
                          name="couponApplicableTo"
                          value="all"
                          checked={couponForm.applicableTo === 'all'}
                          onChange={() => setCouponForm({ ...couponForm, applicableTo: 'all' })}
                        />
                        <span>All Products (Storewide)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                        <input
                          type="radio"
                          name="couponApplicableTo"
                          value="selected"
                          checked={couponForm.applicableTo === 'selected'}
                          onChange={() => setCouponForm({ ...couponForm, applicableTo: 'selected' })}
                        />
                        <span>Specific Products ({couponForm.selectedProducts?.length || 0} selected)</span>
                      </label>
                    </div>

                    {couponForm.applicableTo === 'selected' && (() => {
                      const allProducts = state.products || [];
                      const searchLower = couponProductSearch.trim().toLowerCase();
                      const filtered = searchLower
                        ? allProducts.filter((p) =>
                            (p.title || p.name || '').toLowerCase().includes(searchLower) ||
                            (p.category || p.categorySlug || '').toLowerCase().includes(searchLower) ||
                            String(p.id || '').toLowerCase().includes(searchLower)
                          )
                        : allProducts;
                      const selectedCount = (couponForm.selectedProducts || []).length;

                      return (
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                            <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
                              Assign Products ({selectedCount} assigned):
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                style={{ fontSize: 11, background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: '#0e5c4a', fontWeight: 600 }}
                                onClick={() => {
                                  const filteredIds = filtered.map((p) => p.id);
                                  const combined = Array.from(new Set([...(couponForm.selectedProducts || []), ...filteredIds]));
                                  setCouponForm({ ...couponForm, selectedProducts: combined });
                                }}
                              >
                                Select All Filtered
                              </button>
                              <button
                                type="button"
                                style={{ fontSize: 11, background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: '#64748b' }}
                                onClick={() => {
                                  const filteredIds = new Set(filtered.map((p) => p.id));
                                  const remaining = (couponForm.selectedProducts || []).filter((id) => !filteredIds.has(id));
                                  setCouponForm({ ...couponForm, selectedProducts: remaining });
                                }}
                              >
                                Clear Filtered
                              </button>
                            </div>
                          </div>

                          {/* Instant Product Search Bar */}
                          <div style={{ position: 'relative', marginBottom: 8 }}>
                            <input
                              type="text"
                              placeholder="Search products by title, category, or ID..."
                              value={couponProductSearch}
                              onChange={(e) => setCouponProductSearch(e.target.value)}
                              style={{ width: '100%', padding: '7px 28px 7px 10px', fontSize: 12, border: '1.5px solid #cbd5e1', borderRadius: 6, outline: 'none' }}
                            />
                            {couponProductSearch && (
                              <button
                                type="button"
                                onClick={() => setCouponProductSearch('')}
                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14 }}
                              >
                                ×
                              </button>
                            )}
                          </div>

                          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: 8 }}>
                            {filtered.length === 0 ? (
                              <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', margin: '14px 0' }}>
                                No products match “{couponProductSearch}”
                              </p>
                            ) : (
                              filtered.map((p) => {
                                const isChecked = (couponForm.selectedProducts || []).includes(p.id);
                                return (
                                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', padding: '5px 8px', borderRadius: 4, background: isChecked ? '#f0fdf4' : 'transparent', border: isChecked ? '1px solid #bbf7d0' : '1px solid transparent' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const next = e.target.checked
                                          ? [...(couponForm.selectedProducts || []), p.id]
                                          : (couponForm.selectedProducts || []).filter((id) => id !== p.id);
                                        setCouponForm({ ...couponForm, selectedProducts: next });
                                      }}
                                    />
                                    <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? '#166534' : '#1e293b' }}>
                                      {p.title || p.name}
                                    </span>
                                    {p.category && (
                                      <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', padding: '1px 6px', borderRadius: 10 }}>
                                        {p.category}
                                      </span>
                                    )}
                                    <span style={{ color: '#0e5c4a', fontWeight: 600, marginLeft: 'auto' }}>₹{p.price}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ paddingTop: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                      <input
                        type="checkbox"
                        checked={couponForm.isActive}
                        onChange={(e) => setCouponForm({ ...couponForm, isActive: e.target.checked })}
                        style={{ width: 18, height: 18, accentColor: '#0e5c4a' }}
                      />
                      <span>Coupon Active & Usable at Storefront Checkout</span>
                    </label>
                  </div>

                  <div className="admin-modal-footer-actions" style={{ marginTop: 16 }}>
                    <button
                      type="button"
                      className="admin-modal-btn cancel"
                      disabled={couponSaving}
                      onClick={() => setCouponModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="admin-modal-btn danger"
                      style={{ background: '#0e5c4a' }}
                      disabled={couponSaving}
                    >
                      {couponSaving ? <Loader2 size={15} className="spin" /> : 'Save Coupon'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- DELETE COUPON MODAL ---------------- */}
        {couponToDelete && (
          <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="del-coupon-title">
            <div className="admin-modal-backdrop" onClick={() => !couponDeleteLoading && setCouponToDelete(null)} />
            <div className="admin-modal-dialog" style={{ maxWidth: 480 }}>
              <div className="admin-modal-header">
                <div className="admin-modal-header-text">
                  <h2 id="del-coupon-title" style={{ color: '#991b1b' }}>Delete Coupon</h2>
                  <p>Are you sure you want to delete coupon &quot;{couponToDelete.code}&quot;?</p>
                </div>
                <button type="button" className="admin-modal-close-btn" disabled={couponDeleteLoading} onClick={() => setCouponToDelete(null)}>
                  <X size={20} />
                </button>
              </div>
              <div className="admin-modal-body" style={{ padding: '20px 24px' }}>
                <p style={{ margin: 0, fontSize: 13.5, color: '#64748b' }}>
                  Customers will immediately no longer be able to apply this coupon code at checkout.
                </p>
                <div className="admin-modal-footer-actions" style={{ marginTop: 20 }}>
                  <button type="button" className="admin-modal-btn cancel" disabled={couponDeleteLoading} onClick={() => setCouponToDelete(null)}>Cancel</button>
                  <button type="button" className="admin-modal-btn danger" disabled={couponDeleteLoading} onClick={handleConfirmDeleteCoupon}>
                    {couponDeleteLoading ? <Loader2 size={15} className="spin" /> : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- ADD / EDIT DEAL MODAL ---------------- */}
        {dealModalOpen && (
          <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="deal-modal-title">
            <div className="admin-modal-backdrop" onClick={() => !dealSaving && setDealModalOpen(false)} />
            <div className="admin-modal-dialog" style={{ maxWidth: 580 }}>
              <div className="admin-modal-header">
                <div className="admin-modal-header-text">
                  <div className="admin-modal-badge">
                    <Flame size={14} /> Flash Deals & Timed Promotions
                  </div>
                  <h2 id="deal-modal-title">
                    {editingDealId ? 'Edit Deal of the Day' : 'Configure New Deal of the Day'}
                  </h2>
                  <p>Set discounted prices, stock limits, and countdown expiration timers</p>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  disabled={dealSaving}
                  onClick={() => setDealModalOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="admin-modal-body" style={{ padding: '20px 24px' }}>
                {dealFormMsg.text && (
                  <div className={`admin-modal-alert ${dealFormMsg.type}`} style={{ marginBottom: 16 }}>
                    {dealFormMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{dealFormMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handleSaveDeal} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                      Select Catalog Product *
                    </label>
                    <select
                      className="admin-filter-input"
                      style={{ width: '100%' }}
                      value={dealForm.productId}
                      onChange={(e) => setDealForm({ ...dealForm, productId: e.target.value })}
                      required
                    >
                      <option value="">-- Choose a Product --</option>
                      {(state.products || []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title || p.name} — Regular: ₹{p.price} (Stock: {p.stock ?? '—'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Deal Price (₹) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="admin-filter-input"
                        style={{ width: '100%', fontWeight: 700 }}
                        placeholder="e.g. 199"
                        value={dealForm.dealPrice}
                        onChange={(e) => setDealForm({ ...dealForm, dealPrice: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Deal Stock Limit
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. 50 (optional cap)"
                        value={dealForm.stockLimit}
                        onChange={(e) => setDealForm({ ...dealForm, stockLimit: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Deal Start Time
                      </label>
                      <input
                        type="datetime-local"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        value={dealForm.startTime}
                        onChange={(e) => setDealForm({ ...dealForm, startTime: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Deal End Time
                      </label>
                      <input
                        type="datetime-local"
                        className="admin-filter-input"
                        style={{ width: '100%' }}
                        value={dealForm.endTime}
                        onChange={(e) => setDealForm({ ...dealForm, endTime: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                      Status
                    </label>
                    <select
                      className="admin-filter-input"
                      style={{ width: '100%' }}
                      value={dealForm.status}
                      onChange={(e) => setDealForm({ ...dealForm, status: e.target.value })}
                    >
                      <option value="active">Active Now</option>
                      <option value="scheduled">Scheduled for Future</option>
                      <option value="ended">Ended / Expired</option>
                    </select>
                  </div>

                  <div className="admin-modal-footer-actions" style={{ marginTop: 16 }}>
                    <button
                      type="button"
                      className="admin-modal-btn cancel"
                      disabled={dealSaving}
                      onClick={() => setDealModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="admin-modal-btn danger"
                      style={{ background: '#0e5c4a' }}
                      disabled={dealSaving}
                    >
                      {dealSaving ? <Loader2 size={15} className="spin" /> : 'Save Deal'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- DELETE DEAL MODAL ---------------- */}
        {dealToDelete && (
          <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="del-deal-title">
            <div className="admin-modal-backdrop" onClick={() => !dealDeleteLoading && setDealToDelete(null)} />
            <div className="admin-modal-dialog" style={{ maxWidth: 480 }}>
              <div className="admin-modal-header">
                <div className="admin-modal-header-text">
                  <h2 id="del-deal-title" style={{ color: '#991b1b' }}>Delete Deal</h2>
                  <p>Are you sure you want to delete this promotion?</p>
                </div>
                <button type="button" className="admin-modal-close-btn" disabled={dealDeleteLoading} onClick={() => setDealToDelete(null)}>
                  <X size={20} />
                </button>
              </div>
              <div className="admin-modal-body" style={{ padding: '20px 24px' }}>
                <p style={{ margin: 0, fontSize: 13.5, color: '#64748b' }}>
                  The product will immediately revert back to its standard retail price on the storefront.
                </p>
                <div className="admin-modal-footer-actions" style={{ marginTop: 20 }}>
                  <button type="button" className="admin-modal-btn cancel" disabled={dealDeleteLoading} onClick={() => setDealToDelete(null)}>Cancel</button>
                  <button type="button" className="admin-modal-btn danger" disabled={dealDeleteLoading} onClick={handleConfirmDeleteDeal}>
                    {dealDeleteLoading ? <Loader2 size={15} className="spin" /> : 'Confirm Delete'}
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
