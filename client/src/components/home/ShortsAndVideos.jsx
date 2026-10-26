import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Play, X, ExternalLink, Sparkles, ArrowRight } from 'lucide-react';
import api from '../../utils/api';
import { formatINR } from '../../utils/pricing';
import SectionHead from '../ui/SectionHead';
import './ShortsAndVideos.css';

function getYouTubeEmbed(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1` : null;
}

export default function ShortsAndVideos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getPublicVideos()
      .then((res) => {
        if (!cancelled && res?.videos && res.videos.length > 0) {
          setVideos(res.videos);
        }
      })
      .catch(() => {
        // Degrade gracefully if offline
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveVideo(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleCloseModal();
    };
    if (activeVideo) {
      window.addEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [activeVideo, handleCloseModal]);

  if (loading) {
    return (
      <section className="section shorts-section" aria-label="Shorts and video reviews loading">
        <div className="container">
          <div className="compact-cat-track skeleton-nav" style={{ paddingBlock: '20px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{
                  flex: '0 0 clamp(200px, 22vw, 240px)',
                  aspectRatio: '9 / 16',
                  borderRadius: '16px'
                }}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (videos.length === 0) return null;

  return (
    <section className="section shorts-section" aria-labelledby="shorts-heading">
      <div className="container">
        <SectionHead
          eyebrow="Watch & Shop"
          title="Shorts & Video Reviews"
          subtitle="Real harvest moments, traditional processing methods, and authentic customer experiences."
        />

        <div className="shorts-rail-track" role="region" aria-label="Shorts video reels">
          {videos.map((vid) => {
            const ytEmbed = getYouTubeEmbed(vid.videoUrl);
            const poster = vid.thumbnailUrl || (ytEmbed ? `https://img.youtube.com/vi/${vid.videoUrl.match(/[\w-]{11}/)?.[0]}/hqdefault.jpg` : '/placeholder.png');
            const hasProduct = Boolean(vid.productId && vid.productTitle);

            return (
              <div
                key={vid.id}
                className="video-reel-card"
                role="button"
                tabIndex={0}
                onClick={() => setActiveVideo(vid)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveVideo(vid); }}
                aria-label={`Play video: ${vid.title}`}
              >
                <img
                  src={poster}
                  alt={vid.title}
                  className="video-reel-poster"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = '/placeholder.png'; }}
                />
                <div className="video-reel-overlay" />

                <div className="video-reel-top">
                  <span className="video-badge-pill">
                    <Sparkles size={11} /> Reel
                  </span>
                </div>

                <div className="video-play-center" aria-hidden="true">
                  <Play size={22} fill="currentColor" />
                </div>

                <div className="video-reel-bottom">
                  <h3 className="video-reel-title">{vid.title}</h3>

                  {hasProduct && (
                    <div
                      className="video-attached-product"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {vid.productImage && (
                        <img
                          src={vid.productImage}
                          alt=""
                          className="video-prod-thumb"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      <div className="video-prod-meta">
                        <span className="video-prod-title">{vid.productTitle}</span>
                        <span className="video-prod-price">{formatINR(Number(vid.productPrice) || 0)}</span>
                      </div>
                      <Link
                        to={`/product/${vid.productId}`}
                        className="btn btn-xs btn-primary"
                        style={{ padding: '4px 8px', fontSize: '0.72rem', flexShrink: 0 }}
                        title="View Product"
                      >
                        Shop <ArrowRight size={12} />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Video Modal Player */}
      {activeVideo && (
        <div
          className="video-modal-backdrop"
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
          aria-label={activeVideo.title}
        >
          <div
            className="video-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="video-modal-close"
              onClick={handleCloseModal}
              aria-label="Close video player"
            >
              <X size={20} />
            </button>

            <div className="video-player-wrap">
              {getYouTubeEmbed(activeVideo.videoUrl) ? (
                <iframe
                  src={getYouTubeEmbed(activeVideo.videoUrl)}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={activeVideo.videoUrl}
                  poster={activeVideo.thumbnailUrl}
                  controls
                  autoPlay
                  playsInline
                />
              )}
            </div>

            {activeVideo.productId && activeVideo.productTitle && (
              <div className="video-modal-footer">
                <div className="video-modal-prod">
                  {activeVideo.productImage && (
                    <img src={activeVideo.productImage} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  )}
                  <div className="video-modal-prod-info">
                    <h4>{activeVideo.productTitle}</h4>
                    <p>{formatINR(Number(activeVideo.productPrice) || 0)}</p>
                  </div>
                </div>
                <Link
                  to={`/product/${activeVideo.productId}`}
                  className="btn btn-primary btn-sm"
                  onClick={handleCloseModal}
                >
                  View Product <ExternalLink size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
