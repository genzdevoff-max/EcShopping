import React from 'react';
import UnifiedAuthModal from './UnifiedAuthModal';

/**
 * Customer & Vendor unified login / sign-up modal.
 * Opens over the current page with a blurred storefront background.
 */
export default function LoginModal({
  open,
  onClose,
  onCustomerLogin,
  onVendorLogin,
  initialMode = 'login',
  initialRole = 'customer'
}) {
  return (
    <UnifiedAuthModal
      open={open}
      onClose={onClose}
      onCustomerLogin={onCustomerLogin}
      onVendorLogin={onVendorLogin}
      initialMode={initialMode}
      initialRole={initialRole}
      isPage={false}
    />
  );
}
