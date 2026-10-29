import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Clock, CheckCircle2, XCircle, ArrowRight, RefreshCw, ShoppingBag, Receipt, AlertCircle } from 'lucide-react';
import { PageHero } from '../components/ui/PageHeader';
import PaymentStates from '../components/checkout/PaymentStates';
import { createPhonePePayment, verifyPhonePePayment } from '../components/checkout/paymentGateway';
import { useCart } from '../context/CartContext';
import './PaymentStatus.css';

/**
 * Return route for PhonePe checkout (`https://ecshopping.in/payment/phonepe/return`).
 *
 * Requirements:
 * 1. Never trust URL query parameters alone to declare a payment successful.
 * 2. Authenticate the transaction state exclusively through backend verification.
 * 3. On verified success ('paid'), automatically redirect to the order confirmation page.
 * 4. On pending, show a neutral, reassuring 'Confirming your payment…' state with bounded retries.
 * 5. On failed/cancelled, show an accurate, friendly explanation and allow retrying for the SAME order.
 * 6. On unresolved status or missing order ID, display a neutral 'We’re checking your payment' state
 *    without any alarming warnings or missing-state banners.
 */

// Bounded retry schedule: 5 fast, responsive attempts (~19s total) instead of 20s initial freeze
const RETRY_DELAYS_MS = [2000, 3000, 4000, 5000, 5000];

