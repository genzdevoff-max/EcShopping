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
  const [error, setError] = useState('');
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
          <h2>Admin Login</h2>
          <p>Restricted access for authorized store administrators</p>
        </div>

        {error && (
          <div className="admin-error-message" role="alert">
            {error}
          </div>
        )}

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
            <label htmlFor="admin-password">Password</label>
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
