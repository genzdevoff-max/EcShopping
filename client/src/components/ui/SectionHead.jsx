import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import './ui.css';

export default function SectionHead({
  eyebrow,
  title,
  subtitle,
  linkTo,
  linkLabel = 'View all',
  center = false,
  action = null
}) {
  return (
    <div className={`section-head ${center ? 'section-head-center' : ''}`}>
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        {title && <h2 style={{ marginTop: eyebrow ? 10 : 0 }}>{title}</h2>}
        {subtitle && <p className="lead" style={{ marginTop: 10 }}>{subtitle}</p>}
      </div>

      {(linkTo || action) && (
        <div className="head-actions">
          {action}
          {linkTo && (
            <Link to={linkTo} className="link-more">
              {linkLabel} <ArrowRight size={15} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
