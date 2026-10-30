import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UnifiedAuthModal from '../components/auth/UnifiedAuthModal';
import './Login.css';

/**
 * Unified authentication page for /login and /register routes.
 * Renders the centered rounded popup modal with blurred storefront backdrop.
 */
export default function Login({ onCustomerLogin, onVendorLogin, loggedInCustomer }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isRegisterRoute = location.pathname === '/register';
  const roleQuery = new URLSearchParams(location.search).get('role');
  const initialRole = roleQuery === 'vendor' ? 'vendor' : 'customer';

  useEffect(() => {
    if (loggedInCustomer) navigate('/profile', { replace: true });
  }, [loggedInCustomer, navigate]);

  if (loggedInCustomer) return null;

  return (
    <UnifiedAuthModal
      isPage={true}
      open={true}
      initialMode={isRegisterRoute ? 'signup' : 'login'}
      initialRole={initialRole}
      onCustomerLogin={onCustomerLogin}
      onVendorLogin={onVendorLogin}
      onClose={() => navigate('/', { replace: true })}
    />
  );
}
