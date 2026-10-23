import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight, BookOpen } from 'lucide-react';
import { PageHero } from '../components/ui/PageHeader';
import { blogPosts } from '../data/content';
import './Blog.css';

const ALL = 'All topics';

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export default function Blog() {
  const [topic, setTopic] = useState(ALL);

  const topics = useMemo(
    () => [ALL, ...Array.from(new Set(blogPosts.map((post) => post.tag)))],
    []
  );

  const posts = useMemo(
    () => (topic === ALL ? blogPosts : blogPosts.filter((post) => post.tag === topic)),
    [topic]
  );

  const [featured, ...rest] = posts;

  return (
    <>
      <PageHero
        title="Stories from the farm and the kitchen"
        subtitle="Buying guides, seasonal notes and the way our partner farms actually work."
        crumbs={[{ label: 'Blog' }]}
      />

      <div className="container blog-page">
        <div className="blog-topics" role="tablist" aria-label="Blog topics">
          {topics.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={topic === item}
              className={`chip ${topic === item ? 'active' : ''}`}
              onClick={() => setTopic(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {posts.length === 0 ? (
          <div className="panel blog-empty">
            <BookOpen size={34} aria-hidden="true" />
            <h2>No stories in this topic yet</h2>
            <p className="muted">Try another topic — new posts are added every month.</p>
          </div>
        ) : (
          <>
            <Link to={`/blog/${featured.slug}`} className="blog-featured">
              <div className="blog-featured-media">
                <img src={featured.image} alt="" loading="lazy" />
              </div>
              <div className="blog-featured-body">
                <span className="blog-tag">{featured.tag}</span>
                <h2>{featured.title}</h2>
                <p>{featured.excerpt}</p>
                <div className="blog-meta">
                  <span>{formatDate(featured.date)}</span>
                  <span className="dot-sep">{featured.readTime}</span>
                  <span className="blog-read-more">Read story <ArrowRight size={14} /></span>
                </div>
              </div>
            </Link>

            {rest.length > 0 && (
              <div className="blog-grid">
                {rest.map((post) => (
                  <Link to={`/blog/${post.slug}`} className="blog-card" key={post.slug}>
                    <div className="blog-card-media">
                      <img src={post.image} alt="" loading="lazy" />
                      <span className="blog-tag">{post.tag}</span>
                    </div>
                    <div className="blog-card-body">
                      <h3>{post.title}</h3>
                      <p>{post.excerpt}</p>
                      <div className="blog-meta">
                        <span>{formatDate(post.date)}</span>
                        <span className="blog-read-time"><Clock size={12} /> {post.readTime}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
