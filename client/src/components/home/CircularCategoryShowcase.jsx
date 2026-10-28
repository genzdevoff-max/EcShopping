import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { DEFAULT_CATEGORY_IMAGE } from '../../data/content';
import './CircularCategoryShowcase.css';

export default function CircularCategoryShowcase({ categories = [], loading = false }) {
  const trackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Filter out noise or non-customer categories
  const activeCategories = (categories || []).filter(
    (c) => c && c.name && c.name.toLowerCase() !== 'test' && c.name.toLowerCase() !== 'organic'
  );

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;

    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [activeCategories.length, updateScrollState]);

  const scrollByAmount = (delta) => {
    if (trackRef.current) {
      trackRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  const handleScrollLeft = () => {
    const step = trackRef.current ? Math.round(trackRef.current.clientWidth * 0.75) : 320;
    scrollByAmount(-step);
  };

  const handleScrollRight = () => {
    const step = trackRef.current ? Math.round(trackRef.current.clientWidth * 0.75) : 320;
    scrollByAmount(step);
  };

  // Skeleton loading state
  if (loading) {
    return (
      <section
        className="circular-category-showcase compact-cat-nav"
        aria-label="Loading categories"
      >
        <div className="container circular-cat-container">
          <div className="circular-cat-head">
            <div className="circular-cat-title-wrap">
              <span className="circular-cat-eyebrow">Explore Aisles</span>
              <h2 className="circular-cat-title">Shop by Category</h2>
            </div>
          </div>
          <div className="circular-cat-track skeleton-track" role="status">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="circular-cat-item circular-cat-skeleton-item">
                <div className="circular-cat-media skeleton" />
                <div className="circular-cat-label-skeleton skeleton" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // If no categories and not loading, render nothing
  if (!activeCategories.length) {
    return null;
  }

  return (
    <section
      className="circular-category-showcase compact-cat-nav"
      aria-label="Shop by Category"
    >
      <div className="container circular-cat-container">
        {/* Section Header: Left title + Right scroll arrows & "Show more" link */}
        <div className="circular-cat-head">
          <div className="circular-cat-title-wrap">
            <span className="circular-cat-eyebrow">Explore Aisles</span>
            <h2 className="circular-cat-title">Shop by Category</h2>
          </div>

          <div className="circular-cat-actions">
            {/* Horizontal track scroll arrows (Desktop/Tablet scroll controls) */}
            <div
              className="circular-cat-scroll-controls"
              role="group"
              aria-label="Scroll category items"
            >
              <button
                type="button"
                className="circular-cat-arrow circular-cat-arrow-left"
                onClick={handleScrollLeft}
                disabled={!canScrollLeft}
                aria-label="Scroll categories left"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="circular-cat-arrow circular-cat-arrow-right"
                onClick={handleScrollRight}
                disabled={!canScrollRight}
                aria-label="Scroll categories right"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Canonical navigation to full product listing */}
            <Link
              to="/shop"
              className="circular-cat-show-more-link"
              aria-label="Show more - view all products"
            >
              <span>Show more</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Circular Categories Track */}
        <div
          ref={trackRef}
          className="circular-cat-track"
          tabIndex={0}
          role="region"
          aria-label="Category list"
        >
          {activeCategories.map((cat) => {
            const imgSrc = cat.image || DEFAULT_CATEGORY_IMAGE;
            return (
              <Link
                key={cat.slug}
                to={`/category/${cat.slug}`}
                className="circular-cat-item"
                aria-label={`Shop ${cat.title} category`}
              >
                <div className="circular-cat-media">
                  <img
                    src={imgSrc}
                    alt={cat.title}
                    width="88"
                    height="88"
                    loading="lazy"
                    onError={(e) => {
                      if (e.currentTarget.src !== DEFAULT_CATEGORY_IMAGE) {
                        e.currentTarget.src = DEFAULT_CATEGORY_IMAGE;
                      }
                    }}
                  />
                </div>
                <span className="circular-cat-label">{cat.title}</span>
              </Link>
            );
          })}

          {/* End-cap "All Products / Show more" circular icon tile */}
          <Link
            to="/shop"
            className="circular-cat-item circular-cat-all-tile"
            aria-label="Show more - view all products in catalog"
          >
            <div className="circular-cat-media circular-cat-all-media">
              <div className="circular-cat-all-circle">
                <ArrowRight size={26} aria-hidden="true" />
              </div>
            </div>
            <span className="circular-cat-label">All Products</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
