import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Truck, Banknote, Tag, ArrowRight, Lock, CheckCircle2, MapPin, Plus } from 'lucide-react';
import { addCustomer, saveCustomerSession } from '../utils/storage';
import api from '../utils/api';
import {
  formatINR,
  computeTotals,
  validateCoupon,
  DELIVERY_METHODS
} from '../utils/pricing';
import { useCart } from '../context/CartContext';
import { PageHero } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/States';
import PhonePe from '../components/checkout/PhonePe';
import PaymentStates from '../components/checkout/PaymentStates';
import { createPhonePePayment } from '../components/checkout/paymentGateway';
import './Checkout.css';

const DELIVERY_ICONS = { standard: Truck, express: Truck };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const PIN_RE = /^\d{6}$/;

export default function Checkout({ cartItems, clearCart, loggedInCustomer, onCustomerLogin }) {
  const navigate = useNavigate();
  const ctx = useCart();
  const items = ctx?.items ?? cartItems ?? [];

  const [firstName, setFirstName] = useState(loggedInCustomer?.name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(loggedInCustomer?.name?.split(' ').slice(1).join(' ') || '');
  const [email, setEmail] = useState(loggedInCustomer?.email || '');
  const [phone, setPhone] = useState(loggedInCustomer?.phone || '');
  const [street, setStreet] = useState(loggedInCustomer?.address || '');
  const [city, setCity] = useState(loggedInCustomer?.city || '');
  const [stateCode, setStateCode] = useState(loggedInCustomer?.state || 'TN');
  const [postcode, setPostcode] = useState(loggedInCustomer?.postcode || '');

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
  };

  const [deliveryId, setDeliveryId] = useState('standard');
  const [couponInput, setCouponInput] = useState('');
  const [couponResult, setCouponResult] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [payState, setPayState] = useState('idle');
  const [payInfo, setPayInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const totals = useMemo(
    () => computeTotals({ items, couponResult, deliveryMethodId: deliveryId }),
    [items, couponResult, deliveryId]
  );

  if (items.length === 0) {
    return (
      <>
        <PageHero title="Checkout" subtitle="Secure checkout in a few short steps." crumbs={[{ label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} />
        <section className="section">
          <div className="container">
            <EmptyState
              icon={<ShoppingBag size={30} />}
              title="Your cart is empty"
              text="Add a few products before heading to checkout."
              actions={
                <>
                  <Link to="/shop" className="btn btn-primary">Browse the shop <ArrowRight size={16} /></Link>
                  <Link to="/cart" className="btn btn-ghost">Back to cart</Link>
                </>
              }
            />
          </div>
        </section>
      </>
    );
  }

  const applyCoupon = (event) => {
    event.preventDefault();
    const result = validateCoupon(couponInput, totals.subtotal);
    setCouponResult(result);
  };

  const clearCoupon = () => {
    setCouponInput('');
    setCouponResult(null);
  };

  const validate = () => {
    const next = {};
    if (!firstName.trim()) next.firstName = 'Enter your first name.';
    if (!lastName.trim()) next.lastName = 'Enter your last name.';
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!PHONE_RE.test(phone.trim())) next.phone = 'Enter a valid 10-digit Indian mobile number.';
    if (!street.trim()) next.street = 'Enter your street address.';
    if (!city.trim()) next.city = 'Enter your town or city.';
    if (!PIN_RE.test(postcode.trim())) next.postcode = 'Enter a valid 6-digit PIN code.';
    return next;
  };

  const placeOrder = async (event) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.querySelector('.field-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    /* Auto-account: register the guest with the server so the account is
     * usable anywhere (bcrypt-hashed, no plaintext email or local store). */
    let autoCredentials = null;
    if (!loggedInCustomer) {
      const generatedPassword = Math.random().toString(36).slice(-8) + 'A1!';
      try {
        const data = await api.userRegister({
          name: fullName,
          email: email.trim(),
          password: generatedPassword,
          phone: phone.trim()
        });
        if (data?.success && data.user && data.token) {
          saveCustomerSession(data.user, data.token);
          addCustomer({ ...data.user, address: street.trim(), city: city.trim(), state: stateCode, postcode: postcode.trim() });
          onCustomerLogin?.(data.user);
          autoCredentials = { email: email.trim(), password: generatedPassword, isNew: true };
        } else if (data?.error) {
          // Existing account or another registration error — continue the
          // order as a checkout tied to that email; confirmation page will
          // suggest signing in.
          autoCredentials = { email: email.trim(), isNew: false, notice: data.error };
        }
      } catch {
        // API unreachable — the order still completes with the local cache.
        const created = addCustomer({
          name: fullName,
          email: email.trim(),
          phone: phone.trim(),
          address: street.trim(),
          city: city.trim(),
          state: stateCode,
          postcode: postcode.trim()
        });
        if (created?.success && created.customer) {
          onCustomerLogin?.(created.customer);
        }
      }
    }

    /* Step 1: Create the order server-side first to get a real orderId. */
    let serverOrder = null;
    try {
      const orderPayload = {
        customerName: fullName,
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
        shippingAddress: {
          street: street.trim(),
          city: city.trim(),
          state: stateCode,
          postcode: postcode.trim()
        },
        items: items.map((item) => ({
          id: item.id,
          productId: item.id,
          title: item.title,
          price: item.price,
          image: item.image,
          variant: item.variant || null,
          quantity: item.quantity,
          vendorId: item.vendorId || null
        })),
        couponCode: couponResult?.ok ? couponResult.coupon.code : null,
        deliveryMethod: deliveryId,
        paymentMethod
      };
      const result = await api.createOrder(orderPayload);
      if (result?.success && result.order) {
        serverOrder = result.order;
        try {
          const orders = JSON.parse(localStorage.getItem('ecshopping_orders') || '[]');
          orders.unshift({ ...serverOrder, serverVerified: true });
          localStorage.setItem('ecshopping_orders', JSON.stringify(orders));
        } catch { /* storage unavailable */ }
      } else {
        throw new Error(result?.error || 'Order could not be placed. Please try again.');
      }
    } catch (err) {
      setErrors({ form: err.message || 'Order could not be placed. Please try again.' });
      setSubmitting(false);
      return;
    }

    const orderId = serverOrder.id;

    /* Step 2: For PhonePe — call create-payment with the real orderId.
     * The server reads the total from the DB; the client never supplies amount.
     * Offline drafts (serverVerified=false) can never start a gateway payment:
     * the gateway session and verification live entirely server-side. */
    const serverVerified = serverOrder?.serverVerified !== false;
    if (paymentMethod === 'phonepe' && !serverVerified) {
      setPayState('failed');
      setPayInfo({
        message: 'There is no server connection to confirm this order, so the PhonePe payment cannot be started. Please retry when back online or use Cash on Delivery.',
        missingConfig: false
      });
      setSubmitting(false);
      return;
    }
    if (paymentMethod === 'phonepe') {
      setPayState('processing');
      setPayInfo(null);
      try {
        const payRes = await createPhonePePayment(orderId);
        // payRes has { success, redirectUrl, state?, expireAt? }
        // Save orderId in sessionStorage so the return page can verify
        try {
          sessionStorage.setItem('ecshopping_pending_payment', orderId);
        } catch { /* storage unavailable */ }
        // Redirect to PhonePe's hosted checkout page
        window.location.href = payRes.redirectUrl;
        // Execution stops here (browser navigates away)
        return;
      } catch (err) {
        // 503 = PhonePe not configured; offer COD switch without cancelling order
        const isMissingConfig = err?.status === 503 || err?.message?.includes('not configured');
        setPayState('failed');
        setPayInfo({ message: err.message, missingConfig: isMissingConfig });
        setSubmitting(false);
        // Keep the order in pending state — user can retry or switch to COD
        return;
      }
    }

    if (loggedInCustomer && selectedAddressId === 'new' && saveToAddresses) {
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

    /* COD path: navigate directly to confirmation */
    try {
      localStorage.setItem('ecshopping_last_order', JSON.stringify(serverOrder));
    } catch { /* storage unavailable */ }

    clearCart?.();
    setSubmitting(false);
    navigate(`/order-confirmation/${orderId}`, { state: { order: serverOrder, autoCredentials } });
  };

  const setPayment = (method) => {
    setPaymentMethod(method);
    if (method !== 'phonepe') {
      setPayState('idle');
      setPayInfo(null);
    }
  };

  const fieldError = (key) => (errors[key] ? <p className="field-error" role="alert">{errors[key]}</p> : null);

  return (
    <>
      <PageHero
        title="Checkout"
        subtitle={`${items.length} item${items.length === 1 ? '' : 's'} · ${formatINR(totals.total)} to pay`}
        crumbs={[{ label: 'Cart', to: '/cart' }, { label: 'Checkout' }]}
      />

      <form className="container checkout-layout" onSubmit={placeOrder} noValidate>
        {errors.form && (
          <p className="field-error" role="alert" style={{ marginBottom: '1rem' }}>{errors.form}</p>
        )}
        <div className="checkout-main">
          {/* 1 — Contact */}
          <section className="panel co-section">
            <header className="co-head">
              <span className="co-num">1</span>
              <div>
                <h2>Contact details</h2>
                <p className="tiny muted">We send order updates to these details.</p>
              </div>
            </header>

            <div className="form-grid form-grid-2">
              <label className="field">
                <span className="field-label">First name *</span>
                <input className="input" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                {fieldError('firstName')}
              </label>
              <label className="field">
                <span className="field-label">Last name *</span>
                <input className="input" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                {fieldError('lastName')}
              </label>
              <label className="field">
                <span className="field-label">Email address *</span>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
                {fieldError('email')}
              </label>
              <label className="field">
                <span className="field-label">Mobile number *</span>
                <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="98765 43210" />
                {fieldError('phone')}
              </label>
            </div>

            {!loggedInCustomer && (
              <p className="notice notice-info co-account-note">
                <CheckCircle2 size={15} /> New here? We will create a basic account automatically so you can track this order.
              </p>
            )}
          </section>

          {/* 2 — Address */}
          <section className="panel co-section">
            <header className="co-head">
              <span className="co-num">2</span>
              <div>
                <h2>Shipping address</h2>
                <p className="tiny muted">Where should the seller send this order?</p>
              </div>
            </header>

            {loggedInCustomer && (
              <div className="co-saved-addresses-block">
                <div className="co-saved-header">
                  <span className="co-saved-title"><MapPin size={14} /> Saved delivery addresses</span>
                  <Link to="/profile" className="co-saved-manage-link" target="_blank" rel="noopener noreferrer">Manage in profile</Link>
                </div>
                {loadingAddresses ? (
                  <p className="tiny muted" style={{ paddingBlock: '8px' }}>Loading saved addresses...</p>
                ) : savedAddresses.length > 0 ? (
                  <div className="co-saved-addresses-grid">
                    {savedAddresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`co-address-card ${selectedAddressId === addr.id ? 'selected' : ''}`}
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
                      className={`co-address-card co-address-new-card ${selectedAddressId === 'new' ? 'selected' : ''}`}
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
                ) : (
                  <p className="tiny muted" style={{ paddingBottom: '6px' }}>No saved addresses found. Enter your shipping address below.</p>
                )}
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
                    setPostcode(e.target.value.replace(/\D/g, ''));
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
          </section>

          {/* 3 — Delivery */}
          <section className="panel co-section">
            <header className="co-head">
              <span className="co-num">3</span>
              <div>
                <h2>Delivery method</h2>
                <p className="tiny muted">Speed and cost — pick what suits this order.</p>
              </div>
            </header>

            <div className="co-delivery-list">
              {DELIVERY_METHODS.map((method) => {
                const Icon = DELIVERY_ICONS[method.id] || Truck;
                const freeByCoupon = couponResult?.ok && couponResult.freeShipping;
                const price = method.freeOver && totals.subtotal >= method.freeOver ? 0 : method.price;
                return (
                  <label key={method.id} className={`co-delivery ${deliveryId === method.id ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="delivery"
                      checked={deliveryId === method.id}
                      onChange={() => setDeliveryId(method.id)}
                    />
                    <Icon size={19} />
                    <span className="co-delivery-main">
                      <strong>{method.label}</strong>
                      <small>{method.detail}</small>
                    </span>
                    <span className="co-delivery-price">
                      {price === 0 || freeByCoupon ? <em>FREE</em> : formatINR(price)}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* 4 — Payment */}
          <section className="panel co-section">
            <header className="co-head">
              <span className="co-num">4</span>
              <div>
                <h2>Payment</h2>
                <p className="tiny muted">Choose how you would like to pay for this order.</p>
              </div>
            </header>

            <div className="co-pay-list">
              <PhonePe
                selected={paymentMethod === 'phonepe'}
                onSelect={setPayment}
                amountLabel={formatINR(totals.total)}
              />

              <label className={`co-pay-option ${paymentMethod === 'cod' ? 'selected' : ''}`}>
                <input type="radio" name="payment" checked={paymentMethod === 'cod'} onChange={() => setPayment('cod')} />
                <Banknote size={19} />
                <span className="co-pay-main">
                  <strong>Cash on delivery</strong>
                  <small>Pay the courier when your order arrives.</small>
                </span>
              </label>
            </div>

            {paymentMethod === 'phonepe' && (
              <PaymentStates
                state={payState}
                message={payInfo?.message}
                reference={payInfo?.reference}
                onRetry={() => {
                  setPayState('idle');
                  setPayInfo(null);
                }}
                onCancel={() => setPayment('cod')}
              />
            )}
          </section>
        </div>

        {/* ---------- Summary ---------- */}
        <aside className="checkout-summary" aria-label="Order summary">
          <div className="panel co-summary-panel">
            <h2>Your order</h2>

            <ul className="co-items">
              {items.map((item) => (
                <li key={`${item.id}::${item.variant || 'default'}`}>
                  <img src={item.image} alt="" width="48" height="48" />
                  <span className="co-item-name">
                    {item.title}
                    {item.variant && <small> · {item.variant}</small>}
                    <small>Qty {item.quantity}</small>
                  </span>
                  <span className="co-item-price">{formatINR((Number(item.price) || 0) * item.quantity)}</span>
                </li>
              ))}
            </ul>

            {/* Coupon */}
            <div className="co-coupon">
              <label className="sr-only" htmlFor="coupon-code">Coupon code</label>
              <div className="co-coupon-row">
                <Tag size={16} />
                <input
                  id="coupon-code"
                  type="text"
                  placeholder="Coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  disabled={couponResult?.ok}
                />
                {couponResult?.ok ? (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={clearCoupon}>Remove</button>
                ) : (
                  <button type="button" className="btn btn-sm btn-outline" onClick={applyCoupon}>Apply</button>
                )}
              </div>
              {couponResult && (
                <p className={`co-coupon-msg ${couponResult.ok ? 'ok' : 'err'}`} role="status">
                  {couponResult.message}
                </p>
              )}
            </div>

            <div className="summary-divider" />

            <div className="summary-row">
              <span>Subtotal</span>
              <span>{formatINR(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="summary-row discount">
                <span>Coupon ({couponResult?.coupon?.code})</span>
                <span>−{formatINR(totals.discount)}</span>
              </div>
            )}
            <div className="summary-row">
              <span>Shipping · {DELIVERY_METHODS.find((m) => m.id === deliveryId)?.label}</span>
              <span>{totals.shipping === 0 ? 'FREE' : formatINR(totals.shipping)}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>{formatINR(totals.total)}</span>
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-block co-place" disabled={submitting}>
              {submitting
                ? (paymentMethod === 'phonepe' ? 'Processing payment…' : 'Placing order…')
                : `Place order · ${formatINR(totals.total)}`}
            </button>

            <p className="co-secure-note">
              <Lock size={13} /> Your details are encrypted and used only to fulfil this order.
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}
