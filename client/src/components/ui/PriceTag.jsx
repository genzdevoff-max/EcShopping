import { Star } from 'lucide-react';
import { formatINR, discountPercent, parsePrice } from '../../utils/pricing';
import './ui.css';

export function RatingStars({ rating = 0, reviews, size = 13 }) {
  const value = Number(rating) || 0;
  return (
    <span className="rating" aria-label={`Rated ${value.toFixed(1)} out of 5${reviews != null ? `, ${reviews} reviews` : ''}`}>
      <span className="rating-stars">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={size} fill={i < Math.round(value) ? 'currentColor' : 'none'} />
        ))}
      </span>
      <span className="rating-value">{value.toFixed(1)}</span>
      {reviews != null && <span>({reviews})</span>}
    </span>
  );
}

export function PriceTag({ price, compareAt, size = 'md' }) {
  const now = parsePrice(price);
  const was = compareAt ? parsePrice(compareAt) : null;
  const off = was ? discountPercent(now, was) : 0;
  const style = size === 'lg' ? { fontSize: '1.4rem' } : undefined;

  return (
    <span className="price" style={style}>
      <span className="price-now" style={style}>{formatINR(now)}</span>
      {was && was > now && <span className="price-was">{formatINR(was)}</span>}
      {off > 0 && <span className="price-off">{off}% off</span>}
    </span>
  );
}

export default PriceTag;
