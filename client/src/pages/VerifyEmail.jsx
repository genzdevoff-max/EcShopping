import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Mail, CheckCircle, AlertTriangle, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import brandLogo from '../assets/logo/without-bg-logo.png';
import api from '../utils/api';
import './VerifyEmail.css';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const role = searchParams.get('role') || 'customer';

  const [verifying, setVerifying] = useState(Boolean(token));
  const [verified, setVerified] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');
  const [verifyError, setVerifyError] = useState('');

  // Resend form state
  const [resendEmail, setResendEmail] = useState('');
  const [resendRole, setResendRole] = useState(role || 'customer');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    api.verifyEmail(token, role)
      .then((data) => {
        if (!isMounted) return;
        if (data?.success) {
          setVerified(true);
          setVerifyMessage(data.message || 'Your email address has been successfully verified.');
        } else {
          setVerified(false);
          setVerifyError(data?.error || 'Verification link is invalid or expired.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setVerified(false);
        setVerifyError(err.message || 'Verification link is invalid or expired.');
      })
      .finally(() => {
        if (isMounted) setVerifying(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, role]);

  const handleResendSubmit = async (e) => {
    e.preventDefault();
    setResendError('');
    setResendSuccess('');

    if (!resendEmail || !resendEmail.includes('@')) {
      setResendError('Please enter a valid email address.');
      return;
    }

    setResendLoading(true);
    try {
      const data = await api.resendVerification(resendEmail.trim(), resendRole);
      setResendSuccess(data?.message || 'A verification link has been sent to your email.');
    } catch (err) {
      setResendError(err.message || 'Failed to resend verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="verify-email-page">
      <div className="verify-email-card">
        <header className="verify-email-header">
          <Link to="/" className="verify-email-logo-link" aria-label="EcShopping Home">
            <img src={brandLogo} alt="EcShopping" className="verify-email-logo" />
          </Link>
          <h1>Email Verification</h1>
          <p>
            {verifying
              ? 'Verifying your account email...'
              : verified
              ? 'Your email address has been verified!'
              : 'Secure your EcShopping account'}
          </p>
        </header>

        {verifying && (
          <div className="verify-email-state verifying">
            <Loader2 size={36} className="spin" style={{ color: '#0e5c4a', margin: '16px auto' }} />
            <p>Please wait while we verify your security token...</p>
          </div>
        )}

        {!verifying && verified && (
          <div className="verify-email-state success">
            <div className="verify-email-icon-box success">
              <CheckCircle size={44} />
            </div>
            <h2>Verification Complete</h2>
            <p className="verify-email-msg">{verifyMessage}</p>
            <div className="verify-email-actions">
              <button
                type="button"
                className="verify-email-btn primary"
                onClick={() => navigate('/login')}
              >
                Continue to Login <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {!verifying && !verified && (
          <div className="verify-email-state error">
            {token && (
              <div className="verify-email-alert error">
                <AlertTriangle size={20} />
                <div>
                  <strong>Verification Failed</strong>
                  <p>{verifyError || 'This verification link is invalid, expired, or has already been used.'}</p>
                </div>
              </div>
            )}

            <div className="resend-verification-box">
              <div className="resend-header">
                <Mail size={20} className="resend-icon" />
                <div>
                  <h3>Resend Verification Link</h3>
                  <p>Enter your registered email address to receive a fresh verification link.</p>
                </div>
              </div>

              {resendError && (
                <div className="verify-email-alert error small">
                  <AlertTriangle size={16} />
                  <span>{resendError}</span>
                </div>
              )}

              {resendSuccess && (
                <div className="verify-email-alert success small">
                  <CheckCircle size={16} />
                  <span>{resendSuccess}</span>
                </div>
              )}

              <form onSubmit={handleResendSubmit} className="resend-form">
                <div className="form-group">
                  <label htmlFor="resend-email">Email Address</label>
                  <input
                    id="resend-email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="resend-role">Account Type</label>
                  <select
                    id="resend-role"
                    value={resendRole}
                    onChange={(e) => setResendRole(e.target.value)}
                  >
                    <option value="customer">Customer Account</option>
                    <option value="vendor">Seller Account</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="verify-email-btn primary"
                  disabled={resendLoading}
                >
                  {resendLoading ? (
                    <>
                      <Loader2 size={16} className="spin" /> Sending link...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} /> Send New Verification Link
                    </>
                  )}
                </button>
              </form>

              <div className="verify-email-footer-nav">
                <Link to="/login" className="back-link">
                  &larr; Back to Login
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
