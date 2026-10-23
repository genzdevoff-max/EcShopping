import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, PackageCheck, ArrowRight, Truck, Receipt, KeyRound } from 'lucide-react';
import { getOrders } from '../utils/storage';
import { formatINR, getDeliveryMethod } from '../utils/pricing';
import { PageHero } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/States';
import PaymentStates from '../components/checkout/PaymentStates';
import './OrderConfirmation.css';

export default function OrderConfirmation({ loggedInCustomer }) {
  const location = useLocation();
  const { orderId } = useParams();

  const order = useMemo(() => {
    if (location.state?.order) return location.state.order;
    try {
      const saved = JSON.parse(localStorage.getItem('ecshopping_last_order') || 'null');
      if (saved && String(saved.id) === String(orderId)) return saved;
    } catch {
      /* ignore corrupt storage */
    }
    return getOrders().find((o) => String(o.id) === String(orderId)) || null;
  }, [location.state, orderId]);

  const autoCredentials = location.state?.autoCredentials;
  const payment = location.state?.payment;

  if (!order) {
    return (
      <>
        <PageHero title="Order confirmation" crumbs={[{ label: 'Order confirmation' }]} />
        <section className="section">
          <div className="container">
            <EmptyState
              icon={<Receipt size={30} />}
              title="We could not find that order"
              text="This confirmation link has expired or the order was placed in a different browser. Your order history still lists every order you placed while signed in."
              actions={
                <>
                  <Link to="/orders" className="btn btn-primary">View my orders</Link>
                  <Link to="/shop" className="btn btn-ghost">Continue shopping</Link>
                </>
              }
            />
          </div>
        </section>
      </>
    );
  }

  const method = getDeliveryMethod(order.deliveryMethod || 'standard');
  const paymentMethod = order.paymentMethod || 'cod';
  const paymentStatus = order.paymentStatus || 'pending';

  const timeline = [
    { id: 'confirmed', label: 'Order confirmed', note: 'We received your order.', done: true },
    { id: 'packing', label: 'Packed by seller', note: `${method.detail} dispatch window.`, done: false },
    { id: 'shipping', label: 'On the way', note: 'Courier pickup and transit updates.', done: false },
    { id: 'delivered', label: 'Delivered', note: 'Handed over at your address.', done: false }
  ];

  return (
    <>
      <PageHero
        title="Order confirmed"
        subtitle={`Order ${order.orderNumber || order.id} · ${new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Order confirmed' }]}
      />

      <div className="container oc-wrap">
        <section className="panel oc-hero">
          <span className="oc-check"><CheckCircle2 size={34} /></span>
          <div className="oc-hero-copy">
            <h2>Thank you{order.customerName ? `, ${order.customerName.split(' ')[0]}` : ''} — your order is in.</h2>
            <p>
              A confirmation is stored with your account{loggedInCustomer ? ' and in your order history' : ''},
              and we will notify you as your order moves through each stage.
            </p>
          </div>

          <div className="oc-hero-actions">
            <Link to={`/orders/${order.id}`} className="btn btn-primary">Track this order <ArrowRight size={16} /></Link>
            <Link to="/shop" className="btn btn-outline">Continue shopping</Link>
          </div>
        </section>

        <div className="oc-grid">
          {/* Payment status */}
          <section className="panel oc-block">
            <h3><Receipt size={17} /> Payment</h3>

            {paymentMethod === 'phonepe' ? (
              <PaymentStates
                state={paymentStatus === 'pending' ? 'pending' : 'success'}
                message={order.paymentNote || payment?.message}
                reference={order.paymentReference || payment?.reference}
              />
            ) : (
              <div className="oc-cod">
                <strong>Cash on delivery</strong>
                <p>Pay {formatINR(order.totalAmount ?? order.total ?? 0)} to the courier when your order arrives.</p>
              </div>
            )}

            <dl className="oc-totals">
              <div><dt>Subtotal</dt><dd>{formatINR(order.subtotal || 0)}</dd></div>
              {order.discount > 0 && (
                <div><dt>Coupon {order.couponCode ? `(${order.couponCode})` : ''}</dt><dd className="oc-save">−{formatINR(order.discount)}</dd></div>
              )}
              <div><dt>Shipping</dt><dd>{order.shipping === 0 ? 'FREE' : formatINR(order.shipping || 0)}</dd></div>
              <div className="oc-total"><dt>Total paid / due</dt><dd>{formatINR(order.totalAmount ?? order.total ?? 0)}</dd></div>
            </dl>
          </section>

          {/* Delivery timeline */}
          <section className="panel oc-block">
            <h3><Truck size={17} /> Delivery · {method.label}</h3>
            <ul className="timeline">
              {timeline.map((step) => (
                <li key={step.id} className={`timeline-item ${step.done ? 'done' : ''} ${step.id === 'packing' ? 'current' : ''}`}>
                  <span className="timeline-dot" />
                  <div className="timeline-body">
                    <h4>{step.label}</h4>
                    <p>{step.note}</p>
                  </div>
                </li>
              ))}
            </ul>

            {order.shippingAddress && (
              <p className="oc-address">
                <strong>Shipping to:</strong> {order.shippingAddress.street}, {order.shippingAddress.city},{' '}
                {order.shippingAddress.state} — {order.shippingAddress.postcode}
              </p>
            )}
          </section>

          {/* Items */}
          <section className="panel oc-block oc-items-block">
            <h3><PackageCheck size={17} /> Items in this order</h3>
            <ul className="oc-items">
              {(order.items || []).map((item) => (
                <li key={`${item.id}-${item.variant || 'default'}`}>
                  <img src={item.image} alt="" width="54" height="54" />
                  <span className="oc-item-copy">
                    <strong>{item.title}</strong>
                    {item.variant && <small>Variant: {item.variant}</small>}
                    <small>Sold by {item.seller || 'EcShopping Seller'} · Qty {item.quantity}</small>
                  </span>
                  <span className="oc-item-price">{formatINR((Number(item.price) || 0) * (item.quantity || 1))}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Auto account */}
          {autoCredentials?.isNew && (
            <section className="panel oc-block oc-account">
              <h3><KeyRound size={17} /> Your account is ready</h3>
              <p>
                We created a basic EcShopping account for <strong>{autoCredentials.email}</strong> so you can
                track orders and reorder faster.
              </p>
              <p className="oc-temp-pass">
                Temporary password: <code>{autoCredentials.password}</code>
              </p>
              <p className="tiny muted">Save it now — you can change it later from your profile.</p>
            </section>
          )}
        </div>

        <div className="oc-foot-links">
          <Link to="/orders" className="btn btn-outline">View all orders</Link>
          <Link to="/track-order" className="btn btn-ghost">Track another order</Link>
          <Link to="/profile" className="btn btn-ghost">Go to profile</Link>
        </div>
      </div>
    </>
  );
}
