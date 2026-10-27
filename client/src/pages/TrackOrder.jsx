import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, PackageCheck, MapPin, Clock, ArrowRight, Ban } from 'lucide-react';
import api from '../utils/api';
import { getOrders } from '../utils/storage';
import { paymentStatusDisplay } from '../utils/orderSync';
import { getDeliveryMethod } from '../utils/pricing';
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

export default function TrackOrder({ loggedInCustomer, onOpenLogin }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('id') || '');
  const [searched, setSearched] = useState(() => Boolean(searchParams.get('id')));
  const [result, setResult] = useState(() => {
    const id = searchParams.get('id');
    if (!id) return null;
    return getOrders().find((o) => String(o.id) === id || String(o.orderNumber) === id) || undefined;
  });

  const lastOrder = (() => {
    try {
      return JSON.parse(localStorage.getItem('ecshopping_last_order') || 'null');
    } catch {
      return null;
    }
  })();

  const [searching, setSearching] = useState(false);

  const runSearch = async (event) => {
    event.preventDefault();
    const code = query.trim();
    setSearched(true);
    setSearchParams(code ? { id: code } : {}, { replace: true });
    if (!code) {
      setResult(null);
      return;
    }
    const local = getOrders().find((o) => String(o.id) === code || String(o.orderNumber) === code);
    if (local) {
      setResult(local);
      return;
    }
    if (loggedInCustomer) {
      setSearching(true);
      try {
        const res = await api.getOrder(code, 'customer');
        if (res?.success && res.order) {
          setResult(res.order);
          setSearching(false);
          return;
        }
      } catch {
        // Fall through to null
      } finally {
        setSearching(false);
      }
    }
    setResult(null);
  };

  const timeline = result ? getTimeline(result) : [];
  const method = result ? getDeliveryMethod(result.deliveryMethod || 'standard') : null;

  return (
    <>
      <PageHero
        title="Track your order"
        subtitle="Enter your order reference (for example EC1718000000000 from your confirmation)."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Track order' }]}
      />

      <div className="container to-wrap">
        <form className="panel to-form" onSubmit={runSearch}>
          <label className="sr-only" htmlFor="track-id">Order reference</label>
          <input
            id="track-id"
            className="input"
            type="text"
            placeholder="e.g. EC1718000000000"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={searching}>
            <Search size={16} /> {searching ? 'Searching...' : 'Track order'}
          </button>
        </form>

        {!searched && (
          <>
            <EmptyState
              icon={<PackageCheck size={30} />}
              title="Where do I find my order reference?"
              text="It appears on the order confirmation page and in My Orders, and starts with EC followed by numbers."
              actions={
                loggedInCustomer
                  ? <Link to="/orders" className="btn btn-primary">View my orders <ArrowRight size={16} /></Link>
                  : <button type="button" className="btn btn-primary" onClick={() => onOpenLogin?.()}>Sign in to see orders <ArrowRight size={16} /></button>
              }
            />
            {lastOrder && (
              <p className="to-hint tiny muted">
              Your most recent order: <strong>{lastOrder.orderNumber || lastOrder.id}</strong>{' '}
              <button
                type="button"
                className="to-hint-link"
                onClick={() => {
                    setQuery(lastOrder.id);
                    setSearched(true);
                    setResult(lastOrder);
                  }}
                >
                  track it now
                </button>
              </p>
            )}
          </>
        )}

        {searched && result === null && (
          <EmptyState
            icon={<Search size={28} />}
            title="No order matches that reference"
            text={`Nothing found for “${query}” in this browser. Check the reference, or sign in on the device where you placed the order.`}
            actions={
              <>
                <Link to="/orders" className="btn btn-primary">My orders</Link>
                <Link to="/shop" className="btn btn-ghost">Continue shopping</Link>
              </>
            }
          />
        )}

        {searched && result === undefined && (
          <EmptyState
            icon={<Search size={28} />}
            title="Order not found"
            text="That reference does not match any order stored in this browser."
            actions={<Link to="/orders" className="btn btn-primary">My orders</Link>}
          />
        )}

        {result && (
          <section className="panel to-block">
            <div className="to-summary">
              <div>
                <strong>{result.orderNumber || result.id}</strong>
                <span> · Placed {formatOrderDate(result.date)} · {paymentStatusDisplay(result, PAYMENT_STATUS_LABELS)}</span>
              </div>
              <span className={statusBadgeClass(result.status)}>
                {statusLabel(result.status)}
              </span>
            </div>

            <ul className="timeline">
              {timeline.map((step) => (
                <li key={step.id} className={`timeline-item ${step.done ? 'done' : ''} ${step.current ? 'current' : ''}`}>
                  <span className="timeline-dot" />
                  <div className="timeline-body">
                    <h4>{step.label}</h4>
                    {step.current && <p>{step.description || 'Current stage — in progress.'}</p>}
                    {step.done && <p>Completed.</p>}
                  </div>
                </li>
              ))}
            </ul>

            <p className="to-eta">
              <Clock size={16} />
              Estimated delivery: <strong>{method.detail}</strong> via {method.label}
            </p>

            {result.shippingAddress && (
              <p className="to-eta">
                <MapPin size={16} />
                Delivering to {result.shippingAddress.city}, {result.shippingAddress.state} — {result.shippingAddress.postcode}
              </p>
            )}

            <p className="tiny muted to-block-note">
              Tracking updates appear as your parcel moves through each delivery stage.
            </p>

            <div className="od-actions to-actions">
              <Link to={`/orders/${result.id}`} className="btn btn-outline">Order details</Link>
              {(result.status?.toLowerCase() === 'processing' || result.status?.toLowerCase() === 'pending' || result.status?.toLowerCase() === 'confirmed') && (
                <Link to={`/orders/${result.id}`} className="btn btn-outline" style={{ color: '#dc2626', borderColor: '#fca5a5' }}>
                  <Ban size={15} /> Cancel order
                </Link>
              )}
              <Link to="/orders" className="btn btn-ghost">All orders</Link>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
