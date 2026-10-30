import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

test('Footer.jsx displays only required contact details with readable address lines and tel link', () => {
  const footerJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/Footer.jsx'), 'utf8');

  // Must include the exact name RAMESH. S
  assert.ok(footerJsx.includes('RAMESH. S'), 'Must display RAMESH. S');
  assert.ok(footerJsx.includes('footer-contact-name'), 'Must style name with .footer-contact-name');

  // Must include the exact address lines
  assert.ok(footerJsx.includes('1/896, Nadu Thottam,'), 'Must include street line 1');
  assert.ok(footerJsx.includes('Konamoolai,'), 'Must include area line 2');
  assert.ok(footerJsx.includes('Sathyamangalam,'), 'Must include city line 3');
  assert.ok(footerJsx.includes('Erode – 638402'), 'Must include district and PIN code');

  // Must include the clickable tel link
  assert.ok(footerJsx.includes('href="tel:9786070708"'), 'Must provide tel: link for phone number');
  assert.ok(footerJsx.includes('9786070708'), 'Must display 9786070708');

  // Must NOT have invented placeholder email in the contact block
  assert.ok(!footerJsx.includes('support@ecshopping.example'), 'Must not display invented email address');
  assert.ok(!footerJsx.includes('mailto:'), 'Must not display unprovided mailto links');
});

test('Footer.css defines clean typography, readable address lines, and accessible touch targets', () => {
  const footerCss = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/Footer.css'), 'utf8');

  assert.ok(footerCss.includes('.footer-contact-name'), 'Must define .footer-contact-name');
  assert.ok(footerCss.includes('.footer-address-lines'), 'Must define .footer-address-lines');
  assert.ok(footerCss.includes('.footer-contact-cell'), 'Must define .footer-contact-cell');
  assert.ok(footerCss.includes('.footer-cell-link'), 'Must define .footer-cell-link');
});

test('UnifiedAuthModal and AdminLogin format Administrative Portal heading & subtitle in balanced alignment', () => {
  const authCss = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/auth/UnifiedAuthModal.css'), 'utf8');
  const authJsx = fs.readFileSync(path.join(CLIENT_ROOT, 'src/components/auth/UnifiedAuthModal.jsx'), 'utf8');

  // Verify JSX includes the heading and lock pill
  assert.ok(authJsx.includes('Administrative Portal'), 'Must include Administrative Portal heading');
  assert.ok(authJsx.includes('Authorized Personnel Only'), 'Must include Authorized Personnel Only subtitle');

  // Verify CSS defines column alignment and center alignment
  assert.match(authCss, /\.auth-admin-restricted-banner\s*\{[^}]*flex-direction:\s*column/, 'Must align heading and subtitle vertically');
  assert.match(authCss, /\.auth-admin-restricted-banner\s*\{[^}]*align-items:\s*center/, 'Must center align banner items');
  assert.match(authCss, /\.auth-admin-restricted-banner\s*\{[^}]*justify-content:\s*center/, 'Must center justify banner content');
});
