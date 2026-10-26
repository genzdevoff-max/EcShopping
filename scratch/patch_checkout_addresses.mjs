import fs from 'fs';

let jsx = fs.readFileSync('client/src/pages/Checkout.jsx', 'utf8');

// 1. Update imports
jsx = jsx.replace(
  "import { useMemo, useState } from 'react';",
  "import { useMemo, useState, useEffect } from 'react';"
);

jsx = jsx.replace(
  "import { ShoppingBag, Truck, Banknote, Tag, ArrowRight, Lock, CheckCircle2 } from 'lucide-react';",
  "import { ShoppingBag, Truck, Banknote, Tag, ArrowRight, Lock, CheckCircle2, MapPin, Plus } from 'lucide-react';"
);

// 2. Add address state hooks
const stateHookTarget = "  const [postcode, setPostcode] = useState(loggedInCustomer?.postcode || '');";
const stateHookReplacement = `  const [postcode, setPostcode] = useState(loggedInCustomer?.postcode || '');

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [saveToAddresses, setSaveToAddresses] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (loggedInCustomer) {
      setLoadingAddresses(true);
      api.getUserAddresses()
        .then((res) => {
          if (!cancelled && res?.addresses && res.addresses.length > 0) {
            setSavedAddresses(res.addresses);
            const def = res.addresses.find((a) => a.isDefault) || res.addresses[0];
            if (def) {
              setSelectedAddressId(def.id);
              if (def.name) {
                const parts = def.name.trim().split(' ');
                setFirstName(parts[0] || '');
                setLastName(parts.slice(1).join(' ') || '');
              }
              if (def.phone) setPhone(def.phone);
              if (def.street) setStreet(def.street);
              if (def.city) setCity(def.city);
              if (def.state) setStateCode(def.state);
              if (def.postcode) setPostcode(def.postcode);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingAddresses(false);
        });
    }
    return () => { cancelled = true; };
  }, [loggedInCustomer]);

  const handleSelectAddressCard = (addr) => {
    if (addr === 'new') {
      setSelectedAddressId('new');
    } else {
      setSelectedAddressId(addr.id);
      if (addr.name) {
        const parts = addr.name.trim().split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
      }
      if (addr.phone) setPhone(addr.phone);
      if (addr.street) setStreet(addr.street);
      if (addr.city) setCity(addr.city);
      if (addr.state) setStateCode(addr.state);
      if (addr.postcode) setPostcode(addr.postcode);
    }
  };`;

jsx = jsx.replace(stateHookTarget, stateHookReplacement);

// 3. Save new address during placeOrder
const placeOrderTarget = "    /* COD path: navigate directly to confirmation */";
const placeOrderReplacement = `    if (loggedInCustomer && selectedAddressId === 'new' && saveToAddresses) {
      api.addUserAddress({
        name: fullName,
        phone: phone.trim(),
        street: street.trim(),
        city: city.trim(),
        state: stateCode,
        postcode: postcode.trim(),
        country: 'India',
        isDefault: savedAddresses.length === 0
      }).catch(() => {});
    }

    /* COD path: navigate directly to confirmation */`;

jsx = jsx.replace(placeOrderTarget, placeOrderReplacement);

// 4. Update Section 2 in JSX
const section2Old = `          {/* 2 — Address */}
          <section className="panel co-section">
            <header className="co-head">
              <span className="co-num">2</span>
              <div>
                <h2>Shipping address</h2>
                <p className="tiny muted">Where should the seller send this order?</p>
              </div>
            </header>

            <div className="form-grid">
              <label className="field">
                <span className="field-label">Street address *</span>
                <input className="input" type="text" value={street} onChange={(e) => setStreet(e.target.value)} autoComplete="street-address" placeholder="House number and street name" />
                {fieldError('street')}
              </label>
            </div>

            <div className="form-grid form-grid-2">
              <label className="field">
                <span className="field-label">Town / city *</span>
                <input className="input" type="text" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
                {fieldError('city')}
              </label>
              <label className="field">
                <span className="field-label">State *</span>
                <select className="select" value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
                  <option value="TN">Tamil Nadu</option>
                  <option value="KA">Karnataka</option>
                  <option value="KL">Kerala</option>
                  <option value="AP">Andhra Pradesh</option>
                  <option value="TS">Telangana</option>
                  <option value="MH">Maharashtra</option>
                  <option value="DL">Delhi</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">PIN code *</span>
                <input className="input" type="text" inputMode="numeric" maxLength={6} value={postcode} onChange={(e) => setPostcode(e.target.value.replace(/\\D/g, ''))} autoComplete="postal-code" placeholder="600001" />
                {fieldError('postcode')}
              </label>
            </div>
          </section>`;

