import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        padding: '64px 20px',
      }}
    >
      <div style={{ maxWidth: '46ch' }}>
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 20px',
            borderRadius: 'var(--r-md)',
            background: 'var(--brand-50)',
            color: 'var(--brand)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <SearchX size={30} />
        </div>

        <p
          style={{
            fontSize: 'clamp(3.4rem, 8vw, 5rem)',
            fontWeight: 800,
            lineHeight: 1,
            color: 'var(--brand)',
            margin: 0,
          }}
        >
          404
        </p>

        <h1 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', margin: '12px 0 10px' }}>
          Page not found
        </h1>

        <p className="muted" style={{ lineHeight: 1.65, margin: '0 0 26px' }}>
          The page you are looking for might have been removed, renamed, or is temporarily unavailable.
          Try searching the shop instead.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-primary">Go to homepage</Link>
          <Link to="/shop" className="btn btn-outline">Browse the shop</Link>
        </div>
      </div>
    </div>
  );
}
