import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Search,
  User,
  ShoppingCart,
  Menu,
  X,
  Heart,
  ChevronDown,
  Package,
  ShieldCheck,
  HelpCircle,
  Truck
} from 'lucide-react';
import brandLogo from '../assets/logo/without-bg-logo.png';
import AnnouncementBar from './AnnouncementBar';
import { useCart } from '../context/CartContext';
import { useStorefrontCategories, fetchStorefrontProducts } from '../data/storefront';
import { formatINR, computeTotals } from '../utils/pricing';
import './Header.css';

export default function Header({ cartCount = 0, loggedInCustomer, onCustomerLogout, onOpenLogin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const shopTimeoutRef = useRef(null);

  const handleShopMouseEnter = () => {
    if (shopTimeoutRef.current) clearTimeout(shopTimeoutRef.current);
    setShopOpen(true);
  };

  const handleShopMouseLeave = () => {
    if (shopTimeoutRef.current) clearTimeout(shopTimeoutRef.current);
    shopTimeoutRef.current = setTimeout(() => {
      setShopOpen(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (shopTimeoutRef.current) clearTimeout(shopTimeoutRef.current);
    };
  }, []);

  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const { categories, loading: categoriesLoading } = useStorefrontCategories();
  const cart = useCart();
  const cartSubtotal = useMemo(
    () => computeTotals({ items: cart?.items || [] }).subtotal,
    [cart?.items]
  );

  useEffect(() => {
    const updateWishlist = () => {
      try {
        const items = JSON.parse(localStorage.getItem('ecshopping_wishlist') || '[]');
        setWishlistCount(items.length);
      } catch {
        setWishlistCount(0);
      }
    };
    updateWishlist();
    window.addEventListener('storage', updateWishlist);
    window.addEventListener('wishlistUpdated', updateWishlist);
    return () => {
      window.removeEventListener('storage', updateWishlist);
      window.removeEventListener('wishlistUpdated', updateWishlist);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setShopOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* Suggestions live-query the server (debounced). They are approved
     storefront rows only; failures are surfaced as an empty list plus the
     "see all results" fallback count, never demo data. */
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const res = await fetchStorefrontProducts({ search: q, limit: 6 });
      if (!cancelled) setSuggestions(res.ok ? res.products : []);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setSuggestions([]);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/shop?search=${encodeURIComponent(q)}`);
    closeSearch();
  };

  const runSuggestion = (product) => {
    navigate(`/product/${product.id}`);
    closeSearch();
  };

  const openCart = () => {
    if (cart) cart.setDrawerOpen(true);
    else navigate('/cart');
  };

  const closeMobile = () => setMobileMenuOpen(false);

  const mobileLinkClass = ({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`;

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <AnnouncementBar />

      <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="container header-container">
          <Link to="/" className="brand-logo" aria-label="EcShopping home">
            <img src={brandLogo} alt="EcShopping" className="brand-logo-img" />
          </Link>

          {/* Prominent permanent retail search bar on desktop */}
          <div className="header-primary-search">
            <form className="primary-search-form" onSubmit={handleSearchSubmit} role="search">
              <Search size={18} className="search-inline-icon" />
              <input
                ref={searchInputRef}
                type="search"
                className="primary-search-input"
                placeholder="Search fresh produce, cold-pressed oils, dairy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search products"
              />
              <button type="submit" className="primary-search-submit">Search</button>
            </form>

            {searchQuery.trim().length >= 2 && (
              <div className="search-suggestions live-dropdown" role="listbox" aria-label="Search suggestions">
                {suggestions.length === 0 ? (
                  <p className="suggestion-empty">
                    No products match “{searchQuery.trim()}”. Try another word.
                  </p>
                ) : (
                  suggestions.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className="suggestion-item"
                      onClick={() => runSuggestion(p)}
                      role="option"
                    >
                      <img src={p.image} alt="" width="44" height="44" loading="lazy" />
                      <span className="suggestion-text">
                        <strong>{p.title}</strong>
                        <small>{p.seller}</small>
                      </span>
                      <span className="suggestion-price">{formatINR(p.price)}</span>
                    </button>
                  ))
                )}
                <button
                  type="button"
                  className="suggestion-all"
                  onClick={() => {
                    navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
                    setSearchQuery('');
                  }}
                >
                  See all results for “{searchQuery.trim()}”
                </button>
              </div>
            )}
          </div>

          <nav className="desktop-nav" aria-label="Main navigation">
            <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} end>
              Home
            </NavLink>

            <div
              className={`nav-dropdown ${shopOpen ? 'open' : ''}`}
              onMouseEnter={handleShopMouseEnter}
              onMouseLeave={handleShopMouseLeave}
            >
              <button
                type="button"
                className="nav-link nav-dropdown-trigger"
                onClick={() => setShopOpen((v) => !v)}
                aria-expanded={shopOpen}
                aria-haspopup="true"
              >
                Categories <ChevronDown size={15} />
              </button>

              {shopOpen && (
                <div className="nav-dropdown-panel" role="menu">
                  <Link to="/shop" className="dropdown-wide-link" onClick={() => setShopOpen(false)}>
                    <span className="dw-icon"><Package size={17} /></span>
                    <span>
                      <strong>All products</strong>
                      <small>Browse the full catalogue</small>
                    </span>
                  </Link>

                  <div className="dropdown-grid">
                    {categories.map((c) => (
                      <Link
                        key={c.slug}
                        to={`/category/${c.slug}`}
                        className="dropdown-item"
                        role="menuitem"
                        onClick={() => setShopOpen(false)}
                      >
                        <span className="dropdown-item-thumb">
                          <img src={c.image} alt="" width="44" height="44" loading="lazy" />
                        </span>
                        <span>
                          <strong>{c.title}</strong>
                          <small>{c.tagline}</small>
                        </span>
                      </Link>
                    ))}
                    {categoriesLoading && (
                      <p className="dropdown-item" aria-busy="true">
                        <small>Loading categories…</small>
                      </p>
                    )}
                  </div>

                  <div className="dropdown-footer">
                    <Link to="/collection/new-arrivals" onClick={() => setShopOpen(false)}>New arrivals</Link>
                    <Link to="/collection/deals" onClick={() => setShopOpen(false)}>Weekend deals</Link>
                  </div>
                </div>
              )}
            </div>

            <NavLink to="/track-order" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Track order
            </NavLink>
          </nav>

          <div className="header-actions">
            <div className="search-action-wrapper mobile-only-search-btn">
              <button
                type="button"
                className={`action-icon-btn ${searchOpen ? 'active' : ''}`}
                onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                title="Search products"
                aria-label="Search products"
                aria-expanded={searchOpen}
              >
                <Search size={20} />
              </button>

              {searchOpen && (
                <div className="header-search-panel">
                  <form className="header-search-bar" onSubmit={handleSearchSubmit} role="search">
                    <Search size={18} className="search-inline-icon" />
                    <input
                      ref={searchInputRef}
                      type="search"
                      className="header-search-input"
                      placeholder="Search tomatoes, honey, rice…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      aria-label="Search products"
                    />
                    <button type="submit" className="header-search-submit">Search</button>
                    <button type="button" className="header-search-close" onClick={closeSearch} aria-label="Close search">
                      <X size={18} />
                    </button>
                  </form>

                  {searchQuery.trim().length >= 2 && (
                    <div className="search-suggestions" role="listbox" aria-label="Search suggestions">
                      {suggestions.length === 0 ? (
                        <p className="suggestion-empty">
                          No products match “{searchQuery.trim()}”. Try another word.
                        </p>
                      ) : (
                        suggestions.map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            className="suggestion-item"
                            onClick={() => runSuggestion(p)}
                            role="option"
                          >
                            <img src={p.image} alt="" width="44" height="44" loading="lazy" />
                            <span className="suggestion-text">
                              <strong>{p.title}</strong>
                              <small>{p.seller}</small>
                            </span>
                            <span className="suggestion-price">{formatINR(p.price)}</span>
                          </button>
                        ))
                      )}
                      <button
                        type="button"
                        className="suggestion-all"
                        onClick={() => {
                          navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
                          closeSearch();
                        }}
                      >
                        See all results for “{searchQuery.trim()}”
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {loggedInCustomer ? (
              <Link
                to="/profile"
                className="action-icon-btn header-user-btn has-initial"
                title={`My account (${loggedInCustomer.name})`}
                aria-label="My account"
              >
                <span className="user-initial-avatar">
                  {loggedInCustomer.name?.trim()?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </Link>
            ) : (
              <button
                type="button"
                className="action-icon-btn header-user-btn"
                onClick={() => onOpenLogin?.()}
                title="Login to your account"
                aria-label="Login or register"
              >
                <User size={20} />
              </button>
            )}

            <Link to="/wishlist" className="action-icon-btn" title="Wishlist" aria-label={`Wishlist, ${wishlistCount} items`}>
              <Heart size={20} />
              {wishlistCount > 0 && <span className="icon-badge">{wishlistCount}</span>}
            </Link>

            <button
              type="button"
              className={`action-icon-btn header-cart-btn ${cartCount > 0 ? 'has-total' : ''}`}
              onClick={openCart}
              title="Open cart"
              aria-label={`Open cart, ${cartCount} items, ${formatINR(cartSubtotal)}`}
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && <span className="icon-badge">{cartCount}</span>}
              {cartCount > 0 && <span className="cart-total-text">{formatINR(cartSubtotal)}</span>}
            </button>

            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="mobile-search-row">
            <form onSubmit={handleSearchSubmit} role="search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search products…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search products"
              />
              <button type="submit">Go</button>
            </form>
          </div>
        )}
      </header>

      {mobileMenuOpen && (
        <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="mobile-drawer-top">
            <img src={brandLogo} alt="EcShopping" className="mobile-brand" />
            <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
              <X size={22} />
            </button>
          </div>

          <nav className="mobile-nav" aria-label="Mobile navigation">
            <NavLink to="/" end className={mobileLinkClass} onClick={closeMobile}>
              Home
            </NavLink>
            <NavLink to="/shop" className={mobileLinkClass} onClick={closeMobile}>
              All Products
            </NavLink>
            <NavLink to="/collection/new-arrivals" className={mobileLinkClass} onClick={closeMobile}>
              New arrivals
            </NavLink>
            <NavLink to="/collection/deals" className={mobileLinkClass} onClick={closeMobile}>
              Weekend deals
            </NavLink>

            <p className="mobile-nav-label">Categories</p>
            {categoriesLoading && (
              <p className="mobile-nav-label" aria-busy="true">Loading categories…</p>
            )}
            {!categoriesLoading && categories.length === 0 && (
              <p className="mobile-nav-label">No categories listed yet</p>
            )}
            {!categoriesLoading && categories.map((c) => (
              <NavLink key={c.slug} to={`/category/${c.slug}`} className={mobileLinkClass} onClick={closeMobile}>
                {c.title}
              </NavLink>
            ))}

            <div className="mobile-drawer-divider" />

            <NavLink to="/track-order" className={mobileLinkClass} onClick={closeMobile}>
              <Truck size={16} /> Track order
            </NavLink>
            <NavLink to="/orders" className={mobileLinkClass} onClick={closeMobile}>
              <Package size={16} /> My orders
            </NavLink>
            <NavLink to="/wishlist" className={mobileLinkClass} onClick={closeMobile}>
              <Heart size={16} /> Wishlist ({wishlistCount})
            </NavLink>
            <NavLink to="/cart" className={mobileLinkClass} onClick={closeMobile}>
              <ShoppingCart size={16} /> Cart ({cartCount})
            </NavLink>
            {loggedInCustomer ? (
              <NavLink to="/profile" className={mobileLinkClass} onClick={closeMobile}>
                <User size={16} /> {loggedInCustomer.name}
              </NavLink>
            ) : (
              <button
                type="button"
                className={`${mobileLinkClass({ isActive: false })} mobile-account-btn`}
                onClick={() => { closeMobile(); onOpenLogin?.(); }}
              >
                <User size={16} /> Login / Register
              </button>
            )}

            <div className="mobile-drawer-divider" />

            <NavLink to="/faq" className={mobileLinkClass} onClick={closeMobile}>
              <HelpCircle size={16} /> Help & FAQ
            </NavLink>
            <NavLink to="/about" className={mobileLinkClass} onClick={closeMobile}>About us</NavLink>
            <NavLink to="/contact" className={mobileLinkClass} onClick={closeMobile}>Contact</NavLink>

            <div className="mobile-drawer-divider" />

            <NavLink to="/vendor" className={mobileLinkClass} onClick={closeMobile}>
              <Package size={16} /> Vendor portal
            </NavLink>
            <NavLink
              to="/admin"
              className={({ isActive }) => `mobile-nav-link admin-link${isActive ? ' active' : ''}`}
              onClick={closeMobile}
            >
              <ShieldCheck size={16} /> Admin portal
            </NavLink>
          </nav>

          {loggedInCustomer && (
            <div className="mobile-drawer-foot">
              <button type="button" className="btn btn-ghost btn-block" onClick={() => { onCustomerLogout(); closeMobile(); }}>
                Log out
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}