/**
 * Storefront data layer (Phase 1). Every customer-facing product/category
 * read flows through here — demo catalogue data is never used on the
 * storefront. Read the related approved plan (PHASE-1-STOREFRONT-PLAN.md
 * §3.2) for the exact mapping decisions.
 */
import { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { mapServerProduct, categorySlugFromName, slugifyName } from './mapProduct';
import { categoryDisplayForName, collectionDisplay } from './content';

const PRODUCT_PAGE_LIMIT = 12;
const PRODUCT_LIMIT_CAP = 48;

/* ---------------- public categories (single-flight cache) ---------------- */

let categoriesPromise = null;

/** Active server categories merged with presentation-only display info. */
export const fetchStorefrontCategories = ({ force = false } = {}) => {
  if (force || !categoriesPromise) {
    categoriesPromise = api
      .getPublicCategories()
      .then((data) => {
        const rows = Array.isArray(data?.categories) ? data.categories : [];
        return rows
          .filter((row) => row && row.name)
          .map((row) => {
            const display = categoryDisplayForName(row.name);
            return {
              name: row.name,
              title: display.title || row.name,
              slug: categorySlugFromName(row.name),
              tagline: display.tagline || '',
              blurb: row.description || display.blurb || '',
              image: display.image,
              productsCount: Number(row.productsCount) || 0
            };
          });
      })
      .catch((err) => {
        categoriesPromise = null; // allow a clean retry next attempt
        throw err;
      });
  }
  return categoriesPromise;
};

/** React hook for pages that need the public category list. */
export function useStorefrontCategories() {
  const [state, setState] = useState({ loading: true, error: null, categories: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const categories = await fetchStorefrontCategories({ force: attempt > 0 });
        if (!cancelled) setState({ loading: false, error: null, categories });
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err || new Error('Could not reach the server'), categories: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

/* ---------------- products ---------------- */

/**
 * Fetches approved storefront products. Params (all optional):
 *   search, category (string or string[] of category names), sort
 *   ('newest' | 'price-asc' | 'price-desc'), minPrice, maxPrice,
 *   stockStatus, hasDiscount ('1'), vendorName, page, limit.
 * Never throws — resolves { ok: true, products, total, page, limit } or
 * { ok: false, status, error } so callers can distinguish network failures
 * from empty results and never fall back to demo data.
 */
export const fetchStorefrontProducts = async (params = {}) => {
  const query = {};
  if (params.search && String(params.search).trim()) query.search = String(params.search).trim();
  if (Array.isArray(params.category) && params.category.length) query.category = params.category.join(',');
  else if (params.category) query.category = params.category;
  if (params.sort) query.sort = params.sort;
  if (params.minPrice !== undefined && params.minPrice !== '' && params.minPrice !== null) query.minPrice = params.minPrice;
  if (params.maxPrice !== undefined && params.maxPrice !== '' && params.maxPrice !== null) query.maxPrice = params.maxPrice;
  if (params.stockStatus) query.stockStatus = params.stockStatus;
  if (params.hasDiscount) query.hasDiscount = params.hasDiscount;
  if (params.vendorName) query.vendorName = params.vendorName;
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = Math.min(Number(params.limit) || PRODUCT_PAGE_LIMIT, PRODUCT_LIMIT_CAP);

  try {
    const data = await api.getProducts(query);
    if (!data?.success || !Array.isArray(data.products)) {
      return { ok: false, status: 502, error: 'The store returned an unexpected response. Please try again.' };
    }
    // Defensive: anonymous reads must only ever surface approved rows.
    const products = data.products
      .filter((row) => row && (!row.status || row.status === 'approved'))
      .map(mapServerProduct)
      .filter(Boolean);
    return {
      ok: true,
      products,
      total: Number(data.total ?? products.length),
      page: Number(data.page ?? 1),
      limit: data.limit ?? null
    };
  } catch (err) {
    return { ok: false, status: err?.status || 0, error: err?.message || 'Could not reach the server' };
  }
};

/** Related products for a product detail page. Same error contract as above. */
export const fetchRelatedProducts = async (productId) => {
  try {
    const data = await api.getRelatedProducts(productId);
    if (!data?.success || !Array.isArray(data.products)) {
      return { ok: false, status: 502, products: [] };
    }
    const products = data.products
      .filter((row) => row && (!row.status || row.status === 'approved'))
      .map(mapServerProduct)
      .filter(Boolean);
    return { ok: true, products };
  } catch (err) {
    return { ok: false, status: err?.status || 0, products: [] };
  }
};

/* ---------------- collection routes (approved scope D2) ---------------- */

/** Query params per server-backed collection slug; null when unsupported. */
export const COLLECTION_QUERY = {
  'new-arrivals': () => ({ sort: 'newest' }),
  deals: () => ({ hasDiscount: '1' })
};

export const collectionTitleForSlug = (slug) => collectionDisplay[slug]?.title || null;

/**
 * True when the slug is a known marketing collection that currently has no
 * server-data basis (bestsellers, concerns, specials…). Used by the shop
 * page to show an honest "not available yet" state instead of an error.
 */
export const isKnownUnsupportedCollection = (slug, knownList) => Array.isArray(knownList) && knownList.includes(slug);

/** True when the slug is not recognized at all (typo / removed route). */
export const isUnknownCollectionSlug = (slug, knownList) => !COLLECTION_QUERY[slug] && !isKnownUnsupportedCollection(slug, knownList);

/* ---------------- category slug helpers ---------------- */

export { categorySlugFromName, slugifyName };
