import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

// Read source files for static architecture & template inspection
const promoJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/home/PromotionalBanner.jsx'), 'utf8');
const promoCss = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/home/PromotionalBanner.css'), 'utf8');
const categoryShowcaseJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/home/CircularCategoryShowcase.jsx'), 'utf8');
const categoryShowcaseCss = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/home/CircularCategoryShowcase.css'), 'utf8');
const homeJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/Home.jsx'), 'utf8');
const homeSectionsJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/home/HomeSections.jsx'), 'utf8');

/* ---------------------------------------------------------------
   1. Banner CTA Navigation & Asset Quality Tests
   --------------------------------------------------------------- */

test('PromotionalBanner defines real campaigns with valid canonical routes and zero placeholder links', () => {
  // Ensure no href="#" or placeholder links
  assert.ok(!promoJsx.includes('href="#"'), 'Banner must never contain placeholder href="#" links');
  assert.ok(!promoJsx.includes('to="#"'), 'Banner Link components must never target "#"');

  // Verify campaigns have canonical routes
  assert.ok(promoJsx.includes("to: '/shop'"), 'Must link to /shop for product discovery');
  assert.ok(promoJsx.includes("to: '/collection/deals'") || promoJsx.includes("to: '/category/"), 'Must link to real collections or categories');

  // Verify campaign copy and imagery exist
  assert.ok(promoJsx.includes('Pure Organic Produce & Farm Harvests'), 'Must include organic harvest campaign headline');
  assert.ok(promoJsx.includes('Authentic Wood-Pressed Oils'), 'Must include artisanal oils campaign headline');
  assert.ok(promoJsx.includes('Save on Daily Essentials'), 'Must include farmer bundles campaign headline');
});

test('PromotionalBanner includes accessible navigation controls and layout safety', () => {
  // Navigation controls
  assert.ok(promoJsx.includes('aria-label="Previous promotional slide"'), 'Previous arrow must have accessible aria-label');
  assert.ok(promoJsx.includes('aria-label="Next promotional slide"'), 'Next arrow must have accessible aria-label');
  assert.ok(promoJsx.includes('role="tablist"'), 'Pagination dots must have tablist semantics');
  assert.ok(promoJsx.includes('aria-label="Promotional campaign banner"'), 'Banner section must have region label');

  // Aspect ratio in CSS (~4:1 to 5:2 on desktop)
  assert.match(promoCss, /aspect-ratio:\s*4\.\d+\s*\/\s*1/, 'CSS must specify desktop aspect ratio around 4:1 to 5:2');
  assert.ok(promoCss.includes('min-height'), 'CSS must specify min-height to prevent layout shifts (CLS=0)');
  assert.ok(promoCss.includes('--brand') || promoCss.includes('#0e5c4a'), 'Must preserve EcShopping pine green brand color');
  assert.ok(promoCss.includes('--accent') || promoCss.includes('#d9663d'), 'Must preserve EcShopping terracotta accent color');
});

/* ---------------------------------------------------------------
   2. Circular Category Showcase Rendering & Data Handling
   --------------------------------------------------------------- */

test('CircularCategoryShowcase renders circular category media with balanced labels', () => {
  // Heading requirements
  assert.ok(categoryShowcaseJsx.includes('Shop by Category'), 'Must display "Shop by Category" heading');
  assert.ok(categoryShowcaseJsx.includes('Explore Aisles'), 'Must display "Explore Aisles" eyebrow');

  // Circular media CSS
  assert.match(categoryShowcaseCss, /\.circular-cat-media\s*\{[^}]*border-radius:\s*50%/, 'Media frame must be strictly circular (border-radius: 50%)');
  assert.match(categoryShowcaseCss, /\.circular-cat-media\s*img\s*\{[^}]*object-fit:\s*cover/, 'Image must use object-fit: cover');
  assert.match(categoryShowcaseCss, /\.circular-cat-media\s*img\s*\{[^}]*border-radius:\s*50%/, 'Image inside circular frame must be circular');

  // Balanced labels
  assert.ok(categoryShowcaseCss.includes('.circular-cat-label'), 'Must define label styling');
  assert.ok(categoryShowcaseCss.includes('-webkit-line-clamp: 2'), 'Labels must clamp gracefully up to 2 lines');
});

test('CircularCategoryShowcase filters noise and non-storefront categories', () => {
  // Filters out test/organic categories from live API rows
  assert.ok(categoryShowcaseJsx.includes("toLowerCase() !== 'test'"), 'Must filter out test categories');
  assert.ok(categoryShowcaseJsx.includes("toLowerCase() !== 'organic'"), 'Must filter out generic organic noise');
});

