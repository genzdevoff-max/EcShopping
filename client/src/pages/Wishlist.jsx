import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2 } from 'lucide-react';
import { PageHero } from '../components/ui/PageHeader';
import ProductCard from '../components/ui/ProductCard';
import '../components/policy.css';

const WISHLIST_KEY = 'ecshopping_wishlist';

function readWishlist() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Wishlist({ onAddToCart }) {
  const [items, setItems] = useState(readWishlist);

  useEffect(() => {
    const sync = () => setItems(readWishlist());
    window.addEventListener('wishlistUpdated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('wishlistUpdated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const clearAll = () => {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify([]));
    window.dispatchEvent(new Event('wishlistUpdated'));
  };

  return (
    <>
      <PageHero
        title="My wishlist"
        subtitle={
          items.length > 0
            ? `${items.length} saved item${items.length === 1 ? '' : 's'} — pick up where you left off.`
            : 'Save items you love and come back to them later.'
        }
        crumbs={[{ label: 'Wishlist' }]}
      />

      <div className="container" style={{ paddingBlock: 'clamp(24px, 3vw, 40px) clamp(46px, 6vw, 72px)' }}>
        {items.length === 0 ? (
          <div className="panel" style={{ padding: 'clamp(36px, 6vw, 64px) 24px', textAlign: 'center' }}>
            <Heart size={40} style={{ color: 'var(--muted)' }} aria-hidden="true" />
            <h2 style={{ fontSize: '1.3rem', margin: '16px 0 8px' }}>Your wishlist is empty</h2>
            <p className="muted" style={{ margin: '0 auto 22px', maxWidth: '44ch', lineHeight: 1.65 }}>
              Tap the heart on any product to save it here — it stays on this device until you are ready to buy.
            </p>
            <Link to="/shop" className="btn btn-primary">Explore products</Link>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '14px',
                flexWrap: 'wrap',
                marginBottom: '20px',
              }}
            >
              <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                Use the heart on a card to remove it, or add it straight to your cart.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Link to="/shop" className="btn btn-outline btn-sm">Continue shopping</Link>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
                  <Trash2 size={15} aria-hidden="true" /> Clear all
                </button>
              </div>
            </div>

            <div className="wishlist-list" style={{ display: 'grid', gap: '16px' }}>
              {items.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  horizontal
                  showVariants={false}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
