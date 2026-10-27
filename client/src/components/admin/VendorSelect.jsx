import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, Store, Globe } from 'lucide-react';
import './VendorSelect.css';

/**
 * Searchable vendor selection combobox for Admin Category & Resource assignment.
 * Supports "Shared (Global)" and live search by vendor store name or email.
 */
export default function VendorSelect({
  vendors = [],
  value = 'shared',
  onChange,
  disabled = false,
  placeholder = 'Select vendor or shared…'
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

  const selectedVendor = vendors.find((v) => String(v.id) === String(value));
  const isShared = !value || value === 'shared' || value === 'null';

  const filteredVendors = vendors.filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const nameMatch = (v.name || '').toLowerCase().includes(q);
    const emailMatch = (v.email || '').toLowerCase().includes(q);
    return nameMatch || emailMatch;
  });

  const handleSelect = (val) => {
    onChange?.(val);
    setIsOpen(false);
  };

  return (
    <div className={`vendor-select-container ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        className="vendor-select-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="vendor-select-val">
          {isShared ? (
            <span className="vendor-badge-shared">
              <Globe size={14} /> Shared (Global)
            </span>
          ) : selectedVendor ? (
            <span className="vendor-badge-selected">
              <Store size={14} /> {selectedVendor.name}
              {selectedVendor.email && <small className="vendor-badge-email">({selectedVendor.email})</small>}
            </span>
          ) : (
            <span className="vendor-placeholder">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={15} className={`vendor-select-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="vendor-select-dropdown" role="listbox">
          <div className="vendor-search-wrap">
            <Search size={14} className="vendor-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="vendor-search-input"
              placeholder="Search vendor name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsOpen(false);
              }}
            />
            {search && (
              <button
                type="button"
                className="vendor-search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="vendor-select-options">
            {/* 1. Shared (Global) option */}
            <div
              className={`vendor-select-opt ${isShared ? 'selected' : ''}`}
              onClick={() => handleSelect('shared')}
              role="option"
              aria-selected={isShared}
            >
              <div className="opt-info">
                <span className="opt-title">
                  <Globe size={14} /> Shared (Global Category)
                </span>
                <span className="opt-sub">Available to all approved vendors across the platform</span>
              </div>
              {isShared && <Check size={16} className="opt-check" />}
            </div>

            <div className="vendor-select-divider">Vendors ({filteredVendors.length})</div>

            {/* 2. Filtered vendor options */}
            {filteredVendors.map((v) => {
              const selected = String(v.id) === String(value);
              return (
                <div
                  key={v.id}
                  className={`vendor-select-opt ${selected ? 'selected' : ''}`}
                  onClick={() => handleSelect(v.id)}
                  role="option"
                  aria-selected={selected}
                >
                  <div className="opt-info">
                    <span className="opt-title">
                      <Store size={14} /> {v.name}
                    </span>
                    <span className="opt-sub">{v.email || 'No email provided'}</span>
                  </div>
                  {selected && <Check size={16} className="opt-check" />}
                </div>
              );
            })}

            {filteredVendors.length === 0 && (
              <div className="vendor-select-empty">
                No vendors found matching "{search}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
