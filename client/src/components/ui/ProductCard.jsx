import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Check, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { categoryDisplayForName, DEFAULT_CATEGORY_IMAGE } from '../../data/content';
import { formatINR, discountPercent, parsePrice } from '../../utils/pricing';
import './ui.css';

const WISHLIST_KEY = 'ecshopping_wishlist';

function readWishlist() {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
  } catch {
    return [];
  }
}

export function toggleWishlistItem(product) {
  const list = readWishlist();
  const exists = list.some((i) => String(i.id) === String(product.id));
  const next = exists ? list.filter((i) => String(i.id) !== String(product.id)) : [...list, product];
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('wishlistUpdated'));
  return !exists;
}

export function isWishlisted(id) {
  return readWishlist().some((i) => String(i.id) === String(id));
}

export default function ProductCard({ product, onAddToCart, showVariants = true, horizontal = false }) {
  const cart = useCart();
  const add = onAddToCart || cart?.add;
  const [wished, setWished] = useState(() => isWishlisted(product.id));
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setWished(isWishlisted(product.id));
  }, [product.id]);

  const price = parsePrice(product.price);
  const compareAt = product.compareAt ? parsePrice(product.compareAt) : null;
  const off = compareAt ? discountPercent(price, compareAt) : 0;
  const outOfStock = product.inStock === false;
  const defaultVariant = product.variants && product.variants.length ? product.variants[0] : null;

  const handleAdd = () => {
    if (outOfStock || !add) return;
    add(product, 1, defaultVariant);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const handleWish = () => setWished(toggleWishlistItem(product));

  const badges = [];
  if (off > 0) badges.push(<span key="off" className="badge badge-sale">{off}% off</span>);
  if (product.badge) badges.push(
    <span key="badge" className={`badge ${off > 0 ? 'badge-hot' : 'badge-soft'}`}>{product.badge}</span>
  );

  return (
    <article className={`pcard ${horizontal ? 'horizontal' : ''}`}>
      <div className="pcard-media">
        <Link to={`/product/${product.id}`} aria-label={product.title}>
          <img
            src={product.image}
            alt={product.title}
            loading="lazy"
            width="440"
            height="440"
          onError={(e) => {
            const fallback = (product.category && categoryDisplayForName(product.category).image) || DEFAULT_CATEGORY_IMAGE;
            if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
          }}
          />
        </Link>

        {badges.length > 0 && <div className="pcard-badges">{badges}</div>}

        <button
          type="button"
          className={`pcard-wish ${wished ? 'active' : ''}`}
          onClick={handleWish}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`}
          title={wished ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <Heart size={16} fill={wished ? 'currentColor' : 'none'} />
        </button>

        {outOfStock && <div className="pcard-stock">Out of stock</div>}
      </div>

      <div className="pcard-body">
        <span className="pcard-seller">{product.seller || 'EcShopping Seller'}</span>

        <Link to={`/product/${product.id}`} className="pcard-title-link">
          <h3 className="pcard-title">{product.title}</h3>
        </Link>

        {product.rating != null ? (
          <div className="rating" aria-label={`Rated ${product.rating} out of 5`}>
            <span className="rating-stars">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} size={13} fill={i < Math.round(product.rating || 0) ? 'currentColor' : 'none'} />
              ))}
            </span>
            <span className="rating-value">{Number(product.rating).toFixed(1)}</span>
            {product.reviews != null && <span>({product.reviews})</span>}
          </div>
        ) : (
          <span className="tiny muted pcard-norating">Seller hasn’t collected ratings yet</span>
        )}

        {showVariants && product.variants && product.variants.length > 0 && (
          <div className="pcard-variants">
            {product.variants.slice(0, 3).map((v) => (
              <span key={v} className="pcard-variant">{v}</span>
            ))}
            {product.variants.length > 3 && <span className="pcard-variant">+{product.variants.length - 3}</span>}
          </div>
        )}

        <div className="pcard-foot">
          <span className="price">
            <span className="price-now">{formatINR(price)}</span>
            {compareAt && compareAt > price && <span className="price-was">{formatINR(compareAt)}</span>}
          </span>

          <button
            type="button"
            className={`pcard-add ${added ? 'added' : ''}`}
            onClick={handleAdd}
            disabled={outOfStock}
            aria-label={`Add ${product.title} to cart`}
          >
            {added ? <Check size={15} /> : <ShoppingBag size={15} />}
            {added ? 'Added' : 'Add'}
          </button>
        </div>
      </div>
    </article>
  );
}
