import { useState } from 'react';
import { Plus } from 'lucide-react';
import './ui.css';

/**
 * Accessible accordion. `items` = [{ id, question, answer }]
 * Controlled by default with internal state; pass `defaultOpenId` to
 * have one item open on mount.
 */
export default function Accordion({ items = [], defaultOpenId = null, allowMultiple = false }) {
  const [openIds, setOpenIds] = useState(() => (defaultOpenId ? [defaultOpenId] : []));

  const toggle = (id) => {
    setOpenIds((prev) => {
      const isOpen = prev.includes(id);
      if (allowMultiple) {
        return isOpen ? prev.filter((x) => x !== id) : [...prev, id];
      }
      return isOpen ? [] : [id];
    });
  };

  return (
    <div className="accordion">
      {items.map((item) => {
        const open = openIds.includes(item.id);
        return (
          <div key={item.id} className={`accordion-item ${open ? 'open' : ''}`}>
            <h3>
              <button
                type="button"
                className="accordion-trigger"
                onClick={() => toggle(item.id)}
                aria-expanded={open}
                aria-controls={`acc-panel-${item.id}`}
                id={`acc-btn-${item.id}`}
              >
                <span>{item.question}</span>
                <span className="acc-icon" aria-hidden="true">
                  <Plus size={15} />
                </span>
              </button>
            </h3>
            {open && (
              <div
                className="accordion-panel"
                id={`acc-panel-${item.id}`}
                role="region"
                aria-labelledby={`acc-btn-${item.id}`}
              >
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
