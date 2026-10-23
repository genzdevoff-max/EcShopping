import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MessageCircle } from 'lucide-react';
import { PageHero } from '../components/ui/PageHeader';
import Accordion from '../components/ui/Accordion';
import { faqs } from '../data/content';
import '../components/policy.css';

const ALL = 'All questions';

export default function Faq() {
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');

  const categories = useMemo(() => [ALL, ...faqs.map((group) => group.category)], []);

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs
      .filter((group) => category === ALL || group.category === category)
      .map((group) => ({
        ...group,
        items: q
          ? group.items.filter(
              (item) =>
                item.q.toLowerCase().includes(q) ||
                item.a.toLowerCase().includes(q),
            )
          : group.items,
      }))
      .filter((group) => group.items.length > 0);
  }, [category, query]);

  const resultCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <>
      <PageHero
        title="Frequently asked questions"
        subtitle="Answers about orders, delivery, returns and accounts."
        crumbs={[{ label: 'Frequently asked questions' }]}
      />

      <div className="container" style={{ paddingBlock: 'clamp(24px, 3vw, 40px) clamp(46px, 6vw, 72px)' }}>
        <div className="faq-toolbar">
          <div className="faq-categories" role="tablist" aria-label="FAQ categories">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={category === item}
                className={`chip ${category === item ? 'active' : ''}`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="faq-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search a question…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search questions"
            />
          </label>
        </div>

        {resultCount === 0 ? (
          <div className="panel" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <MessageCircle size={36} style={{ color: 'var(--muted)' }} aria-hidden="true" />
            <h2 style={{ fontSize: '1.15rem', margin: '14px 0 8px' }}>No matching questions</h2>
            <p className="muted" style={{ marginBottom: 18 }}>
              Try a different search term, or contact support and we will answer directly.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline" onClick={() => { setQuery(''); setCategory(ALL); }}>
                Reset search
              </button>
              <Link to="/contact" className="btn btn-primary">Contact support</Link>
            </div>
          </div>
        ) : (
          visibleGroups.map((group) => (
            <section className="faq-group" key={group.category}>
              <h2>{group.category}</h2>
              <Accordion
                items={group.items.map((item, index) => ({
                  id: `${group.category}-${index}`,
                  question: item.q,
                  answer: item.a,
                }))}
                defaultOpenId={`${group.category}-0`}
              />
            </section>
          ))
        )}

        <div className="panel" style={{ padding: 'clamp(20px, 3vw, 28px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 6px' }}>Still need help?</h2>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              Our support team replies within one business day.
            </p>
          </div>
          <Link to="/contact" className="btn btn-primary">Contact us</Link>
        </div>
      </div>
    </>
  );
}
