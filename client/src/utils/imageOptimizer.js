/**
 * Lightweight, safe image URL optimizer for storefront performance.
 * Dynamically applies Cloudinary and Unsplash transformations
 * (f_auto, q_auto, responsive widths) without changing backend storage.
 */

export function optimizeImageUrl(url, { width = 480, quality = 'auto', format = 'auto' } = {}) {
  if (!url || typeof url !== 'string') return url;

  // 1. Cloudinary optimization
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    // Avoid re-transforming if already transformed
    if (/\/upload\/[^/]*[fwq]_[^/]+\//.test(url)) return url;

    const parts = [];
    if (format) parts.push(`f_${format}`);
    if (quality) parts.push(`q_${quality}`);
    if (width) parts.push(`w_${width}`);

    const transformStr = parts.join(',');
    return url.replace('/upload/', `/upload/${transformStr}/`);
  }

  // 2. Unsplash optimization
  if (url.includes('images.unsplash.com')) {
    try {
      const u = new URL(url);
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'crop');
      if (width) u.searchParams.set('w', String(width));
      const targetQuality = quality === 'auto' ? '75' : quality;
      if (targetQuality) u.searchParams.set('q', String(targetQuality));
      return u.toString();
    } catch {
      return url;
    }
  }

  return url;
}

export default optimizeImageUrl;
