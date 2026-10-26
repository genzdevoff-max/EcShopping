import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn, ShieldCheck, Mail, Lock, ArrowLeft } from 'lucide-react';
import api, { authSessions } from '../../utils/api';
import { saveAdminSession } from '../../utils/storage';
import './AdminLogin.css';

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.adminLogin(email.trim(), password);
      if (data?.success && data?.user?.role === 'admin' && data?.token) {
        // Session token goes through api.js global state; the cached admin
        // profile lets a page refresh restore the dashboard without a second login.
        authSessions.set('admin', data.token);
        saveAdminSession(data.user, data.token);
        setError('');
        onLogin(data.user);
        return;
      }
      setError('Invalid email or password');
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setError('Please enter a valid admin email address.');
      return;
    }
    setForgotLoading(true);
    try {
      const data = await api.forgotPassword(forgotEmail.trim(), 'admin');
      setSuccessMsg(data?.message || 'If an account exists with that email, a password reset link has been sent.');
    } catch (err) {
      setError(err.message || 'Unable to request password reset. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        {/* Admin security identity badge */}
        <div className="admin-badge-wrap">
          <span className="admin-security-badge">
            <ShieldCheck size={15} aria-hidden="true" />
            Administrative Portal
          </span>
        </div>

        <div className="admin-login-header">
          <h2>{isForgot ? 'Reset Admin Password' : 'Admin Login'}</h2>
          <p>
            {isForgot
              ? 'Enter your registered administrator email to receive a password reset link'
              : 'Restricted access for authorized store administrators'}
          </p>
        </div>

        {error && (
          <div className="admin-error-message" role="alert">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="auth-alert auth-alert-success" role="status" style={{ marginBottom: 20 }}>
            {successMsg}
          </div>
        )}

        {isForgot ? (
          <form onSubmit={handleForgotSubmit} className="admin-login-form" noValidate>
            <div className="form-group">
              <label htmlFor="admin-forgot-email">Administrator Email</label>
              <div className="admin-input-wrap">
                <Mail size={17} className="admin-input-icon" aria-hidden="true" />
                <input
                  type="email"
                  id="admin-forgot-email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="admin@ecshopping.local"
                  required
                  disabled={forgotLoading}
                />
              </div>
            </div>

            <button type="submit" className="admin-login-btn" disabled={forgotLoading}>
              <LogIn size={16} aria-hidden="true" />
              <span>{forgotLoading ? 'Sending link…' : 'Send Reset Link'}</span>
            </button>

            <button
              type="button"
              className="btn btn-outline"
              style={{ width: '100%', borderRadius: 999 }}
              onClick={() => {
                setIsForgot(false);
                setError('');
                setSuccessMsg('');
              }}
            >
              Back to Admin Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="admin-login-form" noValidate>
            <div className="form-group">
              <label htmlFor="admin-email">Email Address</label>
              <div className="admin-input-wrap">
                <Mail size={17} className="admin-input-icon" aria-hidden="true" />
                <input
                  type="email"
                  id="admin-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ecshopping.local"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="admin-password" style={{ margin: 0 }}>Password</label>
                <button
                  type="button"
                  className="btn-link"
                  style={{ fontSize: '0.8rem', padding: 0 }}
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
              <div className="admin-input-wrap">
                <Lock size={17} className="admin-input-icon" aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="admin-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button type="submit" className="admin-login-btn" disabled={loading}>
              <LogIn size={16} aria-hidden="true" />
              <span>{loading ? 'Signing in…' : 'Login to Dashboard'}</span>
            </button>
          </form>
        )}

        <div className="admin-footer-links">
          <Link to="/" className="admin-return-link">
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Return to storefront</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
