import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatINR, parsePrice, computeTotals } from '../utils/pricing';
import QuantityStepper from './ui/QuantityStepper';
import './CartDrawer.css';

export default function CartDrawer() {
  const cart = useCart();
  const navigate = useNavigate();
  const open = cart?.drawerOpen;
  const items = cart?.items || [];

  const totals = computeTotals({ items });

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') cart?.setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, cart]);

  if (!open) return null;

  const close = () => cart.setDrawerOpen(false);

  const go = (path) => {
    close();
    navigate(path);
  };

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button type="button" className="drawer-backdrop" onClick={close} aria-label="Close cart" tabIndex={-1} />

      <aside className="cart-drawer">
        <header className="drawer-head">
          <div>
            <h2>Your Cart</h2>
            <p className="small muted">{totals.itemCount} item{totals.itemCount === 1 ? '' : 's'}</p>
          </div>
          <button type="button" className="drawer-close" onClick={close} aria-label="Close cart">
            <X size={20} />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="drawer-empty">
            <span className="state-icon">
              <ShoppingBag size={30} />
            </span>
            <h3>Your cart is empty</h3>
            <p className="small muted">Browse the store and add fresh finds — they will show up here.</p>
            <button type="button" className="btn btn-primary" onClick={() => go('/shop')}>
              Start shopping <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="drawer-items">
              {items.map((item) => {
                const lineKey = cart.lineKeyOf(item.id, item.variant);
                const unit = parsePrice(item.price);
                return (
                  <div className="drawer-item" key={lineKey}>
                    <Link to={`/product/${item.id}`} onClick={close} className="drawer-item-media">
                      <img src={item.image} alt={item.title || item.name} width="72" height="72" loading="lazy" />
                    </Link>

                    <div className="drawer-item-body">
                      <div className="drawer-item-top">
                        <Link to={`/product/${item.id}`} onClick={close} className="drawer-item-title">
                          {item.title || item.name}
                        </Link>
                        <button
                          type="button"
                          className="drawer-item-remove"
                          onClick={() => cart.remove(lineKey)}
                          aria-label={`Remove ${item.title || item.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {item.variant && <span className="drawer-item-variant">{item.variant}</span>}

                      <div className="drawer-item-bottom">
                        <QuantityStepper
                          small
                          value={item.quantity}
                          onChange={(qty) => cart.setQuantity(lineKey, qty)}
                          label={`${item.title || item.name} quantity`}
                        />
                        <span className="drawer-item-price">{formatINR(unit * item.quantity)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="drawer-foot">
              <div className="drawer-subtotal">
                <span>Subtotal</span>
                <strong>{formatINR(totals.subtotal)}</strong>
              </div>
              <p className="tiny muted">
                Shipping and discounts are calculated at checkout. Free standard delivery over ₹499.
              </p>

              <div className="drawer-actions">
                <button type="button" className="btn btn-ghost btn-block" onClick={() => go('/cart')}>
                  View full cart
                </button>
                <button type="button" className="btn btn-primary btn-block" onClick={() => go('/checkout')}>
                  Checkout <ArrowRight size={16} />
                </button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
