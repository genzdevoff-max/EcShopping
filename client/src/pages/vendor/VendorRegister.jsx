import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Store,
  MapPin,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Building2,
  Landmark,
  FileCheck,
  CreditCard,
  User,
  Info
} from 'lucide-react';
import api from '../../utils/api';
import { addVendor } from '../../utils/storage';
import './VendorRegister.css';

const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

const BUSINESS_TYPES = [
  'Individual Farmer / Producer',
  'Farmer Producer Organization (FPO)',
  'Sole Proprietorship',
  'Partnership Firm',
  'Private Limited Company',
  'Limited Liability Partnership (LLP)',
  'Artisanal / Cooperative Society'
];

export default function VendorRegister() {
  const navigate = useNavigate();

  // Comprehensive Vendor & Business Registration Form State
  const [formData, setFormData] = useState({
    // Personal & Store details
    businessName: '',
    businessType: 'Individual Farmer / Producer',
    ownerName: '',
    registeredName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',

    // Operating & Farm Address
    address: '',
    city: '',
    district: '',
    state: 'Tamil Nadu',
    pincode: '',
    country: 'India',
    bio: '',

    // Regulatory & Tax
    gstStatus: 'not_registered', // 'not_registered' | 'registered' | 'exempt'
    gstin: '',
    fssaiStatus: 'not_applicable', // 'not_applicable' | 'registered' | 'applied'
    fssaiNumber: '',

    // Bank & Settlement (payouts)
    bankAccountHolder: '',
    bankName: '',
    bankAccountNumber: '',
    confirmBankAccountNumber: '',
    bankIfsc: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Personal & Business Name Validations
    if (!formData.businessName.trim()) {
      setError('Please provide your Store / Farm Name.');
      return;
    }
    if (!formData.ownerName.trim()) {
      setError('Please provide the Owner / Contact Person Name.');
      return;
    }

    const cleanEmail = formData.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Please provide a valid 10-digit Indian mobile number.');
      return;
    }

    if (!formData.password || formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match. Please verify your password.');
      return;
    }

    // Address Validations
    if (!formData.address.trim()) {
      setError('Please provide your farm / operating address.');
      return;
    }
    if (!formData.city.trim() || !formData.district.trim()) {
      setError('Please provide your operating City and District.');
      return;
    }

    const cleanPin = formData.pincode.replace(/\D/g, '');
    if (!/^\d{6}$/.test(cleanPin)) {
      setError('Please enter a valid 6-digit postal PIN code.');
      return;
    }

    // GSTIN Validation (if registered)
    const cleanGst = formData.gstin.trim().toUpperCase();
    if (formData.gstStatus === 'registered') {
      if (!cleanGst) {
        setError('Please provide your 15-character GSTIN number, or select "Not Registered / Composition".');
        return;
      }
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGst)) {
        setError('Please enter a valid 15-character Indian GSTIN format (e.g. 33AAAAA0000A1Z5).');
        return;
      }
    }

    // FSSAI Validation (if registered)
    const cleanFssai = formData.fssaiNumber.trim();
    if (formData.fssaiStatus === 'registered') {
      if (!cleanFssai) {
        setError('Please provide your 14-digit FSSAI license / registration number.');
        return;
      }
      if (!/^\d{14}$/.test(cleanFssai)) {
        setError('FSSAI license number must be exactly 14 digits.');
        return;
      }
    }

    // Bank Account Number Match Validation (if entered)
    const cleanAcc = formData.bankAccountNumber.trim();
    const cleanConfirmAcc = formData.confirmBankAccountNumber.trim();
    if (cleanAcc || cleanConfirmAcc) {
      if (cleanAcc !== cleanConfirmAcc) {
        setError('Bank Account Number and Confirmation do not match.');
        return;
      }
    }

    // IFSC Validation (if entered)
    const cleanIfsc = formData.bankIfsc.trim().toUpperCase();
    if (cleanIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      setError('Please enter a valid 11-character Indian IFSC code (e.g. SBIN0001234).');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: formData.businessName.trim(),
        email: cleanEmail,
        password: formData.password,
        phone: cleanPhone,
        businessName: formData.businessName.trim(),
        businessType: formData.businessType,
        ownerName: formData.ownerName.trim(),
        registeredName: (formData.registeredName.trim() || formData.businessName.trim()),
        address: formData.address.trim(),
        city: formData.city.trim(),
        district: formData.district.trim(),
        state: formData.state,
        pincode: cleanPin,
        country: formData.country || 'India',
        bio: formData.bio.trim() || null,
        gstStatus: formData.gstStatus,
        gstin: formData.gstStatus === 'registered' ? cleanGst : null,
        fssaiStatus: formData.fssaiStatus,
        fssaiNumber: formData.fssaiStatus === 'registered' ? cleanFssai : null,
        bankAccountHolder: formData.bankAccountHolder.trim() || null,
        bankName: formData.bankName.trim() || null,
        bankAccountNumber: cleanAcc || null,
        bankIfsc: cleanIfsc || null
      };

      const res = await api.registerVendor(payload);

      if (res?.success && res.vendor) {
        addVendor(res.vendor);
        setSuccess(true);
      } else {
        setError(res?.error || 'Registration failed. Please check the entered details and try again.');
      }
    } catch (err) {
      setError(err?.message || 'Registration failed. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="vendor-reg-container">
        <div className="vendor-reg-card" style={{ maxWidth: 680, textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={40} />
          </div>
          <h2 style={{ color: '#07322a', fontSize: '1.65rem', marginBottom: 12 }}>Seller Application Submitted!</h2>
          <p style={{ color: '#475569', fontSize: '0.96rem', lineHeight: 1.6, marginBottom: 24 }}>
            Thank you for registering <strong>{formData.businessName}</strong> with EcShopping.
            Your personal details, farm location, tax status, and settlement configuration are now under administrator review for verification.
          </p>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px', textAlign: 'left', marginBottom: 28, fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#0e5c4a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={18} /> Official Verification Process:
            </div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Our administration team verifies your farm operating address, contact credentials, and regulatory filings.</li>
              <li>Once verified, your account status will transition from <strong>Pending Approval</strong> to <strong>Approved</strong>.</li>
              <li>You can log in to your Seller Dashboard immediately once approved to list products, upload video reels, and manage customer orders.</li>
            </ul>
          </div>
          <button
            type="button"
            className="vendor-submit-btn"
            style={{ maxWidth: 280, margin: '0 auto' }}
            onClick={() => navigate('/vendor')}
          >
            Go to Seller Sign In <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vendor-reg-container">
      <div className="vendor-reg-card">
        {/* Header */}
        <div className="vendor-reg-header">
          <div className="vendor-reg-badge">
            <Store size={14} /> EcShopping Seller Partner
          </div>
          <h1 className="vendor-reg-title">Seller & Business Registration</h1>
          <p className="vendor-reg-subtitle">
            Join Tamil Nadu’s trusted farm-to-door organic marketplace. Provide your personal details and complete business profile for verification and approval by our administration team.
          </p>
        </div>

        {/* Form Body */}
        <div className="vendor-reg-body">
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 8, marginBottom: 24, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Section 1: Personal Details & Account Credentials */}
            <div className="vendor-reg-section">
              <div className="vendor-section-header">
                <div className="vendor-section-icon"><User size={18} /></div>
                <div>
                  <h2 className="vendor-section-title">Personal Details & Login Credentials</h2>
                  <p className="vendor-section-desc">Primary account contact and credentials for logging in to the Seller Portal.</p>
                </div>
              </div>

              <div className="vendor-form-grid">
                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>Owner / Contact Person Name <span className="vendor-required">*</span></span>
                  </label>
                  <input
                    type="text"
                    name="ownerName"
                    className="vendor-input"
                    placeholder="Full name of producer or business owner"
                    value={formData.ownerName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>Contact Mobile Number <span className="vendor-required">*</span></span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    className="vendor-input"
                    placeholder="10-digit Indian mobile number"
                    maxLength={10}
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>Email Address (Login Username) <span className="vendor-required">*</span></span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    className="vendor-input"
                    placeholder="seller@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>Account Password <span className="vendor-required">*</span></span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Min 8 characters</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      className="vendor-input"
                      placeholder="Create secure password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                    />
                    <button
                      type="button"
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="vendor-form-group col-span-2">
                  <label className="vendor-label">
                    <span>Confirm Password <span className="vendor-required">*</span></span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      className="vendor-input"
                      placeholder="Re-enter password to confirm"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                    />
                    <button
                      type="button"
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label="Toggle confirm password visibility"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Complete Business Profile */}
            <div className="vendor-reg-section">
              <div className="vendor-section-header">
                <div className="vendor-section-icon"><Building2 size={18} /></div>
                <div>
                  <h2 className="vendor-section-title">Business & Farm Profile</h2>
                  <p className="vendor-section-desc">Store identity and enterprise categorization displayed on the EcShopping storefront.</p>
                </div>
              </div>

              <div className="vendor-form-grid">
                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>Shop / Farm / Brand Name <span className="vendor-required">*</span></span>
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    className="vendor-input"
                    placeholder="e.g. Ramesh Organic Farms"
                    value={formData.businessName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>Producer / Business Type <span className="vendor-required">*</span></span>
                  </label>
                  <select
                    name="businessType"
                    className="vendor-select"
                    value={formData.businessType}
                    onChange={handleChange}
                    required
                  >
                    {BUSINESS_TYPES.map((bt) => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </select>
                </div>

                <div className="vendor-form-group col-span-2">
                  <label className="vendor-label">
                    <span>Registered Business Legal Name</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>If registered differently from trade name (Optional)</span>
                  </label>
                  <input
                    type="text"
                    name="registeredName"
                    className="vendor-input"
                    placeholder="e.g. Ramesh Agro Producers Private Limited"
                    value={formData.registeredName}
                    onChange={handleChange}
                  />
                </div>

                <div className="vendor-form-group col-span-2">
                  <label className="vendor-label">
                    <span>Store Bio & Specialty Produce</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Optional</span>
                  </label>
                  <textarea
                    name="bio"
                    className="vendor-textarea"
                    placeholder="Brief description of your farm produce, heritage crops, cold-pressed oils, or artisanal goods"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Farm & Operating Physical Address */}
            <div className="vendor-reg-section">
              <div className="vendor-section-header">
                <div className="vendor-section-icon"><MapPin size={18} /></div>
                <div>
                  <h2 className="vendor-section-title">Farm & Operating Physical Address</h2>
                  <p className="vendor-section-desc">Physical location where produce is harvested, processed, or packed (strictly required for admin approval).</p>
                </div>
              </div>

              <div className="vendor-form-grid">
                <div className="vendor-form-group col-span-2">
                  <label className="vendor-label">
                    <span>Operating Street Address / Door No. / Village <span className="vendor-required">*</span></span>
                  </label>
                  <textarea
                    name="address"
                    className="vendor-textarea"
                    placeholder="Building name, door number, street, plot number or village name"
                    value={formData.address}
                    onChange={handleChange}
                    required
                    rows={2}
                  />
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>City / Town <span className="vendor-required">*</span></span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    className="vendor-input"
                    placeholder="e.g. Sathyamangalam"
                    value={formData.city}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>District <span className="vendor-required">*</span></span>
                  </label>
                  <input
                    type="text"
                    name="district"
                    className="vendor-input"
                    placeholder="e.g. Erode District"
                    value={formData.district}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>State <span className="vendor-required">*</span></span>
                  </label>
                  <select
                    name="state"
                    className="vendor-select"
                    value={formData.state}
                    onChange={handleChange}
                    required
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>PIN Code <span className="vendor-required">*</span></span>
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    className="vendor-input"
                    placeholder="6-digit PIN code"
                    maxLength={6}
                    value={formData.pincode}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Tax & Regulatory Compliance */}
            <div className="vendor-reg-section">
              <div className="vendor-section-header">
                <div className="vendor-section-icon"><FileCheck size={18} /></div>
                <div>
                  <h2 className="vendor-section-title">Tax & Regulatory Compliance</h2>
                  <p className="vendor-section-desc">Goods & Services Tax (GST) and Food Safety (FSSAI) compliance details.</p>
                </div>
              </div>

              <div className="vendor-form-grid">
                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>GST Registration Status</span>
                  </label>
                  <select
                    name="gstStatus"
                    className="vendor-select"
                    value={formData.gstStatus}
                    onChange={handleChange}
                  >
                    <option value="not_registered">Not Registered / Composition Scheme</option>
                    <option value="registered">Registered (Regular GSTIN)</option>
                    <option value="exempt">Exempt (Raw Agricultural Produce)</option>
                  </select>
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>GSTIN Number {formData.gstStatus === 'registered' && <span className="vendor-required">*</span>}</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>15 characters</span>
                  </label>
                  <input
                    type="text"
                    name="gstin"
                    className="vendor-input"
                    placeholder="33AAAAA0000A1Z5"
                    maxLength={15}
                    value={formData.gstin}
                    onChange={handleChange}
                    disabled={formData.gstStatus !== 'registered'}
                  />
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>FSSAI License / Registration Status</span>
                  </label>
                  <select
                    name="fssaiStatus"
                    className="vendor-select"
                    value={formData.fssaiStatus}
                    onChange={handleChange}
                  >
                    <option value="not_applicable">Not Applicable / Direct Farm Produce</option>
                    <option value="registered">Licensed / Registered</option>
                    <option value="applied">Application In Progress</option>
                  </select>
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>FSSAI License / Registration Number {formData.fssaiStatus === 'registered' && <span className="vendor-required">*</span>}</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>14 digits</span>
                  </label>
                  <input
                    type="text"
                    name="fssaiNumber"
                    className="vendor-input"
                    placeholder="14-digit FSSAI Number"
                    maxLength={14}
                    value={formData.fssaiNumber}
                    onChange={handleChange}
                    disabled={formData.fssaiStatus !== 'registered'}
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Bank & Settlement Details */}
            <div className="vendor-reg-section">
              <div className="vendor-section-header">
                <div className="vendor-section-icon"><Landmark size={18} /></div>
                <div>
                  <h2 className="vendor-section-title">Bank & Settlement Details</h2>
                  <p className="vendor-section-desc">Payout account information for weekly/bi-weekly seller settlements.</p>
                </div>
              </div>

              <div className="vendor-form-grid">
                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>Bank Account Holder Name</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>As on bank passbook</span>
                  </label>
                  <input
                    type="text"
                    name="bankAccountHolder"
                    className="vendor-input"
                    placeholder="Account holder's official name"
                    value={formData.bankAccountHolder}
                    onChange={handleChange}
                  />
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>Bank Name</span>
                  </label>
                  <input
                    type="text"
                    name="bankName"
                    className="vendor-input"
                    placeholder="e.g. State Bank of India, Canara Bank"
                    value={formData.bankName}
                    onChange={handleChange}
                  />
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>Bank Account Number</span>
                  </label>
                  <input
                    type="password"
                    name="bankAccountNumber"
                    className="vendor-input"
                    placeholder="Enter account number"
                    value={formData.bankAccountNumber}
                    onChange={handleChange}
                  />
                </div>

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>Confirm Bank Account Number</span>
                  </label>
                  <input
                    type="text"
                    name="confirmBankAccountNumber"
                    className="vendor-input"
                    placeholder="Re-enter account number"
                    value={formData.confirmBankAccountNumber}
                    onChange={handleChange}
                  />
                </div>

                <div className="vendor-form-group col-span-2">
                  <label className="vendor-label">
                    <span>Bank IFSC Code</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>11 alphanumeric characters</span>
                  </label>
                  <input
                    type="text"
                    name="bankIfsc"
                    className="vendor-input"
                    placeholder="e.g. SBIN0001234"
                    maxLength={11}
                    value={formData.bankIfsc}
                    onChange={handleChange}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
              </div>
            </div>

            {/* Informative Guidance Banner */}
            <div className="vendor-notice-box" style={{ marginBottom: 28 }}>
              <Info size={20} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Administrator Review Notice:</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                  Submitting this application registers your business with EcShopping in <strong>Pending Review</strong> status. Our administrator will inspect your operating location and credentials before enabling your store to receive customer orders.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="vendor-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" /> Submitting Complete Registration...
                </>
              ) : (
                <>
                  Submit Seller Registration <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Footer Back Link */}
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: '0.88rem', color: '#64748b' }}>
            Already registered as a seller?{' '}
            <Link to="/vendor" style={{ color: '#0e5c4a', fontWeight: 600, textDecoration: 'none' }}>
              Sign In to Seller Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
