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
  XCircle,
  Menu,
  X,
  Tag,
  Plus,
  Building2,
  FileText,
  UploadCloud,
  FileCheck2,
  Loader2,
  MapPin,
  ShieldCheck,
  User,
  Truck,
  Lock,
  Shield,
  Edit2,
  Percent
} from 'lucide-react';
import brandLogoWithBg from '../../assets/logo/logo.png';
import Pagination from '../../components/ui/Pagination';
import { DashboardSkeleton, FormSkeleton, TableSkeleton } from '../../components/ui/States';
import api, { authSessions } from '../../utils/api';

const CategoryManager = React.lazy(() => import('./CategoryManager'));
const AddProduct = React.lazy(() => import('./AddProduct'));
const AllProducts = React.lazy(() => import('./AllProducts'));
const EditProduct = React.lazy(() => import('./EditProduct'));

const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];
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
    if (path.includes('/vendor/coupons')) return 'coupons';
    if (path.includes('/vendor/delivery')) return 'delivery';
    if (path.includes('/vendor/profile')) return 'profile';
    if (path.includes('/vendor/settings')) return 'settings';
    return 'dashboard';
  };

  const activeTab = getTabFromPath();

  const handleNavigate = (tabKey) => {
    setSidebarOpen(false);
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
      case 'coupons':
        navigate('/vendor/coupons');
        break;
      case 'delivery':
        navigate('/vendor/delivery');
        break;
      case 'profile':
        navigate('/vendor/profile');
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Pagination states
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(10);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPageSize, setReviewPageSize] = useState(10);

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

  // Settings / Profile Form State
  const [profileData, setProfileData] = useState({
    businessName: vendor?.businessName || vendor?.business_name || vendor?.name || '',
    ownerName: vendor?.ownerName || vendor?.owner_name || vendor?.name || '',
    email: vendor?.email || '',
    phone: vendor?.phone || '',
    address: vendor?.address || '',
    city: vendor?.city || '',
    district: vendor?.district || '',
    state: vendor?.state || 'Tamil Nadu',
    pincode: vendor?.pincode || '',
    bio: vendor?.bio || '',
    gstStatus: vendor?.gstStatus || vendor?.gst_status || 'Not Registered',
    gstin: vendor?.gstin || '',
    gstCertificateUrl: vendor?.gstCertificateUrl || vendor?.gst_certificate_url || '',
    fssaiStatus: vendor?.fssaiStatus || vendor?.fssai_status || 'Not Applicable',
    fssaiNumber: vendor?.fssaiNumber || vendor?.fssai_number || '',
    fssaiCertificateUrl: vendor?.fssaiCertificateUrl || vendor?.fssai_certificate_url || '',
    bankAccountHolder: vendor?.bankAccountHolder || vendor?.bank_account_holder || '',
    bankName: vendor?.bankName || vendor?.bank_name || '',
    bankAccountNumber: vendor?.bankAccountNumber || vendor?.bank_account_number || '',
    bankIfsc: vendor?.bankIfsc || vendor?.bank_ifsc || '',
    bankDocumentUrl: vendor?.bankDocumentUrl || vendor?.bank_document_url || '',
    shippingEnabled: vendor?.shippingEnabled !== false && vendor?.shipping_enabled !== 0,
    shippingCharge: vendor?.shippingCharge != null ? vendor.shippingCharge : (vendor?.shipping_charge != null ? vendor.shipping_charge : '50'),
    shippingFreeThreshold: vendor?.shippingFreeThreshold != null ? vendor.shippingFreeThreshold : (vendor?.shipping_free_threshold != null ? vendor.shipping_free_threshold : '499'),
    shippingEstimatedDays: vendor?.shippingEstimatedDays || vendor?.shipping_estimated_days || '3–5 business days'
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(null); // 'gst' | 'fssai' | 'bank'
  const gstInputRef = React.useRef(null);
  const fssaiInputRef = React.useRef(null);
  const bankInputRef = React.useRef(null);

  // Vendor Coupons State
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponSearch, setCouponSearch] = useState('');
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [couponProductSearch, setCouponProductSearch] = useState('');
  const [couponSaving, setCouponSaving] = useState(false);
  const [couponFormMsg, setCouponFormMsg] = useState({ type: null, text: '' });
  const [editingCouponCode, setEditingCouponCode] = useState(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    title: '',
    type: 'percent',
    value: 10,
    minOrder: 299,
    maxDiscount: '',
    applicableTo: 'all',
    selectedProducts: [],
    usageLimit: '',
    perCustomerLimit: 1,
    startDate: '',
    expiryDate: '',
    isActive: true
  });

  const loadCoupons = async () => {
    setCouponsLoading(true);
    try {
      const res = await api.getVendorCoupons();
      if (res?.success && Array.isArray(res.coupons)) {
        setCoupons(res.coupons);
      }
    } catch {
      setCoupons([]);
    } finally {
      setCouponsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'coupons') {
      loadCoupons();
    }
  }, [activeTab]);

  const handleOpenAddCoupon = () => {
    setEditingCouponCode(null);
    setCouponForm({
      code: '',
      title: '',
      type: 'percent',
      value: 10,
      minOrder: 299,
      maxDiscount: '',
      applicableTo: 'all',
      selectedProducts: [],
      usageLimit: '',
      perCustomerLimit: 1,
      startDate: '',
      expiryDate: '',
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
      title: c.title || c.description || '',
      type: c.type || c.discountType || 'percent',
      value: c.value ?? c.discountValue ?? 10,
      minOrder: c.minOrder ?? c.min_order ?? 0,
      maxDiscount: c.maxDiscount ?? c.max_discount ?? '',
      applicableTo: c.applicableTo || c.applicable_to || (prodIds.length > 0 ? 'selected' : 'all'),
      selectedProducts: prodIds,
      usageLimit: c.usageLimit ?? c.usage_limit ?? '',
      perCustomerLimit: c.perCustomerLimit ?? c.per_customer_limit ?? 1,
      startDate: c.startDate || c.start_date ? new Date(c.startDate || c.start_date).toISOString().slice(0, 10) : '',
      expiryDate: c.expiryDate || c.expiry_date ? new Date(c.expiryDate || c.expiry_date).toISOString().slice(0, 10) : '',
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

    if (couponForm.type === 'percent') {
      const val = Number(couponForm.value);
      if (!val || val <= 0 || val > 100) {
        setCouponFormMsg({ type: 'error', text: 'Percentage discount must be between 1% and 100%.' });
        return;
      }
    } else if (couponForm.type === 'flat') {
      const val = Number(couponForm.value);
      if (!val || val <= 0) {
        setCouponFormMsg({ type: 'error', text: 'Discount value must be greater than zero.' });
        return;
      }
    }

    setCouponSaving(true);
    setCouponFormMsg({ type: null, text: '' });
    try {
      const payload = {
        code: couponForm.code.trim().toUpperCase(),
        title: couponForm.title.trim(),
        type: couponForm.type,
        value: Number(couponForm.value) || 0,
        minOrder: Number(couponForm.minOrder) || 0,
        maxDiscount: couponForm.maxDiscount !== '' ? Number(couponForm.maxDiscount) : null,
        applicableTo: couponForm.applicableTo,
        productIds: couponForm.applicableTo === 'selected' ? couponForm.selectedProducts : [],
        usageLimit: couponForm.usageLimit !== '' ? parseInt(couponForm.usageLimit, 10) : null,
        perCustomerLimit: couponForm.perCustomerLimit !== '' ? parseInt(couponForm.perCustomerLimit, 10) : 1,
        startDate: couponForm.startDate || null,
        expiryDate: couponForm.expiryDate || null,
        isActive: Boolean(couponForm.isActive),
        discountType: couponForm.type,
        discountValue: Number(couponForm.value) || 0,
        minOrderAmount: Number(couponForm.minOrder) || 0,
        maxDiscountAmount: couponForm.maxDiscount !== '' ? Number(couponForm.maxDiscount) : null,
        selectedProducts: couponForm.applicableTo === 'selected' ? couponForm.selectedProducts : []
      };

      if (editingCouponCode) {
        const res = await api.updateVendorCoupon(editingCouponCode, payload);
        if (!res?.success) throw new Error(res?.error || 'Failed to update coupon');
      } else {
        const res = await api.createVendorCoupon(payload);
        if (!res?.success) throw new Error(res?.error || 'Failed to create coupon');
      }

      await loadCoupons();
      setCouponFormMsg({ type: 'success', text: `Coupon ${payload.code} saved successfully!` });
      setTimeout(() => setCouponModalOpen(false), 1000);
    } catch (err) {
      setCouponFormMsg({ type: 'error', text: err?.message || 'Failed to save coupon' });
    } finally {
      setCouponSaving(false);
    }
  };

  const handleDeleteCoupon = async (code) => {
    if (!window.confirm(`Are you sure you want to delete coupon ${code}?`)) return;
    try {
      const res = await api.deleteVendorCoupon(code);
      if (res?.success) {
        setCoupons(prev => prev.filter(c => c.code !== code));
      } else {
        alert(res?.error || 'Failed to delete coupon');
      }
    } catch (err) {
      alert(err?.message || 'Failed to delete coupon');
    }
  };

  // ── Delivery Charges State & Handlers ─────────────────────────────────────
  const [deliveryData, setDeliveryData] = useState({
    shippingEnabled: true,
    shippingCharge: 50,
    shippingFreeThreshold: 499,
    shippingEstimatedDays: '2–4 business days'
  });
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliverySuccessMsg, setDeliverySuccessMsg] = useState('');
  const [deliveryErrorMsg, setDeliveryErrorMsg] = useState('');

  const loadDeliveryCharges = async () => {
    setDeliveryLoading(true);
    setDeliveryErrorMsg('');
    try {
      const res = await api.getVendorDeliveryCharges();
      if (res?.success && res.delivery) {
        setDeliveryData(res.delivery);
      }
    } catch {
      setDeliveryErrorMsg('Unable to load delivery configuration.');
    } finally {
      setDeliveryLoading(false);
    }
  };

  const handleSaveDeliveryCharges = async (e) => {
    e.preventDefault();
    setDeliverySaving(true);
    setDeliverySuccessMsg('');
    setDeliveryErrorMsg('');
    try {
      const res = await api.updateVendorDeliveryCharges(deliveryData);
      if (res?.success) {
        setDeliverySuccessMsg(res.message || 'Delivery charges updated successfully!');
        if (res.delivery) setDeliveryData(res.delivery);
      } else {
        setDeliveryErrorMsg(res?.error || 'Failed to update delivery charges.');
      }
    } catch (err) {
      setDeliveryErrorMsg(err.message || 'Failed to update delivery charges.');
    } finally {
      setDeliverySaving(false);
    }
  };

  // ── Operational Settings & Password State & Handlers ──────────────────────
  const [settingsData, setSettingsData] = useState({
    storeOpen: true,
    status: 'approved',
    emailAlerts: true,
    lowStockThreshold: 10
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState('');
  const [settingsErrorMsg, setSettingsErrorMsg] = useState('');

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('');
  const [passwordErrorMsg, setPasswordErrorMsg] = useState('');

  const loadSettings = async () => {
    setSettingsLoading(true);
    setSettingsErrorMsg('');
    try {
      const res = await api.getVendorSettings();
      if (res?.success && res.settings) {
        setSettingsData(res.settings);
      }
    } catch {
      setSettingsErrorMsg('Unable to load vendor settings.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsSuccessMsg('');
    setSettingsErrorMsg('');
    try {
      const res = await api.updateVendorSettings(settingsData);
      if (res?.success) {
        setSettingsSuccessMsg(res.message || 'Store operational settings saved successfully!');
        if (res.settings) setSettingsData(res.settings);
      } else {
        setSettingsErrorMsg(res?.error || 'Failed to save store settings.');
      }
    } catch (err) {
      setSettingsErrorMsg(err.message || 'Failed to save settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordSuccessMsg('');
    setPasswordErrorMsg('');
    if (!passwordForm.currentPassword) {
      setPasswordErrorMsg('Current password is required.');
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      setPasswordErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordErrorMsg('New passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await api.changeVendorPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      if (res?.success) {
        setPasswordSuccessMsg(res.message || 'Password changed successfully!');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordErrorMsg(res?.error || 'Failed to change password.');
      }
    } catch (err) {
      setPasswordErrorMsg(err.message || 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

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
    if (!authSessions.get('vendor') && typeof onLogout === 'function') {
      onLogout();
      return;
    }
    // Vendor token: pending listings + this vendor's scoped orders.
    await syncProductsFromServer('vendor');
    if (!authSessions.get('vendor') && typeof onLogout === 'function') {
      onLogout();
      return;
    }
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

  useEffect(() => {
    setOrderPage(1);
  }, [orderFilter]);

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

  // Fetch live vendor profile from backend when opening profile
  useEffect(() => {
    if ((activeTab === 'profile' || activeTab === 'settings') && vendor?.id) {
      setProfileLoading(true);
      api.getVendorProfile()
        .then((res) => {
          if (res?.success && res.vendor) {
            const v = res.vendor;
            setProfileData((prev) => ({
              ...prev,
              businessName: v.businessName || v.business_name || v.name || prev.businessName,
              ownerName: v.ownerName || v.owner_name || v.name || prev.ownerName,
              email: v.email || prev.email,
              phone: v.phone || prev.phone,
              address: v.address || prev.address,
              city: v.city || prev.city,
              district: v.district || prev.district,
              state: v.state || prev.state || 'Tamil Nadu',
              pincode: v.pincode || prev.pincode,
              bio: v.bio || prev.bio,
              gstStatus: v.gstStatus || v.gst_status || prev.gstStatus,
              gstin: v.gstin || prev.gstin,
              gstCertificateUrl: v.gstCertificateUrl || v.gst_certificate_url || prev.gstCertificateUrl,
              fssaiStatus: v.fssaiStatus || v.fssai_status || prev.fssaiStatus,
              fssaiNumber: v.fssaiNumber || v.fssai_number || prev.fssaiNumber,
              fssaiCertificateUrl: v.fssaiCertificateUrl || v.fssai_certificate_url || prev.fssaiCertificateUrl,
              bankAccountHolder: v.bankAccountHolder || v.bank_account_holder || prev.bankAccountHolder,
              bankName: v.bankName || v.bank_name || prev.bankName,
              bankAccountNumber: v.bankAccountNumber || v.bank_account_number || prev.bankAccountNumber,
              bankIfsc: v.bankIfsc || v.bank_ifsc || prev.bankIfsc,
              bankDocumentUrl: v.bankDocumentUrl || v.bank_document_url || prev.bankDocumentUrl,
              shippingEnabled: v.shippingEnabled !== false && v.shipping_enabled !== 0,
              shippingCharge: v.shippingCharge != null ? v.shippingCharge : (v.shipping_charge != null ? v.shipping_charge : prev.shippingCharge),
              shippingFreeThreshold: v.shippingFreeThreshold != null ? v.shippingFreeThreshold : (v.shipping_free_threshold != null ? v.shipping_free_threshold : prev.shippingFreeThreshold),
              shippingEstimatedDays: v.shippingEstimatedDays || v.shipping_estimated_days || prev.shippingEstimatedDays
            }));
          }
        })
        .catch(() => {})
        .finally(() => setProfileLoading(false));
    }
  }, [activeTab, vendor?.id]);

  // Fetch live delivery charges config when opening delivery tab
  useEffect(() => {
    if (activeTab === 'delivery' && vendor?.id) {
      loadDeliveryCharges();
    }
  }, [activeTab, vendor?.id]);

  // Fetch live operational settings when opening settings tab
  useEffect(() => {
    if (activeTab === 'settings' && vendor?.id) {
      loadSettings();
    }
  }, [activeTab, vendor?.id]);

  if (!vendor) return null;

  const pendingProducts = products.filter(p => (p.status || 'pending') === 'pending');
  const rejectedProducts = products.filter(p => p.status === 'rejected');
  const approvedProducts = products.filter(p => p.status === 'approved');

  const handleStockToggle = async (product) => {
    await toggleProductStock(product.id);
    await loadData();
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

  // Handle Document Upload in Profile
  const handleVendorDocUpload = async (e, docType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) {
      setProfileErrorMsg('Please select a valid PDF, JPEG, or PNG document.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setProfileErrorMsg('Document size exceeds 10MB limit.');
      return;
    }

    setUploadingDoc(docType);
    setProfileErrorMsg('');

    try {
      const res = await api.uploadDocument(file, 'vendor');
      if (res?.success && res.url) {
        if (docType === 'gst') {
          setProfileData((prev) => ({ ...prev, gstCertificateUrl: res.url }));
        } else if (docType === 'fssai') {
          setProfileData((prev) => ({ ...prev, fssaiCertificateUrl: res.url }));
        } else if (docType === 'bank') {
          setProfileData((prev) => ({ ...prev, bankDocumentUrl: res.url }));
        }
      } else {
        setProfileErrorMsg(res?.error || 'Document upload failed.');
      }
    } catch (err) {
      setProfileErrorMsg(err?.message || 'Document upload failed. Please try again.');
    } finally {
      setUploadingDoc(null);
    }
  };

  // Handle Save Profile & Compliance Settings
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileErrorMsg('');
    setProfileSuccessMsg('');

    try {
      const res = await api.updateVendorProfile(profileData);
      if (res?.success) {
        setProfileSuccessMsg(res.message || 'Profile, licenses, and settlement details saved successfully!');
        if (res.vendor) {
          updateVendor(vendor.id, {
            ...vendor,
            ...res.vendor,
            name: res.vendor.businessName || res.vendor.name || vendor.name
          });
        }
        setTimeout(() => setProfileSuccessMsg(''), 4000);
      } else {
        setProfileErrorMsg(res?.error || 'Failed to update profile.');
      }
    } catch (err) {
      setProfileErrorMsg(err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
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

  const paginatedOrders = filteredOrders.slice(
    (orderPage - 1) * orderPageSize,
    orderPage * orderPageSize
  );

  const paginatedStockProducts = products.slice(
    (stockPage - 1) * stockPageSize,
    stockPage * stockPageSize
  );

  const paginatedReviews = reviews.slice(
    (reviewPage - 1) * reviewPageSize,
    reviewPage * reviewPageSize
  );

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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setEditingProductId(p.id)}
                  title="Click to view / edit product"
                >
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
                  title={p.status === 'approved' ? 'Edit listing (re-approval required)' : 'Edit product details'}
                >
                  Edit
                </button>
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
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="vendor-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside className={`vendor-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* 1. Brand Logo */}
        <div className="vendor-sidebar-header">
          <div className="vendor-sidebar-header-top">
            <Link to="/" className="vendor-brand-logo-link" title="Go to Storefront">
              <div className="vendor-brand-logo-card">
                <img src={brandLogoWithBg} alt="EcShopping Logo" className="vendor-brand-logo-img-bg" />
              </div>
            </Link>
            <button
              type="button"
              className="vendor-sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
              title="Close navigation menu"
              aria-label="Close navigation menu"
            >
              <X size={20} />
            </button>
          </div>

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

          {/* 5b. Coupons */}
          <div className="vendor-menu-item">
            <button 
              className={`vendor-menu-btn ${activeTab === 'coupons' ? 'active' : ''}`}
              onClick={() => handleNavigate('coupons')}
            >
              <Tag size={19} className="vendor-menu-icon" />
              <span className="vendor-menu-title">Store Coupons</span>
              {coupons.length > 0 && (
                <span className="vendor-badge-count">{coupons.length}</span>
              )}
            </button>
          </div>

          {/* 5c. Delivery Charges */}
          <div className="vendor-menu-item">
            <button 
              className={`vendor-menu-btn ${activeTab === 'delivery' ? 'active' : ''}`}
              onClick={() => handleNavigate('delivery')}
            >
              <Truck size={19} className="vendor-menu-icon" />
              <span className="vendor-menu-title">Delivery Charges</span>
            </button>
          </div>

          {/* 6. Vendor Profile */}
          <div className="vendor-menu-item">
            <button 
              className={`vendor-menu-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => handleNavigate('profile')}
            >
              <User size={19} className="vendor-menu-icon" />
              <span className="vendor-menu-title">Vendor Profile</span>
            </button>
          </div>

          {/* 7. Settings */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                className="vendor-menu-toggle"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title="Toggle navigation"
              >
                <Menu size={20} />
              </button>
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
                {activeTab === 'coupons' && 'Store Coupons'}
                {activeTab === 'delivery' && 'Delivery Charges & Shipping'}
                {activeTab === 'profile' && 'Vendor Profile & Regulatory Details'}
                {activeTab === 'settings' && 'Vendor Settings & Security'}
              </h1>
            </div>
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
              {activeTab === 'coupons' && 'Create and manage promotional discounts and coupon codes for your storefront.'}
              {activeTab === 'delivery' && 'Set custom shipping charges, free delivery thresholds, and delivery timelines for your store.'}
              {activeTab === 'profile' && 'Update your business address, GSTIN, FSSAI regulatory compliance, and settlement bank accounts.'}
              {activeTab === 'settings' && 'Configure store availability status, inventory alert thresholds, order notifications, and password credentials.'}
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
            <React.Suspense fallback={<FormSkeleton fields={5} />}>
              <EditProduct
                productId={editingProductId}
                vendor={vendor}
                onBack={() => setEditingProductId(null)}
                onSaved={() => {
                  setEditingProductId(null);
                  loadData();
                }}
              />
            </React.Suspense>
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
            <React.Suspense fallback={<TableSkeleton rows={4} cols={4} />}>
              <CategoryManager vendor={vendor} />
            </React.Suspense>
          )}

          {/* ---------------- 3. PRODUCTS: ADD PRODUCT VIEW (Split Component) ---------------- */}
          {activeTab === 'products-add' && (
            <React.Suspense fallback={<FormSkeleton fields={6} />}>
              <AddProduct vendor={vendor} />
            </React.Suspense>
          )}

          {/* ---------------- 4. PRODUCTS: ALL PRODUCTS VIEW (Split Component) ---------------- */}
          {activeTab === 'products-all' && (
            <React.Suspense fallback={<TableSkeleton rows={6} cols={5} />}>
              <AllProducts vendor={vendor} onProductsUpdated={loadData} />
            </React.Suspense>
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
                  {paginatedStockProducts.map((p) => {
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
                            {inStock ? `In stock (${p.stockQuantity != null ? p.stockQuantity : 50})` : 'Out of stock (0)'}
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

              <div style={{ padding: '14px 18px', borderTop: '1px solid #e2e8f0' }}>
                <Pagination
                  currentPage={stockPage}
                  totalPages={Math.ceil(products.length / stockPageSize) || 1}
                  onPageChange={setStockPage}
                  totalItems={products.length}
                  pageSize={stockPageSize}
                  onPageSizeChange={(sz) => { setStockPageSize(sz); setStockPage(1); }}
                  pageSizeOptions={[10, 25, 50]}
                />
              </div>
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
              {!reviewsLoading && paginatedReviews.map((review) => (
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
          {activeTab === 'reviews' && reviews.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Pagination
                currentPage={reviewPage}
                totalPages={Math.ceil(reviews.length / reviewPageSize) || 1}
                onPageChange={setReviewPage}
                totalItems={reviews.length}
                pageSize={reviewPageSize}
                onPageSizeChange={(sz) => { setReviewPageSize(sz); setReviewPage(1); }}
                pageSizeOptions={[10, 25, 50]}
              />
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
                  {paginatedOrders.map(order => {
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

              <div style={{ padding: '14px 18px', borderTop: '1px solid #e2e8f0' }}>
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
            </div>
          )}

          {/* ---------------- 6. VENDOR PROFILE VIEW ---------------- */}
          {activeTab === 'profile' && (
            <div className="settings-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {profileSuccessMsg && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '12px 18px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                  <CheckCircle size={20} />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {profileErrorMsg && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 18px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                  <AlertCircle size={20} />
                  <span>{profileErrorMsg}</span>
                </div>
              )}

              {profileLoading ? (
                <div style={{ textAlign: 'center', padding: '48px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px', color: '#0e5c4a' }} />
                  <p style={{ color: '#64748b', margin: 0 }}>Loading your store and compliance details...</p>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Card 1: Store & Contact Information */}
                  <div className="settings-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdf4', color: '#0e5c4a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Store size={20} />
                      </div>
                      <div>
                        <h3 className="settings-card-title" style={{ margin: 0 }}>Store & Contact Information</h3>
                        <p className="settings-card-desc" style={{ margin: '2px 0 0' }}>Your public store profile and verified contact details.</p>
                      </div>
                    </div>

                    <div className="form-two-column-grid">
                      <div>
                        <label className="v-input-label">Business / Farm Name *</label>
                        <input
                          type="text"
                          className="v-input-text"
                          value={profileData.businessName}
                          onChange={(e) => setProfileData({ ...profileData, businessName: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <label className="v-input-label">Owner / Contact Name *</label>
                        <input
                          type="text"
                          className="v-input-text"
                          value={profileData.ownerName}
                          onChange={(e) => setProfileData({ ...profileData, ownerName: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <label className="v-input-label">Email Address (Read-only)</label>
                        <input
                          type="email"
                          className="v-input-text"
                          value={profileData.email}
                          disabled
                          style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                        />
                      </div>

                      <div>
                        <label className="v-input-label">Contact Mobile Number *</label>
                        <input
                          type="tel"
                          className="v-input-text"
                          value={profileData.phone}
                          maxLength={10}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                          required
                        />
                      </div>

                      <div className="form-full-column">
                        <label className="v-input-label">Farm / Operating Street Address *</label>
                        <textarea
                          className="v-textarea"
                          rows={2}
                          value={profileData.address}
                          onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                          placeholder="Building, street, plot or village"
                          required
                        />
                      </div>

                      <div>
                        <label className="v-input-label">City / Town *</label>
                        <input
                          type="text"
                          className="v-input-text"
                          value={profileData.city}
                          onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <label className="v-input-label">District *</label>
                        <input
                          type="text"
                          className="v-input-text"
                          value={profileData.district}
                          onChange={(e) => setProfileData({ ...profileData, district: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <label className="v-input-label">State *</label>
                        <select
                          className="v-input-text"
                          value={profileData.state}
                          onChange={(e) => setProfileData({ ...profileData, state: e.target.value })}
                          required
                        >
                          {INDIAN_STATES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="v-input-label">PIN Code *</label>
                        <input
                          type="text"
                          className="v-input-text"
                          value={profileData.pincode}
                          maxLength={6}
                          onChange={(e) => setProfileData({ ...profileData, pincode: e.target.value })}
                          required
                        />
                      </div>

                      <div className="form-full-column">
                        <label className="v-input-label">Store Bio / Description</label>
                        <textarea
                          className="v-textarea"
                          rows={3}
                          value={profileData.bio}
                          onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                          placeholder="Tell customers about your farm harvest practices and specialties"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Business & Regulatory Licenses */}
                  <div className="settings-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdf4', color: '#0e5c4a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileCheck2 size={20} />
                      </div>
                      <div>
                        <h3 className="settings-card-title" style={{ margin: 0 }}>Business & Regulatory Licenses</h3>
                        <p className="settings-card-desc" style={{ margin: '2px 0 0' }}>Goods and Services Tax (GST) & Food Safety (FSSAI) regulatory records.</p>
                      </div>
                    </div>

                    <div className="form-two-column-grid">
                      <div>
                        <label className="v-input-label">GST Registration Status</label>
                        <select
                          className="v-input-text"
                          value={profileData.gstStatus}
                          onChange={(e) => setProfileData({ ...profileData, gstStatus: e.target.value })}
                        >
                          <option value="Not Registered">Not Registered (Exempt / Threshold limit)</option>
                          <option value="Registered">Registered (Hold valid GSTIN)</option>
                        </select>
                      </div>

                      <div>
                        <label className="v-input-label">GSTIN Number</label>
                        <input
                          type="text"
                          className="v-input-text"
                          placeholder="15-character GSTIN"
                          maxLength={15}
                          value={profileData.gstin}
                          onChange={(e) => setProfileData({ ...profileData, gstin: e.target.value.toUpperCase() })}
                          disabled={profileData.gstStatus !== 'Registered'}
                          style={{ textTransform: 'uppercase' }}
                        />
                      </div>

                      <div className="form-full-column">
                        <label className="v-input-label">GST Registration Certificate</label>
                        <input
                          type="file"
                          ref={gstInputRef}
                          style={{ display: 'none' }}
                          accept=".pdf,image/jpeg,image/png"
                          onChange={(e) => handleVendorDocUpload(e, 'gst')}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => gstInputRef.current?.click()}
                            disabled={uploadingDoc === 'gst'}
                            style={{ fontSize: '0.85rem' }}
                          >
                            <UploadCloud size={16} /> {uploadingDoc === 'gst' ? 'Uploading...' : (profileData.gstCertificateUrl ? 'Replace Certificate' : 'Upload GST Certificate')}
                          </button>
                          {profileData.gstCertificateUrl && (
                            <a
                              href={profileData.gstCertificateUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#0e5c4a', fontWeight: 600, textDecoration: 'none' }}
                            >
                              <FileText size={16} /> View Current Certificate
                            </a>
                          )}
                        </div>
                        <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>PDF, JPG, PNG up to 10MB.</small>
                      </div>

                      <div>
                        <label className="v-input-label">FSSAI Registration Status</label>
                        <select
                          className="v-input-text"
                          value={profileData.fssaiStatus}
                          onChange={(e) => setProfileData({ ...profileData, fssaiStatus: e.target.value })}
                        >
                          <option value="Not Applicable">Not Applicable (Raw produce / Exempt)</option>
                          <option value="Applicable">Applicable (Packaged / Processed items)</option>
                        </select>
                      </div>

                      <div>
                        <label className="v-input-label">FSSAI License / Registration No.</label>
                        <input
                          type="text"
                          className="v-input-text"
                          placeholder="14-digit FSSAI number"
                          maxLength={14}
                          value={profileData.fssaiNumber}
                          onChange={(e) => setProfileData({ ...profileData, fssaiNumber: e.target.value })}
                          disabled={profileData.fssaiStatus !== 'Applicable'}
                        />
                      </div>

                      <div className="form-full-column">
                        <label className="v-input-label">FSSAI Food License Certificate</label>
                        <input
                          type="file"
                          ref={fssaiInputRef}
                          style={{ display: 'none' }}
                          accept=".pdf,image/jpeg,image/png"
                          onChange={(e) => handleVendorDocUpload(e, 'fssai')}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => fssaiInputRef.current?.click()}
                            disabled={uploadingDoc === 'fssai'}
                            style={{ fontSize: '0.85rem' }}
                          >
                            <UploadCloud size={16} /> {uploadingDoc === 'fssai' ? 'Uploading...' : (profileData.fssaiCertificateUrl ? 'Replace FSSAI License' : 'Upload FSSAI License')}
                          </button>
                          {profileData.fssaiCertificateUrl && (
                            <a
                              href={profileData.fssaiCertificateUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#0e5c4a', fontWeight: 600, textDecoration: 'none' }}
                            >
                              <FileText size={16} /> View Current FSSAI License
                            </a>
                          )}
                        </div>
                        <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>PDF, JPG, PNG up to 10MB.</small>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Bank Account & Settlement Information */}
                  <div className="settings-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdf4', color: '#0e5c4a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h3 className="settings-card-title" style={{ margin: 0 }}>Bank Account & Settlement Information (Payouts)</h3>
                        <p className="settings-card-desc" style={{ margin: '2px 0 0' }}>Used confidentially for seller payout transfers and settlement deposits.</p>
                      </div>
                    </div>

                    <div className="form-two-column-grid">
                      <div>
                        <label className="v-input-label">Account Holder Legal Name</label>
                        <input
                          type="text"
                          className="v-input-text"
                          placeholder="As printed on bank passbook"
                          value={profileData.bankAccountHolder}
                          onChange={(e) => setProfileData({ ...profileData, bankAccountHolder: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="v-input-label">Bank Name</label>
                        <input
                          type="text"
                          className="v-input-text"
                          placeholder="e.g. State Bank of India, Canara Bank"
                          value={profileData.bankName}
                          onChange={(e) => setProfileData({ ...profileData, bankName: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="v-input-label">Account Number</label>
                        <input
                          type="text"
                          className="v-input-text"
                          placeholder="Bank account number"
                          value={profileData.bankAccountNumber}
                          onChange={(e) => setProfileData({ ...profileData, bankAccountNumber: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="v-input-label">IFSC Code</label>
                        <input
                          type="text"
                          className="v-input-text"
                          placeholder="11-character IFSC code"
                          maxLength={11}
                          value={profileData.bankIfsc}
                          onChange={(e) => setProfileData({ ...profileData, bankIfsc: e.target.value.toUpperCase() })}
                          style={{ textTransform: 'uppercase' }}
                        />
                      </div>

                      <div className="form-full-column">
                        <label className="v-input-label">Bank Passbook / Cancelled Cheque</label>
                        <input
                          type="file"
                          ref={bankInputRef}
                          style={{ display: 'none' }}
                          accept=".pdf,image/jpeg,image/png"
                          onChange={(e) => handleVendorDocUpload(e, 'bank')}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => bankInputRef.current?.click()}
                            disabled={uploadingDoc === 'bank'}
                            style={{ fontSize: '0.85rem' }}
                          >
                            <UploadCloud size={16} /> {uploadingDoc === 'bank' ? 'Uploading...' : (profileData.bankDocumentUrl ? 'Replace Bank Document' : 'Upload Passbook / Cheque')}
                          </button>
                          {profileData.bankDocumentUrl && (
                            <a
                              href={profileData.bankDocumentUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#0e5c4a', fontWeight: 600, textDecoration: 'none' }}
                            >
                              <FileText size={16} /> View Current Bank Document
                            </a>
                          )}
                        </div>
                        <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>PDF, JPG, PNG up to 10MB.</small>
                      </div>
                    </div>
                  </div>

                  {/* Save Action */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                    <button
                      type="submit"
                      className="btn-primary-action"
                      disabled={profileSaving}
                      style={{ padding: '12px 28px', fontSize: '0.95rem' }}
                    >
                      {profileSaving ? (
                        <>
                          <Loader2 size={18} className="spin" /> Saving Profile...
                        </>
                      ) : (
                        <>
                          <Check size={18} /> Save Vendor Profile
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ---------------- 6b. DELIVERY CHARGES VIEW ---------------- */}
          {activeTab === 'delivery' && (
            <div className="settings-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {deliverySuccessMsg && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '12px 18px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                  <CheckCircle size={20} />
                  <span>{deliverySuccessMsg}</span>
                </div>
              )}
              {deliveryErrorMsg && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 18px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                  <AlertCircle size={20} />
                  <span>{deliveryErrorMsg}</span>
                </div>
              )}

              {deliveryLoading ? (
                <div style={{ textAlign: 'center', padding: '48px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px', color: '#0e5c4a' }} />
                  <p style={{ color: '#64748b', margin: 0 }}>Loading delivery charges configuration...</p>
                </div>
              ) : (
                <form onSubmit={handleSaveDeliveryCharges} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div className="settings-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdf4', color: '#0e5c4a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Truck size={20} />
                      </div>
                      <div>
                        <h3 className="settings-card-title" style={{ margin: 0 }}>Store Delivery &amp; Shipping Charges</h3>
                        <p className="settings-card-desc" style={{ margin: '2px 0 0' }}>Configure delivery fees and free shipping order thresholds for customers ordering your produce.</p>
                      </div>
                    </div>

                    <div className="form-two-column-grid">
                      <div className="form-full-column">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <input
                            type="checkbox"
                            checked={deliveryData.shippingEnabled}
                            onChange={(e) => setDeliveryData({ ...deliveryData, shippingEnabled: e.target.checked })}
                            style={{ width: 18, height: 18, accentColor: '#0e5c4a' }}
                          />
                          <span>Charge delivery fee on orders of my produce (uncheck for Free Store Delivery)</span>
                        </label>
                      </div>

                      <div>
                        <label className="v-input-label">Standard Shipping Charge (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="v-input-text"
                          placeholder="e.g. 50"
                          value={deliveryData.shippingCharge}
                          onChange={(e) => setDeliveryData({ ...deliveryData, shippingCharge: Math.max(0, parseFloat(e.target.value) || 0) })}
                          disabled={!deliveryData.shippingEnabled}
                        />
                        <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>Standard fee applied to customer orders containing your items.</small>
                      </div>

                      <div>
                        <label className="v-input-label">Free Delivery Threshold (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="v-input-text"
                          placeholder="e.g. 499 (0 or blank for no free shipping)"
                          value={deliveryData.shippingFreeThreshold ?? ''}
                          onChange={(e) => setDeliveryData({ ...deliveryData, shippingFreeThreshold: e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0) })}
                          disabled={!deliveryData.shippingEnabled}
                        />
                        <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>Orders of your items meeting or exceeding this subtotal qualify for Free Delivery.</small>
                      </div>

                      <div className="form-full-column">
                        <label className="v-input-label">Estimated Delivery Timeline</label>
                        <input
                          type="text"
                          className="v-input-text"
                          placeholder="e.g. 2–4 business days (Direct farm harvest)"
                          value={deliveryData.shippingEstimatedDays}
                          onChange={(e) => setDeliveryData({ ...deliveryData, shippingEstimatedDays: e.target.value })}
                        />
                        <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>Displayed to customers during product browsing and checkout.</small>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                    <button
                      type="submit"
                      className="btn-primary-action"
                      disabled={deliverySaving}
                      style={{ padding: '12px 28px', fontSize: '0.95rem' }}
                    >
                      {deliverySaving ? (
                        <>
                          <Loader2 size={18} className="spin" /> Saving Delivery Charges...
                        </>
                      ) : (
                        <>
                          <Check size={18} /> Save Delivery Charges
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ---------------- 6c. VENDOR SETTINGS VIEW ---------------- */}
          {activeTab === 'settings' && (
            <div className="settings-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {settingsSuccessMsg && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '12px 18px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                  <CheckCircle size={20} />
                  <span>{settingsSuccessMsg}</span>
                </div>
              )}
              {settingsErrorMsg && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 18px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                  <AlertCircle size={20} />
                  <span>{settingsErrorMsg}</span>
                </div>
              )}

              {settingsLoading ? (
                <div style={{ textAlign: 'center', padding: '48px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px', color: '#0e5c4a' }} />
                  <p style={{ color: '#64748b', margin: 0 }}>Loading store operational settings...</p>
                </div>
              ) : (
                <>
                  {/* Card 1: Operations */}
                  <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="settings-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdf4', color: '#0e5c4a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Settings size={20} />
                        </div>
                        <div>
                          <h3 className="settings-card-title" style={{ margin: 0 }}>Store Operations &amp; Preferences</h3>
                          <p className="settings-card-desc" style={{ margin: '2px 0 0' }}>Manage store availability, stock alert levels, and notification triggers.</p>
                        </div>
                      </div>

                      <div className="form-two-column-grid">
                        <div className="form-full-column">
                          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <input
                              type="checkbox"
                              checked={settingsData.storeOpen}
                              onChange={(e) => setSettingsData({ ...settingsData, storeOpen: e.target.checked })}
                              style={{ width: 18, height: 18, accentColor: '#0e5c4a' }}
                            />
                            <span>Store Accepting Orders (uncheck to temporarily pause incoming orders)</span>
                          </label>
                        </div>

                        <div>
                          <label className="v-input-label">Low Stock Alert Threshold (units)</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="v-input-text"
                            placeholder="e.g. 10"
                            value={settingsData.lowStockThreshold}
                            onChange={(e) => setSettingsData({ ...settingsData, lowStockThreshold: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                          />
                          <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>Products with stock below this count trigger a low inventory alert.</small>
                        </div>

                        <div>
                          <label className="v-input-label">Order Notification Emails</label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 500, fontSize: '0.88rem', color: '#334155', marginTop: 8 }}>
                            <input
                              type="checkbox"
                              checked={settingsData.emailAlerts}
                              onChange={(e) => setSettingsData({ ...settingsData, emailAlerts: e.target.checked })}
                              style={{ width: 18, height: 18, accentColor: '#0e5c4a' }}
                            />
                            <span>Receive email alerts whenever an order containing your products is placed</span>
                          </label>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>
                        <button
                          type="submit"
                          className="btn-primary-action"
                          disabled={settingsSaving}
                          style={{ padding: '10px 24px', fontSize: '0.9rem' }}
                        >
                          {settingsSaving ? (
                            <>
                              <Loader2 size={16} className="spin" /> Saving Settings...
                            </>
                          ) : (
                            <>
                              <Check size={16} /> Save Store Preferences
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Card 2: Password */}
                  <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="settings-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Lock size={20} />
                        </div>
                        <div>
                          <h3 className="settings-card-title" style={{ margin: 0 }}>Security &amp; Account Password</h3>
                          <p className="settings-card-desc" style={{ margin: '2px 0 0' }}>Update your vendor portal login password credentials.</p>
                        </div>
                      </div>

                      {passwordSuccessMsg && (
                        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '10px 16px', borderRadius: '8px', marginBottom: 14, fontSize: '0.88rem' }}>
                          {passwordSuccessMsg}
                        </div>
                      )}
                      {passwordErrorMsg && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 16px', borderRadius: '8px', marginBottom: 14, fontSize: '0.88rem' }}>
                          {passwordErrorMsg}
                        </div>
                      )}

                      <div className="form-two-column-grid">
                        <div className="form-full-column">
                          <label className="v-input-label">Current Password *</label>
                          <input
                            type="password"
                            className="v-input-text"
                            placeholder="Enter your current password"
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                            required
                          />
                        </div>

                        <div>
                          <label className="v-input-label">New Password *</label>
                          <input
                            type="password"
                            className="v-input-text"
                            placeholder="At least 6 characters"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            required
                          />
                        </div>

                        <div>
                          <label className="v-input-label">Confirm New Password *</label>
                          <input
                            type="password"
                            className="v-input-text"
                            placeholder="Repeat new password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>
                        <button
                          type="submit"
                          className="btn-primary-action"
                          disabled={passwordSaving}
                          style={{ padding: '10px 24px', fontSize: '0.9rem', background: '#dc2626' }}
                        >
                          {passwordSaving ? (
                            <>
                              <Loader2 size={16} className="spin" /> Updating Password...
                            </>
                          ) : (
                            <>
                              <Lock size={16} /> Change Password
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </>
              )}
            </div>
          )}

          {/* ---------------- 7. STORE COUPONS VIEW ---------------- */}
          {activeTab === 'coupons' && (
            <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 700 }}>Store Coupons &amp; Promotional Offers</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                    Create discounts and special promotional codes applicable to your store's products
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search coupons..."
                      value={couponSearch}
                      onChange={(e) => setCouponSearch(e.target.value)}
                      style={{ padding: '7px 12px 7px 30px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, width: 200 }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-primary-action"
                    onClick={handleOpenAddCoupon}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, background: 'linear-gradient(135deg, #0e5c4a, #16a34a)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Plus size={15} /> Create Coupon
                  </button>
                </div>
              </div>

              {couponsLoading ? (
                <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                  <Loader2 size={24} className="animate-spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
                  Loading store coupons from server…
                </div>
              ) : coupons.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                  <Tag size={42} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                  <h4 style={{ margin: '0 0 6px', color: '#1e293b', fontSize: 16, fontWeight: 600 }}>No store coupons created yet</h4>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Create discount coupons to boost your store conversion and sales.</p>
                  <button
                    type="button"
                    onClick={handleOpenAddCoupon}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#0e5c4a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                  >
                    <Plus size={15} /> Create First Coupon
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table className="vendor-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Coupon Code</th>
                        <th style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Title / Description</th>
                        <th style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Discount</th>
                        <th style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Applicable Scope</th>
                        <th style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Order Minimum &amp; Cap</th>
                        <th style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Validity Window</th>
                        <th style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coupons
                        .filter(c => {
                          if (!couponSearch.trim()) return true;
                          const q = couponSearch.toLowerCase();
                          return (c.code || '').toLowerCase().includes(q) || (c.title || c.description || '').toLowerCase().includes(q);
                        })
                        .map((c) => {
                          const isActive = Boolean(c.is_active ?? c.isActive ?? 1);
                          const isPercent = (c.type || c.discountType) === 'percent';
                          const isExpired = (c.expiry_date || c.expiryDate) && new Date(c.expiry_date || c.expiryDate) < new Date();
                          let prodCount = 0;
                          if (c.applicable_to === 'selected' || c.applicableTo === 'selected') {
                            try {
                              const parsed = typeof c.product_ids === 'string' ? JSON.parse(c.product_ids) : (c.product_ids || c.productIds || []);
                              prodCount = Array.isArray(parsed) ? parsed.length : 0;
                            } catch {
                              prodCount = 0;
                            }
                          }
                          return (
                            <tr key={c.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '14px 20px' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#ecfdf5', border: '1px dashed #059669', borderRadius: 6 }}>
                                  <Tag size={12} style={{ color: '#059669' }} />
                                  <strong style={{ color: '#065f46', fontFamily: 'monospace', letterSpacing: '0.05em', fontSize: 13 }}>
                                    {c.code}
                                  </strong>
                                </div>
                              </td>
                              <td style={{ padding: '14px 20px' }}>
                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13.5 }}>{c.title || c.description || '—'}</div>
                                {c.title && c.description && c.title !== c.description && (
                                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{c.description}</div>
                                )}
                              </td>
                              <td style={{ padding: '14px 20px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '4px 9px',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  fontSize: 12.5,
                                  background: isPercent ? '#fef3c7' : '#e0e7ff',
                                  color: isPercent ? '#92400e' : '#3730a3'
                                }}>
                                  <Percent size={12} />
                                  {isPercent ? `${c.value ?? c.discountValue}% OFF` : `₹${c.value ?? c.discountValue} FLAT OFF`}
                                </span>
                              </td>
                              <td style={{ padding: '14px 20px' }}>
                                {(c.applicable_to === 'selected' || c.applicableTo === 'selected') ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
                                    {prodCount} specific product{prodCount === 1 ? '' : 's'}
                                  </span>
                                ) : (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
                                    All store products
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '14px 20px' }}>
                                <div style={{ fontSize: 12.5, color: '#334155' }}>
                                  <div>Min: <strong>₹{c.min_order ?? c.minOrder ?? 0}</strong></div>
                                  {(c.max_discount || c.maxDiscount) && (
                                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>Cap: ₹{c.max_discount || c.maxDiscount}</div>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '14px 20px', fontSize: 12, color: '#475569' }}>
                                {c.expiry_date || c.expiryDate ? (
                                  <div>Until <strong>{new Date(c.expiry_date || c.expiryDate).toLocaleDateString()}</strong></div>
                                ) : (
                                  <span style={{ color: '#059669', fontWeight: 500 }}>No expiration</span>
                                )}
                              </td>
                              <td style={{ padding: '14px 20px' }}>
                                {isExpired ? (
                                  <span className="status-badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', fontSize: 11, padding: '3px 8px', fontWeight: 600 }}>
                                    EXPIRED
                                  </span>
                                ) : isActive ? (
                                  <span className="status-badge status-approved" style={{ fontSize: 11, padding: '3px 8px', fontWeight: 600 }}>
                                    ACTIVE
                                  </span>
                                ) : (
                                  <span className="status-badge" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', fontSize: 11, padding: '3px 8px', fontWeight: 600 }}>
                                    INACTIVE
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '14px 20px' }}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditCoupon(c)}
                                    style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#334155', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    title="Edit coupon details"
                                  >
                                    <Edit2 size={12} /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCoupon(c.code)}
                                    style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 8px', fontSize: 12, cursor: 'pointer', color: '#dc2626', display: 'inline-flex', alignItems: 'center' }}
                                    title="Delete coupon"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ---------------- VENDOR ADD / EDIT COUPON MODAL ---------------- */}
          {couponModalOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div
                style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)' }}
                onClick={() => !couponSaving && setCouponModalOpen(false)}
              />
              <div style={{ position: 'relative', background: '#fff', borderRadius: 12, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #e2e8f0', paddingBottom: 14 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
                      {editingCouponCode ? `Edit Coupon: ${editingCouponCode}` : 'Create New Store Coupon'}
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                      Offer discounts on your products to attract more shoppers
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCouponModalOpen(false)}
                    disabled={couponSaving}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {couponFormMsg.text && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 13,
                    background: couponFormMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${couponFormMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                    color: couponFormMsg.type === 'success' ? '#065f46' : '#991b1b'
                  }}>
                    {couponFormMsg.text}
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
                        className="v-input-text"
                        style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}
                        placeholder="e.g. FARM15"
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
                        className="v-input-text"
                        value={couponForm.type}
                        onChange={(e) => updateCouponForm({ type: e.target.value })}
                      >
                        <option value="percent">Percentage Discount (%)</option>
                        <option value="flat">Flat Cash Discount (₹)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                      Coupon Title / Description
                    </label>
                    <input
                      type="text"
                      className="v-input-text"
                      placeholder="e.g. 15% off on cold-pressed sesame oil"
                      value={couponForm.title}
                      onChange={(e) => updateCouponForm({ title: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Discount Value *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="v-input-text"
                        value={couponForm.value}
                        onChange={(e) => updateCouponForm({ value: e.target.value })}
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
                        className="v-input-text"
                        value={couponForm.minOrder}
                        onChange={(e) => updateCouponForm({ minOrder: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Max Cap (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="v-input-text"
                        placeholder="Optional"
                        value={couponForm.maxDiscount}
                        onChange={(e) => setCouponForm({ ...couponForm, maxDiscount: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Scope Selection */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#334155', marginBottom: 8 }}>
                      Applicable Products in Your Store
                    </label>
                    <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                        <input
                          type="radio"
                          name="vCouponScope"
                          value="all"
                          checked={couponForm.applicableTo === 'all'}
                          onChange={() => setCouponForm({ ...couponForm, applicableTo: 'all' })}
                        />
                        <span>All My Store Products</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                        <input
                          type="radio"
                          name="vCouponScope"
                          value="selected"
                          checked={couponForm.applicableTo === 'selected'}
                          onChange={() => setCouponForm({ ...couponForm, applicableTo: 'selected' })}
                        />
                        <span>Specific Products ({couponForm.selectedProducts?.length || 0} selected)</span>
                      </label>
                    </div>

                    {couponForm.applicableTo === 'selected' && (() => {
                      const searchLower = couponProductSearch.trim().toLowerCase();
                      const filtered = searchLower
                        ? products.filter((p) =>
                            (p.title || p.name || '').toLowerCase().includes(searchLower) ||
                            (p.category || '').toLowerCase().includes(searchLower) ||
                            String(p.id || '').toLowerCase().includes(searchLower)
                          )
                        : products;
                      const selectedCount = (couponForm.selectedProducts || []).length;

                      return (
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                            <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
                              Assign Store Products ({selectedCount} assigned):
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

                          {/* Instant Search Bar */}
                          <div style={{ position: 'relative', marginBottom: 8 }}>
                            <input
                              type="text"
                              placeholder="Search your store products by title, category, or ID..."
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

                          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: 8 }}>
                            {products.length === 0 ? (
                              <p style={{ fontSize: 12, color: '#94a3b8', margin: '10px 0', textAlign: 'center' }}>No approved products found in your store.</p>
                            ) : filtered.length === 0 ? (
                              <p style={{ fontSize: 12, color: '#94a3b8', margin: '10px 0', textAlign: 'center' }}>No products match “{couponProductSearch}”</p>
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Usage Limit
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="v-input-text"
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
                        className="v-input-text"
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
                        className="v-input-text"
                        value={couponForm.startDate}
                        onChange={(e) => setCouponForm({ ...couponForm, startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#334155' }}>
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        className="v-input-text"
                        value={couponForm.expiryDate}
                        onChange={(e) => setCouponForm({ ...couponForm, expiryDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ paddingTop: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                      <input
                        type="checkbox"
                        checked={couponForm.isActive}
                        onChange={(e) => setCouponForm({ ...couponForm, isActive: e.target.checked })}
                        style={{ width: 18, height: 18, accentColor: '#0e5c4a' }}
                      />
                      <span>Coupon Active & Usable by Customers</span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() => setCouponModalOpen(false)}
                      disabled={couponSaving}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 18px', fontWeight: 500, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={couponSaving}
                      className="btn-primary-action"
                      style={{ padding: '10px 20px' }}
                    >
                      {couponSaving ? 'Saving…' : (editingCouponCode ? 'Update Coupon' : 'Create Coupon')}
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
