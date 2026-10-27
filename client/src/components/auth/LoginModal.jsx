import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import AuthForm from './AuthForm';
import brandLogo from '../../assets/logo/without-bg-logo.png';
import '../../pages/Login.css';

/**
 * Customer login / sign-up popup.
 * Opens over the current page so shoppers can sign in without leaving it.
 */
export default function LoginModal({ open, onClose, onCustomerLogin, initialMode = 'login' }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const firstField = dialogRef.current?.querySelector('input, button');
      firstField?.focus();
    }, 60);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSuccess = () => {
    onClose?.();
  };

  return (
    <div
      className="auth-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to EcShopping"
        ref={dialogRef}
      >
        <div className="auth-modal-top">
          <img src={brandLogo} alt="EcShopping" className="auth-modal-brand" />
          <button
            type="button"
            className="auth-modal-close"
            onClick={() => onClose?.()}
            aria-label="Close sign-in dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="auth-modal-body">
          <AuthForm
            onCustomerLogin={onCustomerLogin}
            onSuccess={handleSuccess}
            initialMode={initialMode}
            compact={true}
            showVendorLink={false}
          />
        </div>
      </div>
    </div>
  );
}
