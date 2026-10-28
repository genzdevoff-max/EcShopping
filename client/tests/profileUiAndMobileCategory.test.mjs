import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

test('CustomerProfile.css styles Personal Details inputs, borders, wrappers and focus states', () => {
  const css = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/CustomerProfile.css'), 'utf8');

  // Input wrapper, icon, and input borders
  assert.match(css, /\.settings-box\s*\{/, 'Must define .settings-box container');
  assert.match(css, /\.profile-form\s*\{/, 'Must define .profile-form layout');
  assert.match(css, /\.profile-form\s+\.input-wrap\s*\{[^}]*border:\s*1\.5px\s+solid\s+#cbd5e1/, 'Must style .input-wrap with clear 1.5px border');
  assert.match(css, /\.profile-form\s+\.input-wrap:focus-within\s*\{[^}]*border-color:\s*#0e5c4a/, 'Must have brand focus ring on .input-wrap:focus-within');
  assert.match(css, /\.profile-form\s+\.input-icon\s*\{[^}]*position:\s*absolute/, 'Must position .input-icon inside .input-wrap');
  assert.match(css, /\.profile-form\s+\.input-wrap\s+input\s*\{[^}]*min-height:\s*44px/, 'Must enforce >=44px touch target on inputs');
  assert.match(css, /\.profile-form\s+\.input-wrap\s+input\s*\{[^}]*padding:[^}]*42px/, 'Must pad input to avoid overlapping the input icon');
  assert.match(css, /\.disabled-input/, 'Must define styling for immutable email input');
  assert.match(css, /\.btn-save-profile\s*\{[^}]*background-color:\s*#0e5c4a/, 'Must style submit button with pine green theme');
  assert.match(css, /\.alert-banner\.success/, 'Must style success feedback alert');
  assert.match(css, /\.alert-banner\.error/, 'Must style error feedback alert');
});

test('CustomerProfile.jsx includes structured field wrappers and disabled identifier notice', () => {
  const jsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/CustomerProfile.jsx'), 'utf8');

  assert.ok(jsx.includes('className="input-wrap"'), 'Must wrap form inputs in .input-wrap');
  assert.ok(jsx.includes('className="input-icon"'), 'Must render input icon in .input-icon');
  assert.ok(jsx.includes('disabled-input'), 'Must mark email as disabled-input');
  assert.ok(jsx.includes('btn-save-profile'), 'Must use .btn-save-profile button');
  assert.ok(jsx.includes('Email address cannot be changed'), 'Must explain email immutability');
});

test('home.css removes redundant category tiles below products on mobile (< 768px)', () => {
  const css = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/home/home.css'), 'utf8');

  // Verify mobile rule hiding .cat-tiles-section
  assert.match(css, /@media\s*\([^)]*max-width:\s*768px\)\s*\{[^}]*\.cat-tiles-section\s*\{[^}]*display:\s*none/,
    'Must hide redundant .cat-tiles-section below products on mobile viewports');
});

test('HomeSections.jsx and Home.jsx keep primary top category navigation intact', () => {
  const homeJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/pages/Home.jsx'), 'utf8');
  const sectionsJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/home/HomeSections.jsx'), 'utf8');

  // Top category navigation must be mounted at the top of Home.jsx
  assert.ok(
    homeJsx.includes('<CircularCategoryShowcase') || homeJsx.includes('<CompactCategoryNav'),
    'Home.jsx must mount CircularCategoryShowcase or CompactCategoryNav at page top'
  );
  assert.ok(
    sectionsJsx.includes('CircularCategoryShowcase') || sectionsJsx.includes('export function CompactCategoryNav'),
    'HomeSections must export CircularCategoryShowcase'
  );
  assert.ok(sectionsJsx.includes('className="compact-cat-nav"') || sectionsJsx.includes('circular-category-showcase'), 'Top category navigation must render navigation class');
});
