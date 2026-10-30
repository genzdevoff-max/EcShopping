import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import {
  detectImageFormat,
  validateImageUpload,
  extractCloudinaryPublicId
} from '../utils/media.js';

const { default: app } = await import('../index.js');
const { signToken } = await import('../middleware/auth.js');
const { default: pool } = await import('../db.js');

const request = () => supertest(app);

after(async () => {
  await pool.end();
});

const VENDOR_TOKEN = signToken({ sub: 'v-media-01', role: 'vendor', vendorId: 'v-media-01', email: 'vendor@media.test' });
const ADMIN_TOKEN = signToken({ sub: 'admin-media-01', role: 'admin', email: 'admin@media.test' });
const CUSTOMER_TOKEN = signToken({ sub: 'c-media-01', role: 'customer', email: 'customer@media.test' });

// Synthetic image magic byte headers
const JPEG_HEADER = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const GIF_HEADER = Buffer.from('GIF89a\x01\x00\x01\x00', 'ascii');
const WEBP_HEADER = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x20, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from('VP8 ', 'ascii')
]);
const FAKE_EXE = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

test('Media: detectImageFormat correctly identifies permitted image formats', () => {
  assert.equal(detectImageFormat(JPEG_HEADER), 'image/jpeg');
  assert.equal(detectImageFormat(PNG_HEADER), 'image/png');
  assert.equal(detectImageFormat(GIF_HEADER), 'image/gif');
  assert.equal(detectImageFormat(WEBP_HEADER), 'image/webp');
  assert.equal(detectImageFormat(FAKE_EXE), null);
  assert.equal(detectImageFormat(Buffer.from('Hello world plain text')), null);
  assert.equal(detectImageFormat(null), null);
});

test('Media: validateImageUpload checks format, size, and presence', () => {
  // Empty
  assert.equal(validateImageUpload(null).ok, false);
  assert.equal(validateImageUpload(Buffer.alloc(0)).ok, false);

  // Non-image
  const nonImage = validateImageUpload(FAKE_EXE);
  assert.equal(nonImage.ok, false);
  assert.match(nonImage.error, /Invalid file format/);

  // Valid PNG
  const valid = validateImageUpload(PNG_HEADER);
  assert.equal(valid.ok, true);
  assert.equal(valid.mimeType, 'image/png');

  // Oversized (>10MB)
  const oversized = Buffer.alloc(11 * 1024 * 1024);
  JPEG_HEADER.copy(oversized, 0);
  const oversizedRes = validateImageUpload(oversized);
  assert.equal(oversizedRes.ok, false);
  assert.match(oversizedRes.error, /exceeds maximum limit/);
});

test('Media: extractCloudinaryPublicId accurately parses Cloudinary URLs', () => {
  const url1 = 'https://res.cloudinary.com/ecshopping/image/upload/v1234567890/ecshopping_products/sample_apple.jpg';
  assert.equal(extractCloudinaryPublicId(url1), 'ecshopping_products/sample_apple');

  const url2 = 'https://res.cloudinary.com/demo/image/upload/sample.png';
  assert.equal(extractCloudinaryPublicId(url2), 'sample');

  assert.equal(extractCloudinaryPublicId('https://example.com/not-cloudinary.jpg'), null);
  assert.equal(extractCloudinaryPublicId('data:image/png;base64,iVBORw0KGgo='), null);
  assert.equal(extractCloudinaryPublicId(null), null);
});

test('POST /api/upload: Authentication and role enforcement', async () => {
  // 401 without auth
  const anon = await request()
    .post('/api/upload')
    .attach('image', PNG_HEADER, 'test.png');
  assert.equal(anon.status, 401);

  // 403 for customer (only vendors and admins can upload product media)
  const cust = await request()
    .post('/api/upload')
    .set('Authorization', `Bearer ${CUSTOMER_TOKEN}`)
    .attach('image', PNG_HEADER, 'test.png');
  assert.equal(cust.status, 403);
});

test('POST /api/upload: Rejects non-image files even if client claims image MIME type', async () => {
  const res = await request()
    .post('/api/upload')
    .set('Authorization', `Bearer ${VENDOR_TOKEN}`)
    .attach('image', FAKE_EXE, { filename: 'malicious.jpg', contentType: 'image/jpeg' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /Invalid file format/);
});

test('POST /api/upload: Rejects request with no file', async () => {
  const res = await request()
    .post('/api/upload')
    .set('Authorization', `Bearer ${VENDOR_TOKEN}`);

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('POST /api/upload: Accepts valid image and returns safe fallback or CDN url', async () => {
  const res = await request()
    .post('/api/upload')
    .set('Authorization', `Bearer ${VENDOR_TOKEN}`)
    .attach('image', PNG_HEADER, 'product.png');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.url);
});

test('POST /api/upload/video: Authentication and role enforcement', async () => {
  // 401 without auth
  const anon = await request()
    .post('/api/upload/video')
    .attach('video', Buffer.from('test video content'), 'test.mp4');
  assert.equal(anon.status, 401);

  // 403 for customer (only vendors and admins can manage video storage)
  const cust = await request()
    .post('/api/upload/video')
    .set('Authorization', `Bearer ${CUSTOMER_TOKEN}`)
    .attach('video', Buffer.from('test video content'), 'test.mp4');
  assert.equal(cust.status, 403);
});

test('POST /api/upload/video: Rejects invalid video formats and missing files', async () => {
  const noFile = await request()
    .post('/api/upload/video')
    .set('Authorization', `Bearer ${VENDOR_TOKEN}`);
  assert.equal(noFile.status, 400);

  const badFormat = await request()
    .post('/api/upload/video')
    .set('Authorization', `Bearer ${VENDOR_TOKEN}`)
    .attach('video', Buffer.from('not a video'), 'test.exe');
  assert.equal(badFormat.status, 400);
  assert.match(badFormat.body.error, /Invalid video format/);
});

test('POST /api/upload/video/delete: Enforces auth and validates publicId', async () => {
  const anon = await request()
    .post('/api/upload/video/delete')
    .send({ publicId: 'test' });
  assert.equal(anon.status, 401);

  const missingId = await request()
    .post('/api/upload/video/delete')
    .set('Authorization', `Bearer ${VENDOR_TOKEN}`)
    .send({});
  assert.equal(missingId.status, 400);
});
