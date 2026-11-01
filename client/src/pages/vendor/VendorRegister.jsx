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

  // Streamlined Form State
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'Individual Farmer / Producer',
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    address: '',
    city: '',
    district: '',
    state: 'Tamil Nadu',
    pincode: '',
    country: 'India',
    bio: ''
  });

  const [showPassword, setShowPassword] = useState(false);
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

    // Field Validations
    if (!formData.businessName.trim() || !formData.ownerName.trim()) {
      setError('Please provide your Business / Farm Name and Owner Name.');
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

    if (!formData.address.trim() || !formData.city.trim() || !formData.district.trim()) {
      setError('Please provide your farm / operating address so the administrator can verify and approve your store.');
      return;
    }

    const cleanPin = formData.pincode.replace(/\D/g, '');
    if (!/^\d{6}$/.test(cleanPin)) {
      setError('Please enter a valid 6-digit postal PIN code.');
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
        registeredName: formData.businessName.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        district: formData.district.trim(),
        state: formData.state,
        pincode: cleanPin,
        country: formData.country || 'India',
        bio: formData.bio.trim() || null
      };

      const res = await api.registerVendor(payload);

      if (res?.success && res.vendor) {
        addVendor(res.vendor);
        setSuccess(true);
      } else {
        setError(res?.error || 'Registration failed. Please try again.');
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
        <div className="vendor-reg-card" style={{ maxWidth: 640, textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={36} />
          </div>
          <h2 style={{ color: '#07322a', fontSize: '1.6rem', marginBottom: 12 }}>Seller Application Submitted!</h2>
          <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 24 }}>
            Thank you for registering <strong>{formData.businessName}</strong> with EcShopping.
            Your farm location and seller profile are now with our administrator team for verification and approval.
          </p>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '18px', textAlign: 'left', marginBottom: 28, fontSize: '0.88rem', color: '#334155', lineHeight: 1.55 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#0e5c4a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={18} /> What happens next:
            </div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Our administration team reviews your farm address and contact details.</li>
              <li>You will receive approval notification once your store is activated.</li>
              <li><strong>Licenses & Settlements</strong>: GSTIN, FSSAI certificates, and bank account for payouts can be submitted directly in your Seller Dashboard profile section anytime.</li>
            </ul>
          </div>
          <button
            type="button"
            className="vendor-submit-btn"
            style={{ maxWidth: 280, margin: '0 auto' }}
            onClick={() => navigate('/vendor')}
          >
            Go to Seller Portal <ArrowRight size={16} />
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
          <h1 className="vendor-reg-title">Seller & Producer Registration</h1>
          <p className="vendor-reg-subtitle">
            Join Tamil Nadu’s leading farm-to-door organic marketplace. Provide your store details and operating address so our administrator can verify and approve your seller account.
          </p>
        </div>

        {/* Form Body */}
        <div className="vendor-reg-body">
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 8, marginBottom: 24, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Store & Contact Details */}
            <div className="vendor-reg-section">
              <div className="vendor-section-header">
                <div className="vendor-section-icon"><Store size={18} /></div>
                <div>
                  <h2 className="vendor-section-title">Store & Contact Details</h2>
                  <p className="vendor-section-desc">Public storefront business name and account credentials.</p>
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

                <div className="vendor-form-group">
                  <label className="vendor-label">
                    <span>Owner / Contact Person <span className="vendor-required">*</span></span>
                  </label>
                  <input
                    type="text"
                    name="ownerName"
                    className="vendor-input"
                    placeholder="Full name of the seller / owner"
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
                    placeholder="10-digit mobile number"
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
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Farm & Operating Address (Required for Admin Approval) */}
            <div className="vendor-reg-section">
              <div className="vendor-section-header">
                <div className="vendor-section-icon"><MapPin size={18} /></div>
                <div>
                  <h2 className="vendor-section-title">Farm & Operating Address</h2>
                  <p className="vendor-section-desc">Physical address where your produce is harvested or packed (required for administrator approval).</p>
                </div>
              </div>

              <div className="vendor-form-grid">
                <div className="vendor-form-group col-span-2">
                  <label className="vendor-label">
                    <span>Farm / Operating Address <span className="vendor-required">*</span></span>
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

                <div className="vendor-form-group col-span-2">
                  <label className="vendor-label">
                    <span>Store Bio / Specialty Produce</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Optional</span>
                  </label>
                  <textarea
                    name="bio"
                    className="vendor-textarea"
                    placeholder="Brief description of your farm produce, crops, or artisanal specialties"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Informative Guidance Banner */}
            <div className="vendor-notice-box" style={{ marginBottom: 28 }}>
              <Info size={20} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Licenses, Certificates & Bank Settlement Details:</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#1e3a8a' }}>
                  To keep initial registration quick and simple, your GSTIN, FSSAI food license, certificates, and bank account for payouts can be filled and updated directly inside your <strong>Seller Dashboard Profile</strong> section after account creation.
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
                  <Loader2 size={18} className="spin" /> Submitting Application...
                </>
              ) : (
                <>
                  Submit Seller Application <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Footer Back Link */}
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: '0.88rem', color: '#64748b' }}>
            Already have a seller account?{' '}
            <Link to="/vendor" style={{ color: '#0e5c4a', fontWeight: 600, textDecoration: 'none' }}>
              Sign In to Seller Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
