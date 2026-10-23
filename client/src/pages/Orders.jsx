import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageSearch, Receipt, ArrowRight, MapPin } from 'lucide-react';
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
    </>
  );
}
