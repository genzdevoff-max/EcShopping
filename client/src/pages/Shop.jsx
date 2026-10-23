import { useEffect, useState } from 'react';
import { useParams, useLocation, useSearchParams, Link } from 'react-router-dom';
import { SlidersHorizontal, X, Search, PackageSearch, LayoutGrid, Rows3 } from 'lucide-react';
import {
  useStorefrontCategories,
  fetchStorefrontProducts,
  COLLECTION_QUERY,
  collectionTitleForSlug
} from '../data/storefront';
import { collectionDisplay } from '../data/content';
import { Breadcrumbs } from '../components/ui/PageHeader';
import ProductCard from '../components/ui/ProductCard';
import Pagination from '../components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/ui/States';
import './Shop.css';

const PAGE_SIZE = 12;

/* Sort options supported by server data (rating/bestselling need review
   and sales metrics that do not exist yet — hidden per approved decision D2). */
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest first' }
];

const PRICE_BANDS = [
  { label: 'Under ₹100', min: 0, max: 100 },
  { label: '₹100 – ₹500', min: 100, max: 500 },
  { label: '₹500 – ₹1,000', min: 500, max: 1000 },
  { label: 'Above ₹1,000', min: 1000, max: null }
];

const normalizeLegacySort = (raw) => {
  const sort = raw || 'relevance';
  // Legacy URLs may still carry rating/bestselling; they have no server
  // basis, so they map to the default ordering instead of erroring.
  if (sort === 'rating' || sort === 'bestselling') return 'relevance';
  return sort;
};

