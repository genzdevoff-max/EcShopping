import './ui.css';

export function EmptyState({ icon = null, title, text, actions = null }) {
  return (
    <div className="empty-state">
      {icon && <div className="state-icon">{icon}</div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {actions && <div className="state-actions">{actions}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', text, onRetry = null, actions = null }) {
  return (
    <EmptyState
      title={title}
      text={text || 'We could not load this content. Please try again.'}
      actions={
        actions || (onRetry ? (
          <button type="button" className="btn-secondary" onClick={onRetry} style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}>
            Try again
          </button>
        ) : null)
      }
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="skeleton-table" aria-hidden="true" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="skeleton" style={{ height: 38, borderRadius: 6, width: '100%' }} />
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton" style={{ height: 32, borderRadius: 4 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 4 }) {
  return (
    <div className="skeleton-form" aria-hidden="true" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skeleton" style={{ height: 14, width: '25%', borderRadius: 4 }} />
          <div className="skeleton" style={{ height: 42, width: '100%', borderRadius: 8 }} />
        </div>
      ))}
      <div className="skeleton" style={{ height: 44, width: 140, borderRadius: 8, marginTop: 8 }} />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="skeleton-dashboard" aria-hidden="true" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div className="skeleton" style={{ height: 280, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 280, borderRadius: 12 }} />
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 3 }) {
  return (
    <div className="skeleton-cards-grid" aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, padding: '16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 8, className = '' }) {
  return (
    <div className={`product-grid ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton sk-media" />
          <div className="skeleton sk-line tiny" />
          <div className="skeleton sk-line" />
          <div className="skeleton sk-line short" />
        </div>
      ))}
    </div>
  );
}

export function LoadingBlock({ label = 'Loading…', height = 180 }) {
  return (
    <div
      className="skeleton"
      style={{ height, borderRadius: 'var(--r-md)' }}
      role="status"
      aria-label={label}
    />
  );
}

export default EmptyState;
