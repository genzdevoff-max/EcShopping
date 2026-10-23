import './ui.css';

/** Lightweight accessible tab strip. `tabs` = [{ id, label }]. */
export function Tabs({ tabs = [], active, onChange, ariaLabel = 'Sections' }) {
  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className={`tab ${active === tab.id ? 'active' : ''}`}
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ active, id, children }) {
  if (active !== id) return null;
  return (
    <div className="tab-panel" role="tabpanel">
      {children}
    </div>
  );
}

export default Tabs;
