import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, Phone, CheckCircle, ArrowRight, Store } from 'lucide-react';
import api from '../../utils/api';
import { saveCustomerSession, addCustomer } from '../../utils/storage';

/**
 * Shared customer login / sign-up form.
 * Used by the full-page `/login` route and the header login popup.
 * Credentials are verified server-side (bcrypt in TiDB) — there is no
 * local credential store, so this flow works only with a running API.
 */
export default function AuthForm({ onCustomerLogin, onSuccess, initialMode = 'login', showVendorLink = true }) {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [name, setName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const finish = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      navigate('/profile');
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.userLogin(loginEmail.trim(), loginPassword);

      if (data?.success && data.user && data.token) {
        saveCustomerSession(data.user, data.token);
        addCustomer(data.user); // offline cache for the admin customers tab
        onCustomerLogin(data.user);
        setSuccessMsg('Login successful! Welcome back.');
        setTimeout(finish, 500);
      } else {
        setError(data.error || 'Invalid email or password');
      }
    } catch (err) {
      setError(err.message || 'Unable to sign in right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name || !signUpEmail || !signUpPassword) {
      setError('Please fill in all required fields.');
      return;
    }
    if (signUpPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const data = await api.userRegister({
        name: name.trim(),
        email: signUpEmail.trim(),
        password: signUpPassword,
        phone: phone.trim()
      });

      if (data?.success && data.user && data.token) {
        saveCustomerSession(data.user, data.token);
        addCustomer(data.user);
        onCustomerLogin(data.user);
        setSuccessMsg('Account created successfully! Welcome to EcShopping.');
        setTimeout(finish, 600);
      } else {
        setError(data.error || 'Could not create the account. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Could not create the account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form-box">
      <header className="auth-form-header">
        <h1>{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
        <p>
          {isSignUp
            ? 'Join EcShopping to order fresh goods and track every delivery.'
            : 'Log in with your email to continue to your orders and wishlist.'}
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

      {!isSignUp ? (
        <form onSubmit={handleLoginSubmit} className="auth-form" noValidate>
          <div className="field">
            <label className="field-label" htmlFor="login-email">
              Email address <span className="req" aria-hidden="true">*</span>
            </label>
            <div className="auth-input-wrap">
              <Mail size={17} className="auth-field-icon" aria-hidden="true" />
              <input
                id="login-email"
                className="input auth-input"
                type="email"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
              {loginEmail.includes('@') && (
                <CheckCircle size={16} className="auth-valid-check" aria-hidden="true" />
              )}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="login-password">
              Password <span className="req" aria-hidden="true">*</span>
            </label>
            <div className="auth-input-wrap">
              <Lock size={17} className="auth-field-icon" aria-hidden="true" />
              <input
                id="login-password"
                className="input auth-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
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
                setError('For account recovery or password resets, please contact support at support@ecshopping.local');
              }}
            >
              Forgot password?
            </button>
          </div>

          <div className="auth-buttons">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'} <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setIsSignUp(true);
                setError('');
                setSuccessMsg('');
              }}
            >
              Create account
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSignUpSubmit} className="auth-form" noValidate>
          <div className="field">
            <label className="field-label" htmlFor="signup-name">
              Full name <span className="req" aria-hidden="true">*</span>
            </label>
            <div className="auth-input-wrap">
              <User size={17} className="auth-field-icon" aria-hidden="true" />
              <input
                id="signup-name"
                className="input auth-input"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="signup-email">
              Email address <span className="req" aria-hidden="true">*</span>
            </label>
            <div className="auth-input-wrap">
              <Mail size={17} className="auth-field-icon" aria-hidden="true" />
              <input
                id="signup-email"
                className="input auth-input"
                type="email"
                placeholder="you@example.com"
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
            <label className="field-label" htmlFor="signup-phone">
              Phone number <span className="auth-optional">(optional)</span>
            </label>
            <div className="auth-input-wrap">
              <Phone size={17} className="auth-field-icon" aria-hidden="true" />
              <input
                id="signup-phone"
                className="input auth-input"
                type="tel"
                placeholder="+91 90000 00000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="signup-password">
              Password <span className="req" aria-hidden="true">*</span>
            </label>
            <div className="auth-input-wrap">
              <Lock size={17} className="auth-field-icon" aria-hidden="true" />
              <input
                id="signup-password"
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
              {loading ? 'Creating account…' : 'Register'} <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setIsSignUp(false);
                setError('');
                setSuccessMsg('');
              }}
            >
              Back to login
            </button>
          </div>
        </form>
      )}

      {showVendorLink && (
        <div className="auth-portals">
          <span className="auth-portals-label">Are you a registered seller?</span>
          <Link to="/vendor" className="auth-portal-link">
            <Store size={15} aria-hidden="true" />
            Switch to vendor login
          </Link>
        </div>
      )}
    </div>
  );
}
