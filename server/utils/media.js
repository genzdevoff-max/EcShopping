/**
 * Media validation and Cloudinary asset helpers.
 *
 * Enforces server-side sniffing of magic bytes to verify legitimate image formats
 * (JPEG, PNG, GIF, WEBP) instead of trusting client extensions or MIME headers alone.
 */

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

/**
 * Sniff buffer magic bytes to accurately detect permitted image formats.
 * @param {Buffer} buf
 * @returns {'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | null}
 */
export function detectImageFormat(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 4) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return 'image/png';
  }

  // GIF: GIF87a or GIF89a (47 49 46 38)
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return 'image/gif';
  }

  // WebP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Validates an uploaded image buffer for permitted format and size.
 * @param {Buffer} buffer
 * @returns {{ ok: boolean, error?: string, mimeType?: string }}
 */
export function validateImageUpload(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: 'No image file uploaded' };
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, error: 'Image size exceeds maximum limit of 10MB' };
  }

  const detectedMime = detectImageFormat(buffer);
  if (!detectedMime) {
    return {
      ok: false,
      error: 'Invalid file format. Only JPEG, PNG, WebP, and GIF images are permitted.'
    };
  }

  return { ok: true, mimeType: detectedMime };
}

/**
 * Sniff buffer magic bytes to detect permitted document and certificate formats.
 * Accepts PDF documents as well as scanned PNG and JPEG certificate images.
 * @param {Buffer} buf
 * @returns {'application/pdf' | 'image/jpeg' | 'image/png' | null}
 */
export function detectDocumentFormat(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 4) return null;

  // PDF: %PDF- (25 50 44 46)
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return 'application/pdf';
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return 'image/png';
  }

  return null;
}

/**
 * Validates an uploaded document / certificate buffer for permitted format and size.
 * @param {Buffer} buffer
 * @returns {{ ok: boolean, error?: string, mimeType?: string }}
 */
export function validateDocumentUpload(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: 'No document file uploaded' };
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, error: 'Document size exceeds maximum limit of 10MB' };
  }

  const detectedMime = detectDocumentFormat(buffer);
  if (!detectedMime) {
    return {
      ok: false,
      error: 'Invalid document format. Only PDF, JPG, and PNG files are accepted for certificates and legal documents.'
    };
  }

  return { ok: true, mimeType: detectedMime };
}

/**
 * Extracts the Cloudinary public_id from a Cloudinary secure_url.
 * Returns null if not a Cloudinary URL or no public_id can be extracted safely.
 *
 * Cloudinary URL structure:
 * https://res.cloudinary.com/<cloud_name>/image/upload/[v<version>/]<public_id>.<ext>
 *
 * @param {string} url
 * @returns {string | null}
 */
export function extractCloudinaryPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/image\/upload\/(?:v\d+\/)?([^\.\?\#]+)(?:\.[a-zA-Z0-9]+)?/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}
