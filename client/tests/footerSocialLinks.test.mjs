import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

const contentJs = fs.readFileSync(path.join(CLIENT_ROOT, 'src/data/content.js'), 'utf8');
const footerJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/Footer.jsx'), 'utf8');
const footerCss = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/Footer.css'), 'utf8');

test('content.js exports configurable socialLinks array covering Instagram, Facebook, and YouTube', () => {
  assert.ok(contentJs.includes('export const socialLinks'), 'Must export socialLinks array');
  assert.ok(contentJs.includes('Instagram'), 'Must include Instagram config');
  assert.ok(contentJs.includes('Facebook'), 'Must include Facebook config');
  assert.ok(contentJs.includes('YouTube'), 'Must include YouTube config');
  assert.ok(contentJs.includes('VITE_INSTAGRAM_URL'), 'Must support environment variable override for Instagram');
  assert.ok(contentJs.includes('VITE_FACEBOOK_URL'), 'Must support environment variable override for Facebook');
  assert.ok(contentJs.includes('VITE_YOUTUBE_URL'), 'Must support environment variable override for YouTube');
});

test('Footer.jsx renders accessible, secure social links with zero dead placeholder links', () => {
  // Ensure dead "#" links are completely eradicated
  assert.ok(!footerJsx.includes('href="#instagram"'), 'Must not have dead #instagram link');
  assert.ok(!footerJsx.includes('href="#facebook"'), 'Must not have dead #facebook link');
  assert.ok(!footerJsx.includes('href="#youtube"'), 'Must not have dead #youtube link');

  // Verify external security attributes
  assert.ok(footerJsx.includes('target="_blank"'), 'Must open in new tab');
  assert.ok(footerJsx.includes('rel="noopener noreferrer"'), 'Must protect against reverse tab-napping with noopener noreferrer');

  // Verify accessibility
  assert.ok(footerJsx.includes('aria-label='), 'Must include aria-label for assistive tech');
  assert.ok(footerJsx.includes('title='), 'Must include tooltip title attribute');

  // Verify conditional rendering that ignores empty links
  assert.ok(
    footerJsx.includes(".filter((item) => item.url && item.url.startsWith('http'))"),
    'Must filter out empty or invalid URLs so unconfigured profiles degrade gracefully'
  );
});

test('Footer.css ensures 44px accessible touch targets and responsive flex wrap', () => {
  assert.ok(footerCss.includes('width: 44px') || footerCss.includes('min-width: 44px'), 'Must meet 44px touch target width');
  assert.ok(footerCss.includes('height: 44px') || footerCss.includes('min-height: 44px'), 'Must meet 44px touch target height');
  assert.ok(footerCss.includes('flex-wrap: wrap'), 'Must wrap gracefully on narrow viewports');
});
