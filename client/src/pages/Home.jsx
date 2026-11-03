import { useCallback, useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import {
  PromotionalBanner,
  CircularCategoryShowcase,
  ProductRail,
  CategoryRails
} from '../components/home/HomeSections';
import HomepageFilters from '../components/home/HomepageFilters';
import ProductCard from '../components/ui/ProductCard';
import ShortsAndVideos from '../components/home/ShortsAndVideos';
import { fetchStorefrontCategories, fetchStorefrontProducts } from '../data/storefront';

const RAIL_POOL_LIMIT = 48;

export default function Home({ onAddToCart }) {
  const [state, setState] = useState({
    loading: true,
    categoriesError: null,
    listingsError: null,
    categories: [],
    items: [],
    newArrivals: [],
    deals: [],
    rails: [],
    productsTotal: null,
    categoriesCount: null,
    dealsCount: null,
    banners: undefined
  });
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchStorefrontCategories(),
      fetchStorefrontProducts({ limit: RAIL_POOL_LIMIT }),
      api.getBanners().catch(() => null),
      api.getActiveDeals().catch(() => null)
    ]);

    const [catRes, listRes, bannerRes, activeDealsRes] = results;
    const categories = catRes.status === 'fulfilled' ? catRes.value : [];
    const listings = listRes.status === 'fulfilled' ? listRes.value : { ok: false, products: [], total: null };
    const dedicatedDeals = (activeDealsRes.status === 'fulfilled' && activeDealsRes.value?.success && Array.isArray(activeDealsRes.value.deals))
      ? activeDealsRes.value.deals.map((d) => ({
          id: d.productId || d.product_id,
          title: d.productTitle || d.product_title || 'Deal Item',
          price: d.dealPrice ?? d.deal_price,
          originalPrice: d.originalPrice ?? d.product_price,
          discount: d.discountPct ? `${d.discountPct}% OFF` : 'SPECIAL DEAL',
          image: d.productImage || d.product_image,
          categorySlug: d.productCategory || d.product_category || 'deals',
          rating: d.productRating || 4.8,
          reviewsCount: d.productReviewCount || 10,
          stock: d.stockLimit ? Math.max(0, d.stockLimit - (d.soldCount || 0)) : (d.productStock || 50),
          inStock: true,
          dealEndTime: d.endTime || d.end_time
        }))
      : [];
    const bannerPayload = bannerRes.status === 'fulfilled' && bannerRes.value?.success && Array.isArray(bannerRes.value.banners) && bannerRes.value.banners.length > 0
      ? bannerRes.value.banners.map((b) => ({
          id: b.id,
          tag: b.tag || 'Direct Farm Harvest',
          title: b.title,
          subtitle: b.subtitle || '',
          primaryCta: { label: b.cta_text || 'Shop Now', to: b.cta_link || '/shop' },
          secondaryCta: b.secondary_cta_text ? { label: b.secondary_cta_text, to: b.secondary_cta_link || '/shop' } : null,
          badge: b.badge || '',
          image: b.image_url || b.imageUrl || b.image,
          mobileImage: b.mobile_image_url || b.mobileImageUrl || b.mobileImage || null,
          tabletImage: b.tablet_image_url || b.tabletImageUrl || b.tabletImage || null,
          aspectRatio: b.image_aspect_ratio || b.imageAspectRatio || '16:5'
        }))
      : undefined;

    const items = listings.ok ? listings.products : [];
    const rails = categories.map((category) => ({
      category,
      items: items.filter((p) => p.categorySlug === category.slug)
    }));

    const fallbackDeals = items.filter((p) => (p.compareAt && Number(p.compareAt) > Number(p.price)) || p.couponOffer).slice(0, 8);
    const finalDeals = dedicatedDeals.length > 0 ? dedicatedDeals : fallbackDeals;

    setState({
      loading: false,
      categoriesError: catRes.status === 'rejected' ? catRes.reason : null,
      listingsError: listRes.status === 'rejected' || !listings.ok
        ? (listRes.status === 'rejected' ? listRes.reason : { message: listings.error })
        : null,
      categories,
      items,
      newArrivals: items.slice(0, 8),
      deals: finalDeals,
      rails,
      productsTotal: listRes.status === 'fulfilled' && listings.ok ? listings.total : null,
      categoriesCount: catRes.status === 'fulfilled' ? categories.length : null,
      dealsCount: finalDeals.length,
      banners: bannerPayload
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => { cancelled = true; };
  }, [attempt, load]);

  const retry = () => setAttempt((n) => n + 1);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPrice, setSelectedPrice] = useState('all');
  const [selectedSort, setSelectedSort] = useState('featured');

  const hasActiveFilters = selectedCategory !== 'all' || selectedPrice !== 'all' || selectedSort !== 'featured';

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedPrice('all');
    setSelectedSort('featured');
  };

  const filteredItems = useMemo(() => {
    if (!hasActiveFilters) return [];

    let pool = [...state.items];
    if (selectedCategory === 'deals') {
      pool = state.deals && state.deals.length > 0 ? [...state.deals] : pool.filter((p) => p.discount || p.dealPrice || p.strikePrice > p.price);
    } else if (selectedCategory === 'new-arrivals') {
      pool = state.newArrivals && state.newArrivals.length > 0 ? [...state.newArrivals] : pool;
    } else if (selectedCategory !== 'all') {
      pool = pool.filter((p) => p.categorySlug === selectedCategory || p.category === selectedCategory);
    }

    if (selectedPrice === 'under-199') {
      pool = pool.filter((p) => Number(p.price) <= 199);
    } else if (selectedPrice === 'under-499') {
      pool = pool.filter((p) => Number(p.price) <= 499);
    } else if (selectedPrice === '500-plus') {
      pool = pool.filter((p) => Number(p.price) >= 500);
    }

    if (selectedSort === 'price-asc') {
      pool.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (selectedSort === 'price-desc') {
      pool.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (selectedSort === 'discount') {
      pool.sort((a, b) => {
        const discA = a.discount ? parseFloat(a.discount) || 0 : (a.strikePrice > a.price ? a.strikePrice - a.price : 0);
        const discB = b.discount ? parseFloat(b.discount) || 0 : (b.strikePrice > b.price ? b.strikePrice - b.price : 0);
        return discB - discA;
      });
    }

    return pool;
  }, [hasActiveFilters, state.items, state.deals, state.newArrivals, selectedCategory, selectedPrice, selectedSort]);

  const { loading, categoriesError, listingsError } = state;
  const hasDeals = state.deals && state.deals.length > 0;

  return (
    <>
      {/* 1. Wide Promotional Campaign Banner directly below Header */}
      <PromotionalBanner campaigns={state.banners} />

      {/* 2. Circular Category Showcase directly below Banner with Show more action */}
      <CircularCategoryShowcase
        categories={state.categories}
        loading={loading}
      />

      {/* 3. Quick Storefront Filters */}
      <HomepageFilters
        categories={state.categories}
        activeCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        activePrice={selectedPrice}
        onSelectPrice={setSelectedPrice}
        activeSort={selectedSort}
        onSelectSort={setSelectedSort}
        onResetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
        totalResults={filteredItems.length}
      />

      {/* 4. Active In-Page Filtered Showcase (Instant results when any filter is clicked) */}
      {hasActiveFilters && (
        <section className="section-compact" style={{ padding: '24px 0 36px', background: '#fafaf9' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#0e5c4a', letterSpacing: '0.05em' }}>
                  Filtered Results
                </span>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b', margin: '2px 0 0' }}>
                  Showing {filteredItems.length} matching {filteredItems.length === 1 ? 'item' : 'items'}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={resetFilters}
                  style={{ fontSize: 13 }}
                >
                  Clear filters
                </button>
                <Link
                  to={selectedCategory !== 'all' && selectedCategory !== 'deals' && selectedCategory !== 'new-arrivals' ? `/category/${selectedCategory}` : '/shop'}
                  className="btn btn-sm btn-primary"
                  style={{ fontSize: 13 }}
                >
                  Explore all in Shop →
                </Link>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>No produce found for this filter combination</p>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 16 }}>Try selecting a different price range or category</p>
                <button type="button" className="btn btn-sm btn-primary" onClick={resetFilters}>
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="product-grid cols-4">
                {filteredItems.map((product) => (
                  <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. Deals of the Day & Flash Sales (First prominent product section) */}
      {hasDeals ? (
        <ProductRail
          eyebrow="⚡ Flash Sales & Special Values"
          title="Deals of the Day & Flash Sales"
          subtitle="Verified seller discounts on genuine organic staples and fresh farm harvests."
          linkTo="/collection/deals"
          linkLabel="All Deals"
          items={state.deals}
          tone="accent"
          loading={loading}
          onAddToCart={onAddToCart}
        />
      ) : (
        <ProductRail
          eyebrow="Featured Selections"
          title="Featured Farm Products"
          subtitle="Wholesome everyday organic essentials directly from local farms."
          linkTo="/shop"
          linkLabel="View All"
          items={state.items.slice(0, 4)}
          tone="plain"
          loading={loading}
          onAddToCart={onAddToCart}
        />
      )}

      {/* 4. Best Sellers & Farm Staples */}
      <ProductRail
        eyebrow="Customer Favorites"
        title="Best Sellers & Farm Staples"
        subtitle="The most frequently re-ordered everyday pantry essentials."
        linkTo="/shop"
        linkLabel="Explore All Items"
        items={state.items.slice(0, 4)}
        tone="plain"
        loading={loading}
        onAddToCart={onAddToCart}
      />

      {/* 5. New Arrivals — From live catalog */}
      <ProductRail
        eyebrow="Freshly Listed"
        title="New Arrivals from Local Farms"
        subtitle="Directly added from verified growers and farm cooperatives this week."
        linkTo="/collection/new-arrivals"
        linkLabel="All New Arrivals"
        items={state.newArrivals}
        tone="plain"
        loading={loading}
        onAddToCart={onAddToCart}
      />

      {/* 8. Shorts & Video Reviews — Real harvest moments and customer reels */}
      <ShortsAndVideos />

      {/* 9. Additional Category-Specific Product Rails & Genuine Offers */}
      <CategoryRails
        rails={state.rails}
        loading={loading && !listingsError && !categoriesError}
        error={listingsError || categoriesError ? { message: (listingsError || categoriesError).message } : null}
        onRetry={retry}
        onAddToCart={onAddToCart}
      />
    </>
  );
}
