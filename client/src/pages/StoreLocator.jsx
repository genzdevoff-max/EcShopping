import { useMemo, useState } from 'react';
import { Search, MapPin, Phone, Clock, Navigation, Store } from 'lucide-react';
import { PageHero } from '../components/ui/PageHeader';
import { stores } from '../data/content';
import './StoreLocator.css';

export default function StoreLocator() {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((store) =>
      `${store.name} ${store.city} ${store.address} ${store.pincode}`.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <>
      <PageHero
        title="Find a store near you"
        subtitle="Collect your order, meet the team or shop the shelf in person."
        crumbs={[{ label: 'Store locator' }]}
      />

      <div className="container store-page">
        <label className="store-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by city, area or pincode…"
            aria-label="Search stores by city, area or pincode"
          />
        </label>

        {results.length === 0 ? (
          <div className="panel store-empty">
            <Store size={34} aria-hidden="true" />
            <h2>No store matches “{query.trim()}”</h2>
            <p className="muted">
              Try a nearby city or pincode. Home delivery is also available across serviceable pincodes at checkout.
            </p>
            <button type="button" className="btn btn-outline" onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        ) : (
          <>
            <p className="store-count">
              {results.length} store{results.length === 1 ? '' : 's'} found
            </p>

            <div className="store-grid">
              {results.map((store) => (
                <article className="store-card" key={store.id}>
                  <div className="store-card-head">
                    <span className="store-icon"><Store size={20} /></span>
                    <div>
                      <h2>{store.name}</h2>
                      <span className="store-city">{store.city}</span>
                    </div>
                  </div>

                  <ul className="store-details">
                    <li><MapPin size={15} /> <span>{store.address} — {store.pincode}</span></li>
                    <li><Phone size={15} /> <a href={`tel:${store.phone.replace(/\s/g, '')}`}>{store.phone}</a></li>
                    <li><Clock size={15} /> <span>{store.hours}</span></li>
                  </ul>

                  <a
                    href={store.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm store-directions"
                  >
                    <Navigation size={15} /> Get directions
                  </a>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
