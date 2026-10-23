import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2, Truck, Tag, ArrowRight, ShieldCheck } from 'lucide-react';
import { useCart, lineKeyOf as fallbackKey } from '../context/CartContext';
import { formatINR, computeTotals, DELIVERY_METHODS } from '../utils/pricing';
import { PageHero } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/States';
import QuantityStepper from '../components/ui/QuantityStepper';
import './Cart.css';

export default function Cart({ cartItems, updateQuantity, removeItem }) {
  const navigate = useNavigate();
  const ctx = useCart();
  const keyOf = ctx?.lineKeyOf || fallbackKey;

  const items = ctx?.items ?? cartItems ?? [];
  const setQty = (lineKey, qty) => {
    if (ctx?.setQuantity) ctx.setQuantity(lineKey, qty);
    else if (updateQuantity) updateQuantity(lineKey.split('::')[0], qty);
  };
  const removeLine = (lineKey) => {
    if (ctx?.remove) ctx.remove(lineKey);
    else if (removeItem) removeItem(lineKey.split('::')[0]);
  };

  const standard = DELIVERY_METHODS.find((m) => m.id === 'standard') || DELIVERY_METHODS[0];
  const totals = computeTotals({ items, deliveryMethodId: 'standard' });
  const subtotal = totals.subtotal;
  const freeShipping = standard.freeOver && subtotal >= standard.freeOver;
  const toFreeShipping = standard.freeOver ? Math.max(0, standard.freeOver - subtotal) : 0;
  const progress = standard.freeOver
    ? Math.min(100, Math.round((subtotal / standard.freeOver) * 100))
    : 100;
  const itemCount = items.reduce((n, item) => n + item.quantity, 0);

  if (items.length === 0) {
    return (
      <>
        <PageHero title="Shopping cart" subtitle="Your cart is waiting for its first pick." crumbs={[{ label: 'Cart' }]} />
        <section className="section">
          <div className="container">
            <EmptyState
              icon={<ShoppingBag size={30} />}
              title="Your cart is currently empty"
              text="Browse the shop and add a few everyday essentials — produce, pantry staples or something handmade."
              actions={
                <>
                  <Link to="/shop" className="btn btn-primary">Return to shop <ArrowRight size={16} /></Link>
                  <Link to="/collection/new-arrivals" className="btn btn-ghost">See new arrivals</Link>
                </>
              }
            />
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero
        title="Shopping cart"
        subtitle={`${itemCount} item${itemCount === 1 ? '' : 's'} · prices in ₹, taxes included`}
        crumbs={[{ label: 'Cart' }]}
      />

      <div className="container cart-layout">
        <section className="cart-items" aria-label="Cart items">
          {items.map((item) => {
            const lineKey = keyOf(item.id, item.variant);
            const price = Number(item.price) || 0;
            const lineTotal = price * item.quantity;
            const outOfStock = item.inStock === false;

            return (
              <article className="cart-line" key={lineKey}>
                <Link to={`/product/${item.id}`} className="cart-line-media">
                  <img src={item.image} alt={item.title} width="120" height="120" />
                </Link>

                <div className="cart-line-body">
                  <div className="cart-line-head">
                    <Link to={`/product/${item.id}`} className="cart-line-title">
                      {item.title}
                    </Link>
                    <span className="cart-line-seller">{item.seller || 'EcShopping Seller'}</span>
                    {item.variant && <span className="badge badge-soft">Pack: {item.variant}</span>}
                    {outOfStock && <span className="badge badge-danger">Out of stock</span>}
                  </div>

                  <div className="cart-line-foot">
                    <div className="cart-line-qty">
                      <QuantityStepper
                        small
                        value={item.quantity}
                        min={1}
                        max={99}
                        onChange={(qty) => setQty(lineKey, qty)}
                        label={`quantity of ${item.title}`}
                      />
                    </div>

                    <div className="cart-line-prices">
                      <span className="cart-line-unit">{formatINR(price)} each</span>
                      <strong className="cart-line-total">{formatINR(lineTotal)}</strong>
                    </div>

                    <button
                      type="button"
                      className="cart-line-remove"
                      onClick={() => removeLine(lineKey)}
                      aria-label={`Remove ${item.title} from cart`}
                      title="Remove"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          <div className="cart-actions-row">
            <Link to="/shop" className="btn btn-ghost">← Continue shopping</Link>
            <Link to="/wishlist" className="btn btn-ghost">View wishlist</Link>
          </div>
        </section>

        <aside className="cart-summary" aria-label="Order summary">
          <div className="panel cart-summary-panel">
            <h2>Order summary</h2>

            <div className="summary-row">
              <span>Subtotal ({itemCount} items)</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            <div className="summary-row">
              <span>
                <Truck size={14} /> {standard.label}
              </span>
              <span>{freeShipping ? 'FREE' : formatINR(totals.shipping)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="summary-row discount">
                <span><Tag size={14} /> Discount</span>
                <span>−{formatINR(totals.discount)}</span>
              </div>
            )}

            <div className="summary-divider" />

            <div className="summary-row total">
              <span>Total</span>
              <span>{formatINR(totals.total)}</span>
            </div>

            <p className="tiny muted cart-tax-note">Inclusive of all taxes. Shipping estimates update at checkout.</p>

            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => navigate('/checkout')}>
              Proceed to checkout <ArrowRight size={17} />
            </button>

            <p className="cart-coupon-note">
              <Tag size={14} /> Have a code? Coupons are applied on the checkout page.
            </p>

            <ul className="cart-assurances">
              <li><ShieldCheck size={15} /> Secure, mock checkout — no real payment in this release</li>
              <li><Truck size={15} /> Standard delivery {standard.detail.toLowerCase()}</li>
            </ul>
          </div>

          {standard.freeOver > 0 && (
            <div className="panel cart-freeship">
              {freeShipping ? (
                <p className="freeship-msg ok"><Truck size={16} /> You have unlocked FREE standard delivery.</p>
              ) : (
                <>
                  <p className="freeship-msg">
                    <Truck size={16} /> Add <strong>{formatINR(toFreeShipping)}</strong> more for free standard delivery.
                  </p>
                  <div className="freeship-bar" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
