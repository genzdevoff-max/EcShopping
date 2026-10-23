import { Loader2, CheckCircle2, XCircle, Clock, ShieldAlert } from 'lucide-react';
import './payment.css';

/**
 * Visual states for the PhonePe handoff.
 * `state`: 'idle' | 'processing' | 'success' | 'failed' | 'pending' | 'warning'
 */
export default function PaymentStates({ state, message = '', reference = '', onRetry, onCancel }) {
  if (state === 'idle') return null;

  if (state === 'processing') {
    return (
      <div className="pay-state processing" role="status" aria-live="polite">
        <Loader2 size={22} className="spin" />
        <div>
          <strong>Connecting to PhonePe…</strong>
          <p>Do not close this page — the payment is being confirmed against the gateway.</p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="pay-state success" role="status" aria-live="polite">
        <CheckCircle2 size={22} />
        <div>
          <strong>Payment approved</strong>
          <p>{message || 'Your payment was approved.'}</p>
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
          <strong>Payment failed</strong>
          <p>{message || 'The transaction was declined by your bank.'}</p>
          {reference && <span className="pay-ref">Ref: {reference}</span>}
          <div className="pay-actions">
            {onRetry && (
              <button type="button" className="btn btn-sm btn-primary" onClick={onRetry}>
                Try again
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
          <strong>Payment pending</strong>
          <p>{message || 'Awaiting confirmation from PhonePe. Your order will be confirmed once the gateway reports back.'}</p>
          {reference && <span className="pay-ref">Ref: {reference}</span>}
        </div>
      </div>
    );
  }

  if (state === 'warning') {
    return (
      <div className="pay-state warning" role="status" aria-live="polite">
        <ShieldAlert size={22} />
        <div>
          <strong>Status unavailable</strong>
          <p>{message || 'The payment could not be confirmed right now. Nothing has been charged.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pay-state info" role="status">
      <ShieldAlert size={22} />
      <div>
        <strong>Could not start PhonePe</strong>
        <p>Please try again or choose cash on delivery.</p>
      </div>
    </div>
  );
}
