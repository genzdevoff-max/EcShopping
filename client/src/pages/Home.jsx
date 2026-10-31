import { useCallback, useEffect, useState } from 'react';
import api from '../utils/api';
import {
  PromotionalBanner,
  CircularCategoryShowcase,
  ProductRail,
  CategoryRails,
  CompactTrustBar,
  NewsletterCta
} from '../components/home/HomeSections';
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
      fetchStorefrontProducts({ hasDiscount: '1', limit: 8 }),
      api.getBanners().catch(() => null)
    ]);

    const [catRes, listRes, dealRes, bannerRes] = results;
    const categories = catRes.status === 'fulfilled' ? catRes.value : [];
    const listings = listRes.status === 'fulfilled' ? listRes.value : { ok: false, products: [], total: null };
    const deals = dealRes.status === 'fulfilled' ? dealRes.value : { ok: false, products: [] };
    const bannerPayload = bannerRes.status === 'fulfilled' && bannerRes.value?.success && Array.isArray(bannerRes.value.banners) && bannerRes.value.banners.length > 0
      ? bannerRes.value.banners.map((b) => ({
          id: b.id,
          tag: b.tag || 'Direct Farm Harvest',
          title: b.title,
          subtitle: b.subtitle || '',
          primaryCta: { label: b.cta_text || 'Shop Now', to: b.cta_link || '/shop' },
          secondaryCta: b.secondary_cta_text ? { label: b.secondary_cta_text, to: b.secondary_cta_link || '/shop' } : null,
          badge: b.badge || '',
          image: b.image_url
        }))
      : undefined;

    const items = listings.ok ? listings.products : [];
    const rails = categories.map((category) => ({
      category,
      items: items.filter((p) => p.categorySlug === category.slug)
    }));

    setState({
      loading: false,
      categoriesError: catRes.status === 'rejected' ? catRes.reason : null,
      listingsError: listRes.status === 'rejected' || !listings.ok
        ? (listRes.status === 'rejected' ? listRes.reason : { message: listings.error })
        : null,
      categories,
      items,
      newArrivals: items.slice(0, 8),
      deals: deals.ok ? deals.products : [],
      rails,
      productsTotal: listRes.status === 'fulfilled' && listings.ok ? listings.total : null,
      categoriesCount: catRes.status === 'fulfilled' ? categories.length : null,
      dealsCount: dealRes.status === 'fulfilled' && deals.ok ? deals.total : null,
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

      {/* 3. Best Offers / Deals of the Day (First prominent product section) */}
      {hasDeals ? (
        <ProductRail
          eyebrow="⚡ Today's Special Values"
          title="Best Offers & Deals of the Day"
          subtitle="Verified seller discounts on genuine organic staples and farm harvests."
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

      {/* 9. Compact Trust / Policy Section (Bottom Reassurance) */}
      <CompactTrustBar />

      {/* 10. Existing Newsletter */}
      <NewsletterCta />
    </>
  );
}
