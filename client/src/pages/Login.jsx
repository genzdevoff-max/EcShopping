import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthForm from '../components/auth/AuthForm';
import userLoginImg from '../assets/login-page/user-login.png';
import './Login.css';

export default function Login({ onCustomerLogin, loggedInCustomer }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (loggedInCustomer) navigate('/profile', { replace: true });
  }, [loggedInCustomer, navigate]);

  if (loggedInCustomer) return null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Left side: brand panel */}
        <aside className="auth-brand-side">
          <span className="auth-brand-tag">
            <span className="brand-dot" aria-hidden="true" />
            Customer portal
          </span>

          <div className="auth-visual">
            <img
              src={userLoginImg}
              alt="Customer shopping at EcShopping"
              className="auth-side-img"
            />
          </div>

          <div className="auth-caption">
            <h2>Fresh &amp; organic, every day</h2>
            <p>
              Shop farm-fresh produce, groceries and household essentials straight from local sellers.
            </p>
          </div>
        </aside>

        {/* Right side: login / sign-up form */}
        <main className="auth-form-side">
          <AuthForm onCustomerLogin={onCustomerLogin} />
        </main>
      </div>
    </div>
  );
}
