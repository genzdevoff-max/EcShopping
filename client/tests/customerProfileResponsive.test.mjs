import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

const cssPath = path.join(CLIENT_ROOT, 'src/pages/CustomerProfile.css');
const jsxPath = path.join(CLIENT_ROOT, 'src/pages/CustomerProfile.jsx');

const css = fs.readFileSync(cssPath, 'utf8');
const jsx = fs.readFileSync(jsxPath, 'utf8');

test('CustomerProfile: Invariant - No blanket overflow-x hidden or 100vw on page root', () => {
  // Ensure .customer-profile-page does NOT use max-width: 100vw or overflow-x: hidden
  const pageRootMatches = css.match(/\.customer-profile-page\s*\{[^}]*\}/g) || [];
  for (const block of pageRootMatches) {
    assert.ok(
      !block.includes('max-width: 100vw'),
      'Must NOT use max-width: 100vw on .customer-profile-page (causes scrollbar overflow)'
    );
    assert.ok(
      !block.includes('overflow-x: hidden'),
      'Must NOT use blanket overflow-x: hidden on .customer-profile-page to hide real overflow bugs'
    );
  }
});

test('CustomerProfile: Layout container guarantees min-width: 0 and box-sizing: border-box', () => {
  assert.match(
    css,
    /\.customer-profile-page\s*\{[^}]*box-sizing:\s*border-box/,
    '.customer-profile-page must enforce box-sizing: border-box'
  );
  assert.match(
    css,
    /\.profile-layout\s*\{[^}]*min-width:\s*0/,
    '.profile-layout must define min-width: 0 to prevent grid column blowout'
  );
  assert.match(
    css,
    /\.profile-sidebar\s*\{[^}]*min-width:\s*0/,
    '.profile-sidebar must define min-width: 0'
  );
  assert.match(
    css,
    /\.profile-content\s*\{[^}]*min-width:\s*0/,
    '.profile-content must define min-width: 0'
  );
});

test('CustomerProfile: User profile card wraps long emails, phones, and names safely', () => {
  assert.match(
    css,
    /\.profile-email\s*\{[^}]*word-break:\s*break-all/,
    '.profile-email must use word-break: break-all for safe wrapping of long email strings'
  );
  assert.match(
    css,
    /\.profile-email\s*\{[^}]*overflow-wrap:\s*anywhere/,
    '.profile-email must use overflow-wrap: anywhere'
  );
  assert.match(
    css,
    /\.profile-phone\s*\{[^}]*overflow-wrap:\s*anywhere/,
    '.profile-phone must safely wrap long phone numbers'
  );
  assert.match(
    css,
    /\.profile-badge\s*\{[^}]*max-width:\s*100%/,
    '.profile-badge must be constrained to 100% max-width'
  );
});

test('CustomerProfile: Navigation tabs on mobile form a controlled horizontal scroll container', () => {
  // Check the @media (max-width: 768px) rule for .profile-nav
  const mobileNavMatch = css.match(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.profile-nav\s*\{([\s\S]*?)\}/);
  assert.ok(mobileNavMatch, 'Must define mobile responsive styles for .profile-nav');

  const navBody = mobileNavMatch[1];
  assert.match(navBody, /overflow-x:\s*auto/, '.profile-nav must scroll horizontally on mobile');
  assert.match(navBody, /max-width:\s*100%/, '.profile-nav must be bounded by 100% max-width');
  assert.match(navBody, /min-width:\s*0/, '.profile-nav must set min-width: 0');
  assert.match(navBody, /scroll-snap-type:\s*x\s*proximity/, '.profile-nav must support smooth scroll snapping');

  // Verify tab buttons have flex-shrink: 0 and touch target >= 40px
  const mobileNavButtonMatch = css.match(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.profile-nav\s+button\s*\{([\s\S]*?)\}/);
  assert.ok(mobileNavButtonMatch, 'Must define mobile responsive styles for .profile-nav button');
  const btnBody = mobileNavButtonMatch[1];
  assert.match(btnBody, /flex-shrink:\s*0/, '.profile-nav button must have flex-shrink: 0 to prevent squishing');
  assert.match(btnBody, /min-height:\s*42px/, '.profile-nav button must enforce >= 42px touch target');
  assert.match(btnBody, /white-space:\s*nowrap/, '.profile-nav button must maintain nowrap labels inside scroll container');

  // Verify logout button does NOT have margin-left: auto inside mobile scroll container
  const logoutBtnMatch = css.match(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.profile-nav\s+button\.logout-btn\s*\{([\s\S]*?)\}/);
  assert.ok(logoutBtnMatch, 'Must configure logout button on mobile');
  assert.match(logoutBtnMatch[1], /margin-left:\s*0/, 'Must override margin-left: auto with 0 to prevent scroll distortion');
});

