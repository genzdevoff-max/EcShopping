import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Mail, Phone, MapPin, Check, ArrowRight } from 'lucide-react';
import brandLogo from '../assets/logo/without-bg-logo.png';
import { useStorefrontCategories } from '../data/storefront';
import { siteInfo } from '../data/content';
import './Footer.css';

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

            <ul className="footer-contact">
              <li><Mail size={15} /> <a href={`mailto:${siteInfo.email}`}>{siteInfo.email}</a></li>
              <li><Phone size={15} /> <a href={`tel:${siteInfo.phone.replace(/\s/g, '')}`}>{siteInfo.phone}</a></li>
              <li><MapPin size={15} /> <span>{siteInfo.address}</span></li>
            </ul>

            <div className="social-links" aria-label="Social links">
              <a href="#instagram" aria-label="Instagram">IG</a>
              <a href="#facebook" aria-label="Facebook">FB</a>
              <a href="#youtube" aria-label="YouTube">YT</a>
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
              <li><Link to="/store-locator">Store locator</Link></li>
              <li><Link to="/contact">Contact us</Link></li>
              <li><Link to="/bulk-order">Bulk order enquiry</Link></li>
            </ul>
          </nav>

          <nav className="footer-links-col" aria-label="Company links">
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">About us</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/privacy">Privacy policy</Link></li>
              <li><Link to="/terms">Terms & conditions</Link></li>
              <li><Link to="/vendor">Vendor portal</Link></li>
              <li><Link to="/vendor/register">Become a seller</Link></li>
              <li><Link to="/admin">Admin portal</Link></li>
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
