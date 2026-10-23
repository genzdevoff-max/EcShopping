import { Link } from 'react-router-dom';
import { Store, Truck, ShieldCheck, Sprout } from 'lucide-react';
import { PageHero } from '../components/ui/PageHeader';
import { siteInfo } from '../data/content';
import '../components/policy.css';

const values = [
  {
    icon: Store,
    title: 'Local sellers first',
    text: 'Small and regional sellers get a storefront with the same polish as national brands — no middle layer taking a cut they never agreed to.',
  },
  {
    icon: Sprout,
    title: 'Fresh by default',
    text: 'Produce and staples are picked, packed and dispatched on short cycles so what arrives at your door still looks like it did on the shelf.',
  },
  {
    icon: Truck,
    title: 'Delivery you can plan around',
    text: 'Standard and express options with timelines shown before you pay — not after you have already waited.',
  },
  {
    icon: ShieldCheck,
    title: 'Straightforward policies',
    text: 'Clear returns, honest refund windows and support that answers in one business day. The fine print is on the policy pages, not hidden.',
  },
];

const stats = [
  { value: '24 hrs', label: 'Pickup orders ready within' },
  { value: '48 hrs', label: 'Window to report a bad delivery' },
  { value: '3–5 days', label: 'Standard delivery across the region' },
  { value: '1 day', label: 'Typical support response time' },
];

export default function AboutUs() {
  return (
    <>
      <PageHero
        title={`About ${siteInfo.brand}`}
        subtitle={siteInfo.tagline}
        crumbs={[{ label: 'About us' }]}
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '22px' }}>
          <Link to="/shop" className="btn btn-primary">Start shopping</Link>
          <Link to="/contact" className="btn btn-outline">Talk to us</Link>
        </div>
      </PageHero>

      <div className="container" style={{ paddingBlock: 'clamp(24px, 3vw, 40px) clamp(46px, 6vw, 72px)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.7fr) minmax(260px, 1fr)',
            gap: 'clamp(18px, 3vw, 34px)',
            alignItems: 'start',
          }}
          className="about-layout"
        >
          <article className="panel" style={{ padding: 'clamp(22px, 3vw, 36px)' }}>
            <div className="prose">
              <section>
                <h2>The idea</h2>
                <p>
                  {siteInfo.brand} started from an observation: the sellers around us knew their products
                  better than any marketplace algorithm ever would, but they had no good way to sell online.
                  Buyers, meanwhile, were getting faster delivery and worse produce.
                </p>
                <p>
                  So we built a storefront where a seller's listing, their stock and their delivery promise
                  are the product — not an ad slot. This release is the customer-facing half of that idea:
                  browse, compare, order and track, with policies written in plain language.
                </p>
              </section>

              <section>
                <h2>What we are building</h2>
                <p>
                  A regional marketplace for everyday goods — groceries, staples, produce and household
                  essentials — operated out of {siteInfo.address}. Orders are fulfilled with local delivery
                  partners so the distance between seller and doorstep stays short.
                </p>
                <p>
                  Payment options are Cash on Delivery and PhonePe. Nothing on this site collects card or UPI
                  credentials directly — payments are handled by the payment provider.
                </p>
              </section>

              <section>
                <h2>Who is behind it</h2>
                <p>
                  {siteInfo.registered}. Business details, registrations and support contacts are listed on
                  the contact and policy pages. We source from local sellers so the distance between farm and
                  kitchen stays short.
                </p>
              </section>
            </div>
          </article>

          <aside>
            <div className="panel" style={{ padding: 'clamp(20px, 3vw, 28px)', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 14px' }}>Service commitments</h2>
              <div style={{ display: 'grid', gap: '14px' }}>
                {stats.map((stat) => (
                  <div key={stat.label} style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                    <strong style={{ fontSize: '1.15rem', color: 'var(--brand)', minWidth: '78px' }}>{stat.value}</strong>
                    <span className="muted" style={{ fontSize: '0.84rem', lineHeight: 1.5 }}>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel" style={{ padding: 'clamp(20px, 3vw, 28px)' }}>
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 10px' }}>Questions or feedback</h2>
              <p className="muted" style={{ fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 16px' }}>
                Tell us what is working, what is not, and which sellers you want to see next.
              </p>
              <Link to="/contact" className="btn btn-outline btn-sm">Contact the team</Link>
            </div>
          </aside>
        </div>

        <div className="info-grid" style={{ marginTop: 'clamp(22px, 3vw, 34px)' }}>
          {values.map(({ icon: Icon, title, text }) => (
            <div className="info-card panel" key={title}>
              <span className="info-icon"><Icon size={20} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
