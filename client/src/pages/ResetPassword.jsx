import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import brandLogo from '../assets/logo/without-bg-logo.png';
import api from '../utils/api';
import './ResetPassword.css';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const role = searchParams.get('role') || 'customer';

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [accountEmail, setAccountEmail] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const minLength = role === 'admin' ? 12 : 8;

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setTokenError('Missing password reset token in the link.');
      return;
    }

    let isMounted = true;
    api.verifyResetToken(token, role)
      .then((data) => {
        if (!isMounted) return;
        if (data?.valid) {
          setTokenValid(true);
          setAccountEmail(data.email || '');
          if (data.role) {
            setRole(data.role);
          }
        } else {
          setTokenValid(false);
          setTokenError(data?.error || 'Invalid or expired password reset link.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setTokenValid(false);
        setTokenError(err.message || 'Invalid or expired password reset link.');
      })
      .finally(() => {
        if (isMounted) setVerifying(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, role]);

  const getLoginRoute = () => {
    if (role === 'admin') return '/admin';
    if (role === 'vendor') return '/vendor';
    return '/login';
  };

  const getRoleLabel = () => {
    if (role === 'admin') return 'Store Administrator';
    if (role === 'vendor') return 'Vendor Partner';
    return 'Customer';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!newPassword || !confirmPassword) {
      setFormError('Please fill in both password fields.');
      return;
    }

    if (newPassword.length < minLength) {
      setFormError(`Password must be at least ${minLength} characters long.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match. Please retype carefully.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await api.resetPassword(token, role, newPassword);
      if (data?.success) {
        setResetSuccess(true);
      } else {
        setFormError(data?.error || 'Unable to reset password. Please try again.');
      }
    } catch (err) {
      setFormError(err.message || 'Unable to reset password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reset-password-page">
      <div className="reset-password-card">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src={brandLogo} alt="EcShopping" style={{ height: 34, width: 'auto', objectFit: 'contain' }} />
        </div>
        <div className="reset-badge-wrap">
          <span className="reset-security-badge">
            <ShieldCheck size={16} aria-hidden="true" />
            EcShopping Security
          </span>
        </div>

        <header className="reset-password-header">
          <h1>Reset Your Password</h1>
          <p>
            {getRoleLabel()} Account Security
          </p>
        </header>

        {verifying ? (
          <div className="reset-state-box">
            <div className="reset-spinner" aria-hidden="true" />
            <p>Verifying your password reset link…</p>
          </div>
        ) : !tokenValid ? (
          <div className="reset-state-box reset-invalid-box">
            <div className="reset-error-icon" aria-hidden="true">
              <AlertTriangle size={36} />
            </div>
            <h2>Reset Link Invalid or Expired</h2>
            <p>{tokenError || 'This password reset link is invalid or has already been used.'}</p>
            <Link to={getLoginRoute()} className="btn btn-primary reset-action-btn">
              Request a New Reset Link
            </Link>
          </div>
        ) : resetSuccess ? (
          <div className="reset-state-box reset-success-box">
            <div className="reset-success-icon" aria-hidden="true">
              <CheckCircle size={40} />
            </div>
            <h2>Password Reset Complete</h2>
            <p>Your password has been updated successfully. You can now log in with your new credentials.</p>
            <button
              type="button"
              className="btn btn-primary reset-action-btn"
              onClick={() => navigate(getLoginRoute())}
            >
              Go to Login <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="reset-password-form" noValidate>
            {accountEmail && (
              <div className="reset-account-info">
                <span>Account:</span> <strong>{accountEmail}</strong> ({role})
              </div>
            )}

            {formError && (
              <div className="auth-alert auth-alert-error" role="alert">
                {formError}
              </div>
            )}

            <div className="field">
              <label className="field-label" htmlFor="new-password">
                New Password <span className="req" aria-hidden="true">*</span>
              </label>
              <div className="auth-input-wrap">
                <Lock size={17} className="auth-field-icon" aria-hidden="true" />
                <input
                  id="new-password"
                  className="input auth-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={`At least ${minLength} characters`}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
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
              <span className="field-hint">
                Minimum {minLength} characters.
              </span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="confirm-password">
                Confirm New Password <span className="req" aria-hidden="true">*</span>
              </label>
              <div className="auth-input-wrap">
                <Lock size={17} className="auth-field-icon" aria-hidden="true" />
                <input
                  id="confirm-password"
                  className="input auth-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-eye-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="auth-buttons">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Updating password…' : 'Update Password'}{' '}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <Link to={getLoginRoute()} className="btn btn-outline">
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
