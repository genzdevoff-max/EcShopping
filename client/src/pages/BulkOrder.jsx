import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, Percent, CheckCircle2, Send, Package } from 'lucide-react';
import { PageHero } from '../components/ui/PageHeader';
import { bulkOrderInfo, siteInfo } from '../data/content';
import '../components/policy.css';

const initialForm = { name: '', email: '', phone: '', product: '', quantity: '', message: '' };

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Please enter your name.';
  if (!form.email.trim()) errors.email = 'Please enter your email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address.';
  if (!form.phone.trim()) errors.phone = 'Please enter a phone number.';
  else if (!/^[+\d][\d\s-]{7,15}$/.test(form.phone.trim())) errors.phone = 'Enter a valid phone number.';
  if (!form.quantity.trim()) errors.quantity = 'Tell us roughly how many units you need.';
  return errors;
}

export default function BulkOrder() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitted(true);
    setForm(initialForm);
  };

  const facts = [
    { icon: Package, label: 'Minimum quantity', value: bulkOrderInfo.minQuantity },
    { icon: Clock, label: 'Lead time', value: bulkOrderInfo.leadTime },
    { icon: Percent, label: 'Volume discount', value: bulkOrderInfo.discount },
    { icon: Users, label: 'Typical buyers', value: bulkOrderInfo.useCases[0] },
  ];

  return (
    <>
      <PageHero
        title="Bulk order enquiry"
        subtitle="Volume pricing for offices, events and resellers."
        crumbs={[{ label: 'Bulk order enquiry' }]}
      />

      <div className="container" style={{ paddingBlock: 'clamp(24px, 3vw, 40px) clamp(46px, 6vw, 72px)' }}>
        <div className="info-grid" style={{ marginBottom: 'clamp(22px, 3vw, 34px)' }}>
          {facts.map(({ icon: Icon, label, value }) => (
            <div className="info-card panel" key={label}>
              <span className="info-icon"><Icon size={20} /></span>
              <h3>{label}</h3>
              <p>{value}</p>
            </div>
          ))}
        </div>

        <div className="policy-layout">
          <aside className="panel" style={{ padding: 'clamp(20px, 3vw, 28px)' }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 16px' }}>How it works</h2>
            <ol style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingLeft: 0, listStyle: 'none', counterReset: 'step' }}>
              {bulkOrderInfo.steps.map((step, index) => (
                <li key={step} style={{ display: 'flex', gap: '12px', fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--ink-2)' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--brand-50)',
                      color: 'var(--brand-700)', fontSize: '0.72rem', fontWeight: 800, display: 'grid', placeItems: 'center',
                    }}
                  >
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <h2 style={{ fontSize: '1.1rem', margin: '26px 0 12px' }}>Who orders this way</h2>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: 0, listStyle: 'none', fontSize: '0.87rem', color: 'var(--muted)' }}>
              {bulkOrderInfo.useCases.map((useCase) => (
                <li key={useCase} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start' }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 3 }} aria-hidden="true" />
                  {useCase}
                </li>
              ))}
            </ul>

            <p className="tiny muted" style={{ marginTop: '22px' }}>
              Prefer email? Write to <a href={`mailto:${siteInfo.email}`} style={{ color: 'var(--brand)' }}>{siteInfo.email}</a>.
            </p>
          </aside>

          <div className="panel" style={{ padding: 'clamp(22px, 3vw, 36px)' }}>
            <h2 style={{ fontSize: '1.35rem', margin: '0 0 6px' }}>Send your requirement</h2>
            <p className="muted" style={{ margin: '0 0 22px', fontSize: '0.9rem' }}>
              Share the product and quantity you need. Our team replies with availability, pricing and lead time.
            </p>

            {submitted ? (
              <div className="form-success" role="status">
                <CheckCircle2 size={18} aria-hidden="true" />
                <div>
                  <strong>Enquiry received.</strong> Our team will review your requirement and get back to you
                  with availability, pricing and lead time. You can also reach us at{' '}
                  <a href={`mailto:${siteInfo.email}`}>{siteInfo.email}</a>.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="field">
                    <label className="field-label" htmlFor="bulk-name">
                      Your name <span className="req" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="bulk-name"
                      className={`input ${errors.name ? 'has-error' : ''}`}
                      type="text"
                      value={form.name}
                      onChange={update('name')}
                      placeholder="Full name"
                      aria-invalid={Boolean(errors.name)}
                    />
                    {errors.name && <span className="field-error" role="alert">{errors.name}</span>}
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="bulk-email">
                      Email <span className="req" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="bulk-email"
                      className={`input ${errors.email ? 'has-error' : ''}`}
                      type="email"
                      value={form.email}
                      onChange={update('email')}
                      placeholder="you@company.com"
                      aria-invalid={Boolean(errors.email)}
                    />
                    {errors.email && <span className="field-error" role="alert">{errors.email}</span>}
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="bulk-phone">
                      Phone <span className="req" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="bulk-phone"
                      className={`input ${errors.phone ? 'has-error' : ''}`}
                      type="tel"
                      value={form.phone}
                      onChange={update('phone')}
                      placeholder="+91 90000 00000"
                      aria-invalid={Boolean(errors.phone)}
                    />
                    {errors.phone && <span className="field-error" role="alert">{errors.phone}</span>}
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="bulk-product">Product or category</label>
                    <input
                      id="bulk-product"
                      className="input"
                      type="text"
                      value={form.product}
                      onChange={update('product')}
                      placeholder="e.g. cold-pressed oil, rice"
                    />
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="bulk-quantity">
                      Approx. quantity <span className="req" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="bulk-quantity"
                      className={`input ${errors.quantity ? 'has-error' : ''}`}
                      type="text"
                      value={form.quantity}
                      onChange={update('quantity')}
                      placeholder="e.g. 50 units"
                      aria-invalid={Boolean(errors.quantity)}
                    />
                    {errors.quantity && <span className="field-error" role="alert">{errors.quantity}</span>}
                  </div>
                </div>

                <div className="field" style={{ marginTop: '16px' }}>
                  <label className="field-label" htmlFor="bulk-message">Details</label>
                  <textarea
                    id="bulk-message"
                    className="textarea"
                    rows={5}
                    value={form.message}
                    onChange={update('message')}
                    placeholder="Delivery city, deadline, packaging preferences…"
                  />
                  <span className="field-hint">Minimum order is {bulkOrderInfo.minQuantity}.</span>
                </div>

                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginTop: '20px' }}>
                  <button type="submit" className="btn btn-primary">
                    <Send size={16} aria-hidden="true" /> Send enquiry
                  </button>
                  <Link to="/faq" className="btn btn-ghost">Read bulk-order FAQs</Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
