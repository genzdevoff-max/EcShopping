import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, Tag, Plus } from 'lucide-react';
import './CategorySelect.css';

/**
 * Searchable Category Selector Combobox
 * Displays a searchable dropdown for category selection with inline creation support.
 * Prevents overlapping labels, dropdown clipping, and layout shifts.
 */
export default function CategorySelect({
  categories = [],
  value = '',
  onChange,
  onAddNew = null,
  disabled = false,
  placeholder = 'Select category…',
  id = 'category-select'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const filteredCategories = categories.filter((cat) => {
    const name = typeof cat === 'string' ? cat : (cat?.name || '');
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return name.toLowerCase().includes(q);
  });

  const selectedName = typeof value === 'string' ? value : (value?.name || '');

  const handleSelect = (catName) => {
    onChange?.(catName);
    setIsOpen(false);
  };

  return (
    <div className={`cat-select-container ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      <button
        id={id}
        type="button"
        className={`cat-select-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="cat-select-val">
          {selectedName ? (
            <span className="cat-badge-selected">
              <Tag size={14} className="cat-icon-tag" /> {selectedName}
            </span>
          ) : (
            <span className="cat-placeholder">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={15} className={`cat-select-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="cat-select-dropdown" role="listbox">
          <div className="cat-search-wrap">
            <Search size={14} className="cat-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="cat-search-input"
              placeholder="Search category name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsOpen(false);
              }}
            />
            {search && (
              <button
                type="button"
                className="cat-search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="cat-select-options">
            {filteredCategories.map((cat, idx) => {
              const name = typeof cat === 'string' ? cat : cat.name;
              const isSelected = name.toLowerCase() === selectedName.toLowerCase();
              return (
                <div
                  key={cat.id || idx}
                  className={`cat-select-opt ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(name)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="opt-info">
                    <span className="opt-title">
                      <Tag size={13} /> {name}
                    </span>
                    {cat.description && <span className="opt-sub">{cat.description}</span>}
                  </div>
                  {isSelected && <Check size={16} className="opt-check" />}
                </div>
              );
            })}

            {filteredCategories.length === 0 && (
              <div className="cat-select-empty">
                No categories match "{search}"
              </div>
            )}
          </div>

          {onAddNew && (
            <div className="cat-select-footer">
              <button
                type="button"
                className="cat-add-new-btn"
                onClick={() => {
                  setIsOpen(false);
                  onAddNew();
                }}
              >
                <Plus size={14} /> Add New Category
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
