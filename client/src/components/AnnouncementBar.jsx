import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { announcementMessages } from '../data/content';
import './AnnouncementBar.css';

const DISMISS_KEY = 'ecshopping_announcement_dismissed';

export default function AnnouncementBar() {
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const timerRef = useRef(null);

  useEffect(() => {
    if (hidden || announcementMessages.length < 2) return undefined;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % announcementMessages.length);
    }, 5000);
    return () => clearInterval(timerRef.current);
  }, [hidden]);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable — dismissal stays in memory */
    }
  };

  const move = (delta) => {
    setIndex((i) => (i + delta + announcementMessages.length) % announcementMessages.length);
  };

  return (
    <div className="announcement-bar" role="region" aria-label="Announcements">
      <div className="container announcement-inner">
        <button type="button" className="announcement-nav" onClick={() => move(-1)} aria-label="Previous announcement">
          <ChevronLeft size={15} />
        </button>

        <p className="announcement-text" key={index} aria-live="polite">
          {announcementMessages[index]}
        </p>

        <button type="button" className="announcement-nav" onClick={() => move(1)} aria-label="Next announcement">
          <ChevronRight size={15} />
        </button>

        <button type="button" className="announcement-close" onClick={dismiss} aria-label="Dismiss announcements">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
