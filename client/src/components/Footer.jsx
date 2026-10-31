import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Phone, MapPin, Check, ArrowRight, Mail } from 'lucide-react';
import brandLogo from '../assets/logo/without-bg-logo.png';
import { useStorefrontCategories } from '../data/storefront';
import { socialLinks } from '../data/content';
import './Footer.css';

function InstagramIcon({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function YoutubeIcon({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <polygon points="10 15 15 12 10 9 10 15" fill="currentColor" />
    </svg>
  );
}

const SOCIAL_ICONS = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  youtube: YoutubeIcon
};

function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | error | done
  const [message, setMessage] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!valid) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }
    setStatus('done');
    setMessage('You are on the list. We will be in touch soon.');
    setEmail('');
  };

  return (
    <form className="newsletter-form" onSubmit={submit} noValidate>
      <label className="sr-only" htmlFor="footer-newsletter">Email address</label>
      <div className="newsletter-row">
        <input
          id="footer-newsletter"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status !== 'idle') setStatus('idle'); }}
          aria-invalid={status === 'error'}
          className={status === 'error' ? 'has-error' : ''}
        />
        <button type="submit" aria-label="Subscribe to newsletter">
          <ArrowRight size={17} />
        </button>
      </div>
      {message && (
        <p className={`newsletter-msg ${status === 'error' ? 'err' : 'ok'}`} role="status">
          {status === 'done' && <Check size={14} />} {message}
        </p>
      )}
    </form>
  );
}

export default function Footer() {
  const { categories, loading: categoriesLoading } = useStorefrontCategories();

  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="container footer-grid">
          <div className="footer-brand-col">
            <Link to="/" className="footer-brand" aria-label="EcShopping home">
              <img src={brandLogo} alt="EcShopping" className="footer-brand-logo-img" />
            </Link>
            <p className="footer-desc">
              A marketplace where verified local sellers meet customers who want fresh, honest,
              everyday goods — from farm produce to handmade home essentials.
            </p>

            <div className="footer-contact footer-contact-card">
              <div className="footer-contact-name">RAMESH. S</div>
              <div className="footer-contact-address">
                <MapPin size={15} className="footer-contact-icon" aria-hidden="true" />
                <address className="footer-address-lines">
                  <span>1/896, Nadu Thottam,</span>
                  <span>Konamoolai,</span>
                  <span>Sathyamangalam,</span>
                  <span>Erode – 638402</span>
                </address>
              </div>
              <div className="footer-contact-cell">
                <Phone size={15} className="footer-contact-icon" aria-hidden="true" />
                <span className="footer-cell-label">Cell:</span>
                <a href="tel:9786070708" className="footer-cell-link">9786070708</a>
              </div>
              <div className="footer-contact-email">
                <Mail size={15} className="footer-contact-icon" aria-hidden="true" />
                <span className="footer-email-label">Email:</span>
                <a href="mailto:econnectshopping@gmail.com" className="footer-email-link" aria-label="Email EcShopping at econnectshopping@gmail.com">
                  econnectshopping@gmail.com
                </a>
              </div>
            </div>

            <div className="social-links" aria-label="Social media channels">
              {socialLinks
                .filter((item) => item.url && item.url.startsWith('http'))
                .map((item) => {
                  const Icon = SOCIAL_ICONS[item.key] || Globe;
                  return (
                    <a
                      key={item.key}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.ariaLabel || `${item.name} (opens in new tab)`}
                      title={item.ariaLabel || `${item.name} (opens in new tab)`}
                      className="social-link-btn"
                    >
                      <Icon size={18} />
                    </a>
                  );
                })}
            </div>
          </div>

          <nav className="footer-links-col" aria-label="Shop links">
            <h4>Shop</h4>
            <ul>
              <li><Link to="/shop">All products</Link></li>
              {!categoriesLoading && categories.slice(0, 5).map((c) => (
                <li key={c.slug}><Link to={`/category/${c.slug}`}>{c.title}</Link></li>
              ))}
              <li><Link to="/collection/new-arrivals">New arrivals</Link></li>
              <li><Link to="/collection/deals">Weekend deals</Link></li>
            </ul>
          </nav>

          <nav className="footer-links-col" aria-label="Support links">
            <h4>Support</h4>
            <ul>
              <li><Link to="/faq">FAQ</Link></li>
              <li><Link to="/shipping">Shipping & delivery</Link></li>
              <li><Link to="/returns">Returns & refunds</Link></li>
              <li><Link to="/track-order">Track your order</Link></li>
              <li><Link to="/orders">Order history</Link></li>
              <li><Link to="/contact">Contact us</Link></li>
              <li><Link to="/bulk-order">Bulk order enquiry</Link></li>
            </ul>
          </nav>

          <nav className="footer-links-col" aria-label="Company links">
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">About us</Link></li>
              <li><Link to="/privacy">Privacy policy</Link></li>
              <li><Link to="/terms">Terms & conditions</Link></li>
              <li><Link to="/vendor">Vendor portal</Link></li>
              <li><Link to="/vendor/register">Become a seller</Link></li>
              <li><Link to="/admin/login">Admin Login</Link></li>
            </ul>
          </nav>

          <div className="footer-newsletter-col">
            <h4>Stay in the loop</h4>
            <p>Seasonal drops, restock alerts and seller stories — one short email a week.</p>
            <NewsletterForm />

            <div className="footer-payments">
              <span className="footer-payments-title">Payment options at checkout</span>
              <div className="payment-chips">
                <span className="pay-chip pay-phonepe">PhonePe</span>
                <span className="pay-chip">COD</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p>© {new Date().getFullYear()} EcShopping. All rights reserved.</p>
          <div className="footer-bottom-links">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/returns">Returns</Link>
            <span className="footer-meta"><Globe size={13} /> India · INR (₹)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
