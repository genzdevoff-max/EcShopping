import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Package, MapPin, Receipt, Truck, ArrowLeft, Ban, AlertCircle, X } from 'lucide-react';
import api from '../utils/api';
import { getOrders } from '../utils/storage';
import { paymentStatusDisplay } from '../utils/orderSync';
import { formatINR, getDeliveryMethod } from '../utils/pricing';
import { PageHero } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/States';
import {
  formatOrderDate,
  statusBadgeClass,
  statusLabel,
  getTimeline,
  PAYMENT_STATUS_LABELS
} from '../utils/orderStatus';
import './Orders.css';

export default function OrderDetails({ loggedInCustomer, onOpenLogin }) {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(() => {
    // 1. Check last placed order in session/local storage
    try {
      const last = JSON.parse(localStorage.getItem('ecshopping_last_order') || 'null');
      if (last && (String(last.id) === String(orderId) || String(last.orderNumber) === String(orderId))) {
        if (
          loggedInCustomer?.email &&
          last.customerEmail &&
          last.customerEmail.toLowerCase() !== loggedInCustomer.email.toLowerCase()
        ) {
          return { restricted: true };
        }
        return last;
      }
    } catch {
      /* ignore parse error */
    }

    // 2. Check cached orders
    const all = getOrders();
    const found = all.find((o) => String(o.id) === String(orderId) || String(o.orderNumber) === String(orderId));
    if (!found) return null;
    if (
      loggedInCustomer?.email &&
      found.customerEmail &&
      found.customerEmail.toLowerCase() !== loggedInCustomer.email.toLowerCase()
    ) {
      return { restricted: true };
    }
    return found;
  });

  const [loading, setLoading] = useState(!order);
  const [cancelling, setCancelling] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Changed my mind');
  const [cancelError, setCancelError] = useState(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Fetch latest authoritative state from backend if logged in
    if (loggedInCustomer && orderId) {
      if (!order) setLoading(true);

      api.getOrder(orderId, 'customer')
        .then((res) => {
          if (!cancelled && res?.success && res.order) {
            setOrder(res.order);
            // Sync locally so other tabs/views stay up-to-date
            try {
              const orders = getOrders();
              const idx = orders.findIndex((o) => String(o.id) === String(res.order.id) || String(o.orderNumber) === String(res.order.id));
              if (idx >= 0) {
                orders[idx] = { ...orders[idx], ...res.order, serverVerified: true };
                localStorage.setItem('ecshopping_orders', JSON.stringify(orders));
              }
            } catch {
              /* ignore cache error */
            }
          }
        })
        .catch((err) => {
          if (!cancelled && err?.status === 403) {
            setOrder({ restricted: true });
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => { cancelled = true; };
  }, [orderId, loggedInCustomer?.email]);

  const handleCancelOrder = async () => {
    if (!order?.id) return;
    setCancelling(true);
    setCancelError(null);

    try {
      const res = await api.cancelCustomerOrder(order.id, cancelReason);
      if (res?.success) {
        setOrder((prev) => ({ ...prev, status: 'Cancelled' }));
        setCancelSuccess(true);
        // Sync local storage
        try {
          const orders = getOrders();
          const updated = orders.map((o) =>
            String(o.id) === String(order.id) || String(o.orderNumber) === String(order.id)
              ? { ...o, status: 'Cancelled' }
              : o
          );
          localStorage.setItem('ecshopping_orders', JSON.stringify(updated));

          const last = JSON.parse(localStorage.getItem('ecshopping_last_order') || 'null');
          if (last && (String(last.id) === String(order.id) || String(last.orderNumber) === String(order.id))) {
            localStorage.setItem('ecshopping_last_order', JSON.stringify({ ...last, status: 'Cancelled' }));
          }
        } catch {
          /* ignore cache error */
        }
        setCancelModalOpen(false);
      } else {
        setCancelError(res?.error || 'Unable to cancel order right now.');
      }
    } catch (err) {
      setCancelError(err?.message || 'Unable to cancel order right now. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHero title="Order details" crumbs={[{ label: 'My orders', to: '/orders' }, { label: 'Order details' }]} />
        <div className="container" style={{ padding: '60px 0', textAlign: 'center' }}>
          <p className="muted">Loading order details...</p>
        </div>
      </>
    );
  }

  if (!order || order.restricted) {
    return (
      <>
        <PageHero title="Order details" crumbs={[{ label: 'My orders', to: '/orders' }, { label: 'Order details' }]} />
        <section className="section">
          <div className="container">
            <EmptyState
              icon={<Package size={30} />}
              title={order?.restricted ? 'This order belongs to another account' : 'Order not found'}
              text={order?.restricted
                ? 'Sign in with the account used at checkout to view this order.'
                : `We could not find an order with the reference “${orderId}” in this browser.`}
              actions={
                <>
                  <Link to="/orders" className="btn btn-primary">My orders</Link>
                  <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Go back</button>
                </>
              }
            />
          </div>
        </section>
      </>
    );
  }

  const method = getDeliveryMethod(order.deliveryMethod || 'standard');
  const timeline = getTimeline(order);
  const statusLower = (order.status || '').toLowerCase();
  const isCancellable = statusLower === 'processing' || statusLower === 'pending' || statusLower === 'confirmed';

  return (
    <>
      <PageHero
        title={`Order ${order.orderNumber || order.id}`}
        subtitle={`Placed on ${formatOrderDate(order.date || order.createdAt)} · ${order.items?.length || 0} item${order.items?.length === 1 ? '' : 's'}`}
        crumbs={[{ label: 'My orders', to: '/orders' }, { label: order.orderNumber || String(order.id) }]}
      />

      <div className="container od-wrap">
        <div className="panel od-head">
          <div className="od-head-main">
            <strong>Reference {order.orderNumber || order.id}</strong>
            <span>Payment: {paymentStatusDisplay(order, PAYMENT_STATUS_LABELS)} · Delivery: {method.label} ({method.detail})</span>
          </div>
          <div className="od-head-badges">
            <span className={statusBadgeClass(order.status)}>
              {statusLabel(order.status)}
            </span>
            <span className="badge badge-soft">{order.paymentMethod === 'phonepe' ? 'PhonePe' : 'Cash on delivery'}</span>
          </div>
        </div>

        <div className="od-grid">
          <section className="panel od-block">
            <h3><Package size={17} /> Items</h3>
            <ul className="od-items">
              {(order.items || []).map((item) => (
                <li key={`${item.id}-${item.variant || 'default'}`}>
                  <img src={item.image} alt="" width="56" height="56" />
                  <span className="od-item-copy">
                    <strong>{item.title}</strong>
                    {item.variant && <small>Variant: {item.variant}</small>}
                    <small>Sold by {item.seller || item.vendorName || 'EcShopping Seller'} · Qty {item.quantity}</small>
                  </span>
                  <span className="od-item-price">
                    {formatINR((Number(item.price) || 0) * (item.quantity || 1))}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="od-side">
            <section className="panel od-block">
              <h3><Truck size={17} /> Status</h3>
              <ul className="timeline">
                {timeline.map((step) => (
                  <li key={step.id} className={`timeline-item ${step.done ? 'done' : ''} ${step.current ? 'current' : ''}`}>
                    <span className="timeline-dot" />
                    <div className="timeline-body">
                      <h4>{step.label}</h4>
                      {step.description && <p className="tiny muted">{step.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
              {order.status?.toLowerCase() === 'cancelled' && (
                <div className="notice notice-danger" style={{ marginTop: '14px' }}>
                  <strong>Order Cancelled</strong>
                  <p className="tiny">This order was cancelled and items were restored to inventory.</p>
                </div>
              )}
            </section>

            <section className="panel od-block">
              <h3><Receipt size={17} /> Payment summary</h3>
              <dl className="od-totals">
                <div><dt>Subtotal</dt><dd>{formatINR(order.subtotal || 0)}</dd></div>
                {order.discount > 0 && (
                  <div className="od-save"><dt>Coupon {order.couponCode ? `(${order.couponCode})` : ''}</dt><dd>−{formatINR(order.discount)}</dd></div>
                )}
                <div><dt>Shipping</dt><dd>{order.shipping === 0 ? 'FREE' : formatINR(order.shipping || 0)}</dd></div>
                <div className="od-total"><dt>Total</dt><dd>{formatINR(order.totalAmount ?? order.total ?? 0)}</dd></div>
              </dl>
            </section>

            <section className="panel od-block">
              <h3><MapPin size={17} /> Shipping address</h3>
              {order.shippingAddress ? (
                <p className="od-address">
                  <strong>{order.customerName}</strong>
                  {typeof order.shippingAddress === 'string'
                    ? order.shippingAddress
                    : `${order.shippingAddress.street || ''}, ${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''} — ${order.shippingAddress.postcode || ''}`
                  }<br />
                  {order.customerPhone}
                </p>
              ) : (
                <p className="muted tiny">No address recorded for this order.</p>
              )}
            </section>
          </div>
        </div>

        <div className="od-actions">
          <Link to={`/track-order?id=${encodeURIComponent(order.id)}`} className="btn btn-primary">
            <Truck size={16} /> Track this order
          </Link>
          {isCancellable && (
            <button
              type="button"
              className="btn btn-outline"
              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
              onClick={() => {
                if (!loggedInCustomer) {
                  onOpenLogin?.();
                } else {
                  setCancelModalOpen(true);
                }
              }}
              title="Cancel this order"
            >
              <Ban size={16} /> Cancel Order
            </button>
          )}
          <Link to="/orders" className="btn btn-outline"><ArrowLeft size={16} /> Back to my orders</Link>
          <Link to="/shop" className="btn btn-ghost">Continue shopping</Link>
        </div>
      </div>

      {/* Cancellation Modal */}
      {cancelModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="cancel-title">Cancel Order #{order.orderNumber || order.id}</h3>
              <button type="button" className="close-btn" onClick={() => setCancelModalOpen(false)}>
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
                <label htmlFor="cancel-reason-select" style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  Reason for Cancellation
                </label>
                <select
                  id="cancel-reason-select"
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
              <button type="button" className="btn btn-ghost" onClick={() => setCancelModalOpen(false)}>
                Keep Order
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={handleCancelOrder}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
