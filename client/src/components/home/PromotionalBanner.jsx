import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import './PromotionalBanner.css';

export const PROMO_CAMPAIGNS = [
  {
    id: 'harvest-fresh',
    tag: 'Direct Farm Harvest',
    title: 'Pure Organic Produce & Farm Harvests',
    subtitle: 'Residue-free vegetables, cold-pressed oils & raw forest honey directly from certified local farmers.',
    primaryCta: { label: 'Shop Fresh Harvest', to: '/shop' },
    secondaryCta: { label: 'Explore Deals', to: '/collection/deals' },
    badge: '100% Certified Organic • Free Delivery over ₹499',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80'
  },
  {
    id: 'wood-pressed-oils',
    tag: 'Traditional Cold-Pressed',
    title: 'Authentic Wood-Pressed Oils & Pure Desi Ghee',
    subtitle: 'Stone-ground sesame, groundnut, and coconut oils crafted by artisanal Tamil Nadu producers.',
    primaryCta: { label: 'Shop Pantry Staples', to: '/category/pantry-staples' },
    secondaryCta: { label: 'Browse Catalog', to: '/shop' },
    badge: 'Zero Chemical Refining • Pure Nutrient Retention',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=1600&q=80'
  },
  {
    id: 'weekend-deals',
    tag: 'Weekly Farmer Special',
    title: 'Save on Daily Essentials & Farm Bundles',
    subtitle: 'Enjoy verified seller discounts on heritage rice, organic country eggs, and pure palm jaggery.',
    primaryCta: { label: 'View Today’s Deals', to: '/collection/deals' },
    secondaryCta: { label: 'All Products', to: '/shop' },
    badge: 'Limited Stock • Direct Farmer Support',
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1600&q=80'
  }
];

export default function PromotionalBanner({ campaigns = PROMO_CAMPAIGNS, interval = 6000 }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  const total = campaigns.length;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const goToSlide = (idx) => {
    setCurrentIndex(idx);
  };

  useEffect(() => {
    if (total <= 1 || isPaused) return undefined;
    timerRef.current = setInterval(nextSlide, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [total, isPaused, nextSlide, interval]);

  if (!campaigns || total === 0) return null;

  const active = campaigns[currentIndex];

  return (
    <section
      className="promo-banner-section"
      aria-label="Promotional campaign banner"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="promo-banner-container">
        <div className="promo-banner-viewport">
          {campaigns.map((camp, idx) => {
            const isActive = idx === currentIndex;
            return (
              <div
                key={camp.id}
                className={`promo-banner-slide ${isActive ? 'active' : ''}`}
                aria-hidden={!isActive}
              >
                {/* Background campaign image with dark Pine Green gradient overlay */}
                <div className="promo-banner-media">
                  <img
                    src={camp.image}
                    alt=""
                    className="promo-banner-img"
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    fetchPriority={idx === 0 ? 'high' : 'low'}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="promo-banner-overlay" />
                </div>

                {/* Content Overlay */}
                <div className="promo-banner-content">
                  <div className="promo-banner-tag-row">
                    <span className="promo-banner-tag">
                      <Sparkles size={13} className="promo-tag-icon" aria-hidden="true" />
                      {camp.tag}
                    </span>
                    {camp.badge && (
                      <span className="promo-banner-badge">{camp.badge}</span>
                    )}
                  </div>

                  <h2 className="promo-banner-title">{camp.title}</h2>
                  <p className="promo-banner-sub">{camp.subtitle}</p>

                  <div className="promo-banner-actions">
                    <Link
                      to={camp.primaryCta.to}
                      className="promo-btn promo-btn-primary"
                      aria-label={`${camp.primaryCta.label} - ${camp.title}`}
                    >
                      <span>{camp.primaryCta.label}</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    {camp.secondaryCta && (
                      <Link
                        to={camp.secondaryCta.to}
                        className="promo-btn promo-btn-secondary"
                        aria-label={`${camp.secondaryCta.label} - ${camp.title}`}
                      >
                        <span>{camp.secondaryCta.label}</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Navigation Controls: Previous / Next arrow buttons */}
          {total > 1 && (
            <>
              <button
                type="button"
                className="promo-arrow promo-arrow-prev"
                onClick={prevSlide}
                aria-label="Previous promotional slide"
              >
                <ChevronLeft size={22} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="promo-arrow promo-arrow-next"
                onClick={nextSlide}
                aria-label="Next promotional slide"
              >
                <ChevronRight size={22} aria-hidden="true" />
              </button>

              {/* Pagination Dots */}
              <div className="promo-dots" role="tablist" aria-label="Campaign slides">
                {campaigns.map((camp, idx) => (
                  <button
                    key={camp.id}
                    type="button"
                    role="tab"
                    className={`promo-dot ${idx === currentIndex ? 'active' : ''}`}
                    onClick={() => goToSlide(idx)}
                    aria-label={`Slide ${idx + 1}: ${camp.title}`}
                    aria-selected={idx === currentIndex}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
