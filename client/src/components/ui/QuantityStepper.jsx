import { Minus, Plus } from 'lucide-react';
import './ui.css';

export default function QuantityStepper({
  value = 1,
  onChange,
  min = 1,
  max = 99,
  small = false,
  label = 'quantity',
  disabled = false
}) {
  const clamp = (n) => Math.min(max, Math.max(min, n));

  return (
    <div className={`qty-stepper ${small ? 'sm' : ''} ${disabled ? 'disabled' : ''}`} role="group" aria-label={`Adjust ${label}`}>
      <button
        type="button"
        onClick={() => !disabled && onChange && onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label}`}
      >
        <Minus size={small ? 13 : 15} />
      </button>
      <span className="qty-value" aria-live="polite">{value}</span>
      <button
        type="button"
        onClick={() => !disabled && onChange && onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label}`}
      >
        <Plus size={small ? 13 : 15} />
      </button>
    </div>
  );
}
