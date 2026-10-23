import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, Clock, MapPin, CheckCircle2, Send } from 'lucide-react';
import { PageHero } from '../components/ui/PageHeader';
import { siteInfo } from '../data/content';
import '../components/policy.css';

const initialForm = { name: '', email: '', subject: '', message: '' };

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Please enter your name.';
  if (!form.email.trim()) errors.email = 'Please enter your email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address.';
  if (!form.message.trim()) errors.message = 'Please tell us how we can help.';
  else if (form.message.trim().length < 10) errors.message = 'Add a little more detail (at least 10 characters).';
  return errors;
}

export default function ContactUs() {
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

  const cards = [
    { icon: Mail, title: 'Email', value: siteInfo.email, href: `mailto:${siteInfo.email}` },
    { icon: Phone, title: 'Phone', value: siteInfo.phone, href: `tel:${siteInfo.phone.replace(/[^+\d]/g, '')}` },
    { icon: Clock, title: 'Support hours', value: siteInfo.hours },
    { icon: MapPin, title: 'Operations', value: siteInfo.address },
  ];

  return (
    <>
      <PageHero
        title="Contact us"
        subtitle="Questions about an order, a product or selling with us? We reply within one business day."
        crumbs={[{ label: 'Contact us' }]}
      />

      <div className="container" style={{ paddingBlock: 'clamp(24px, 3vw, 40px) clamp(46px, 6vw, 72px)' }}>
        <div className="info-grid" style={{ marginBottom: 'clamp(22px, 3vw, 34px)' }}>
          {cards.map(({ icon: Icon, title, value, href }) => (
            <div className="info-card panel" key={title}>
              <span className="info-icon"><Icon size={20} /></span>
              <h3>{title}</h3>
              {href ? (
                <p><a href={href}>{value}</a></p>
              ) : (
                <p>{value}</p>
              )}
            </div>
          ))}
        </div>

        <div className="policy-layout">
          <aside className="panel" style={{ padding: 'clamp(20px, 3vw, 28px)' }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 12px' }}>Before you write</h2>
            <p className="muted" style={{ fontSize: '0.88rem', lineHeight: 1.65, margin: '0 0 16px' }}>
              Most day-to-day questions are answered instantly in the help centre — delivery windows, refund
              timelines, payment options and account data.
            </p>
            <Link to="/faq" className="btn btn-outline btn-sm">Browse FAQs</Link>

            <h2 style={{ fontSize: '1.1rem', margin: '26px 0 12px' }}>Selling with us</h2>
            <p className="muted" style={{ fontSize: '0.88rem', lineHeight: 1.65, margin: '0 0 16px' }}>
              Interested in listing your products? Mention your category and city in the form and our team will
              get in touch about onboarding.
            </p>
            <p className="tiny muted" style={{ margin: 0 }}>
              {siteInfo.registered}
            </p>
          </aside>

          <div className="panel" style={{ padding: 'clamp(22px, 3vw, 36px)' }}>
            <h2 style={{ fontSize: '1.35rem', margin: '0 0 6px' }}>Send a message</h2>
            <p className="muted" style={{ margin: '0 0 22px', fontSize: '0.9rem' }}>
              Fill in the form and we will get back to you by email.
            </p>

            {submitted ? (
              <div className="form-success" role="status">
                <CheckCircle2 size={18} aria-hidden="true" />
                <div>
                  <strong>Message received — thank you.</strong> We will get back to you by email shortly.
                  You can also reach us directly at{' '}
                  <a href={`mailto:${siteInfo.email}`}>{siteInfo.email}</a>.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="field">
                    <label className="field-label" htmlFor="contact-name">
                      Your name <span className="req" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="contact-name"
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
                    <label className="field-label" htmlFor="contact-email">
                      Email <span className="req" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="contact-email"
                      className={`input ${errors.email ? 'has-error' : ''}`}
                      type="email"
                      value={form.email}
                      onChange={update('email')}
                      placeholder="you@example.com"
                      aria-invalid={Boolean(errors.email)}
                    />
                    {errors.email && <span className="field-error" role="alert">{errors.email}</span>}
                  </div>
                </div>

                <div className="field" style={{ marginTop: '16px' }}>
                  <label className="field-label" htmlFor="contact-subject">Subject</label>
                  <input
                    id="contact-subject"
                    className="input"
                    type="text"
                    value={form.subject}
                    onChange={update('subject')}
                    placeholder="What is this about?"
                  />
                </div>

                <div className="field" style={{ marginTop: '16px' }}>
                  <label className="field-label" htmlFor="contact-message">
                    Message <span className="req" aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    className={`textarea ${errors.message ? 'has-error' : ''}`}
                    rows={6}
                    value={form.message}
                    onChange={update('message')}
                    placeholder="Include your order ID if this is about an existing order."
                    aria-invalid={Boolean(errors.message)}
                  />
                  {errors.message && <span className="field-error" role="alert">{errors.message}</span>}
                </div>

                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginTop: '20px' }}>
                  <button type="submit" className="btn btn-primary">
                    <Send size={16} aria-hidden="true" /> Send message
                  </button>
                  <Link to="/faq" className="btn btn-ghost">Check the FAQs first</Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
