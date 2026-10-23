import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Truck,
  ShieldCheck,
  RotateCcw,
  Sprout,
  IndianRupee,
  HeartHandshake,
  Quote,
  Mail,
  PackageCheck,
  ShoppingBasket,
  Wallet,
  Play,
  X,
  Sparkles,
  Layers
} from 'lucide-react';
import {
  benefits,
  testimonials,
  shopVideos,
  marqueeMessages,
  collectionDisplay
} from '../../data/content';
import ProductCard from '../ui/ProductCard';
import SectionHead from '../ui/SectionHead';
import { ErrorState } from '../ui/States';
import './home.css';

/* ---------------------------------------------------------------
   1. Compact Horizontal Category Navigation (Amazon/Flipkart style)
   Clean, space-efficient category bar directly underneath header.
   --------------------------------------------------------------- */

export function CompactCategoryNav({ categories = [], loading = false }) {
  if (loading) {
    return (
      <nav className="compact-cat-nav" aria-label="Category navigation">
        <div className="container compact-cat-track skeleton-nav">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="compact-cat-pill skeleton" style={{ width: 90, height: 36 }} />
          ))}
        </div>
      </nav>
    );
  }

  const activeCategories = categories.filter(
    (c) => c.name && c.name.toLowerCase() !== 'test' && c.name.toLowerCase() !== 'organic'
  );
  if (!activeCategories.length) return null;

  return (
    <nav className="compact-cat-nav" aria-label="Quick Category navigation">
      <div className="container compact-cat-track">
        <Link to="/shop" className="compact-cat-item all-categories-pill">
          <Layers size={16} />
          <span>All Items</span>
        </Link>
        {activeCategories.map((cat) => (
          <Link key={cat.slug} to={`/category/${cat.slug}`} className="compact-cat-item">
            <div className="compact-cat-thumb">
              <img src={cat.image} alt="" width="32" height="32" loading="lazy" />
            </div>
            <span className="compact-cat-label">{cat.title}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------------
   2. Restrained Marketplace Banner (Secondary to shopping)
   Substantially reduced height (~120-140px) to prevent pushing
   products below the fold.
   --------------------------------------------------------------- */

export function CompactMarketplaceBanner() {
  return (
    <div className="compact-mkt-banner">
      <div className="container compact-mkt-inner">
        <div className="compact-mkt-copy">
          <span className="compact-mkt-tag">
            <Sparkles size={13} /> Direct from Local Farmers & Cooperatives
          </span>
          <h2>Authentic Farm Organics & Daily Staples</h2>
          <p>Cold-pressed oils, raw forest honey, farm vegetables & A2 dairy across Tamil Nadu.</p>
        </div>
        <div className="compact-mkt-actions">
          <Link to="/collection/deals" className="btn btn-accent btn-sm">
            Deals of the Day <ArrowRight size={14} />
          </Link>
          <Link to="/shop" className="btn btn-outline-light btn-sm">
            Browse All Aisles
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   3. Shop by Category (Compact image tiles)
   Dense, space-efficient category cards inspired by Flipkart/Amazon.
   --------------------------------------------------------------- */

export function CompactCategoryTiles({ categories = [], loading = false }) {
  const activeCategories = categories.filter(
    (c) => c.name && c.name.toLowerCase() !== 'test' && c.name.toLowerCase() !== 'organic'
  );
  if (!activeCategories.length && !loading) return null;

  return (
    <section className="section-compact cat-tiles-section">
      <div className="container">
        <div className="section-head-split">
          <div>
            <span className="eyebrow">Explore Aisles</span>
            <h2 className="title">Shop by Category</h2>
          </div>
          <Link to="/shop" className="retail-view-all-link">
            All Categories <ArrowRight size={15} />
          </Link>
        </div>

        <div className="compact-cat-tiles-grid">
          {activeCategories.map((cat) => (
            <Link key={cat.slug} to={`/category/${cat.slug}`} className="compact-tile-card">
              <div className="compact-tile-media">
                <img src={cat.image} alt={cat.title} width="160" height="110" loading="lazy" />
              </div>
              <div className="compact-tile-body">
                <h4 className="compact-tile-title">{cat.title}</h4>
                <span className="compact-tile-count">
                  {cat.productsCount ? `${cat.productsCount} ${cat.productsCount === 1 ? 'item' : 'items'}` : 'Explore'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------
   4. Compact Trust / Policy Bar (Bottom reassurance)
   Restrained horizontal bar placed near bottom, never dominating
   the top shopping view.
   --------------------------------------------------------------- */

export function CompactTrustBar() {
  const trustFeatures = [
    { icon: Truck, title: 'Free Delivery', desc: 'On all orders above ₹499' },
    { icon: ShieldCheck, title: '100% Quality Tested', desc: 'Residue & chemical free' },
    { icon: RotateCcw, title: '48-Hour Replacements', desc: 'Hassle-free doorstep claim' },
    { icon: IndianRupee, title: 'COD & Secure PhonePe', desc: 'Pay at door or via UPI' }
  ];

  return (
    <section className="compact-trust-strip">
      <div className="container compact-trust-grid">
        {trustFeatures.map((item) => {
          const Icon = item.icon;
          return (
            <div className="compact-trust-col" key={item.title}>
              <div className="compact-trust-icon">
                <Icon size={20} />
              </div>
              <div className="compact-trust-text">
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------
   Product rail (Dense, marketplace product display)
   --------------------------------------------------------------- */

export function ProductRail({
  eyebrow,
  title,
  subtitle,
  linkTo,
  linkLabel,
  items = [],
  loading = false,
  tone = 'plain',
  onAddToCart
}) {
  if (loading) {
    return (
      <section className={`section-compact rail-section tone-${tone}`} aria-hidden="true">
        <div className="container">
          <div className="skeleton sk-line short" style={{ height: 22, width: 200, marginBottom: 14 }} />
          <div className="product-grid cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="skeleton-card" key={i}>
                <div className="skeleton sk-media" />
                <div className="skeleton sk-line tiny" />
                <div className="skeleton sk-line" />
                <div className="skeleton sk-line short" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className={`section-compact rail-section tone-${tone}`}>
      <div className="container">
        <div className="rail-head-flex">
          <div>
            {eyebrow && <span className="rail-eyebrow">{eyebrow}</span>}
            <h2 className="rail-title">{title}</h2>
            {subtitle && <p className="rail-subtitle">{subtitle}</p>}
          </div>
          {linkTo && linkLabel && (
            <Link to={linkTo} className="rail-more-link">
              {linkLabel} <ArrowRight size={15} />
            </Link>
          )}
        </div>
        <div className="product-grid cols-4">
          {items.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------
   Per-category rails (server categories + server products)
   --------------------------------------------------------------- */

export function CategoryRails({ rails = [], loading = false, error = null, onRetry = null, onAddToCart }) {
  if (error) {
    return (
      <section className="section-compact rail-section">
        <div className="container">
          <ErrorState
            title="Product rails could not be loaded"
            text={error.message || 'We could not reach the server. Please try again.'}
            actions={onRetry && <button type="button" className="btn btn-primary" onClick={onRetry}>Try again</button>}
          />
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="section-compact rail-section" aria-hidden="true">
        <div className="container">
          <div className="skeleton sk-line short" style={{ height: 22, width: 200, marginBottom: 14 }} />
          <div className="product-grid cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="skeleton-card" key={i}>
                <div className="skeleton sk-media" />
                <div className="skeleton sk-line tiny" />
                <div className="skeleton sk-line" />
                <div className="skeleton sk-line short" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {rails
        .filter((rail) => rail.items.length > 0)
        .map(({ category, items }) => (
          <section className="section-compact rail-section" key={category.slug}>
            <div className="container">
              <div className="rail-head-flex">
                <div>
                  <span className="rail-eyebrow">Aisle Shelf</span>
                  <h2 className="rail-title">{category.title}</h2>
                  {category.blurb && <p className="rail-subtitle">{category.blurb}</p>}
                </div>
                <Link to={`/category/${category.slug}`} className="rail-more-link">
                  See all in {category.title} <ArrowRight size={15} />
                </Link>
              </div>
              <div className="product-grid cols-4">
                {items.slice(0, 8).map((product) => (
                  <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
                ))}
              </div>
            </div>
          </section>
        ))}
    </>
  );
}

/* ---------------------------------------------------------------
   Backward-compatible / Supporting exports
   --------------------------------------------------------------- */

export const QuickCategoryRow = CompactCategoryNav;
export const CategoryGrid = CompactCategoryTiles;
export const TrustBadgesRow = CompactTrustBar;

export function HeroCarousel() {
  return <CompactMarketplaceBanner />;
}

export const Hero = HeroCarousel;

export function ShopByNeedGrid() {
  return null; // Suppressed from landing to maintain pure marketplace density
}

export function PromoBanners() {
  const deals = collectionDisplay.deals;
  if (!deals) return null;

  return (
    <section className="section-tight">
      <div className="container promo-grid">
        <Link to="/collection/deals" className="promo-banner promo-amber">
          <div className="promo-copy">
            <span className="promo-eyebrow">Limited time</span>
            <h3>{deals.title}</h3>
            <p>{deals.subtitle}</p>
            <span className="promo-link">Shop now <ArrowRight size={15} /></span>
          </div>
          <img src={deals.image} alt="" width="640" height="420" loading="lazy" />
        </Link>
      </div>
    </section>
  );
}

export function CollectionsStrip({ newArrivalsCount = null, dealsCount = null, loading = false }) {
  const entries = [
    { slug: 'new-arrivals', to: '/collection/new-arrivals', count: newArrivalsCount },
    { slug: 'deals', to: '/collection/deals', count: dealsCount }
  ];

  if (loading) return null;

  return (
    <section className="section-compact section-alt">
      <div className="container">
        <SectionHead
          eyebrow="Featured collections"
          title="Start from what just landed"
          subtitle="New listings straight from our sellers, plus limited-time price drops."
        />
        <div className="coll-grid">
          {entries.map(({ slug, to, count }) => {
            const coll = collectionDisplay[slug];
            if (!coll) return null;
            return (
              <Link key={slug} to={to} className="coll-card">
                <img src={coll.image} alt="" width="640" height="400" loading="lazy" />
                <div className="coll-overlay">
                  {typeof count === 'number' && <span className="coll-count">{count} products</span>}
                  <h3>{coll.title}</h3>
                  <p>{coll.subtitle}</p>
                  <span className="coll-link">Shop collection <ArrowRight size={14} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function VideoShop() {
  const [activeVideo, setActiveVideo] = useState(null);

  useEffect(() => {
    if (!activeVideo) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setActiveVideo(null);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [activeVideo]);

  const close = () => setActiveVideo(null);

  return (
    <section className="section-compact">
      <div className="container">
        <SectionHead
          eyebrow="Shop by videos"
          title="See the products in action"
          subtitle="Short clips from our partner farms, kitchens and packing hubs."
        />
        <div className="video-grid">
          {shopVideos.map((video) => (
            <button
              key={video.id}
              type="button"
              className="video-card"
              onClick={() => setActiveVideo(video)}
              aria-label={`Play video: ${video.title}`}
            >
              <img src={video.poster} alt="" loading="lazy" />
              <span className="video-play" aria-hidden="true">
                <Play size={20} fill="currentColor" />
              </span>
              <span className="video-caption">
                <strong>{video.title}</strong>
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeVideo && (
        <div className="video-modal" role="dialog" aria-modal="true" aria-label={activeVideo.title}>
          <button type="button" className="video-modal-backdrop" onClick={close} aria-label="Close video" />
          <div className="video-modal-panel">
            <div className="video-modal-head">
              <h3>{activeVideo.title}</h3>
              <button type="button" className="video-modal-close" onClick={close} aria-label="Close video">
                <X size={20} />
              </button>
            </div>
            <video src={activeVideo.src} poster={activeVideo.poster} controls autoPlay playsInline />
          </div>
        </div>
      )}
    </section>
  );
}

export function MarqueeStrip() {
  const items = [...marqueeMessages, ...marqueeMessages];

  return (
    <div className="marquee" role="region" aria-label="Store highlights">
      <div className="marquee-track">
        {items.map((message, index) => (
          <span className="marquee-item" key={`${message}-${index}`}>
            <Sprout size={14} aria-hidden="true" />
            {message}
          </span>
        ))}
      </div>
    </div>
  );
}

const orderSteps = [
  { icon: ShoppingBasket, title: 'Pick your items', text: 'Browse categories or search for a specific product and add it to your cart.' },
  { icon: Wallet, title: 'Choose payment', text: 'Pay online or choose cash on delivery at checkout.' },
  { icon: PackageCheck, title: 'We pack it fresh', text: 'Sellers pack your order the same day, with produce picked that morning.' },
  { icon: Truck, title: 'Track to your door', text: 'Follow each step on the order timeline until it reaches your address.' }
];

export function OrderingSteps() {
  return (
    <section className="section-compact section-tint">
      <div className="container">
        <SectionHead
          center
          eyebrow="How ordering works"
          title="Four simple steps from cart to doorstep"
          subtitle="The whole flow is designed to stay predictable — you always know what happens next."
        />
        <div className="steps-row">
          {orderSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div className="step-card" key={step.title}>
                <span className="step-number">{index + 1}</span>
                <span className="step-icon"><Icon size={20} /></span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const iconMap = { Sprout, Truck, ShieldCheck, RotateCcw, IndianRupee, HeartHandshake };

export function BenefitsGrid({ loading = false, productsTotal = null, categoriesCount = null }) {
  return (
    <section className="section-compact">
      <div className="container">
        <SectionHead
          center
          eyebrow="Why shop here"
          title="Built on trust, not on discounts alone"
          subtitle="Marketplaces work when both sides win. Here is what we hold ourselves to."
        />
        <div className="benefits-grid">
          {benefits.map((benefit) => {
            const Icon = iconMap[benefit.icon] || ShieldCheck;
            return (
              <div className="benefit" key={benefit.title}>
                <span className="benefit-icon"><Icon size={20} /></span>
                <div>
                  <h4>{benefit.title}</h4>
                  <p>{benefit.text}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="trust-strip">
          <div className="stat">
            <span className="stat-value">{loading || productsTotal === null ? '—' : productsTotal}</span>
            <span className="stat-label">Live listings</span>
          </div>
          <div className="stat">
            <span className="stat-value">{loading || categoriesCount === null ? '—' : categoriesCount}</span>
            <span className="stat-label">Categories</span>
          </div>
          <div className="stat">
            <span className="stat-value">48 h</span>
            <span className="stat-label">Replacement window</span>
          </div>
          <div className="stat">
            <span className="stat-value">{loading ? '—' : '₹499'}</span>
            <span className="stat-label">Free delivery over</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TestimonialsSection() {
  const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <section className="section-compact section-alt">
      <div className="container">
        <SectionHead
          center
          eyebrow="Customer voices"
          title="What buyers say about their orders"
        />
        <div className="quote-grid">
          {testimonials.map((t) => (
            <figure className="quote-card" key={t.id}>
              <Quote size={20} className="quote-mark" />
              <blockquote className="quote-text">“{t.text}”</blockquote>
              <figcaption className="quote-meta">
                <span className="avatar sm accent">{initials(t.name)}</span>
                <span>
                  <span className="quote-name">{t.name}</span>
                  <span className="quote-loc">{t.location}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function NewsletterCta() {
  return (
    <section className="section-compact">
      <div className="container">
        <div className="newsletter-cta">
          <div className="newsletter-copy">
            <span className="eyebrow">Stay in the loop</span>
            <h2>Seasonal drops and restock alerts, once a week</h2>
            <p>Join the list for new seller announcements, harvest updates and weekend offers.</p>
          </div>

          <form
            className="newsletter-inline"
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.email;
              const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
              const note = e.currentTarget.querySelector('.newsletter-inline-msg');
              if (!valid) {
                input.classList.add('has-error');
                note.textContent = 'Please enter a valid email address.';
                note.className = 'newsletter-inline-msg err';
              } else {
                input.classList.remove('has-error');
                input.value = '';
                note.textContent = 'Thanks for subscribing!';
                note.className = 'newsletter-inline-msg ok';
              }
            }}
            noValidate
          >
            <label className="sr-only" htmlFor="home-newsletter">Email address</label>
            <div className="newsletter-field">
              <Mail size={16} />
              <input id="home-newsletter" name="email" type="email" placeholder="you@example.com" />
              <button type="submit" className="btn btn-accent btn-sm">Subscribe</button>
            </div>
            <p className="newsletter-inline-msg" role="status" aria-live="polite" />
          </form>
        </div>
      </div>
    </section>
  );
}
