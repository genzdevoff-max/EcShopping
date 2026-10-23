import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHero } from '../components/ui/PageHeader';
import PaymentStates from '../components/checkout/PaymentStates';
import { createPhonePePayment, verifyPhonePePayment } from '../components/checkout/paymentGateway';
import { useCart } from '../context/CartContext';
import './PaymentStatus.css';

/**
 * Return route for the PhonePe hosted checkout (`PHONEPE_REDIRECT_URL`).
 *
 * The gateway hands the browser back here — but a redirect alone is NEVER
 * trusted. The outcome comes exclusively from the server re-checking the
 * gateway's Order Status API. While pending, the page reconciles
 * automatically per the official UAT guidance: first recheck ~20 s, then a
 * few short retries, then manual re-checks. Nothing is mint locally.
 */
const PENDING_RETRY_DELAYS_MS = [20000, 3000, 3000, 3000, 4000, 4000, 4000];

const readPendingOrderId = () => {
  try {
    return sessionStorage.getItem('ecshopping_pending_payment');
  } catch {
    return null;
  }
};

const clearPendingOrderId = () => {
  try {
    sessionStorage.removeItem('ecshopping_pending_payment');
  } catch {
    /* storage unavailable */
  }
};

export default function PaymentStatus() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cart = useCart();
  const orderId = (searchParams.get('orderId') || readPendingOrderId() || '').trim();

  const [state, setState] = useState(orderId ? 'processing' : 'missing');
  const [message, setMessage] = useState('');
  const [messageKey, setMessageKey] = useState(0); // forces the live region to repeat
  const [checksLeft, setChecksLeft] = useState(0);
  const [payingAgain, setPayingAgain] = useState(false);

  const aliveRef = useRef(true);
  const finalizingRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const finalizePaid = useCallback((verifiedOrder) => {
    if (finalizingRef.current) return; // navigate exactly once per visit
    finalizingRef.current = true;
    cart?.clear?.();
    clearPendingOrderId();
    navigate(`/order-confirmation/${verifiedOrder.id || orderId}`, {
      state: {
        order: verifiedOrder,
        autoCredentials: null,
        payment: {
          status: 'success',
          reference: verifiedOrder.paymentReference || verifiedOrder.gatewayTransactionId || null
        }
      },
      replace: true
    });
  }, [cart, navigate, orderId]);

  const verify = useCallback(async () => {
    if (!orderId) {
      setState('missing');
      return 'missing';
    }
    try {
      const res = await verifyPhonePePayment(orderId);
      if (!aliveRef.current) return 'cancelled';
      if (res.paymentStatus === 'paid') {
        finalizePaid(res.order || { id: orderId });
        return 'paid';
      }
      if (res.paymentStatus === 'failed') {
        setMessageKey((k) => k + 1);
        setState('failed');
        setMessage(
          res.gatewayState
            ? `PhonePe reports this transaction as ${res.gatewayState.toLowerCase().replace(/_/g, ' ')}. No amount has been captured — try again or pay later from your orders page.`
            : 'The payment did not complete. No amount has been captured — try again or pay later from your orders page.'
        );
        return 'failed';
      }
      setMessageKey((k) => k + 1);
      setState('pending');
      setMessage('PhonePe has not confirmed this payment yet. We re-check automatically — the order stays pending until the gateway confirms.');
      return 'pending';
    } catch (err) {
      if (!aliveRef.current) return 'cancelled';
      setMessageKey((k) => k + 1);
      setState('error');
      setMessage(err?.message || 'Verification failed. The order stays pending — check again in a moment.');
      return 'error';
    }
  }, [finalizePaid, orderId]);

  useEffect(() => {
    // setState runs inside verify()'s async continuations; the effect only kicks off the request
    // oxlint-disable-next-line react/set-state-in-effect
    if (orderId) verify();
  }, [verify, orderId]);

  /* Automatic reconciliation loop while pending (UAT schedule). */
  useEffect(() => {
    if (state !== 'pending') return undefined;
    let cancelled = false;
    let timer = null;

    const schedule = (delay, nextIndex) => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        // "checks left" counts the scheduled automatic re-checks after this one
        setChecksLeft(Math.max(PENDING_RETRY_DELAYS_MS.length - nextIndex, 0));
        const outcome = await verify();
        if (cancelled || !aliveRef.current) return;
        if (outcome === 'pending' && nextIndex < PENDING_RETRY_DELAYS_MS.length) {
          schedule(PENDING_RETRY_DELAYS_MS[nextIndex], nextIndex + 1);
        }
      }, delay);
    };

    schedule(PENDING_RETRY_DELAYS_MS[0], 1);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state, verify]);

  /* Retry the checkout session for the SAME order — no second order is created. */
  const payAgain = async () => {
    setPayingAgain(true);
    try {
      const res = await createPhonePePayment(orderId);
      window.location.href = res.redirectUrl; // same hosted PayPage, same order
    } catch (err) {
      setPayingAgain(false);
      setMessageKey((k) => k + 1);
      setState('error');
      setMessage(err?.message || 'Could not start the payment. Please try again shortly.');
    }
  };

  if (state === 'missing') {
    return (
      <>
        <PageHero
          title="Payment status"
          subtitle="No payment reference was supplied."
          crumbs={[{ label: 'Cart', to: '/cart' }, { label: 'Payment' }]}
        />
        <div className="ps-wrap">
          <section className="ps-card panel">
            <PaymentStates
              state="warning"
              message="If you started a PhonePe payment on this device, open your orders to check its current state or restart the checkout."
            />
            <div className="ps-actions">
              <Link to="/track-order" className="btn btn-primary">Track an order</Link>
              <Link to="/cart" className="btn btn-ghost">Back to cart</Link>
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHero
        title="Payment status"
        subtitle={`Order ${orderId}`}
        crumbs={[{ label: 'Cart', to: '/cart' }, { label: 'Payment' }]}
      />
      <div className="ps-wrap">
        <section className="ps-card panel" aria-live="polite">
          {state === 'processing' && <PaymentStates state="processing" key={`p-${messageKey}`} />}

          {state === 'pending' && (
            <PaymentStates state="pending" key={`pend-${messageKey}`} message={message} reference={orderId} />
          )}

          {state === 'error' && (
            <>
              <PaymentStates state="warning" key={`e-${messageKey}`} message={message} />
              <div className="ps-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => { setState('processing'); verify(); }}
                >
                  Check again
                </button>
                <Link to="/track-order" className="btn btn-ghost">Track the order</Link>
              </div>
            </>
          )}

          {state === 'failed' && (
            <>
              <PaymentStates state="failed" key={`f-${messageKey}`} message={message} reference={orderId} />
              <div className="ps-actions">
                <button type="button" className="btn btn-primary" onClick={payAgain} disabled={payingAgain}>
                  {payingAgain ? 'Starting payment…' : 'Try paying again'}
                </button>
                <Link to="/track-order" className="btn btn-ghost">Track the order</Link>
              </div>
            </>
          )}

          {state === 'pending' && checksLeft > 0 && (
            <p className="ps-note">
              Automatically re-checking with PhonePe ({checksLeft} check{checksLeft === 1 ? '' : 's'} left) — or check again manually.
            </p>
          )}

          {(state === 'pending' || state === 'processing') && (
            <div className="ps-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setState('processing'); verify().then((outcome) => { if (outcome === 'pending') setState('pending'); }); }}
                disabled={state === 'processing'}
              >
                Check now
              </button>
              <Link to="/track-order" className="btn btn-ghost">Track the order</Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
