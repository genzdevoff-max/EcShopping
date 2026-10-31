import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  X,
  User,
  Store,
  ShieldCheck,
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  Sparkles
} from 'lucide-react';
import brandLogo from '../../assets/logo/without-bg-logo.png';
import api, { authSessions } from '../../utils/api';
import {
  saveCustomerSession,
  addCustomer,
  saveVendorSession,
  addVendor,
  saveAdminSession
} from '../../utils/storage';
import './UnifiedAuthModal.css';

export default function UnifiedAuthModal({
  open = true,
  onClose,
  initialRole = 'customer', // 'customer' | 'vendor' | 'admin'
  initialMode = 'login', // 'login' | 'signup' | 'forgot'
  onCustomerLogin,
  onVendorLogin,
  onAdminLogin,
  isPage = false, // When rendered directly on a route like /login, /register, /vendor
  restrictToAdmin = false // For /admin route
}) {
  const navigate = useNavigate();
  const dialogRef = useRef(null);

  // Active Role: 'customer' | 'vendor' | 'admin'
  const [role, setRole] = useState(restrictToAdmin ? 'admin' : initialRole);

  // Active Sub-Mode: 'login' | 'signup' | 'forgot'
  const [mode, setMode] = useState(initialMode);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [vendorPendingNotice, setVendorPendingNotice] = useState(false);

  // Synchronize initial props if they change
  useEffect(() => {
    if (restrictToAdmin) {
      setRole('admin');
    } else if (initialRole) {
      setRole(initialRole);
    }
  }, [initialRole, restrictToAdmin]);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const firstInput = dialogRef.current?.querySelector('input');
      firstInput?.focus();
    }, 80);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  if (!open) return null;

  const handleDismiss = () => {
    if (onClose) {
      onClose();
    } else if (isPage) {
      navigate('/', { replace: true });
    }
  };

  const handleRoleChange = (newRole) => {
    if (restrictToAdmin && newRole !== 'admin') return;
    setRole(newRole);
    setError('');
    setSuccessMsg('');
    setVendorPendingNotice(false);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccessMsg('');
    setVendorPendingNotice(false);
  };

  // ---------------- Form Submissions ----------------
  const handleCustomerLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const data = await api.userLogin(email.trim(), password);
      if (data?.success && data.user && data.token) {
        saveCustomerSession(data.user, data.token);
        addCustomer(data.user);
        onCustomerLogin?.(data.user);
        setSuccessMsg('Welcome back! Login successful.');
        setTimeout(() => {
          handleDismiss();
          if (isPage) navigate('/profile');
        }, 500);
      } else {
        setError(data?.error || 'Invalid email or password.');
      }
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSignUpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.userRegister({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim()
      });

      if (data?.success && data.user && data.token) {
        saveCustomerSession(data.user, data.token);
        addCustomer(data.user);
        onCustomerLogin?.(data.user);
        setSuccessMsg('Account created successfully! Welcome to EcShopping.');
        setTimeout(() => {
          handleDismiss();
          if (isPage) navigate('/profile');
        }, 600);
      } else {
        setError(data?.error || 'Could not create account. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Could not create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVendorLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setVendorPendingNotice(false);
    setLoading(true);

    try {
      const data = await api.loginVendor(email.trim(), password);
      if (data?.success && data.vendor && data.token) {
        setSuccessMsg('Login successful! Opening Vendor Portal...');
        saveVendorSession(data.vendor, data.token);
        setTimeout(() => {
          onVendorLogin?.(data.vendor, data.token);
          handleDismiss();
          navigate('/vendor');
        }, 500);
        return;
      }
      setError('Invalid email or password');
    } catch (err) {
      const msg = err.message || 'Invalid email or password';
      if (msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('approval')) {
        setVendorPendingNotice(true);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVendorRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.registerVendor({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim()
      });

      if (data?.success && data.vendor) {
        addVendor(data.vendor);
        if (data.vendor.status === 'pending') {
          setVendorPendingNotice(true);
          setMode('login');
          setSuccessMsg('Application submitted! Your seller account is awaiting administrator review.');
          return;
        }
        setSuccessMsg('Seller account registered! Opening Vendor Portal...');
        setTimeout(() => {
          onVendorLogin?.(data.vendor);
          handleDismiss();
          navigate('/vendor');
        }, 600);
        return;
      }
      setError(data?.error || 'Could not register seller account.');
    } catch (err) {
      setError(err.message || 'Could not complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const data = await api.adminLogin(email.trim(), password);
      if (data?.success && data?.user?.role === 'admin' && data?.token) {
        authSessions.set('admin', data.token);
        saveAdminSession(data.user, data.token);
        setSuccessMsg('Administrator authenticated! Entering Dashboard...');
        setTimeout(() => {
          onAdminLogin?.(data.user);
          handleDismiss();
          navigate('/admin');
        }, 400);
        return;
      }
      setError('Invalid administrator email or password.');
    } catch (err) {
      setError(err.message || 'Unable to sign in as administrator. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid registered email address.');
      return;
    }

    setLoading(true);
    try {
      const rolePayload = role === 'admin' ? 'admin' : role === 'vendor' ? 'vendor' : 'customer';
      const data = await api.forgotPassword(email.trim(), rolePayload);
      setSuccessMsg(data?.message || 'If an account exists with that email, a password reset link has been dispatched.');
    } catch (err) {
      setError(err.message || 'Unable to request password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={isPage ? 'auth-page-backdrop' : 'auth-modal-backdrop'}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div
        className="auth-modal-box"
        role="dialog"
        aria-modal="true"
        aria-label="EcShopping Authentication"
        ref={dialogRef}
      >
        {/* Header: Logo + Close */}
        <header className="auth-modal-header">
          <Link to="/" className="auth-modal-brand-link" onClick={handleDismiss} aria-label="EcShopping Home">
            <img src={brandLogo} alt="EcShopping" className="auth-modal-brand-img" />
          </Link>
          <button
            type="button"
            className="auth-modal-close-btn"
            onClick={handleDismiss}
            aria-label="Close authentication dialog"
          >
            <X size={18} />
          </button>
        </header>

        {/* Role Switcher: Customer vs Seller / Vendor OR Administrator Access */}
        {role === 'admin' || restrictToAdmin ? (
          <div className="auth-admin-restricted-banner">
            <span className="admin-security-badge">
              <ShieldCheck size={16} />
              Administrative Portal
            </span>
            <span className="admin-lock-pill">Authorized Personnel Only</span>
          </div>
        ) : (
          <div className="auth-role-tabs" role="tablist" aria-label="Select account role">
            <button
              type="button"
              role="tab"
              aria-selected={role === 'customer'}
              className={`auth-role-tab ${role === 'customer' ? 'active' : ''}`}
              onClick={() => handleRoleChange('customer')}
            >
              <User size={16} className="role-icon" />
              <span>Customer</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === 'vendor'}
              className={`auth-role-tab ${role === 'vendor' ? 'active' : ''}`}
              onClick={() => handleRoleChange('vendor')}
            >
              <Store size={16} className="role-icon" />
              <span>Seller / Vendor</span>
            </button>
          </div>
        )}

        {/* Sub-Mode Pills (Sign In vs Create Account) — hidden for Admin & Forgot flows */}
        {role !== 'admin' && mode !== 'forgot' && (
          <div className="auth-mode-pills" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`auth-mode-pill ${mode === 'login' ? 'active' : ''}`}
              onClick={() => handleModeChange('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={`auth-mode-pill ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => handleModeChange('signup')}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="auth-modal-scroll">
          {/* Header Copy */}
          <div className="auth-header-copy">
            <h2>
              {mode === 'forgot'
                ? 'Reset your password'
                : role === 'admin'
                ? 'Administrator Access'
                : mode === 'signup'
                ? role === 'vendor'
                  ? 'Register as Seller'
                  : 'Create Customer Account'
                : role === 'vendor'
                ? 'Vendor Portal Login'
                : 'Welcome Back'}
            </h2>
            <p>
              {mode === 'forgot'
                ? "Enter your registered email address and we'll dispatch password recovery instructions."
                : role === 'admin'
                ? 'Restricted access for verified EcShopping store managers.'
                : mode === 'signup'
                ? role === 'vendor'
                  ? 'Sell organic products, manage inventory & reach local shoppers.'
                  : 'Join EcShopping to buy farm-fresh items & track deliveries.'
                : role === 'vendor'
                ? 'Sign in to access your seller dashboard, products & customer orders.'
                : 'Sign in with your email to continue your shopping journey.'}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="auth-alert auth-alert-success" role="status">
              <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Pending Approval Notice for Vendors */}
          {vendorPendingNotice && (
            <div className="auth-vendor-status-box">
              <div className="auth-vendor-status-title">
                <Clock size={16} />
                <span>Seller Account Pending Admin Approval</span>
              </div>
              <p className="auth-vendor-status-desc">
                Your registration has been submitted and is currently in review. An administrator will review your store details shortly. You will be able to log in once approved.
              </p>
            </div>
          )}

          {/* Phase 3: Explicit Account-Type Choice Cards in Signup Mode */}
          {mode === 'signup' && role !== 'admin' && (
            <div className="auth-signup-choices" role="radiogroup" aria-label="Account category">
              <button
                type="button"
                className={`auth-choice-card ${role === 'customer' ? 'selected' : ''}`}
                onClick={() => setRole('customer')}
                role="radio"
                aria-checked={role === 'customer'}
              >
                <div className="auth-choice-icon">
                  <User size={18} />
                </div>
                <div className="auth-choice-text">
                  <strong>Option 1: Customer Account</strong>
                  <span>Shop farm-fresh produce, save addresses &amp; fast checkout</span>
                </div>
              </button>

              <button
                type="button"
                className={`auth-choice-card ${role === 'vendor' ? 'selected' : ''}`}
                onClick={() => setRole('vendor')}
                role="radio"
                aria-checked={role === 'vendor'}
              >
                <div className="auth-choice-icon vendor-icon">
                  <Store size={18} />
                </div>
                <div className="auth-choice-text">
                  <strong>Option 2: Seller / Vendor Account</strong>
                  <span>Register a business, list organic products &amp; manage orders</span>
                </div>
              </button>
            </div>
          )}

          {/* ----------------- FORGOT PASSWORD VIEW ----------------- */}
          {mode === 'forgot' ? (
            <form onSubmit={handleForgotSubmit} className="auth-unified-form" noValidate>
              <div className="auth-field-group">
                <label className="auth-field-label" htmlFor="auth-forgot-email">
                  Registered Email Address <span className="req">*</span>
                </label>
                <div className="auth-input-container">
                  <Mail size={16} className="auth-field-prefix-icon" />
                  <input
                    id="auth-forgot-email"
                    type="email"
                    className="auth-unified-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '4px 0 8px', lineHeight: 1.45 }}>
                Need manual verification? Our support desk can assist at{' '}
                <a
                  href="mailto:econnectshopping@gmail.com"
                  style={{ color: '#0e5c4a', fontWeight: 600, textDecoration: 'underline' }}
                >
                  econnectshopping@gmail.com
                </a>.
              </p>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <Loader2 size={18} className="spin" /> : <ArrowRight size={18} />}
                <span>{loading ? 'Sending Instructions...' : 'Send Reset Link'}</span>
              </button>

              <div className="auth-footer-switch">
                <span>Remembered your password?</span>
                <button
                  type="button"
                  className="auth-footer-switch-btn"
                  onClick={() => handleModeChange('login')}
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            /* ----------------- LOGIN & SIGNUP FORMS ----------------- */
            <form
              onSubmit={
                role === 'admin'
                  ? handleAdminLoginSubmit
                  : mode === 'signup'
                  ? role === 'vendor'
                    ? handleVendorRegisterSubmit
                    : handleCustomerSignUpSubmit
                  : role === 'vendor'
                  ? handleVendorLoginSubmit
                  : handleCustomerLoginSubmit
              }
              className="auth-unified-form"
              noValidate
            >
              {/* Name field (Sign Up only) */}
              {mode === 'signup' && role !== 'admin' && (
                <div className="auth-field-group">
                  <label className="auth-field-label" htmlFor="auth-name">
                    {role === 'vendor' ? 'Business or Seller Name' : 'Full Name'} <span className="req">*</span>
                  </label>
                  <div className="auth-input-container">
                    <User size={16} className="auth-field-prefix-icon" />
                    <input
                      id="auth-name"
                      type="text"
                      className="auth-unified-input"
                      placeholder={role === 'vendor' ? 'e.g. Green Valley Farms' : 'e.g. Ananya Sharma'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div className="auth-field-group">
                <label className="auth-field-label" htmlFor="auth-email">
                  {role === 'admin' ? 'Administrator Email' : role === 'vendor' ? 'Seller Email' : 'Email Address'} <span className="req">*</span>
                </label>
                <div className="auth-input-container">
                  <Mail size={16} className="auth-field-prefix-icon" />
                  <input
                    id="auth-email"
                    type="email"
                    className="auth-unified-input"
                    placeholder={role === 'admin' ? 'admin@ecshopping.in' : 'you@example.com'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Phone (Sign Up only) */}
              {mode === 'signup' && role !== 'admin' && (
                <div className="auth-field-group">
                  <label className="auth-field-label" htmlFor="auth-phone">
                    Mobile Phone Number <span className="req">*</span>
                  </label>
                  <div className="auth-input-container">
                    <Phone size={16} className="auth-field-prefix-icon" />
                    <input
                      id="auth-phone"
                      type="tel"
                      className="auth-unified-input"
                      placeholder="98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {/* Password Field */}
              <div className="auth-field-group">
                <label className="auth-field-label" htmlFor="auth-password">
                  Password <span className="req">*</span>
                </label>
                <div className="auth-input-container">
                  <Lock size={16} className="auth-field-prefix-icon" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-unified-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    className="auth-eye-toggle admin-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password (Login mode only) */}
              {mode === 'login' && (
                <div className="auth-meta-row">
                  <label className="auth-remember-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="auth-forgot-link"
                    onClick={() => handleModeChange('forgot')}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Primary Action Button */}
              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? (
                  <Loader2 size={18} className="spin" />
                ) : (
                  <ArrowRight size={18} />
                )}
                <span>
                  {loading
                    ? 'Authenticating...'
                    : role === 'admin'
                    ? 'Enter Administrator Dashboard'
                    : mode === 'signup'
                    ? role === 'vendor'
                      ? 'Submit Seller Registration'
                      : 'Create Customer Account'
                    : role === 'vendor'
                    ? 'Sign In to Vendor Portal'
                    : 'Sign In'}
                </span>
              </button>

              {/* Footer Switch Prompt */}
              {role !== 'admin' && (
                <div className="auth-footer-switch">
                  {mode === 'login' ? (
                    <>
                      <span>Don't have an account yet?</span>
                      <button
                        type="button"
                        className="auth-footer-switch-btn"
                        onClick={() => handleModeChange('signup')}
                      >
                        Sign up now
                      </button>
                    </>
                  ) : (
                    <>
                      <span>Already registered?</span>
                      <button
                        type="button"
                        className="auth-footer-switch-btn"
                        onClick={() => handleModeChange('login')}
                      >
                        Sign in instead
                      </button>
                    </>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
