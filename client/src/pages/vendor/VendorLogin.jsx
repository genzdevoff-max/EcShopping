import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UnifiedAuthModal from '../../components/auth/UnifiedAuthModal';
import '../Login.css';

/**
 * Unified Seller / Vendor authentication component.
 * Renders the centered rounded popup modal with blurred storefront backdrop.
 */
export default function VendorLogin({ onLogin, initialSignUp = false, embedded = false }) {
  const [isSignUp, setIsSignUp] = useState(initialSignUp);
  const navigate = useNavigate();

  return (
    <UnifiedAuthModal
      isPage={!embedded}
      open={true}
      initialRole="vendor"
      initialMode={isSignUp ? 'signup' : 'login'}
      onVendorLogin={onLogin}
      onClose={() => navigate('/', { replace: true })}
    />
  );
}
