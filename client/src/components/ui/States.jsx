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

export function ErrorState({ title = 'Something went wrong', text, actions = null }) {
  return (
    <EmptyState
      title={title}
      text={text || 'We could not load this content. Please try again.'}
      actions={actions}
    />
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
