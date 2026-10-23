import React, { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
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
        // profile lets a page refresh restore the dashboard without a
        // second login.
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
        <div className="admin-login-header">
          <h2>Admin Login</h2>
          <p>Sign in to manage your store</p>
        </div>

        {error && <div className="admin-error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-group">
            <label htmlFor="admin-email">Email Address</label>
            <input
              type="email"
              id="admin-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@yourdomain.com"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-password">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="admin-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="admin-login-btn" disabled={loading}>
            <LogIn size={16} />
            {loading ? 'Signing in…' : 'Login to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
