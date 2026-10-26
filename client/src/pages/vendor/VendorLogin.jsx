import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, Phone, CheckCircle, ArrowRight } from 'lucide-react';
import vendorLoginImg from '../../assets/login-page/vendor-login.png';
import api from '../../utils/api';
import { addVendor, saveVendorSession } from '../../utils/storage';
import '../Login.css';

export default function VendorLogin({ onLogin, initialSignUp = false }) {
  const [isSignUp, setIsSignUp] = useState(initialSignUp);
  const navigate = useNavigate();

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Register state
  const [name, setName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  const [isForgot, setIsForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setForgotLoading(true);
    try {
      const data = await api.forgotPassword(forgotEmail.trim(), 'vendor');
      setSuccessMsg(data?.message || 'If an account exists with that email, a password reset link has been sent.');
    } catch (err) {
      setError(err.message || 'Unable to request password reset. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Handle Vendor Login (server-side bcrypt verification via TiDB)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.loginVendor(email.trim(), password);
      if (data?.success && data.vendor && data.token) {
        setSuccessMsg('Login successful! Opening Vendor Panel...');
        saveVendorSession(data.vendor, data.token);
        setTimeout(() => {
          onLogin(data.vendor, data.token);
          navigate('/vendor');
        }, 500);
        return;
      }
      setError('Invalid email or password');
    } catch (err) {
      // Server messages cover pending/rejected accounts and auth failures.
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  // Handle Vendor Register (TiDB Cloud backed — awaits admin approval)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name || !signUpEmail || !signUpPassword) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const data = await api.registerVendor({
        name: name.trim(),
        email: signUpEmail.trim(),
        password: signUpPassword,
        phone: phone.trim()
      });

      if (data?.success && data.vendor) {
        addVendor(data.vendor); // cache the new vendor locally
        setLoading(false);

        if (data.vendor.status === 'pending') {
          setIsSignUp(false);
          setSuccessMsg('Registration submitted! Your seller account is awaiting admin approval.');
          return;
        }

        setSuccessMsg('Vendor registered successfully! Opening Vendor Panel...');
        setTimeout(() => {
          onLogin(data.vendor);
          navigate('/vendor');
        }, 600);
        return;
      }
    } catch (err) {
      setError(err.message || 'Could not complete registration. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="auth-page vendor-auth-page">
      <div className="auth-card">
        {/* ---------- Left brand panel ---------- */}
        <div className="auth-brand-side">
          <div className="auth-brand-tag">
            <span className="brand-dot" />
            <span>Vendor Portal</span>
          </div>

          <div className="auth-visual">
            <img src={vendorLoginImg} alt="Sell on EcShopping" className="auth-side-img" />
          </div>

          <div className="auth-caption">
            <h2>Sell &amp; Grow with EcShopping</h2>
            <p>Manage your products, track customer orders, and deliver organic items directly from your farm.</p>
          </div>
        </div>

        {/* ---------- Right form panel ---------- */}
        <div className="auth-form-side">
          <div className="auth-form-box">
            <header className="auth-form-header">
              <h1>
                {isForgot
                  ? 'Reset vendor password'
                  : isSignUp
                  ? 'Become a seller'
                  : 'Vendor login'}
              </h1>
              <p>
                {isForgot
                  ? "Enter your registered vendor email and we'll send you a password reset link."
                  : isSignUp
                  ? 'Register your business to start listing and selling products on EcShopping.'
                  : 'Sign in to manage your products, storefront, and incoming customer orders.'}
              </p>
            </header>

            {error && (
              <div className="auth-alert auth-alert-error" role="alert">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="auth-alert auth-alert-success" role="status">
                {successMsg}
              </div>
            )}

            {isForgot ? (
              <form onSubmit={handleForgotSubmit} className="auth-form" noValidate>
                <div className="field">
                  <label className="field-label" htmlFor="vendor-forgot-email">
                    Registered vendor email <span className="req" aria-hidden="true">*</span>
                  </label>
                  <div className="auth-input-wrap">
                    <Mail size={17} className="auth-field-icon" aria-hidden="true" />
                    <input
                      id="vendor-forgot-email"
                      className="input auth-input"
                      type="email"
                      placeholder="vendor@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      disabled={forgotLoading}
                    />
                    {forgotEmail.includes('@') && (
                      <CheckCircle size={16} className="auth-valid-check" aria-hidden="true" />
                    )}
                  </div>
                </div>

                <div className="auth-buttons">
                  <button type="submit" className="btn btn-primary" disabled={forgotLoading}>
                    {forgotLoading ? 'Sending link…' : 'Send reset link'} <ArrowRight size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setIsForgot(false);
                      setError('');
                      setSuccessMsg('');
                    }}
                  >
                    Back to vendor login
                  </button>
                </div>
              </form>
            ) : !isSignUp ? (
              /* VENDOR LOGIN FORM */
              <form onSubmit={handleLoginSubmit} className="auth-form" noValidate>
                <div className="field">
                  <label className="field-label" htmlFor="vendor-email">
                    Email address <span className="req" aria-hidden="true">*</span>
                  </label>
                  <div className="auth-input-wrap">
                    <Mail size={17} className="auth-field-icon" aria-hidden="true" />
                    <input
                      id="vendor-email"
                      className="input auth-input"
                      type="email"
                      placeholder="vendor@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    {email.includes('@') && (
                      <CheckCircle size={16} className="auth-valid-check" aria-hidden="true" />
                    )}
                  </div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="vendor-password">
                    Password <span className="req" aria-hidden="true">*</span>
                  </label>
                  <div className="auth-input-wrap">
                    <Lock size={17} className="auth-field-icon" aria-hidden="true" />
                    <input
                      id="vendor-password"
                      className="input auth-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="auth-eye-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div className="auth-actions-row">
                  <label className="auth-remember">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      setIsForgot(true);
                      setError('');
                      setSuccessMsg('');
                      if (email) setForgotEmail(email);
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="auth-buttons">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Logging in…' : 'Login to Vendor Panel'} <ArrowRight size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => { setIsSignUp(true); setError(''); setSuccessMsg(''); }}
                  >
                    Register as Seller
                  </button>
                </div>
              </form>
            ) : (
              /* VENDOR REGISTER FORM */
              <form onSubmit={handleRegisterSubmit} className="auth-form" noValidate>
                <div className="field">
                  <label className="field-label" htmlFor="vendor-reg-name">
                    Business / farm name <span className="req" aria-hidden="true">*</span>
                  </label>
                  <div className="auth-input-wrap">
                    <User size={17} className="auth-field-icon" aria-hidden="true" />
                    <input
                      id="vendor-reg-name"
                      className="input auth-input"
                      type="text"
                      placeholder="e.g. Ramesh Farms"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="vendor-reg-email">
                    Email address <span className="req" aria-hidden="true">*</span>
                  </label>
                  <div className="auth-input-wrap">
                    <Mail size={17} className="auth-field-icon" aria-hidden="true" />
                    <input
                      id="vendor-reg-email"
                      className="input auth-input"
                      type="email"
                      placeholder="vendor@example.com"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      required
                    />
                    {signUpEmail.includes('@') && (
                      <CheckCircle size={16} className="auth-valid-check" aria-hidden="true" />
                    )}
                  </div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="vendor-reg-phone">
                    Phone number <span className="auth-optional">(optional)</span>
                  </label>
                  <div className="auth-input-wrap">
                    <Phone size={17} className="auth-field-icon" aria-hidden="true" />
                    <input
                      id="vendor-reg-phone"
                      className="input auth-input"
                      type="tel"
                      placeholder="+91 90000 00000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="vendor-reg-password">
                    Password <span className="req" aria-hidden="true">*</span>
                  </label>
                  <div className="auth-input-wrap">
                    <Lock size={17} className="auth-field-icon" aria-hidden="true" />
                    <input
                      id="vendor-reg-password"
                      className="input auth-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="auth-eye-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div className="auth-buttons">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Submitting…' : 'Register Account'} <ArrowRight size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => { setIsSignUp(false); setError(''); setSuccessMsg(''); }}
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            )}

            {/* Switch to Customer Login */}
            <div className="auth-portals">
              <span className="auth-portals-label">Are you a customer?</span>
              <Link to="/login" className="auth-portal-link">
                <User size={15} aria-hidden="true" />
                <span>Switch to Customer Login</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