/** Multi-source resolution of the order ID to withstand mobile browser storage eviction. */
const resolveOrderId = (searchParams) => {
  // 1. Search parameters in the redirect URL
  const paramCandidates = [
    searchParams.get('orderId'),
    searchParams.get('merchantTransactionId'),
    searchParams.get('transactionId'),
    searchParams.get('merchantOrderId'),
    searchParams.get('id')
  ];
  for (const candidate of paramCandidates) {
    if (candidate && typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  // 2. Session storage key
  try {
    const sessionVal = sessionStorage.getItem('ecshopping_pending_payment');
    if (sessionVal && sessionVal.trim()) return sessionVal.trim();
  } catch {
    /* ignore storage error */
  }

  // 3. Local storage pending payment key
  try {
    const localVal = localStorage.getItem('ecshopping_pending_payment');
    if (localVal && localVal.trim()) return localVal.trim();
  } catch {
    /* ignore storage error */
  }

  // 4. Last order saved in localStorage
  try {
    const lastOrder = JSON.parse(localStorage.getItem('ecshopping_last_order') || 'null');
    if (lastOrder?.id && typeof lastOrder.id === 'string' && lastOrder.id.trim()) {
      return lastOrder.id.trim();
    }
  } catch {
    /* ignore storage error */
  }

  return '';
};

const clearPendingOrderMarkers = () => {
  try {
    sessionStorage.removeItem('ecshopping_pending_payment');
  } catch {
    /* storage unavailable */
  }
  try {
    localStorage.removeItem('ecshopping_pending_payment');
  } catch {
    /* storage unavailable */
  }
};

export default function PaymentStatus() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cart = useCart();

  const [orderId] = useState(() => resolveOrderId(searchParams));

  // States: 'confirming' | 'pending' | 'pending_settling' | 'failed' | 'error' | 'unresolved'
  const [state, setState] = useState(() => (orderId ? 'confirming' : 'unresolved'));
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [payingAgain, setPayingAgain] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [failedReason, setFailedReason] = useState('');

  const aliveRef = useRef(true);
  const finalizingRef = useRef(false);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  /**
   * Finalize paid order: updates local caches, clears pending markers and cart,
   * then navigates directly to the order confirmation page.
   */
  const finalizePaid = useCallback((verifiedOrder) => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }

    const orderData = verifiedOrder || { id: orderId, paymentStatus: 'paid' };

    // Update local storage caches so OrderConfirmation and Order Details have fresh data
    try {
      localStorage.setItem('ecshopping_last_order', JSON.stringify({ ...orderData, paymentStatus: 'paid' }));
      const storedOrders = JSON.parse(localStorage.getItem('ecshopping_orders') || '[]');
      const existingIdx = storedOrders.findIndex((o) => String(o.id) === String(orderData.id));
      if (existingIdx >= 0) {
        storedOrders[existingIdx] = { ...storedOrders[existingIdx], ...orderData, paymentStatus: 'paid' };
      } else {
        storedOrders.unshift({ ...orderData, paymentStatus: 'paid' });
      }
      localStorage.setItem('ecshopping_orders', JSON.stringify(storedOrders));
    } catch {
      /* storage unavailable */
    }

    cart?.clear?.();
    clearPendingOrderMarkers();

    navigate(`/order-confirmation/${orderData.id || orderId}`, {
      state: {
        order: orderData,
        autoCredentials: null,
        payment: {
          status: 'success',
          message: 'Payment successful · Your order has been confirmed.',
          reference: orderData.paymentReference || orderData.gatewayTransactionId || null
        }
      },
      replace: true
    });
  }, [cart, navigate, orderId]);

  /**
   * Core verification function: talks to backend /api/payments/phonepe/verify.
   * Never assumes outcome from URL params.
   */
  const performVerification = useCallback(async (isManual = false) => {
    if (!orderId) {
      setState('unresolved');
      return 'unresolved';
    }

    setIsChecking(true);
    try {
      const res = await verifyPhonePePayment(orderId);
      if (!aliveRef.current) return 'cancelled';

      if (res.paymentStatus === 'paid') {
        finalizePaid(res.order || { id: orderId });
        return 'paid';
      }

      if (res.paymentStatus === 'failed') {
        clearPendingOrderMarkers();
        setState('failed');
        setFailedReason(
          res.gatewayState
            ? `PhonePe reports this payment as ${res.gatewayState.toLowerCase().replace(/_/g, ' ')}. No amount has been deducted.`
            : 'Your payment was declined by your bank or cancelled. No amount was deducted.'
        );
        return 'failed';
      }

      // If pending:
      if (isManual) {
        // If user manually pressed "Check now", keep in pending_settling if retries were already exhausted
        setState((current) => (current === 'pending_settling' ? 'pending_settling' : 'pending'));
      }
      return 'pending';
    } catch (err) {
      if (!aliveRef.current) return 'cancelled';
      setState('error');
      setErrorMessage(err?.message || 'We could not reach the payment verification service. Your order remains safely recorded.');
      return 'error';
    } finally {
      if (aliveRef.current) {
        setIsChecking(false);
      }
    }
  }, [finalizePaid, orderId]);

  // Initial verification trigger on mount
  useEffect(() => {
    if (!orderId) {
      // oxlint-disable-next-line react/set-state-in-effect
      setState('unresolved');
      return;
    }

    let active = true;

    const runInitial = async () => {
      const outcome = await performVerification(false);
      if (!active || outcome !== 'pending') return;

      // Start automatic bounded retry loop
      let currentIdx = 0;

      const scheduleNext = (idx) => {
        if (idx >= RETRY_DELAYS_MS.length) {
          if (active && aliveRef.current) {
            setState('pending_settling');
          }
          return;
        }

        setAttemptIndex(idx + 1);
        setState('pending');

        retryTimerRef.current = setTimeout(async () => {
          if (!active || !aliveRef.current || finalizingRef.current) return;
          const nextOutcome = await performVerification(false);
          if (nextOutcome === 'pending' && active) {
            scheduleNext(idx + 1);
          }
        }, RETRY_DELAYS_MS[idx]);
      };

      scheduleNext(0);
    };

    runInitial();

    return () => {
      active = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [orderId, performVerification]);

  // Manual status check
  const handleManualCheck = async () => {
    if (isChecking) return;
    const outcome = await performVerification(true);
    if (outcome === 'pending') {
      setState('pending_settling');
    }
  };

  // Retry payment for the EXACT SAME order without creating a duplicate
  const payAgain = async () => {
    if (payingAgain || !orderId) return;
    setPayingAgain(true);
    try {
      const res = await createPhonePePayment(orderId);
      if (res?.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        throw new Error('PhonePe did not provide a payment URL. Please try again shortly.');
      }
    } catch (err) {
      setPayingAgain(false);
      setState('error');
      setErrorMessage(err?.message || 'Could not start the payment session. Please try again in a few moments.');
    }
  };

  // Case D: Order ID genuinely cannot be resolved
  if (state === 'unresolved') {
    return (
      <>
        <PageHero
          title="Payment verification"
          subtitle="Order reference lookup"
          crumbs={[{ label: 'Home', to: '/' }, { label: 'Payment' }]}
        />
        <div className="ps-wrap">
          <section className="ps-card panel" aria-live="polite">
            <div className="pay-state info">
              <Clock size={24} className="ps-icon-neutral" />
              <div>
                <strong>We’re checking your payment</strong>
                <p>
                  We could not automatically detect an active order reference from this return link.
                  If you just completed a payment on PhonePe or your UPI app, please check your order history
                  before paying again to avoid duplicate charges.
                </p>
              </div>
            </div>

            <div className="ps-actions">
              <Link to="/orders" className="btn btn-primary">
                <Receipt size={16} /> View my orders
              </Link>
              <Link to="/track-order" className="btn btn-outline">
                Track an order
              </Link>
              <Link to="/shop" className="btn btn-ghost">
                Continue shopping
              </Link>
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHero
        title="Payment verification"
        subtitle={`Order ${orderId}`}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Payment status' }]}
      />
      <div className="ps-wrap">
        <section className="ps-card panel" aria-live="polite">
          {/* 1. Actively confirming or initial check */}
          {(state === 'confirming' || state === 'pending') && (
            <div className="ps-flow-state">
              <div className="pay-state processing">
                <Loader2 size={24} className="spin ps-icon-spin" />
                <div>
                  <strong>Confirming your payment…</strong>
                  <p>
                    Checking transaction status with PhonePe. Please wait a moment while we verify your order.
                  </p>
                  <span className="pay-ref">Ref: {orderId}</span>
                </div>
              </div>

              {state === 'pending' && attemptIndex > 0 && (
                <p className="ps-progress-note">
                  Checking with PhonePe (Attempt {attemptIndex} of {RETRY_DELAYS_MS.length})…
                </p>
              )}

              <div className="ps-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleManualCheck}
                  disabled={isChecking}
                >
                  {isChecking ? (
                    <>
                      <Loader2 size={16} className="spin" /> Checking status…
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} /> Check status now
                    </>
                  )}
                </button>
                <Link to={`/orders/${orderId}`} className="btn btn-outline">
                  View order
                </Link>
                <Link to="/orders" className="btn btn-ghost">
                  My orders
                </Link>
              </div>
            </div>
          )}

          {/* 2. Pending settled after retries: neutral reassurance without alarming warning */}
          {state === 'pending_settling' && (
            <div className="ps-flow-state">
              <div className="pay-state info">
                <Clock size={24} className="ps-icon-neutral" />
                <div>
                  <strong>Payment confirmation in progress</strong>
                  <p>
                    PhonePe is still processing this transaction. If your payment went through, your order will be
                    confirmed automatically once PhonePe updates. Please do not pay again while this payment is settling.
                  </p>
                  <span className="pay-ref">Ref: {orderId}</span>
                </div>
              </div>

              <p className="ps-note">
                You can check the payment status again below, or view this order in your order history at any time.
              </p>

              <div className="ps-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleManualCheck}
                  disabled={isChecking}
                >
                  {isChecking ? (
                    <>
                      <Loader2 size={16} className="spin" /> Checking PhonePe…
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} /> Check payment status
                    </>
                  )}
                </button>
                <Link to={`/orders/${orderId}`} className="btn btn-outline">
                  View order details
                </Link>
                <Link to="/orders" className="btn btn-ghost">
                  My orders
                </Link>
              </div>
            </div>
          )}

          {/* 3. Payment failed or cancelled */}
          {state === 'failed' && (
            <div className="ps-flow-state">
              <div className="pay-state failed">
                <XCircle size={24} />
                <div>
                  <strong>Payment did not complete</strong>
                  <p>
                    {failedReason ||
                      'The payment was declined by your bank or cancelled. No amount was deducted from your account.'}
                  </p>
                  <span className="pay-ref">Ref: {orderId}</span>
                </div>
              </div>

              <p className="ps-note">
                If money was deducted by your bank, it will be automatically refunded within 3–5 business days. You can retry paying for this order or choose another payment method.
              </p>

              <div className="ps-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={payAgain}
                  disabled={payingAgain}
                >
                  {payingAgain ? (
                    <>
                      <Loader2 size={16} className="spin" /> Starting payment…
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} /> Try paying again
                    </>
                  )}
                </button>
                <Link to={`/orders/${orderId}`} className="btn btn-outline">
                  View order
                </Link>
                <Link to="/cart" className="btn btn-ghost">
                  <ShoppingBag size={16} /> Back to cart
                </Link>
              </div>
            </div>
          )}

          {/* 4. Verification error (network or temporary service issue) */}
          {state === 'error' && (
            <div className="ps-flow-state">
              <div className="pay-state info">
                <AlertCircle size={24} className="ps-icon-neutral" />
                <div>
                  <strong>Checking payment details</strong>
                  <p>
                    {errorMessage ||
                      'We could not reach the payment verification service. Your order remains safely recorded.'}
                  </p>
                  <span className="pay-ref">Ref: {orderId}</span>
                </div>
              </div>

              <p className="ps-note">
                Please do not attempt a new payment immediately. Check again in a few moments or open your order details.
              </p>

              <div className="ps-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleManualCheck}
                  disabled={isChecking}
                >
                  {isChecking ? (
                    <>
                      <Loader2 size={16} className="spin" /> Checking status…
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} /> Check again
                    </>
                  )}
                </button>
                <Link to={`/orders/${orderId}`} className="btn btn-outline">
                  View order details
                </Link>
                <Link to="/orders" className="btn btn-ghost">
                  My orders
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}