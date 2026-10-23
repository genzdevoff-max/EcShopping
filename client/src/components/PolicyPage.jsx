import { PageHero } from './ui/PageHeader';
import './policy.css';

const slugify = (text) =>
  String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Shared layout for policy / information pages.
 * `sections` = [{ heading, paragraphs?: string[], bullets?: string[] }]
 */
export default function PolicyPage({ title, subtitle, crumbs, sections = [], footerNote = null, children = null }) {
  return (
    <>
      <PageHero title={title} subtitle={subtitle} crumbs={crumbs} />

      <div className="container policy-layout">
        <aside className="policy-toc panel" aria-label="On this page">
          <h2>On this page</h2>
          <nav>
            <ol>
              {sections.map((section) => (
                <li key={section.heading}>
                  <a href={`#${slugify(section.heading)}`}>{section.heading}</a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="policy-body panel">
          <div className="prose">
            {sections.map((section) => (
              <section key={section.heading} id={slugify(section.heading)} className="policy-section">
                <h2>{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
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

          {children}

          {footerNote && <p className="policy-updated tiny muted">{footerNote}</p>}
        </article>
      </div>
    </>
  );
}
