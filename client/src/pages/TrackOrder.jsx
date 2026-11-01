import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  PackageCheck,
  MapPin,
  Clock,
  ArrowRight,
  Ban,
  CheckCircle2,
  Truck,
  Home,
  ShoppingBag,
  Receipt,
  AlertCircle,
  X
} from 'lucide-react';
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
  PAYMENT_STATUS_LABELS
} from '../utils/orderStatus';
import './Orders.css';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80';

export default function TrackOrder({ loggedInCustomer, onOpenLogin }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id') || '';
  const [query, setQuery] = useState(initialId);
  const [searched, setSearched] = useState(Boolean(initialId));
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);

  // Cancellation modal states
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('Changed my mind');
  const [cancelError, setCancelError] = useState(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  const lastOrder = (() => {
    try {
      return JSON.parse(localStorage.getItem('ecshopping_last_order') || 'null');
    } catch {
      return null;
    }
  })();

  const executeTrack = async (orderRef) => {
    const code = String(orderRef || '').trim();
    if (!code) {
      setResult(null);
      setSearched(false);
      return;
    }

    setSearched(true);
    setSearching(true);
    setCancelError(null);
    setCancelSuccess(false);

    // 1. Check local storage first for instant display
    let localMatch = null;
    try {
      localMatch = getOrders().find((o) =>
        String(o.id).toUpperCase() === code.toUpperCase() ||
        String(o.orderNumber || '').toUpperCase() === code.toUpperCase()
      );
    } catch {
      /* ignore storage read error */
    }

    if (localMatch) {
      setResult(localMatch);
    }

    // 2. Fetch authoritative live order from public tracking API
    try {
      const res = await api.trackOrder(code);
      if (res?.success && res.order) {
        setResult(res.order);
      } else if (!localMatch) {
        setResult(null);
      }
    } catch {
      // If public track fails, check if customer is logged in and can fetch full order
      if (loggedInCustomer) {
        try {
          const authRes = await api.getOrder(code, 'customer');
          if (authRes?.success && authRes.order) {
            setResult(authRes.order);
          } else if (!localMatch) {
            setResult(null);
          }
        } catch {
          if (!localMatch) setResult(null);
        }
      } else if (!localMatch) {
        setResult(null);
      }
    } finally {
      setSearching(false);
    }
  };

  // Run tracking automatically if URL contains ?id=...
  useEffect(() => {
    if (initialId) {
      executeTrack(initialId);
    }
  }, [initialId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const code = query.trim();
    setSearchParams(code ? { id: code } : {}, { replace: true });
    executeTrack(code);
  };

  const handleQuickLookup = (orderId) => {
    setQuery(orderId);
    setSearchParams({ id: orderId }, { replace: true });
    executeTrack(orderId);
  };

  const handleCancelOrder = async () => {
    if (!result?.id) return;
    if (!loggedInCustomer) {
      setCancelModalOpen(false);
      onOpenLogin?.();
      return;
    }

    setCancelling(true);
    setCancelError(null);

    try {
      const res = await api.cancelCustomerOrder(result.id, cancelReason);
      if (res?.success) {
        setResult((prev) => ({ ...prev, status: 'Cancelled' }));
        setCancelSuccess(true);
        try {
          const orders = getOrders();
          const updated = orders.map((o) =>
            String(o.id) === String(result.id) ? { ...o, status: 'Cancelled' } : o
          );
          localStorage.setItem('ecshopping_orders', JSON.stringify(updated));
        } catch {
          /* ignore storage error */
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

  // Derive tracking progression milestones
  const statusStr = String(result?.status || 'Processing').trim().toLowerCase();
  const isCancelled = statusStr === 'cancelled';
  const isDelivered = statusStr === 'delivered';
  const isShipped = statusStr === 'shipped' || statusStr === 'out_for_delivery';

  // Step indices: 0: Placed, 1: Packed, 2: In Transit, 3: Delivered
  let activeStepIndex = 1; // Default Processing
  if (isDelivered) activeStepIndex = 3;
  else if (isShipped) activeStepIndex = 2;
  else if (isCancelled) activeStepIndex = -1;

  const steps = [
    {
      id: 'placed',
      title: 'Order Placed',
      desc: 'Order confirmed & sent to farm',
      icon: <CheckCircle2 size={20} />
    },
    {
      id: 'packed',
      title: 'Harvested & Packed',
      desc: 'Fresh produce inspected & packed',
      icon: <PackageCheck size={20} />
    },
    {
      id: 'shipped',
      title: 'Out for Delivery',
      desc: 'Dispatched with delivery partner',
      icon: <Truck size={20} />
    },
    {
      id: 'delivered',
      title: 'Delivered',
      desc: 'Safely arrived at your address',
      icon: <Home size={20} />
    }
  ];

  const deliveryMethod = result ? getDeliveryMethod(result.deliveryMethod || 'standard') : null;
  const isCancellable = !isCancelled && (statusStr === 'processing' || statusStr === 'pending' || statusStr === 'confirmed');

  return (
    <>
      <PageHero
        title="Track Your Order"
        subtitle="Follow your farm-fresh produce and artisanal groceries right to your doorstep."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Track Order' }]}
      />

      <div className="container to-wrap">
        {/* Search Bar Panel */}
        <form className="panel to-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="track-id">Order Reference or ID</label>
          <input
            id="track-id"
            className="input"
            type="text"
            placeholder="e.g. ORD-591753"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={searching}>
            <Search size={16} /> {searching ? 'Tracking...' : 'Track Order'}
          </button>
        </form>

        {/* Initial Empty State / Helper */}
        {!searched && (
          <>
            <EmptyState
              icon={<PackageCheck size={32} />}
              title="Where do I find my Order ID?"
              text="Your Order ID starts with ORD- and was provided on your checkout confirmation and in your order confirmation email / SMS."
              actions={
                loggedInCustomer ? (
                  <Link to="/orders" className="btn btn-primary">
                    View My Orders <ArrowRight size={16} />
                  </Link>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={() => onOpenLogin?.()}>
                    Sign in to see all orders <ArrowRight size={16} />
                  </button>
                )
              }
            />
            {lastOrder && (
              <p className="to-hint tiny muted" style={{ marginTop: '12px' }}>
                Your most recent order: <strong>{lastOrder.orderNumber || lastOrder.id}</strong>{' '}
                <button
                  type="button"
                  className="to-hint-link"
                  onClick={() => handleQuickLookup(lastOrder.orderNumber || lastOrder.id)}
                >
                  Track it now
                </button>
              </p>
            )}
          </>
        )}

        {/* Searching Loader */}
        {searching && (
          <div className="panel" style={{ padding: '36px', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 14px' }} />
            <p className="muted" style={{ margin: 0 }}>Locating your order details...</p>
          </div>
        )}

        {/* Not Found State */}
        {searched && !searching && result === null && (
          <EmptyState
            icon={<Search size={30} />}
            title="Order not found"
            text={`We couldn’t find an order matching “${query}”. Please verify your Order Reference ID (e.g. ORD-591753) or sign in to view your order history.`}
            actions={
              <>
                {loggedInCustomer ? (
                  <Link to="/orders" className="btn btn-primary">My Orders</Link>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={() => onOpenLogin?.()}>Sign In</button>
                )}
                <Link to="/shop" className="btn btn-ghost">Continue Shopping</Link>
              </>
            }
          />
        )}

        {/* Loaded Ecommerce Order Tracker */}
        {result && !searching && (
          <>
            {/* Header Status Card */}
            <div className="panel od-head" style={{ borderRadius: 'var(--r-md)' }}>
              <div className="od-head-main">
                <strong style={{ fontSize: '1.25rem' }}>Order {result.orderNumber || result.id}</strong>
                <span>
                  Placed on {formatOrderDate(result.date || result.createdAt)} ·{' '}
                  Payment: {paymentStatusDisplay(result, PAYMENT_STATUS_LABELS)}
                </span>
              </div>
              <div className="od-head-badges">
                <span className={statusBadgeClass(result.status)}>
                  {statusLabel(result.status)}
                </span>
                <span className="badge badge-soft">
                  {result.paymentMethod === 'phonepe' ? 'PhonePe UPI / Card' : 'Cash on Delivery'}
                </span>
              </div>
            </div>

            {/* Cancelled Banner if applicable */}
            {isCancelled && (
              <div className="notice notice-danger" style={{ padding: '16px', borderRadius: 'var(--r-md)' }}>
                <strong><Ban size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} /> Order Cancelled</strong>
                <p className="tiny" style={{ margin: '4px 0 0' }}>
                  This order has been cancelled and items were restored to inventory. If you already paid, any refund has been initiated to your original payment method.
                </p>
              </div>
            )}

            {/* Visual Ecommerce Stepper */}
            {!isCancelled && (
              <div className="panel ec-tracker-card">
                <h3 style={{ margin: 0, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 800 }}>
                  Live Delivery Progress
                </h3>
                <div className="ec-tracker">
                  <div
                    className="ec-tracker-fill"
                    style={{
                      '--progress-pct': `${(activeStepIndex / (steps.length - 1)) * 100}%`,
                      width: `${(activeStepIndex / (steps.length - 1)) * 100}%`
                    }}
                  />
                  {steps.map((st, idx) => {
                    const isDone = idx < activeStepIndex || (isDelivered && idx <= activeStepIndex);
                    const isCurrent = idx === activeStepIndex && !isDelivered;
                    const isPending = idx > activeStepIndex;

                    return (
                      <div
                        key={st.id}
                        className={`ec-step ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''} ${isPending ? 'pending' : ''}`}
                      >
                        <div className="ec-step-icon">
                          {st.icon}
                        </div>
                        <div className="ec-step-title">{st.title}</div>
                        <div className="ec-step-desc">{st.desc}</div>
                      </div>
                    );
                  })}
                </div>

                {deliveryMethod && (
                  <div className="to-eta" style={{ marginTop: '16px' }}>
                    <Clock size={16} />
                    <span>
                      Estimated Delivery: <strong>{deliveryMethod.detail}</strong> via {deliveryMethod.label}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Main Content Grid: Purchased Products + Order Details */}
            <div className="od-grid">
              {/* Left Column: Purchased Products */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <section className="panel od-block" style={{ borderRadius: 'var(--r-md)' }}>
                  <h3>
                    <ShoppingBag size={17} /> Purchased Products ({result.items?.length || 0})
                  </h3>
                  <ul className="od-items">
                    {(result.items || []).map((item, idx) => (
                      <li key={`${item.id || item.productId || idx}-${item.variant || 'default'}`}>
                        <img
                          src={item.image || DEFAULT_IMAGE}
                          alt={item.title}
                          width="64"
                          height="64"
                          style={{ objectFit: 'cover', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)' }}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = DEFAULT_IMAGE;
                          }}
                        />
                        <span className="od-item-copy">
                          {item.productId ? (
                            <Link
                              to={`/product/${item.productId}`}
                              style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}
                            >
                              {item.title}
                            </Link>
                          ) : (
                            <strong>{item.title}</strong>
                          )}
                          {item.variant && (
                            <small className="badge badge-soft" style={{ alignSelf: 'flex-start', padding: '2px 7px', fontSize: '0.7rem' }}>
                              Pack: {item.variant}
                            </small>
                          )}
                          <small>
                            Sold by {item.vendorName || item.seller || 'EcShopping Partner Farm'} · Qty: {item.quantity} × {formatINR(Number(item.price) || 0)}
                          </small>
                        </span>
                        <span className="od-item-price">
                          {formatINR((Number(item.price) || 0) * (item.quantity || 1))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Delivery Destination */}
                <section className="panel od-block" style={{ borderRadius: 'var(--r-md)' }}>
                  <h3><MapPin size={17} /> Delivery Address</h3>
                  {result.shippingAddress ? (
                    <div className="od-address">
                      <strong>{result.customerName || 'Customer'}</strong>
                      {result.shippingAddress.street && <p style={{ margin: '2px 0' }}>{result.shippingAddress.street}</p>}
                      <p style={{ margin: '2px 0' }}>
                        {result.shippingAddress.city ? `${result.shippingAddress.city}, ` : ''}
                        {result.shippingAddress.state ? `${result.shippingAddress.state} ` : ''}
                        {result.shippingAddress.postcode ? `— ${result.shippingAddress.postcode}` : ''}
                      </p>
                    </div>
                  ) : (
                    <p className="tiny muted">Standard residential delivery address</p>
                  )}
                </section>
              </div>

              {/* Right Column: Payment & Order Summary */}
              <div className="od-side">
                <section className="panel od-block" style={{ borderRadius: 'var(--r-md)' }}>
                  <h3><Receipt size={17} /> Order & Payment Summary</h3>
                  <dl className="od-totals">
                    <div>
                      <dt>Items Subtotal</dt>
                      <dd>{formatINR(result.subtotal || 0)}</dd>
                    </div>
                    {Number(result.discount) > 0 && (
                      <div className="od-save">
                        <dt>Coupon Discount {result.couponCode ? `(${result.couponCode})` : ''}</dt>
                        <dd>−{formatINR(result.discount)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Delivery Charges</dt>
                      <dd>
                        {Number(result.shipping) === 0 ? (
                          <span style={{ color: 'var(--brand-700)', fontWeight: 600 }}>FREE</span>
                        ) : (
                          formatINR(result.shipping || 0)
                        )}
                      </dd>
                    </div>
                    <div className="od-total">
                      <dt>Total Amount</dt>
                      <dd>{formatINR(result.totalAmount ?? result.total ?? 0)}</dd>
                    </div>
                  </dl>
                  <p className="tiny muted" style={{ marginTop: '12px', borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
                    Payment Mode:{' '}
                    <strong>{result.paymentMethod === 'phonepe' ? 'PhonePe UPI / Cards' : 'Cash on Delivery'}</strong>
                  </p>
                </section>

                {/* Quick Actions Panel */}
                <section className="panel od-block" style={{ borderRadius: 'var(--r-md)' }}>
                  <h3>Actions & Help</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    <Link to={`/orders/${result.id}`} className="btn btn-outline" style={{ justifyContent: 'center' }}>
                      View Full Invoice Details
                    </Link>
                    {isCancellable && (
                      <button
                        type="button"
                        className="btn btn-outline btn-cancel-order"
                        style={{ justifyContent: 'center' }}
                        onClick={() => setCancelModalOpen(true)}
                      >
                        <Ban size={15} /> Cancel Order
                      </button>
                    )}
                    <Link to="/shop" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                      Shop More Products
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ justifyContent: 'center' }}
                      onClick={() => {
                        setResult(null);
                        setSearched(false);
                        setQuery('');
                        setSearchParams({}, { replace: true });
                      }}
                    >
                      Track Another Order
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}

        {/* Cancellation Confirmation Modal */}
        {cancelModalOpen && (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-dialog">
              <div className="modal-header">
                <h3>Cancel Order {result?.orderNumber || result?.id}</h3>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => setCancelModalOpen(false)}
                  disabled={cancelling}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div style={{ padding: '20px' }}>
                <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--ink)' }}>
                  Are you sure you want to cancel this order?
                </p>
                <p className="tiny muted" style={{ margin: '0 0 16px' }}>
                  If you cancel now, your ordered items will be immediately released back to our farm inventory.
                </p>

                <label htmlFor="track-cancel-reason" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  Reason for Cancellation:
                </label>
                <select
                  id="track-cancel-reason"
                  className="input"
                  style={{ width: '100%', marginBottom: '16px' }}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  disabled={cancelling}
                >
                  <option value="Changed my mind">Changed my mind</option>
                  <option value="Ordered by mistake">Ordered by mistake</option>
                  <option value="Need to change delivery address">Need to change delivery address</option>
                  <option value="Found a better price / offer">Found a better price / offer</option>
                  <option value="Delivery time is too long">Delivery time is too long</option>
                  <option value="Other">Other</option>
                </select>

                {cancelError && (
                  <div className="notice notice-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px' }}>
                    <AlertCircle size={16} />
                    <span className="tiny">{cancelError}</span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setCancelModalOpen(false)}
                  disabled={cancelling}
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                  onClick={handleCancelOrder}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
