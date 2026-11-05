import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

const adminJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/admin/AdminDashboard.jsx'), 'utf8');
const vendorCatJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/vendor/CategoryManager.jsx'), 'utf8');
const showcaseJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/home/CircularCategoryShowcase.jsx'), 'utf8');
const showcaseCss = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/home/CircularCategoryShowcase.css'), 'utf8');
const storefrontJs = fs.readFileSync(path.join(CLIENT_ROOT, 'src/data/storefront.js'), 'utf8');

/* ---------------------------------------------------------------
   1. Admin Category Management Image Upload & Edit
   --------------------------------------------------------------- */

test('AdminDashboard.jsx includes Category Image upload and URL inputs in creation form', () => {
  // Label and file input
  assert.ok(adminJsx.includes('Category Image'), 'Must label category image in form');
  assert.ok(adminJsx.includes('newCatFileInputRef'), 'Must reference file input for category image upload');
  assert.ok(adminJsx.includes('handleNewCatImageUpload'), 'Must provide image upload handler for new category');
  assert.ok(adminJsx.includes('api.uploadImage'), 'Must upload image via api.uploadImage');

  // URL input and preview
  assert.ok(adminJsx.includes('newCatImage'), 'Must bind state for category image URL');
  assert.ok(adminJsx.includes('clearCategoriesCache'), 'Must invalidate storefront cache on category mutation');
});

test('AdminDashboard.jsx renders Category Image column and thumbnails in categories table', () => {
  // Image header in the table
  assert.ok(/<th[^>]*>\s*Image\s*<\/th>/.test(adminJsx), 'Categories table must include Image header');

  // Circular thumbnail display
  assert.ok(adminJsx.includes('cat.image || DEFAULT_CATEGORY_IMAGE'), 'Must display cat.image with fallback');
  assert.ok(adminJsx.includes('borderRadius: \'50%\'') || adminJsx.includes('border-radius: 50%') || adminJsx.includes('borderRadius: 50%'), 'Category thumbnail must be circular');

  // Edit row allows image replacement
  assert.ok(adminJsx.includes('editCatFileInputRef'), 'Edit row must support file upload replacement');
  assert.ok(adminJsx.includes('handleEditCatImageUpload'), 'Must define handler for editing category image');
  assert.ok(adminJsx.includes('imageUrl: editCatImage'), 'Must send updated imageUrl on save');
});

/* ---------------------------------------------------------------
   2. Vendor Category Manager Image Upload
   --------------------------------------------------------------- */

test('CategoryManager.jsx supports Category Image upload, URL entry, and thumbnail in table', () => {
  assert.ok(vendorCatJsx.includes('Category Image'), 'Vendor CategoryManager must label category image field');
  assert.ok(vendorCatJsx.includes('handleImageUpload'), 'Vendor CategoryManager must have image upload handler');
  assert.ok(vendorCatJsx.includes('api.uploadImage'), 'Vendor CategoryManager must call api.uploadImage');
  assert.ok(vendorCatJsx.includes('imageUrl: image'), 'Vendor CategoryManager must persist imageUrl');
  assert.ok(/<th[^>]*>\s*Image\s*<\/th>/.test(vendorCatJsx), 'Vendor CategoryManager table must include Image header');
  assert.ok(vendorCatJsx.includes('cat.image || DEFAULT_CATEGORY_IMAGE'), 'Vendor table must display thumbnail with fallback');
});

/* ---------------------------------------------------------------
   3. Storefront Data Layer and Customer Homepage Connection
   --------------------------------------------------------------- */

test('storefront.js maps database category image and exports clearCategoriesCache', () => {
  assert.ok(storefrontJs.includes('image: row.image || display.image'), 'Must prioritize database row.image over static fallback');
  assert.ok(storefrontJs.includes('export const clearCategoriesCache'), 'Must export clearCategoriesCache for immediate invalidation');
});

test('CircularCategoryShowcase.jsx handles database image URLs and data URIs safely', () => {
  // Uses cat.image with fallback
  assert.ok(showcaseJsx.includes('const imgSrc = cat.image || DEFAULT_CATEGORY_IMAGE;'), 'Must retrieve cat.image or DEFAULT_CATEGORY_IMAGE');

  // Handles data URIs without breaking srcset
  assert.ok(showcaseJsx.includes('isDataUri'), 'Must detect inline data URIs to avoid invalid srcset commas');
  assert.ok(showcaseJsx.includes('optimizeImageUrl'), 'Must optimize remote URLs via optimizeImageUrl');

  // Fallback on error
  assert.ok(showcaseJsx.includes('DEFAULT_CATEGORY_IMAGE'), 'Must revert to DEFAULT_CATEGORY_IMAGE on image load error');
});

/* ---------------------------------------------------------------
   4. Mobile and Desktop Display Verification
   --------------------------------------------------------------- */

test('CircularCategoryShowcase.css ensures responsive circular images on mobile and desktop', () => {
  // Desktop circular styling
  assert.match(showcaseCss, /\.circular-cat-media\s*\{[^}]*border-radius:\s*50%/, 'Media frame must be circular');
  assert.match(showcaseCss, /\.circular-cat-media\s*img\s*\{[^}]*object-fit:\s*cover/, 'Image must have object-fit: cover');

  // Mobile media query responsiveness
  assert.ok(showcaseCss.includes('@media (max-width: 768px)'), 'Must include tablet/mobile breakpoint');
  assert.ok(showcaseCss.includes('@media (max-width: 430px)'), 'Must include phone breakpoint');
  assert.ok(showcaseCss.includes('@media (max-width: 350px)'), 'Must include narrow phone breakpoint (320px-350px)');
});