test('CustomerProfile: Order History toolbar actions and buttons fit without clipping', () => {
  // Mobile toolbar actions rule
  const mobileToolbarMatch = css.match(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.section-toolbar\s*\{([\s\S]*?)\}/);
  assert.ok(mobileToolbarMatch, 'Must define mobile .section-toolbar layout');
  assert.match(mobileToolbarMatch[1], /flex-direction:\s*column/, '.section-toolbar must stack on mobile');

  const mobileToolbarActions = css.match(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.toolbar-actions\s*\{([\s\S]*?)\}/);
  assert.ok(mobileToolbarActions, 'Must define mobile .toolbar-actions');
  assert.match(mobileToolbarActions[1], /width:\s*100%/, '.toolbar-actions must span full available width');

  // At <= 480px, toolbar buttons must be 100% full width to prevent clipping
  const smallMobileActions = css.match(/@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*?\.toolbar-actions\s*\{([\s\S]*?)\}/);
  assert.ok(smallMobileActions, 'Must define <= 480px .toolbar-actions');
  assert.match(smallMobileActions[1], /flex-direction:\s*column/, 'Toolbar actions stack full-width on mobile <= 480px');

  const smallMobileLink = css.match(/@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*?\.toolbar-link\s*\{([\s\S]*?)\}/);
  assert.ok(smallMobileLink, 'Must define <= 480px .toolbar-link');
  assert.match(smallMobileLink[1], /width:\s*100%/, 'Toolbar links must take 100% width on mobile <= 480px');
});

test('CustomerProfile: Order cards wrap long order IDs and adapt footer buttons', () => {
  assert.match(
    css,
    /\.order-id\s*\{[^}]*word-break:\s*break-all/,
    '.order-id must have word-break: break-all to prevent long order IDs from blowing out card headers'
  );
  assert.match(
    css,
    /\.order-id\s*\{[^}]*overflow-wrap:\s*anywhere/,
    '.order-id must have overflow-wrap: anywhere'
  );
  assert.match(
    css,
    /\.order-header-info\s*\{[^}]*min-width:\s*0/,
    '.order-header-info must have min-width: 0 for proper flex containment'
  );

  // Footer buttons full-width on mobile <= 480px
  const footerBtnMatch = css.match(/@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*?\.btn-secondary-sm,\s*\.btn-cancel-sm\s*\{([\s\S]*?)\}/);
  assert.ok(footerBtnMatch, 'Must define full-width order action buttons on mobile <= 480px');
  assert.match(footerBtnMatch[1], /width:\s*100%/, 'Order action buttons must be full-width on narrow mobile');
  assert.match(footerBtnMatch[1], /min-height:\s*44px/, 'Order action buttons must enforce >= 44px touch target');
});

test('CustomerProfile: Saved Addresses grid collapses to 1 column on mobile without 280px min-width overflow', () => {
  const mobileGridMatch = css.match(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.address-grid\s*\{([\s\S]*?)\}/);
  assert.ok(mobileGridMatch, 'Must define mobile .address-grid rule');
  assert.match(mobileGridMatch[1], /grid-template-columns:\s*1fr/, 'Must collapse to 1fr single column on mobile');

  assert.match(
    css,
    /\.address-card\s*\{[^}]*overflow-wrap:\s*anywhere/,
    '.address-card must wrap address text safely'
  );
});

test('CustomerProfile: Modals are responsive bottom sheets on mobile with accessible touch targets', () => {
  const modalMatch = css.match(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.modal-dialog\s*\{([\s\S]*?)\}/);
  assert.ok(modalMatch, 'Must define responsive modal on mobile');
  assert.match(modalMatch[1], /width:\s*100%/, 'Modal dialog must take 100% width on mobile');
  assert.match(modalMatch[1], /border-radius:\s*18px\s+18px\s+0\s+0/, 'Modal dialog forms a modern bottom-sheet on mobile');

  assert.match(
    css,
    /\.modal-header\s+h3\s*\{[^}]*overflow-wrap:\s*anywhere/,
    '.modal-header h3 must wrap long order titles or cancellation text safely'
  );
});

test('CustomerProfile: Small mobile <= 360px and <= 480px optimizations are present', () => {
  assert.match(css, /@media\s*\(max-width:\s*480px\)/, 'Must provide dedicated breakpoint for <= 480px');
  assert.match(css, /@media\s*\(max-width:\s*360px\)/, 'Must provide dedicated breakpoint for <= 360px');
  assert.match(css, /@media\s*\(max-width:\s*768px\)/, 'Must provide dedicated breakpoint for <= 768px');
  assert.match(css, /@media\s*\(max-width:\s*1024px\)/, 'Must provide dedicated breakpoint for <= 1024px');
});

test('CustomerProfile: JSX contains proper accessibility roles and responsive markup hooks', () => {
  assert.ok(jsx.includes('role="tablist"'), 'Navigation must declare role="tablist"');
  assert.ok(jsx.includes('role="tab"'), 'Tab buttons must declare role="tab"');
  assert.ok(jsx.includes('aria-selected='), 'Tab buttons must declare aria-selected');
  assert.ok(jsx.includes('className="order-header-info"'), 'Order card header must wrap info in .order-header-info');
  assert.ok(jsx.includes('addresses-toolbar'), 'Addresses toolbar must have .addresses-toolbar');
});
