import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, ShoppingBag, Check, Star, ArrowRight, ShieldCheck } from 'lucide-react';
import { formatINR, discountPercent, parsePrice } from '../../utils/pricing';
import { categoryDisplayForName, DEFAULT_CATEGORY_IMAGE } from '../../data/content';
import { useCart } from '../../context/CartContext';
import QuantityStepper from './QuantityStepper';
import './ProductQuickView.css';

/**
 * Product Quick-View Pop-Up Modal
 * - Desktop: Centered modal with backdrop
 * - Mobile: Bottom-sheet style with drag handle and scrollable viewport
 */
export default function ProductQuickView({ product, open, onClose, onAddToCart }) {
  const dialogRef = useRef(null);
  const previouslyFocusedElement = useRef(null);
  const cart = useCart();
  const add = onAddToCart || cart?.add;

  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(
    product?.variants && product.variants.length > 0 ? product.variants[0] : null
  );
  const [added, setAdded] = useState(false);

  // Sync selected variant when product changes
  useEffect(() => {
    if (product?.variants && product.variants.length > 0) {
      setSelectedVariant(product.variants[0]);
    } else {
      setSelectedVariant(null);
    }
    setQuantity(1);
    setAdded(false);
  }, [product?.id]);

  // Keyboard navigation & body scroll lock
  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedElement.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Focus the modal after open
    const timer = setTimeout(() => {
      const focusable = dialogRef.current?.querySelector('button, [href], input, [tabindex="0"]');
      focusable?.focus();
    }, 50);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
      if (previouslyFocusedElement.current && typeof previouslyFocusedElement.current.focus === 'function') {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open || !product) return null;

  const price = parsePrice(product.price);
  const compareAt = product.compareAt ? parsePrice(product.compareAt) : null;
  const off = compareAt && compareAt > price ? discountPercent(price, compareAt) : 0;
  const outOfStock = product.inStock === false;

  const handleAddToCart = () => {
    if (outOfStock || !add) return;
    add(product, quantity, selectedVariant);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const modalContent = (
    <div
      className="quickview-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="quickview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quickview-product-title"
        ref={dialogRef}
      >
        {/* Mobile bottom-sheet drag handle */}
        <div className="quickview-sheet-handle" aria-hidden="true" />

        {/* Close Button */}
        <button
          type="button"
          className="quickview-close-btn"
          onClick={() => onClose?.()}
          aria-label="Close product quick view"
          title="Close (Esc)"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div className="quickview-grid">
          {/* Left Column: Media */}
          <div className="quickview-media-col">
            <div className="quickview-image-wrap">
              <img
                src={product.image}
                alt={product.title}
                loading="eager"
                onError={(e) => {
                  const fallback =
                    (product.category && categoryDisplayForName(product.category).image) ||
                    DEFAULT_CATEGORY_IMAGE;
                  if (fallback && e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                  }
                }}
              />
              <div className="quickview-badges">
                {off > 0 && <span className="badge badge-sale">{off}% off</span>}
                {product.badge && (
                  <span className={`badge ${off > 0 ? 'badge-hot' : 'badge-soft'}`}>
                    {product.badge}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Details & Actions */}
          <div className="quickview-details-col">
            <span className="quickview-seller">{product.seller || 'EcShopping Seller'}</span>

            <h2 id="quickview-product-title" className="quickview-title">
              {product.title}
            </h2>

            {/* Ratings */}
            {product.rating != null && (
              <div className="quickview-rating-row" aria-label={`Rated ${product.rating} out of 5 stars`}>
                <span className="rating-stars" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star
                      key={i}
                      size={14}
                      fill={i < Math.round(product.rating || 0) ? 'currentColor' : 'none'}
                    />
                  ))}
                </span>
                <strong>{Number(product.rating).toFixed(1)}</strong>
                {product.reviews != null && <span>({product.reviews} reviews)</span>}
              </div>
            )}

            {/* Price Box */}
            <div className="quickview-price-block">
              <span className="quickview-price-now">{formatINR(price)}</span>
              {compareAt && compareAt > price && (
                <>
                  <span className="quickview-price-was">{formatINR(compareAt)}</span>
                  <span className="quickview-discount-tag">
                    Save {formatINR(compareAt - price)}
                  </span>
                </>
              )}
            </div>

            {/* Description Snippet */}
            {product.description && (
              <p className="quickview-desc">{product.description}</p>
            )}

            {/* Available Variants */}
            {product.variants && product.variants.length > 0 && (
              <div className="quickview-variants">
                <span className="quickview-section-label">
                  Variant: {selectedVariant || 'Standard'}
                </span>
                <div className="quickview-variant-options" role="radiogroup" aria-label="Product variant">
                  {product.variants.map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      role="radio"
                      aria-checked={selectedVariant === variant}
                      className={`quickview-variant-chip ${selectedVariant === variant ? 'active' : ''}`}
                      onClick={() => setSelectedVariant(variant)}
                    >
                      {variant}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock status */}
            <div className="quickview-stock-notice">
              {outOfStock ? (
                <span className="quickview-stock-out">Out of stock</span>
              ) : (
                <span className="quickview-stock-in">
                  <ShieldCheck size={16} aria-hidden="true" />
                  In stock · Dispatched by {product.seller || 'EcShopping Seller'}
                </span>
              )}
            </div>

            {/* Quantity and Actions */}
            <div className="quickview-actions">
              {!outOfStock && (
                <QuantityStepper
                  value={quantity}
                  onChange={setQuantity}
                  min={1}
                  max={10}
                  label="quantity"
                />
              )}

              <button
                type="button"
                className={`btn btn-primary quickview-add-btn ${added ? 'quickview-added-state' : ''}`}
                onClick={handleAddToCart}
                disabled={outOfStock}
                aria-label={outOfStock ? 'Product is out of stock' : `Add ${quantity} to cart`}
              >
                {added ? <Check size={18} aria-hidden="true" /> : <ShoppingBag size={18} aria-hidden="true" />}
                {added ? 'Added to cart' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>

            {/* Full Product Page Navigation Link */}
            <Link
              to={`/product/${product.id}`}
              onClick={() => onClose?.()}
              className="quickview-details-link"
            >
              <span>View full product details</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