export default function Shop({ onAddToCart }) {
  const { slug } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dense, setDense] = useState(false);

  const { loading: categoriesLoading, error: categoriesError, categories, retry: retryCategories } = useStorefrontCategories();

  const [productsState, setProductsState] = useState({ loading: true, error: null, status: null, products: [], total: 0 });
  const [attempt, setAttempt] = useState(0);

  const mode = location.pathname.startsWith('/category')
    ? 'category'
    : location.pathname.startsWith('/collection')
      ? 'collection'
      : 'all';

  const search = searchParams.get('search') || '';
  const rawSort = searchParams.get('sort') || '';
  const normSort = normalizeLegacySort(rawSort);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const bandIndex = searchParams.get('band') ? Number(searchParams.get('band')) : null;
  const inStockOnly = searchParams.get('inStock') === '1';
  const activeFilterParams = searchParams.getAll('category');

  const activeCategory = mode === 'category' ? categories.find((c) => c.slug === slug) || null : null;
  const collectionParams = mode === 'collection' ? (COLLECTION_QUERY[slug] || null) : null;
  const collectionTitle = mode === 'collection' ? collectionTitleForSlug(slug) : null;
  const collectionSubtitle = mode === 'collection' ? (collectionDisplay[slug]?.subtitle || '') : '';

  const setParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        next.delete(key);
        value.forEach((v) => next.append(key, v));
      } else if (value === '' || value === null || value === undefined || value === false) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    if (!('page' in patch)) next.delete('page');
    setSearchParams(next, { replace: false });
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (search) next.set('search', search);
    setSearchParams(next);
  };

  /* One server fetch per URL-state change: the server resolves search,
     sorting, category, price band, stock and pagination together. The
     slug→name mapping needs the category list, so category-filtered reads
     wait for it (and surface an error state if it cannot load). */
  useEffect(() => {
    let cancelled = false;

    const pathname = location.pathname;
    const currentMode = pathname.startsWith('/category')
      ? 'category'
      : pathname.startsWith('/collection')
        ? 'collection'
        : 'all';
    const searchValue = (searchParams.get('search') || '').trim();
    const sortParam = normalizeLegacySort(searchParams.get('sort'));
    const bandParam = searchParams.get('band') ? Number(searchParams.get('band')) : null;
    const inStockParam = searchParams.get('inStock') === '1';
    const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const categorySlugParams = searchParams.getAll('category');

    const needsCategoryResolution = currentMode === 'category' || (currentMode === 'all' && categorySlugParams.length > 0);

    if (currentMode === 'category' && categoriesLoading && !categoriesError) {
      setProductsState((s) => ({ ...s, loading: true }));
      return undefined;
    }

    (async () => {
      if (needsCategoryResolution && categoriesError) {
        if (!cancelled) setProductsState({ loading: false, error: { message: categoriesError.message || 'Filters could not be loaded', status: 0 }, status: null, products: [], total: 0 });
        return;
      }

      const fetchParams = { limit: PAGE_SIZE, page: pageParam };
      if (searchValue) fetchParams.search = searchValue;
      if (sortParam && sortParam !== 'relevance') fetchParams.sort = sortParam;
      if (bandParam != null && PRICE_BANDS[bandParam]) {
        const band = PRICE_BANDS[bandParam];
        if (band.min > 0) fetchParams.minPrice = band.min;
        if (band.max != null) fetchParams.maxPrice = band.max;
      }
      if (inStockParam) fetchParams.stockStatus = 'in_stock';

      if (currentMode === 'category') {
        const category = categories.find((c) => c.slug === slug) || null;
        if (!category) {
          if (!cancelled) setProductsState({ loading: false, error: null, status: 'unknown-slug', products: [], total: 0 });
          return;
        }
        fetchParams.category = category.name;
      } else if (currentMode === 'collection' && COLLECTION_QUERY[slug]) {
        // Collection defaults only fill gaps: an explicit user sort still wins.
        Object.entries(COLLECTION_QUERY[slug]()).forEach(([key, value]) => {
          if (fetchParams[key] === undefined) fetchParams[key] = value;
        });
      } else if (currentMode === 'collection') {
        if (!cancelled) setProductsState({ loading: false, error: null, status: 'unsupported-collection', products: [], total: 0 });
        return;
      } else if (currentMode === 'all' && categorySlugParams.length > 0) {
        const names = categorySlugParams
          .map((s) => categories.find((c) => c.slug === s))
          .filter(Boolean)
          .map((c) => c.name);
        if (names.length !== categorySlugParams.length) {
          if (!cancelled) setProductsState({ loading: false, error: null, status: 'unknown-slug', products: [], total: 0 });
          return;
        }
        fetchParams.category = names;
      }

      if (!cancelled) setProductsState((s) => ({ ...s, loading: true }));
      const res = await fetchStorefrontProducts(fetchParams);
      if (cancelled) return;
      if (res.ok) {
        setProductsState({ loading: false, error: null, status: null, products: res.products, total: res.total });
      } else {
        setProductsState({ loading: false, error: { message: res.error || 'Could not reach the server', status: res.status }, status: null, products: [], total: 0 });
      }
    })();

    return () => { cancelled = true; };
  }, [location.pathname, slug, searchParams.toString(), categories, categoriesLoading, categoriesError, attempt]);

  const retryFetch = () => setAttempt((n) => n + 1);

  const totalPages = Math.max(1, Math.ceil(productsState.total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const activeFilterCount =
    activeFilterParams.length +
    (bandIndex != null ? 1 : 0) +
    (inStockOnly ? 1 : 0);

  let title;
  let subtitle;
  if (mode === 'category' && activeCategory) {
    title = activeCategory.title;
    subtitle = activeCategory.blurb;
  } else if (mode === 'category') {
    title = slug;
    subtitle = '';
  } else if (mode === 'collection' && collectionTitle) {
    title = collectionTitle;
    subtitle = collectionSubtitle;
  } else if (mode === 'collection') {
    title = slug;
    subtitle = '';
  } else if (search) {
    title = `Results for “${search}”`;
    subtitle = 'Browse everything listed by our verified sellers.';
  } else {
    title = 'All Products';
    subtitle = 'Browse everything listed by our verified sellers.';
  }

  const crumbs = [{ label: 'Shop', to: '/shop' }];
  if (mode === 'category') crumbs.push({ label: title, to: `/category/${slug}` });
  if (mode === 'collection') crumbs.push({ label: title, to: `/collection/${slug}` });
  if (search) crumbs.push({ label: `Search: ${search}` });

  return (
    <>
      <section className="shop-head">
        <div className="container">
          <Breadcrumbs items={crumbs} />
          <h1>{title}</h1>
          {subtitle && <p className="shop-head-sub">{subtitle}</p>}

          <nav className="shop-cat-strip" aria-label="Shop categories">
            <Link to="/shop" className={mode === 'all' && !search ? 'active' : ''}>
              All Products
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                to={`/category/${cat.slug}`}
                className={mode === 'category' && activeCategory?.slug === cat.slug ? 'active' : ''}
              >
                {cat.title}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <div className="container shop-layout">
        {/* ---------- Filters (desktop sidebar / mobile drawer) ---------- */}
        <aside className={`shop-sidebar ${filtersOpen ? 'open' : ''}`} aria-label="Product filters">
          <div className="sidebar-head">
            <h2>Filters</h2>
            <button type="button" className="sidebar-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
              <X size={19} />
            </button>
          </div>

          {categoriesError ? (
            <p className="muted" style={{ padding: '8px 4px 4px' }}>
              Filters could not be loaded.{' '}
              <button type="button" className="link-more" onClick={retryCategories}>Retry</button>
            </p>
          ) : categoriesLoading ? (
            <div aria-hidden="true" style={{ padding: '8px 4px' }}>
              <div className="skeleton sk-line short" style={{ height: 18, marginBottom: 12, width: 120 }} />
              <div className="skeleton sk-line" style={{ height: 16, marginBottom: 8 }} />
              <div className="skeleton sk-line" style={{ height: 16, marginBottom: 8, width: '70%' }} />
            </div>
          ) : (
            <>
              <div className="filter-group">
                <h3>Category</h3>
                <ul className="filter-list">
                  {categories.map((cat) => {
                    const checked = activeFilterParams.includes(cat.slug);
                    return (
                      <li key={cat.slug}>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setParams({
                                category: checked
                                  ? activeFilterParams.filter((c) => c !== cat.slug)
                                  : [...activeFilterParams, cat.slug]
                              })
                            }
                          />
                          <span>{cat.title}{cat.productsCount ? ` (${cat.productsCount})` : ''}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="filter-group">
                <h3>Price</h3>
                <div className="filter-chips">
                  {PRICE_BANDS.map((band, index) => (
                    <button
                      key={band.label}
                      type="button"
                      className={`chip ${bandIndex === index ? 'active' : ''}`}
                      onClick={() => setParams({ band: bandIndex === index ? '' : index })}
                    >
                      {band.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={() => setParams({ inStock: inStockOnly ? '' : '1' })}
                  />
                  <span>In stock only</span>
                </label>
              </div>
            </>
          )}

          <button type="button" className="btn btn-ghost btn-block" onClick={clearFilters} disabled={activeFilterCount === 0}>
            Clear all filters
          </button>

          <button type="button" className="btn btn-primary btn-block sidebar-apply" onClick={() => setFiltersOpen(false)}>
            Show {productsState.total} result{productsState.total === 1 ? '' : 's'}
          </button>
        </aside>

        {filtersOpen && (
          <button type="button" className="sidebar-backdrop" onClick={() => setFiltersOpen(false)} aria-label="Close filters" />
        )}

        {/* ---------- Results ---------- */}
        <section className="shop-results" aria-live="polite">
          <div className="shop-toolbar">
            <button type="button" className="filter-toggle" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal size={16} />
              Filters {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
            </button>

            <p className="shop-count">
              {productsState.loading ? 'Loading products…' : `${productsState.total} product${productsState.total === 1 ? '' : 's'}`}
            </p>

            <div className="shop-toolbar-right">
              <div className="view-toggle" role="group" aria-label="Layout density">
                <button type="button" className={!dense ? 'active' : ''} onClick={() => setDense(false)} aria-label="Comfortable grid" aria-pressed={!dense}>
                  <LayoutGrid size={16} />
                </button>
                <button type="button" className={dense ? 'active' : ''} onClick={() => setDense(true)} aria-label="Compact grid" aria-pressed={dense}>
                  <Rows3 size={16} />
                </button>
              </div>

              <label className="sr-only" htmlFor="sort-select">Sort products</label>
              <select
                id="sort-select"
                className="select sort-select"
                value={normSort}
                onChange={(e) => setParams({ sort: e.target.value })}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="active-filters">
              {activeFilterParams.map((catSlug) => (
                <button
                  key={catSlug}
                  type="button"
                  className="active-chip"
                  onClick={() => setParams({ category: activeFilterParams.filter((c) => c !== catSlug) })}
                >
                  {categories.find((c) => c.slug === catSlug)?.title || catSlug} <X size={13} />
                </button>
              ))}
              {bandIndex != null && PRICE_BANDS[bandIndex] && (
                <button type="button" className="active-chip" onClick={() => setParams({ band: '' })}>
                  {PRICE_BANDS[bandIndex].label} <X size={13} />
                </button>
              )}
              {inStockOnly && (
                <button type="button" className="active-chip" onClick={() => setParams({ inStock: '' })}>
                  In stock <X size={13} />
                </button>
              )}
            </div>
          )}

          {productsState.status === 'unknown-slug' ? (
            <EmptyState
              icon={<Search size={28} />}
              title="That page does not exist"
              text={`We could not find “${slug}”. It may have been renamed or removed.`}
              actions={
                <>
                  <Link to="/shop" className="btn btn-primary">Browse all products</Link>
                  <Link to="/" className="btn btn-ghost">Back to home</Link>
                </>
              }
            />
          ) : productsState.status === 'unsupported-collection' ? (
            <EmptyState
              icon={<PackageSearch size={28} />}
              title="This collection is not available yet"
              text="Curated collections will appear here once there is seller data to back them."
              actions={
                <>
                  <Link to="/shop" className="btn btn-primary">Browse all products</Link>
                  <Link to="/collection/new-arrivals" className="btn btn-ghost">See newest products</Link>
                </>
              }
            />
          ) : productsState.error ? (
            <ErrorState
              title={productsState.error.status === 404 ? 'Not found' : 'Products could not be loaded'}
              text={productsState.error.message}
              actions={
                <>
                  <button type="button" className="btn btn-primary" onClick={retryFetch}>Try again</button>
                  <Link to="/shop" className="btn btn-ghost">Back to all products</Link>
                </>
              }
            />
          ) : productsState.loading ? (
            <SkeletonGrid count={8} className={dense ? 'compact' : ''} />
          ) : productsState.products.length === 0 ? (
            <EmptyState
              icon={<PackageSearch size={28} />}
              title={search ? `No products match “${search}”` : 'No products match these filters'}
              text="Try removing a filter, widening the price range, or search for something else."
              actions={
                <>
                  <button type="button" className="btn btn-primary" onClick={clearFilters}>Clear filters</button>
                  <Link to="/shop" className="btn btn-ghost">View all products</Link>
                </>
              }
            />
          ) : (
            <>
              <div className={`product-grid shop-grid ${dense ? 'compact' : ''}`}>
                {productsState.products.map((product) => (
                  <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
                ))}
              </div>

              <Pagination
                page={safePage}
                totalPages={totalPages}
                totalItems={productsState.total}
                pageSize={PAGE_SIZE}
                onChange={(next) => {
                  setParams({ page: next });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />

              <p className="shop-footnote">
                All prices are in Indian Rupees (₹) and include applicable taxes where noted by the seller.
                Listings and pricing accuracy are the seller’s responsibility.
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}