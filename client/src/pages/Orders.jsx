import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageSearch, Receipt, ArrowRight, MapPin, Ban, X, AlertCircle } from 'lucide-react';
import api from '../utils/api';
import { getOrders, syncOrdersFromServerDetailed } from '../utils/storage';
import { paymentStatusDisplay } from '../utils/orderSync';
import { formatINR } from '../utils/pricing';
import { PageHero } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/States';
import {
  formatOrderDate,
  statusBadgeClass,
  PAYMENT_STATUS_LABELS
} from '../utils/orderStatus';
import './Orders.css';

export default function Orders({ loggedInCustomer, onOpenLogin }) {
  const [, setVersion] = useState(0);
  const [sync, setSync] = useState({ loading: true, error: null });
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('Changed my mind');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!loggedInCustomer) return () => {};
    setSync({ loading: true, error: null });
    // Server-side history (customer token) merged into the local cache.
    syncOrdersFromServerDetailed({}, 'customer').then((result) => {
      if (cancelled) return;
      setSync(result.ok
        ? { loading: false, error: null }
        : { loading: false, error: result });
      setVersion(v => v + 1);
    });
    return () => { cancelled = true; };
  }, [loggedInCustomer?.email]);

  const isCancellable = (status) => {
    const s = (status || '').toLowerCase();
    return s === 'processing' || s === 'pending' || s === 'confirmed';
  };

  const handleOpenCancelModal = (order) => {
    setCancellingOrder(order);
    setCancelReason('Changed my mind');
    setCancelError(null);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingOrder) return;
    setCancelSubmitting(true);
    setCancelError(null);

    try {
      const res = await api.cancelCustomerOrder(cancellingOrder.id, cancelReason);
      if (res?.success) {
        const stored = getOrders();
        const updated = stored.map((o) =>
          String(o.id) === String(cancellingOrder.id) || String(o.orderNumber) === String(cancellingOrder.id)
            ? { ...o, status: 'Cancelled' }
            : o
        );
        localStorage.setItem('ecshopping_orders', JSON.stringify(updated));

        try {
          const last = JSON.parse(localStorage.getItem('ecshopping_last_order') || 'null');
          if (last && (String(last.id) === String(cancellingOrder.id) || String(last.orderNumber) === String(cancellingOrder.id))) {
            localStorage.setItem('ecshopping_last_order', JSON.stringify({ ...last, status: 'Cancelled' }));
          }
        } catch {
          /* ignore cache error */
        }

        setVersion((v) => v + 1);
        setCancellingOrder(null);
      } else {
        setCancelError(res?.error || 'Unable to cancel order right now.');
      }
    } catch (err) {
      setCancelError(err?.message || 'Unable to cancel order right now. Please try again.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  if (!loggedInCustomer) {
    return (
      <>
        <PageHero title="My orders" subtitle="Order history and tracking for your account." crumbs={[{ label: 'My orders' }]} />
        <section className="section">
          <div className="container">
            <EmptyState
              icon={<PackageSearch size={30} />}
              title="Sign in to see your orders"
              text="Your order history is tied to your EcShopping account. Sign in with the email you used at checkout."
              actions={
                <>
                  <button type="button" className="btn btn-primary" onClick={() => onOpenLogin?.()}>Sign in <ArrowRight size={16} /></button>
                  <Link to="/shop" className="btn btn-ghost">Continue shopping</Link>
                </>
              }
            />
          </div>
        </section>
      </>
    );
  }

  const email = loggedInCustomer.email;
  const orders = getOrders().filter(
    (order) =>
      (order.customerEmail && order.customerEmail === email) ||
      (order.email && order.email === email)
  );

  const totalSpent = orders.reduce((sum, o) => sum + (Number(o.totalAmount ?? o.total) || 0), 0);

  const syncBanner = sync.error
    ? (sync.error.status === 401
        ? 'Your session expired — sign in again to keep this device in sync. Showing orders saved here.'
        : 'Could not reach the order service — showing orders saved on this device. Nothing was changed or deleted.')
    : null;

  const subtitle = orders.length
    ? `${orders.length} order${orders.length === 1 ? '' : 's'} · ${formatINR(totalSpent)} spent`
    : 'No orders yet — your first one is a few clicks away.';

  return (
    <>
      <PageHero
        title="My orders"
        subtitle={sync.loading ? 'Checking your order history…' : subtitle}
        crumbs={[{ label: 'Profile', to: '/profile' }, { label: 'My orders' }]}
      />

      <div className="container orders-wrap">
        {syncBanner && (
          <p className="notice notice-info" role="status">
            {syncBanner}
          </p>
        )}
        {orders.length === 0 ? (
          <EmptyState
            icon={<Receipt size={30} />}
            title="You have not placed an order yet"
            text="Once you place an order, it will show up here with its status, totals and tracking."
            actions={
              <>
                <Link to="/shop" className="btn btn-primary">Start shopping <ArrowRight size={16} /></Link>
                <Link to="/track-order" className="btn btn-ghost">Track an order</Link>
              </>
            }
          />
        ) : (
          <>
            <div className="orders-toolbar">
              <p className="muted">
                Signed in as <strong>{email}</strong>
              </p>
              <Link to="/track-order" className="btn btn-sm btn-outline">Track an order</Link>
            </div>

            <ul className="orders-list">
              {orders.map((order) => (
                <li className="panel order-card" key={order.id}>
                  <div className="order-card-head">
                    <div>
                      <span className="order-number">{order.orderNumber || order.id}</span>
                      <span className="order-date">{formatOrderDate(order.date)}</span>
                    </div>
                    <span className={statusBadgeClass(order.status)}>
                      {order.status === 'confirmed' ? 'Confirmed' : order.status?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {order.serverVerified === false && (
                    <p className="orders-note tiny muted">Device copy — not yet confirmed by the server.</p>
                  )}

                  <ul className="order-card-items">
                    {(order.items || []).slice(0, 3).map((item) => (
                      <li key={`${item.id}-${item.variant || 'default'}`}>
                        <img src={item.image} alt="" width="44" height="44" />
                        <span>
                          {item.title}
                          <small>Qty {item.quantity}</small>
                        </span>
                      </li>
                    ))}
                    {(order.items || []).length > 3 && (
                      <li className="order-more-items">+{(order.items.length - 3)} more</li>
                    )}
                  </ul>

                  <div className="order-card-foot">
                    <div className="order-meta">
                      <span className="order-total">{formatINR(order.totalAmount ?? order.total ?? 0)}</span>
                      <span className="order-pay">
                        {paymentStatusDisplay(order, PAYMENT_STATUS_LABELS)}
                      </span>
                      {order.shippingAddress && (
                        <span className="order-addr">
                          <MapPin size={13} /> {order.shippingAddress.city}, {order.shippingAddress.state}
                        </span>
                      )}
                    </div>

                    <div className="order-actions">
                      <Link to={`/orders/${order.id}`} className="btn btn-sm btn-outline">View details</Link>
                      <Link to={`/track-order?id=${encodeURIComponent(order.id)}`} className="btn btn-sm btn-ghost">Track</Link>
                      {isCancellable(order.status) && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline btn-cancel-order"
                          style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                          onClick={() => handleOpenCancelModal(order)}
                          title="Cancel this order"
                        >
                          <Ban size={13} /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <p className="orders-note tiny muted">
              Orders sync automatically while you are signed in. Guests keep their local history in this browser only.
            </p>
          </>
        )}
      </div>

      {/* Cancellation Modal */}
      {cancellingOrder && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="orders-cancel-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="orders-cancel-title">Cancel Order #{cancellingOrder.orderNumber || cancellingOrder.id}</h3>
              <button type="button" className="close-btn" onClick={() => setCancellingOrder(null)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {cancelError && (
              <div className="alert-banner error" style={{ margin: '15px 20px 0' }}>
                <AlertCircle size={18} /> {cancelError}
              </div>
            )}

            <div style={{ padding: '20px' }}>
              <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.5, margin: 0 }}>
                Are you sure you want to cancel this order? Once cancelled, items are automatically restocked.
                If you paid online via PhonePe, a refund will be processed back to your payment method.
              </p>

              <div style={{ marginTop: '16px' }}>
                <label htmlFor="orders-cancel-reason-select" style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  Reason for Cancellation
                </label>
                <select
                  id="orders-cancel-reason-select"
                  className="input"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="Changed my mind">Changed my mind</option>
                  <option value="Ordered by mistake">Ordered by mistake</option>
                  <option value="Found a better price elsewhere">Found a better price elsewhere</option>
                  <option value="Delivery taking too long">Delivery taking too long</option>
                  <option value="Other">Other reason</option>
                </select>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 20px', borderTop: '1px solid var(--line)' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setCancellingOrder(null)}>
                Keep Order
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={handleConfirmCancel}
                disabled={cancelSubmitting}
              >
                {cancelSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
