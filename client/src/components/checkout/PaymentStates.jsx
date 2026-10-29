import { Loader2, CheckCircle2, XCircle, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import './payment.css';

/**
 * Visual states for the PhonePe handoff & return verification.
 * `state`: 'idle' | 'processing' | 'checking' | 'success' | 'failed' | 'pending' | 'warning' | 'info'
 */
export default function PaymentStates({ state, message = '', reference = '', onRetry, onCancel }) {
  if (state === 'idle') return null;

  if (state === 'processing' || state === 'checking') {
    return (
      <div className="pay-state processing" role="status" aria-live="polite">
        <Loader2 size={22} className="spin" />
        <div>
          <strong>Confirming your payment…</strong>
          <p>{message || 'Checking transaction status with PhonePe. Please do not close or refresh this page.'}</p>
          {reference && <span className="pay-ref">Ref: {reference}</span>}
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="pay-state success" role="status" aria-live="polite">
        <CheckCircle2 size={22} />
        <div>
          <strong>Payment successful</strong>
          <p>{message || 'Your payment has been verified and your order is confirmed.'}</p>
          {reference && <span className="pay-ref">Ref: {reference}</span>}
        </div>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="pay-state failed" role="alert">
        <XCircle size={22} />
        <div>
          <strong>Payment did not complete</strong>
          <p>{message || 'The transaction was declined by your bank or cancelled. No amount was deducted.'}</p>
          {reference && <span className="pay-ref">Ref: {reference}</span>}
          <div className="pay-actions">
            {onRetry && (
              <button type="button" className="btn btn-sm btn-primary" onClick={onRetry}>
                Try paying again
              </button>
            )}
            {onCancel && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
                Switch to cash on delivery
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <div className="pay-state pending" role="status" aria-live="polite">
        <Clock size={22} />
        <div>
          <strong>Payment confirmation in progress</strong>
          <p>{message || 'Awaiting confirmation from PhonePe. Your order is safely recorded and will be confirmed shortly.'}</p>
          {reference && <span className="pay-ref">Ref: {reference}</span>}
        </div>
      </div>
    );
  }

  // Fallback for neutral / info / warning states — keeps messaging calm and reassuring
  return (
    <div className="pay-state info" role="status" aria-live="polite">
      <Clock size={22} />
      <div>
        <strong>Checking payment details</strong>
        <p>{message || 'We are verifying your transaction with the payment provider. Please check your order history before attempting another payment.'}</p>
        {reference && <span className="pay-ref">Ref: {reference}</span>}
      </div>
    </div>
  );
}
