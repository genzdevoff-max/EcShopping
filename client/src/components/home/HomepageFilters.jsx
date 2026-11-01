import { useState } from 'react';
import { Tag, Sparkles, Filter, X, ArrowUpDown, ChevronRight, Check } from 'lucide-react';
import './HomepageFilters.css';

export default function HomepageFilters({
  categories = [],
  activeCategory = 'all',
  onSelectCategory,
  activePrice = 'all',
  onSelectPrice,
  activeSort = 'featured',
  onSelectSort,
  onResetFilters,
  hasActiveFilters = false,
  totalResults = 0
}) {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const priceBands = [
    { id: 'all', label: 'All Prices' },
    { id: 'under-199', label: 'Under ₹199', max: 199 },
    { id: 'under-499', label: 'Under ₹499', max: 499 },
    { id: '500-plus', label: '₹500 & Above', min: 500 }
  ];

  const sortOptions = [
    { id: 'featured', label: 'Featured' },
    { id: 'price-asc', label: 'Price: Low to High' },
    { id: 'price-desc', label: 'Price: High to Low' },
    { id: 'discount', label: 'Biggest Discount' }
  ];

  const cleanCategories = categories.filter(
    (c) => c.name && !['test', 'organic'].includes(c.name.toLowerCase())
  );

  return (
    <section className="home-filters-section" aria-label="Browse and Filter Products">
      <div className="container">
        <div className="home-filters-bar">
          {/* Section Header */}
          <div className="home-filters-header">
            <div className="home-filters-title-wrap">
              <span className="home-filters-eyebrow">
                <Sparkles size={14} className="sparkle-icon" /> Quick Storefront Filters
              </span>
              <h2 className="home-filters-heading">Explore Fresh Harvests & Daily Staples</h2>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="home-filters-clear-btn"
                onClick={onResetFilters}
                title="Reset all filters"
              >
                <X size={14} /> Clear Filters ({totalResults} found)
              </button>
            )}
          </div>

          {/* Primary Category & Special Collection Pills */}
          <div className="home-filter-pills-row">
            <button
              type="button"
              className={`home-pill ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => onSelectCategory('all')}
            >
              All Produce
            </button>

            <button
              type="button"
              className={`home-pill special-deal ${activeCategory === 'deals' ? 'active' : ''}`}
              onClick={() => onSelectCategory('deals')}
            >
              <Tag size={13} /> ⚡ Deals & Offers
            </button>

            <button
              type="button"
              className={`home-pill ${activeCategory === 'new-arrivals' ? 'active' : ''}`}
              onClick={() => onSelectCategory('new-arrivals')}
            >
              🌱 Fresh Arrivals
            </button>

            {cleanCategories.slice(0, 8).map((cat) => {
              const isActive = activeCategory === (cat.slug || cat.id);
              return (
                <button
                  key={cat.slug || cat.id}
                  type="button"
                  className={`home-pill ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory(cat.slug || cat.id)}
                >
                  {cat.title || cat.name}
                </button>
              );
            })}
          </div>

          {/* Secondary Filter Sub-Bar: Price Chips + Sort Dropdown */}
          <div className="home-filter-subbar">
            <div className="home-price-chips">
              <span className="subbar-label">Price:</span>
              {priceBands.map((band) => (
                <button
                  key={band.id}
                  type="button"
                  className={`home-price-chip ${activePrice === band.id ? 'active' : ''}`}
                  onClick={() => onSelectPrice(band.id)}
                >
                  {activePrice === band.id && <Check size={12} />}
                  {band.label}
                </button>
              ))}
            </div>

            <div className="home-sort-wrap">
              <label htmlFor="home-sort-select" className="subbar-label">
                <ArrowUpDown size={13} /> Sort:
              </label>
              <select
                id="home-sort-select"
                className="home-sort-select"
                value={activeSort}
                onChange={(e) => onSelectSort(e.target.value)}
              >
                {sortOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
