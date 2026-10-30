/**
 * Pure, dependency-free mapping helpers for server-backed storefront data.
 * Kept free of browser/API imports so node --test can exercise it directly.
 */

/** URL slug for a category name: lowercase, spaces/punctuation collapsed to dashes. */
export function slugifyName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function categorySlugFromName(name) {
  return slugifyName(name);
}

/**
 * Maps one /api/products row to the shape the storefront UI (ProductCard,
 * ProductDetails, cart, wishlist, checkout snapshot) already understands.
 * Deliberately never invents values: fields without a server source
 * (rating, reviews, variants, specs, badge, sales, tags, image variants)
 * stay null/empty so the UI hides them instead of fabricating data.
 */
export function mapServerProduct(row) {
  if (!row || typeof row !== 'object') return null;

  const price = Number(row.price) || 0;
  const strikeRaw = row.strikePrice != null && row.strikePrice !== '' ? Number(row.strikePrice) : null;
  const stockStatus = row.stockStatus || 'in_stock';
  const isApproved = row.status ? row.status === 'approved' : true;
  const isVendorProduct = Boolean(row.vendorId && row.vendorId !== 'admin');
  const isAdminProduct = !isVendorProduct;

  let resolvedSeller = row.vendorName || 'EcShopping Seller';
  if (row.vendorName === 'Platform Direct' || row.vendorName === 'admin' || row.vendorName === 'Admin') {
    resolvedSeller = 'Admin Direct';
  }

  return {
    id: String(row.id ?? ''),
    title: row.title || row.name || 'Untitled product',
    name: row.name || row.title || 'Untitled product',
    description: row.description || '',
    price,
    // compareAt is only shown when the strike price is really higher;
    // this mirrors the server-side validated hasDiscount comparison.
    compareAt: strikeRaw != null && strikeRaw > price ? strikeRaw : null,
    image: row.image || '',
    images: row.image ? [row.image] : [],
    videoUrl: row.videoUrl || row.video_url || '',
    category: row.category || '',
    categorySlug: categorySlugFromName(row.category),
    seller: resolvedSeller,
    vendorId: row.vendorId || null,
    isAdminProduct,
    isVendorProduct,
    ownerType: isVendorProduct ? 'vendor' : 'admin',
    unit: row.unit || '',
    variants: [],
    selectedVariant: null,
    rating: null,
    reviews: null,
    badge: null,
    tags: [],
    specs: [],
    sales: null,
    inStock: stockStatus !== 'out_of_stock',
    stockStatus,
    status: row.status || 'approved',
    isApproved,
    addedAt: row.createdAt || null,
    createdAt: row.createdAt || null,
    isServerListing: true
  };
}