const section2New = `          {/* 2 — Address */}
          <section className="panel co-section">
            <header className="co-head">
              <span className="co-num">2</span>
              <div>
                <h2>Shipping address</h2>
                <p className="tiny muted">Where should the seller send this order?</p>
              </div>
            </header>

            {loggedInCustomer && savedAddresses.length > 0 && (
              <div className="co-saved-addresses-block">
                <div className="co-saved-header">
                  <span className="co-saved-title"><MapPin size={14} /> Saved delivery addresses</span>
                  <Link to="/profile" className="co-saved-manage-link" target="_blank" rel="noopener noreferrer">Manage in profile</Link>
                </div>
                <div className="co-saved-addresses-grid">
                  {savedAddresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={\`co-address-card \${selectedAddressId === addr.id ? 'selected' : ''}\`}
                    >
                      <input
                        type="radio"
                        name="shippingAddressSelect"
                        checked={selectedAddressId === addr.id}
                        onChange={() => handleSelectAddressCard(addr)}
                      />
                      <div className="co-address-info">
                        <div className="co-address-top">
                          <span className="co-address-name">{addr.name}</span>
                          {addr.isDefault && <span className="co-default-tag">Default</span>}
                        </div>
                        <div className="co-address-lines">
                          {addr.street}<br />
                          {addr.city}, {addr.state} - {addr.postcode}
                        </div>
                        {addr.phone && <div className="co-address-phone">Phone: {addr.phone}</div>}
                      </div>
                    </label>
                  ))}
                  <label
                    className={\`co-address-card co-address-new-card \${selectedAddressId === 'new' ? 'selected' : ''}\`}
                  >
                    <input
                      type="radio"
                      name="shippingAddressSelect"
                      checked={selectedAddressId === 'new'}
                      onChange={() => handleSelectAddressCard('new')}
                    />
                    <div className="co-address-new-content">
                      <Plus size={16} />
                      <span>Deliver to a new address</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="form-grid">
              <label className="field">
                <span className="field-label">Street address *</span>
                <input
                  className="input"
                  type="text"
                  value={street}
                  onChange={(e) => {
                    setStreet(e.target.value);
                    if (selectedAddressId && selectedAddressId !== 'new') setSelectedAddressId('new');
                  }}
                  autoComplete="street-address"
                  placeholder="House number and street name"
                />
                {fieldError('street')}
              </label>
            </div>

            <div className="form-grid form-grid-2">
              <label className="field">
                <span className="field-label">Town / city *</span>
                <input
                  className="input"
                  type="text"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    if (selectedAddressId && selectedAddressId !== 'new') setSelectedAddressId('new');
                  }}
                  autoComplete="address-level2"
                />
                {fieldError('city')}
              </label>
              <label className="field">
                <span className="field-label">State *</span>
                <select
                  className="select"
                  value={stateCode}
                  onChange={(e) => {
                    setStateCode(e.target.value);
                    if (selectedAddressId && selectedAddressId !== 'new') setSelectedAddressId('new');
                  }}
                >
                  <option value="TN">Tamil Nadu</option>
                  <option value="KA">Karnataka</option>
                  <option value="KL">Kerala</option>
                  <option value="AP">Andhra Pradesh</option>
                  <option value="TS">Telangana</option>
                  <option value="MH">Maharashtra</option>
                  <option value="DL">Delhi</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">PIN code *</span>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={postcode}
                  onChange={(e) => {
                    setPostcode(e.target.value.replace(/\\D/g, ''));
                    if (selectedAddressId && selectedAddressId !== 'new') setSelectedAddressId('new');
                  }}
                  autoComplete="postal-code"
                  placeholder="600001"
                />
                {fieldError('postcode')}
              </label>
            </div>

            {loggedInCustomer && selectedAddressId === 'new' && (
              <label className="co-save-address-opt">
                <input
                  type="checkbox"
                  checked={saveToAddresses}
                  onChange={(e) => setSaveToAddresses(e.target.checked)}
                />
                <span>Save this address to my profile for future orders</span>
              </label>
            )}
          </section>`;

jsx = jsx.replace(section2Old, section2New);

fs.writeFileSync('client/src/pages/Checkout.jsx', jsx, 'utf8');
console.log('Checkout.jsx successfully updated');

// Update Checkout.css
let css = fs.readFileSync('client/src/pages/Checkout.css', 'utf8');
const newCss = `

/* ---------------- Saved Addresses ---------------- */

.co-saved-addresses-block {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.co-saved-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.co-saved-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.co-saved-manage-link {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--brand);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.co-saved-addresses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.co-address-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border: 1.5px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface);
  cursor: pointer;
  transition: all 0.2s var(--ease);
}

.co-address-card:hover {
  border-color: var(--brand-300);
}

.co-address-card.selected {
  border-color: var(--brand);
  background: var(--brand-50, #f0f7f4);
  box-shadow: 0 0 0 3px rgba(14, 92, 74, 0.12);
}

.co-address-card input[type="radio"] {
  accent-color: var(--brand);
  margin-top: 3px;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.co-address-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.co-address-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 2px;
}

.co-address-name {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--ink);
}

.co-default-tag {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: var(--r-pill);
  background: var(--brand);
  color: #fff;
  letter-spacing: 0.04em;
}

.co-address-lines {
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--ink-2);
}

.co-address-phone {
  font-size: 0.78rem;
  color: var(--muted);
  margin-top: 2px;
}

.co-address-new-card {
  align-items: center;
  justify-content: center;
  border-style: dashed;
  min-height: 80px;
}

.co-address-new-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--brand);
}

.co-save-address-opt {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 14px;
  font-size: 0.85rem;
  color: var(--ink-2);
  cursor: pointer;
}

.co-save-address-opt input {
  accent-color: var(--brand);
  width: 16px;
  height: 16px;
}
`;

if (!css.includes('co-saved-addresses-block')) {
  fs.writeFileSync('client/src/pages/Checkout.css', css + newCss, 'utf8');
  console.log('Checkout.css updated');
}
