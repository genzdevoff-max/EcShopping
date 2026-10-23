import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, CalendarDays } from 'lucide-react';
import { PageHero } from '../components/ui/PageHeader';
import { blogPosts, getBlogPost } from '../data/content';
import './Blog.css';

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export default function BlogPost() {
  const { slug } = useParams();
  const post = getBlogPost(slug);

  if (!post) {
    return (
      <div className="container blog-page">
        <div className="panel blog-empty">
          <h2>Story not found</h2>
          <p className="muted">That article may have been renamed or removed.</p>
          <Link to="/blog" className="btn btn-primary">Back to all stories</Link>
        </div>
      </div>
    );
  }

  const related = blogPosts.filter((item) => item.slug !== post.slug).slice(0, 3);

  return (
    <>
      <PageHero
        title={post.title}
        subtitle={post.excerpt}
        crumbs={[{ label: 'Blog', to: '/blog' }, { label: post.title }]}
      >
        <div className="blog-post-meta">
          <span><CalendarDays size={14} /> {formatDate(post.date)}</span>
          <span><Clock size={14} /> {post.readTime}</span>
          <span>By {post.author}</span>
        </div>
      </PageHero>

      <div className="container blog-page">
        <Link to="/blog" className="blog-back">
          <ArrowLeft size={15} /> All stories
        </Link>

        <article className="panel blog-article">
          <div className="blog-article-media">
            <img src={post.image} alt="" />
          </div>

          <div className="prose">
            <span className="blog-tag">{post.tag}</span>
            {post.sections.map((section, index) => (
              <section key={`${post.slug}-${index}`}>
                {section.heading && <h2>{section.heading}</h2>}
                {section.paragraphs?.map((paragraph, pIndex) => (
                  <p key={pIndex}>{paragraph}</p>
                ))}
                {section.bullets && (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </article>

        {related.length > 0 && (
          <section className="blog-related">
            <h2>More stories</h2>
            <div className="blog-grid">
              {related.map((item) => (
                <Link to={`/blog/${item.slug}`} className="blog-card" key={item.slug}>
                  <div className="blog-card-media">
                    <img src={item.image} alt="" loading="lazy" />
                    <span className="blog-tag">{item.tag}</span>
                  </div>
                  <div className="blog-card-body">
                    <h3>{item.title}</h3>
                    <div className="blog-meta">
                      <span>{formatDate(item.date)}</span>
                      <span className="blog-read-time"><Clock size={12} /> {item.readTime}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
