import { ChevronLeft, ChevronRight } from 'lucide-react';
import './ui.css';

function getPageItems(page, totalPages) {
  const pages = [];
  const push = (p) => pages.push(p);
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) push(i);
    return pages;
  }
  push(1);
  if (page > 3) push('…');
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i += 1) push(i);
  if (page < totalPages - 2) push('…');
  push(totalPages);
  return pages;
}

export default function Pagination({ page = 1, totalPages = 1, onChange, totalItems, pageSize }) {
  if (!totalPages || totalPages <= 1) return null;

  const from = pageSize ? (page - 1) * pageSize + 1 : null;
  const to = pageSize && totalItems ? Math.min(page * pageSize, totalItems) : null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="page-btn"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {getPageItems(page, totalPages).map((item, index) =>
        item === '…' ? (
          <span key={`gap-${index}`} className="page-info" aria-hidden="true">…</span>
        ) : (
          <button
            key={item}
            type="button"
            className={`page-btn ${item === page ? 'active' : ''}`}
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Page ${item}`}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        className="page-btn"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>

      {from && to && (
        <span className="page-info">
          Showing {from}–{to}
        </span>
      )}
    </nav>
  );
}
