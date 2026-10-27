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

export default function Pagination({
  page = 1,
  totalPages = 1,
  onChange,
  totalItems,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50]
}) {
  if (totalItems === 0) return null;
  if ((!totalPages || totalPages <= 1) && (!totalItems || !onPageSizeChange)) return null;

  const from = pageSize && totalItems ? Math.max((page - 1) * pageSize + 1, 1) : null;
  const to = pageSize && totalItems ? Math.min(page * pageSize, totalItems) : null;

  return (
    <div className="pagination-wrap">
      {from && to ? (
        <span className="pagination-summary">
          Showing <strong>{from}–{to}</strong> of <strong>{totalItems}</strong> {totalItems === 1 ? 'item' : 'items'}
        </span>
      ) : null}

      <nav className="pagination" aria-label="Pagination">
        <button
          type="button"
          className="page-btn page-arrow-btn"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
          <span className="sr-only">Previous</span>
        </button>

        {getPageItems(page, Math.max(totalPages, 1)).map((item, index) =>
          item === '…' ? (
            <span key={`gap-${index}`} className="page-gap" aria-hidden="true">…</span>
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
          className="page-btn page-arrow-btn"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
          <span className="sr-only">Next</span>
        </button>
      </nav>

      {onPageSizeChange && pageSize && (
        <div className="pagination-size-wrap">
          <label htmlFor="pagination-size-select" className="pagination-size-label">Rows per page:</label>
          <select
            id="pagination-size-select"
            className="pagination-size-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
