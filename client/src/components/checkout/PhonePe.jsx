import { Smartphone } from 'lucide-react';
import './payment.css';

/**
 * PhonePe payment option card (selection UI only — no gateway logic here).
 * The wordmark is plain text styled in a neutral tone;
 * we do not reproduce any third-party logo artwork.
 */
export default function PhonePe({ selected, onSelect, amountLabel, disabled = false }) {
  return (
    <label className={`pp-option ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}>
      <input
        type="radio"
        name="payment"
        value="phonepe"
        checked={selected}
        onChange={() => onSelect('phonepe')}
        disabled={disabled}
      />

      <span className="pp-main">
        <span className="pp-wordmark" aria-label="PhonePe">PhonePe</span>
        <span className="pp-sub">UPI · PhonePe app, QR and UPI ID</span>
      </span>

      <span className="pp-right">
        <span className="pp-amount">{amountLabel}</span>
      </span>

      <span className="pp-note">
        <Smartphone size={14} />
        Pay securely using the PhonePe app, a QR code or your UPI ID.
      </span>
    </label>
  );
}
