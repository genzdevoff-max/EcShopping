import { Link } from 'react-router-dom';
import './ui.css';

export function Breadcrumbs({ items = [] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/">Home</Link>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} style={{ display: 'contents' }}>
            <span className="crumb-sep" aria-hidden="true">/</span>
            {item.to && !last ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span className="crumb-current" aria-current={last ? 'page' : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function PageHero({ title, subtitle, crumbs = [], children, light = false }) {
  return (
    <section className={`page-hero ${light ? 'light' : ''}`}>
      <div className="container page-hero-inner">
        {crumbs.length > 0 && <Breadcrumbs items={crumbs} />}
        <h1>{title}</h1>
        {subtitle && <p className="lead">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}

export default PageHero;