/* ---------------------------------------------------------------
   3. Category Click Navigation
   --------------------------------------------------------------- */

test('CircularCategoryShowcase navigates individual categories to /category/${slug}', () => {
  // Category link interpolation
  assert.ok(categoryShowcaseJsx.includes('to={`/category/${cat.slug}`}'), 'Each category item must navigate to /category/${cat.slug}');
  assert.ok(categoryShowcaseJsx.includes('aria-label={`Shop ${cat.title} category`}'), 'Category links must have accessible labels');
});

/* ---------------------------------------------------------------
   4. Show More / View All vs Arrow Scroll Behavior
   --------------------------------------------------------------- */

test('Show more action navigates to /shop while arrow controls strictly scroll the container', () => {
  // Canonical "Show more" link
  assert.ok(categoryShowcaseJsx.includes('to="/shop"'), 'Show more action must navigate to /shop');
  assert.ok(categoryShowcaseJsx.includes('className="circular-cat-show-more-link"'), 'Must render dedicated .circular-cat-show-more-link');
  assert.ok(categoryShowcaseJsx.includes('Show more'), 'Must display visible "Show more" label text');

  // End-cap tile in the track
  assert.ok(categoryShowcaseJsx.includes('circular-cat-all-tile'), 'Track must provide end-cap All Products / Show more circular tile');

  // Scroll arrow controls must be buttons (type="button") that scroll, NOT anchor links
  assert.ok(categoryShowcaseJsx.includes('className="circular-cat-arrow circular-cat-arrow-left"'), 'Must render left scroll arrow');
  assert.ok(categoryShowcaseJsx.includes('className="circular-cat-arrow circular-cat-arrow-right"'), 'Must render right scroll arrow');
  assert.ok(categoryShowcaseJsx.includes('onClick={handleScrollLeft}'), 'Left arrow must invoke scroll handler');
  assert.ok(categoryShowcaseJsx.includes('onClick={handleScrollRight}'), 'Right arrow must invoke scroll handler');
  assert.ok(categoryShowcaseJsx.includes('scrollBy'), 'Arrow handlers must call scrollBy to scroll row horizontally');
});

/* ---------------------------------------------------------------
   5. Empty Category & Image Fallback Behavior
   --------------------------------------------------------------- */

test('CircularCategoryShowcase provides graceful image fallbacks and skeleton loading', () => {
  // Graceful fallback image
  assert.ok(categoryShowcaseJsx.includes('DEFAULT_CATEGORY_IMAGE'), 'Must import and use DEFAULT_CATEGORY_IMAGE fallback');
  assert.ok(categoryShowcaseJsx.includes('onError='), 'Must handle img onError event to replace broken images');

  // Skeleton loading state
  assert.ok(categoryShowcaseJsx.includes('loading'), 'Must accept loading prop');
  assert.ok(categoryShowcaseJsx.includes('skeleton-track'), 'Must render skeleton track when loading');
  assert.ok(categoryShowcaseJsx.includes('circular-cat-skeleton-item'), 'Must render skeleton circular items');

  // Empty state handling
  assert.ok(categoryShowcaseJsx.includes('!activeCategories.length') && categoryShowcaseJsx.includes('return null'), 'Must gracefully return null when no categories exist');
});

/* ---------------------------------------------------------------
   6. Homepage Hierarchy & Integration
   --------------------------------------------------------------- */

test('Home.jsx maintains correct product-first hierarchy: Banner -> Circular Categories -> Product Rails', () => {
  // Check imports in Home.jsx and HomeSections.jsx
  assert.ok(homeJsx.includes('PromotionalBanner'), 'Home.jsx must import PromotionalBanner');
  assert.ok(homeJsx.includes('CircularCategoryShowcase'), 'Home.jsx must import CircularCategoryShowcase');
  assert.ok(homeSectionsJsx.includes('export { PromotionalBanner, CircularCategoryShowcase }'), 'HomeSections must export both components');

  // Check visual hierarchy order in Home.jsx
  const bannerIndex = homeJsx.indexOf('<PromotionalBanner');
  const categoryIndex = homeJsx.indexOf('<CircularCategoryShowcase');
  const railIndex = homeJsx.indexOf('<ProductRail');

  assert.ok(bannerIndex !== -1, 'PromotionalBanner must be rendered in Home.jsx');
  assert.ok(categoryIndex !== -1, 'CircularCategoryShowcase must be rendered in Home.jsx');
  assert.ok(railIndex !== -1, 'ProductRail must be rendered in Home.jsx');

  assert.ok(bannerIndex < categoryIndex, 'PromotionalBanner must precede CircularCategoryShowcase');
  assert.ok(categoryIndex < railIndex, 'CircularCategoryShowcase must precede ProductRail');
});
