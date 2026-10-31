import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import dns from 'node:dns';

// Prefer IPv4 over IPv6 for external connections to avoid Gmail SMTP IPv6 ETIMEDOUT
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
import { v2 as cloudinary } from 'cloudinary';
import crypto, { randomInt } from 'node:crypto';
import multer from 'multer';
import pool, { initDatabase } from './db.js';
import {
  hashPassword,
  verifyHash,
  isHashed,
  timingSafeEqualStrings,
  passwordMeetsPolicy
} from './utils/passwords.js';
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
  requireCustomer,
  requireCustomerOrAnon,
  requireVendorOrAdmin,
  signToken
} from './middleware/auth.js';
import { authLimiter, registerLimiter, reviewLimiter, paymentLimiter } from './middleware/rateLimit.js';
import { fail, sendDbError, sendInternalError } from './utils/errors.js';
import {
  assertPaisa,
  createCheckoutPayment,
  getOrderStatus,
  mapPhonePeState,
  latestTransactionId,
  validatePhonePeConfig,
  resetTokenCache,
  getFrontendOrigin,
  getPhonePeRedirectUrl,
  getPhonePeCallbackUrl
} from './utils/phonepe.js';
import { validateImageUpload, extractCloudinaryPublicId } from './utils/media.js';

dotenv.config();

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  if (/\s/.test(process.env.CLOUDINARY_CLOUD_NAME)) {
    console.warn(`⚠️ [Cloudinary] WARNING: CLOUDINARY_CLOUD_NAME ("${process.env.CLOUDINARY_CLOUD_NAME}") contains spaces. Cloudinary cloud names must be strictly alphanumeric identifiers without spaces (from Cloudinary dashboard).`);
  } else {
    console.log(`✅ Cloudinary configured (cloud: ${process.env.CLOUDINARY_CLOUD_NAME})`);
  }
} else {
  console.warn('⚠️ Cloudinary not configured — uploads will fall back to inline data URIs.');
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB maximum file size
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB maximum video size
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Friendly root so opening http://localhost:5000/ doesn't return "Cannot GET /".
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'EcShopping API',
    message: 'API is running. Use the /api/* endpoints.',
    health: '/api/health',
    endpoints: {
      vendors: '/api/vendors',
      products: '/api/products',
      orders: '/api/orders',
      reviews: '/api/reviews',
      categories: '/api/categories'
    }
  });
});

// Initialize TiDB Cloud Database tables and hydrate runtime platform settings
initDatabase()
  .then(async () => {
    try {
      const [rows] = await pool.query('SELECT setting_key, setting_value FROM platform_settings');
      for (const { setting_key, setting_value } of rows) {
        if (setting_value !== null && setting_value !== undefined && setting_value !== '') {
          process.env[setting_key] = setting_value;
        }
      }
      if (rows.length > 0) {
        console.log(`✅ Loaded ${rows.length} platform setting(s) from database`);
      }
    } catch {
      /* platform_settings table will be created if not exists */
    }
  })
  .catch((err) => console.error('Error hydrating platform settings:', err.message));

// Centralized Admin Email Service
import {
  transporter,
  escapeHtml,
  getAdminSender,
  getAdminNotificationRecipient,
  getSupportReplyTo,
  getFrontendUrl,
  sendAdminEmail,
  sendCustomerWelcomeEmail,
  sendVendorWelcomeEmail,
  sendCustomerVerificationEmail,
  sendVendorVerificationEmail,
  sendResendVerificationEmail,
  sendPasswordResetEmail,
  maskEmail,
  sendVendorProductSubmissionNotification,
  sendProductApprovalStatusEmail,
  sendOrderConfirmationEmail,
  sendPaymentStatusEmail,
  sendOrderFulfillmentStatusEmail,
  sendOrderCancellationEmail,
  sendVendorAccountStatusEmail
} from './services/emailService.js';

export {
  transporter,
  escapeHtml,
  getAdminSender,
  getAdminNotificationRecipient,
  getSupportReplyTo,
  sendCustomerWelcomeEmail,
  sendVendorWelcomeEmail,
  sendCustomerVerificationEmail,
  sendVendorVerificationEmail,
  sendResendVerificationEmail,
  sendPasswordResetEmail,
  maskEmail,
  sendVendorProductSubmissionNotification,
  sendProductApprovalStatusEmail,
  sendOrderConfirmationEmail,
  sendPaymentStatusEmail,
  sendOrderFulfillmentStatusEmail,
  sendOrderCancellationEmail,
  sendVendorAccountStatusEmail
};

// Aliases for compatibility
export const sendVerificationEmail = sendResendVerificationEmail;
export const sendVendorStatusNotificationEmail = sendVendorAccountStatusEmail;
export const sendProductStatusNotificationEmail = sendProductApprovalStatusEmail;

// Cloudinary Image Upload Endpoint (sellers/admins only)
app.post('/api/upload', requireVendorOrAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }

    // Server-side magic-byte sniffing format validation and size check
    const validation = validateImageUpload(req.file.buffer);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    // Check if Cloudinary credentials are configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      // Fallback data URI for smooth development until user adds keys
      const base64 = req.file.buffer.toString('base64');
      const dataUri = `data:${validation.mimeType};base64,${base64}`;
      return res.status(200).json({
        success: true,
        url: dataUri,
        isFallback: true,
        notice: 'Cloudinary credentials missing in .env. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in server/.env'
      });
    }

    // Upload buffer directly to Cloudinary
    const uploadPromise = new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'ecshopping_products',
          resource_type: 'image'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const result = await uploadPromise;
    console.log(`✅ [Cloudinary] Image uploaded successfully: ${result.secure_url}`);
    return res.status(200).json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id
    });
  } catch (err) {
    console.error('❌ Cloudinary upload error:', err?.message || err);
    // If Cloudinary rejected the upload due to invalid credentials, invalid cloud name, or gateway issue,
    // fall back cleanly to a local data URI with an explicit warning rather than hard-crashing product workflows.
    const isCloudinaryAuthOrConfig =
      err?.http_code === 401 ||
      err?.http_code === 400 ||
      err?.message?.includes('cloud_name') ||
      err?.message?.includes('Must supply');

    if (isCloudinaryAuthOrConfig && req.file?.buffer) {
      const validation = validateImageUpload(req.file.buffer);
      const mime = validation.ok ? validation.mimeType : 'image/jpeg';
      const base64 = req.file.buffer.toString('base64');
      const dataUri = `data:${mime};base64,${base64}`;
      return res.status(200).json({
        success: true,
        url: dataUri,
        isFallback: true,
        notice: `Cloudinary upload failed (${err?.message || 'invalid configuration'}). Stored image locally as fallback data URI.`
      });
    }

    return res.status(500).json({ success: false, error: 'Image upload failed. Please try again.' });
  }
});

// Cloudinary Video Upload Endpoint (sellers/admins only)
app.post(
  '/api/upload/video',
  requireVendorOrAdmin,
  (req, res, next) => {
    videoUpload.single('video')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: 'Video file exceeds the 50MB size limit. Please upload a smaller video or provide a YouTube URL.'
          });
        }
        return res.status(400).json({
          success: false,
          error: `Video upload error: ${err.message}`
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ success: false, error: 'No video file uploaded' });
      }

      const mime = req.file.mimetype || '';
      const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg', 'video/x-msvideo'];
      const ext = (req.file.originalname || '').split('.').pop().toLowerCase();
      const allowedExts = ['mp4', 'webm', 'mov', 'ogg', 'avi', 'm4v'];

      if (!allowedMimes.includes(mime) && !allowedExts.includes(ext)) {
        return res.status(400).json({
          success: false,
          error: `Invalid video format (.${ext || 'unknown'}). Supported formats: MP4, WebM, MOV, OGG, AVI.`
        });
      }

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!cloudName || !apiKey || !apiSecret) {
        return res.status(503).json({
          success: false,
          error: 'Cloudinary credentials are not configured on the server. Please provide a video URL instead.'
        });
      }

      if (/\s/.test(cloudName)) {
        return res.status(502).json({
          success: false,
          error: `Cloudinary rejected credentials: Invalid cloud_name "${cloudName}". Cloud names cannot contain spaces. Please check your Cloudinary configuration in server environment.`
        });
      }

      const uploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'ecshopping/products/videos',
            resource_type: 'video'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.on('error', reject);
        stream.end(req.file.buffer);
      });

      const result = await uploadPromise;
      console.log(`🎬 [Cloudinary] Video uploaded: ${result.secure_url}`);
      return res.status(200).json({
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        public_id: result.public_id,
        format: result.format,
        duration: result.duration,
        bytes: result.bytes
      });
    } catch (err) {
      console.error('❌ Video upload error:', err?.message || err);

      const msg = err?.message || '';

      if (
        err?.http_code === 401 ||
        msg.includes('cloud_name') ||
        msg.includes('Invalid cloud_name') ||
        msg.includes('mismatch') ||
        msg.includes('Must supply')
      ) {
        return res.status(502).json({
          success: false,
          error: `Cloudinary authentication failed: ${msg || 'Cloud name or API credentials rejected by Cloudinary CDN'}. Please verify Cloudinary credentials in server environment.`
        });
      }

      if (err?.http_code === 400) {
        return res.status(400).json({
          success: false,
          error: `Cloudinary video rejection: ${msg || 'Unsupported video encoding or corrupted file'}.`
        });
      }

      if (err?.code === 'ETIMEDOUT' || err?.code === 'ECONNRESET' || msg.includes('timeout')) {
        return res.status(504).json({
          success: false,
          error: 'Cloudinary connection timed out. Please check your network and try again.'
        });
      }

      return res.status(500).json({
        success: false,
        error: `Failed to upload video to Cloudinary: ${msg || 'Unknown error'}. Please provide a YouTube / video URL if upload persists failing.`
      });
    }
  }
);

// Cloudinary Video Removal / Deletion Endpoint (sellers/admins only)
app.post('/api/upload/video/delete', requireVendorOrAdmin, async (req, res) => {
  try {
    const { publicId, public_id } = req.body || {};
    const pid = publicId || public_id;
    if (!pid) {
      return res.status(400).json({ success: false, error: 'publicId is required' });
    }
    if (cloudinary?.uploader?.destroy) {
      await cloudinary.uploader.destroy(pid, { resource_type: 'video' });
    }
    return res.status(200).json({ success: true, message: 'Video removed from Cloudinary storage' });
  } catch (err) {
    console.error('❌ Video removal error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to remove video from Cloudinary' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT 1 as connected');
    res.json({
      status: 'online',
      database: 'TiDB Cloud MySQL connected',
      dbName: process.env.DB_NAME || 'ecshopping',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Health check DB error:', err);
    res.status(500).json({ status: 'error', database: 'unavailable' });
  }
});

// ================= USER AUTHENTICATION (TiDB Cloud) =================

// User Register
app.post('/api/auth/user/register', registerLimiter, async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
  }

  if (!passwordMeetsPolicy(password)) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
  }

  try {
    // Check if email already exists in TiDB
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Email is already registered' });
    }

    const userId = 'c' + Date.now();
    const cleanPhone = phone ? phone.trim() : '';
    const passwordHash = await hashPassword(password);

    // Legacy `password` column is never filled with real credentials.
    await pool.query(
      'INSERT INTO users (id, name, email, password, password_hash, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name.trim(), email.trim().toLowerCase(), '', passwordHash, cleanPhone]
    );

    const token = signToken({ sub: userId, role: 'customer', email: email.trim().toLowerCase(), name: name.trim() });
    const newUser = {
      id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: cleanPhone
    };

    // Generate email verification token and dispatch welcome/verification email
    const rawVerToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawVerToken).digest('hex');
    const verId = 'ev_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    try {
      await pool.query(
        'INSERT INTO email_verifications (id, email, role, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
        [verId, newUser.email, 'customer', tokenHash, expiresAt]
      );
      await sendVerificationEmail({ email: newUser.email, role: 'customer', userName: newUser.name, rawToken: rawVerToken });
    } catch (err) {
      console.error('⚠️ Customer verification email setup error:', err.message);
    }

    console.log(`✅ [TiDB] User registered: ${newUser.name} (${newUser.email})`);
    return res.status(201).json({ success: true, user: newUser, token });
  } catch (err) {
    console.error('❌ User register DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to create the account right now. Please try again.' });
  }
});

// User Login
app.post('/api/auth/user/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, password, password_hash, created_at FROM users WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );

    if (rows.length === 0) {
      // Check if user exists as a vendor or admin to give a clear, helpful message
      try {
        const [vendorMatch] = await pool.query('SELECT id FROM vendors WHERE LOWER(email) = LOWER(?)', [email.trim()]);
        if (vendorMatch.length > 0) {
          return res.status(401).json({
            success: false,
            error: 'No customer account found with this email. This email is registered as a seller account — please use the Seller Login tab.'
          });
        }
      } catch {}
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const user = rows[0];

    // Prefer the bcrypt hash; support bcrypt hash in legacy password column; legacy plaintext rows upgrade on success.
    let authenticated = await verifyHash(password, user.password_hash);
    if (!authenticated && user.password) {
      if (isHashed(user.password)) {
        authenticated = await verifyHash(password, user.password);
        if (authenticated) {
          await pool.query('UPDATE users SET password_hash = ?, password = "" WHERE id = ?', [
            user.password,
            user.id
          ]);
        }
      } else if (timingSafeEqualStrings(password, user.password)) {
        authenticated = true;
        await pool.query('UPDATE users SET password_hash = ?, password = "" WHERE id = ?', [
          await hashPassword(password),
          user.id
        ]);
      }
    }

    if (!authenticated) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = signToken({ sub: user.id, role: 'customer', email: user.email, name: user.name });
    console.log(`✅ [TiDB] User logged in: ${user.name} (${user.email})`);
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.created_at
      },
      token
    });
  } catch (err) {
    console.error('❌ User login DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to process the login right now. Please try again.' });
  }
});

// ================= CUSTOMER PROFILE & ADDRESS MANAGEMENT =================

// Get customer profile and saved addresses
app.get('/api/user/profile', requireCustomer, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, created_at AS createdAt FROM users WHERE id = ?',
      [req.auth.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const [addresses] = await pool.query(
      `SELECT id, user_id AS userId, name, phone, street, city, state, postcode, country,
              is_default AS isDefault, created_at AS createdAt
       FROM customer_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
      [req.auth.id]
    );
    return res.status(200).json({
      success: true,
      user: {
        ...rows[0],
        addresses: addresses.map((a) => ({ ...a, isDefault: Boolean(a.isDefault) }))
      }
    });
  } catch (err) {
    console.error('❌ Get user profile DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load profile' });
  }
});

// Update customer profile (name, phone)
app.put('/api/user/profile', requireCustomer, async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'Name is required' });
  }
  const cleanName = String(name).trim();
  const cleanPhone = phone ? String(phone).trim() : '';

  try {
    await pool.query(
      'UPDATE users SET name = ?, phone = ? WHERE id = ?',
      [cleanName, cleanPhone, req.auth.id]
    );
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, created_at AS createdAt FROM users WHERE id = ?',
      [req.auth.id]
    );
    return res.status(200).json({
      success: true,
      user: rows[0],
      message: 'Profile updated successfully'
    });
  } catch (err) {
    console.error('❌ Update user profile DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to update profile' });
  }
});

// Update customer password
app.put('/api/user/password', requireCustomer, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Current password and new password are required' });
  }
  if (!passwordMeetsPolicy(newPassword)) {
    return res.status(400).json({ success: false, error: 'New password must be at least 8 characters long' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, password, password_hash FROM users WHERE id = ?',
      [req.auth.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const user = rows[0];
    let authenticated = await verifyHash(currentPassword, user.password_hash);
    if (!authenticated && !isHashed(user.password) && user.password) {
      authenticated = timingSafeEqualStrings(currentPassword, user.password);
    }
    if (!authenticated) {
      return res.status(401).json({ success: false, error: 'Incorrect current password' });
    }

    const newHash = await hashPassword(newPassword);
    await pool.query(
      'UPDATE users SET password_hash = ?, password = "" WHERE id = ?',
      [newHash, req.auth.id]
    );
    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('❌ Update password DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to update password' });
  }
});

// List saved customer addresses
app.get('/api/user/addresses', requireCustomer, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, user_id AS userId, name, phone, street, city, state, postcode, country,
              is_default AS isDefault, created_at AS createdAt
       FROM customer_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
      [req.auth.id]
    );
    return res.status(200).json({
      success: true,
      addresses: rows.map((r) => ({ ...r, isDefault: Boolean(r.isDefault) }))
    });
  } catch (err) {
    console.error('❌ Get user addresses DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load addresses' });
  }
});

// Add a new address
app.post('/api/user/addresses', requireCustomer, async (req, res) => {
  const { name, phone, street, city, state, postcode, country = 'India', isDefault } = req.body || {};
  if (!name || !street || !city || !state || !postcode) {
    return res.status(400).json({ success: false, error: 'Name, street, city, state, and PIN code are required' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT id FROM customer_addresses WHERE user_id = ?',
      [req.auth.id]
    );
    const shouldBeDefault = Boolean(isDefault) || existing.length === 0;

    if (shouldBeDefault) {
      await pool.query('UPDATE customer_addresses SET is_default = FALSE WHERE user_id = ?', [req.auth.id]);
    }

    const addrId = 'addr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    await pool.query(
      `INSERT INTO customer_addresses (id, user_id, name, phone, street, city, state, postcode, country, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        addrId,
        req.auth.id,
        String(name).trim(),
        phone ? String(phone).trim() : '',
        String(street).trim(),
        String(city).trim(),
        String(state).trim(),
        String(postcode).trim(),
        String(country || 'India').trim(),
        shouldBeDefault ? 1 : 0
      ]
    );

    const [created] = await pool.query(
      `SELECT id, user_id AS userId, name, phone, street, city, state, postcode, country,
              is_default AS isDefault, created_at AS createdAt
       FROM customer_addresses WHERE id = ?`,
      [addrId]
    );

    return res.status(201).json({
      success: true,
      address: { ...created[0], isDefault: Boolean(created[0].isDefault) }
    });
  } catch (err) {
    console.error('❌ Create user address DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to add address' });
  }
});

// Update an address
app.put('/api/user/addresses/:id', requireCustomer, async (req, res) => {
  const { id } = req.params;
  const { name, phone, street, city, state, postcode, country = 'India', isDefault } = req.body || {};

  if (!name || !street || !city || !state || !postcode) {
    return res.status(400).json({ success: false, error: 'Name, street, city, state, and PIN code are required' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT id, is_default FROM customer_addresses WHERE id = ? AND user_id = ?',
      [id, req.auth.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }

    const makeDefault = Boolean(isDefault);
    if (makeDefault) {
      await pool.query('UPDATE customer_addresses SET is_default = FALSE WHERE user_id = ?', [req.auth.id]);
    }

    await pool.query(
      `UPDATE customer_addresses
       SET name = ?, phone = ?, street = ?, city = ?, state = ?, postcode = ?, country = ?, is_default = ?
       WHERE id = ? AND user_id = ?`,
      [
        String(name).trim(),
        phone ? String(phone).trim() : '',
        String(street).trim(),
        String(city).trim(),
        String(state).trim(),
        String(postcode).trim(),
        String(country || 'India').trim(),
        makeDefault ? 1 : (existing[0].is_default ? 1 : 0),
        id,
        req.auth.id
      ]
    );

    const [updated] = await pool.query(
      `SELECT id, user_id AS userId, name, phone, street, city, state, postcode, country,
              is_default AS isDefault, created_at AS createdAt
       FROM customer_addresses WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      address: { ...updated[0], isDefault: Boolean(updated[0].isDefault) }
    });
  } catch (err) {
    console.error('❌ Update user address DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to update address' });
  }
});

// Delete an address
app.delete('/api/user/addresses/:id', requireCustomer, async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await pool.query(
      'SELECT id, is_default FROM customer_addresses WHERE id = ? AND user_id = ?',
      [id, req.auth.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }

    const wasDefault = Boolean(existing[0].is_default);
    await pool.query('DELETE FROM customer_addresses WHERE id = ? AND user_id = ?', [id, req.auth.id]);

    if (wasDefault) {
      const [remaining] = await pool.query(
        'SELECT id FROM customer_addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [req.auth.id]
      );
      if (remaining.length > 0) {
        await pool.query('UPDATE customer_addresses SET is_default = TRUE WHERE id = ?', [remaining[0].id]);
      }
    }

    return res.status(200).json({ success: true, message: 'Address removed successfully' });
  } catch (err) {
    console.error('❌ Delete user address DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to delete address' });
  }
});

// Set address as default
app.put('/api/user/addresses/:id/default', requireCustomer, async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await pool.query(
      'SELECT id FROM customer_addresses WHERE id = ? AND user_id = ?',
      [id, req.auth.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }

    await pool.query('UPDATE customer_addresses SET is_default = FALSE WHERE user_id = ?', [req.auth.id]);
    await pool.query('UPDATE customer_addresses SET is_default = TRUE WHERE id = ? AND user_id = ?', [id, req.auth.id]);

    return res.status(200).json({ success: true, message: 'Default address updated successfully' });
  } catch (err) {
    console.error('❌ Set default address DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to set default address' });
  }
});

// ================= VENDOR AUTHENTICATION (TiDB Cloud) =================

// Vendor Register
app.post('/api/auth/vendor/register', registerLimiter, async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
  }

  if (!passwordMeetsPolicy(password)) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
  }

  try {
    // Check if email already registered as vendor
    const [existing] = await pool.query(
      'SELECT id FROM vendors WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Email is already registered as seller' });
    }

    const vendorId = 'v' + Date.now();
    const cleanPhone = phone ? phone.trim() : '';
    const passwordHash = await hashPassword(password);

    // Legacy `password` column is never filled with real credentials.
    await pool.query(
      'INSERT INTO vendors (id, name, email, password, password_hash, phone, status, direct_selling) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [vendorId, name.trim(), email.trim().toLowerCase(), '', passwordHash, cleanPhone, 'pending', 0]
    );

    const newVendor = {
      id: vendorId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: cleanPhone,
      status: 'pending',
      directSelling: false
    };

    // Generate email verification token and dispatch welcome/verification email
    const rawVerToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawVerToken).digest('hex');
    const verId = 'ev_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    try {
      await pool.query(
        'INSERT INTO email_verifications (id, email, role, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
        [verId, newVendor.email, 'vendor', tokenHash, expiresAt]
      );
      await sendVerificationEmail({ email: newVendor.email, role: 'vendor', userName: newVendor.name, rawToken: rawVerToken });
    } catch (err) {
      console.error('⚠️ Vendor verification email setup error:', err.message);
    }

    console.log(`✅ [TiDB] Vendor registered (pending approval): ${newVendor.name} (${newVendor.email})`);
    return res.status(201).json({ success: true, vendor: newVendor });
  } catch (err) {
    console.error('❌ Vendor register DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to create the seller account right now. Please try again.' });
  }
});

// Vendor Login
app.post('/api/auth/vendor/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, status, direct_selling, password, password_hash, created_at FROM vendors WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );

    if (rows.length === 0) {
      // Check if user exists as a customer or admin to give a clear, helpful message
      try {
        const [customerMatch] = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
        if (customerMatch.length > 0) {
          return res.status(401).json({
            success: false,
            error: 'No seller account found with this email. This email is registered as a customer account — please use the Customer Login tab.'
          });
        }
      } catch {}
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const vendor = rows[0];

    // Prefer the bcrypt hash; support bcrypt hash in legacy password column; legacy plaintext rows upgrade on success.
    let authenticated = await verifyHash(password, vendor.password_hash);
    if (!authenticated && vendor.password) {
      if (isHashed(vendor.password)) {
        authenticated = await verifyHash(password, vendor.password);
        if (authenticated) {
          await pool.query('UPDATE vendors SET password_hash = ?, password = "" WHERE id = ?', [
            vendor.password,
            vendor.id
          ]);
        }
      } else if (timingSafeEqualStrings(password, vendor.password)) {
        authenticated = true;
        await pool.query('UPDATE vendors SET password_hash = ?, password = "" WHERE id = ?', [
          await hashPassword(password),
          vendor.id
        ]);
      }
    }

    if (!authenticated) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    if (vendor.status === 'pending') {
      return res.status(403).json({ success: false, error: 'Your account is pending admin approval' });
    }

    if (vendor.status === 'rejected') {
      return res.status(403).json({ success: false, error: 'Your seller account has been rejected' });
    }

    if (vendor.status === 'deactivated' || vendor.status === 'suspended') {
      return res.status(403).json({ success: false, error: 'Your seller account has been deactivated. Please contact support.' });
    }

    const token = signToken({ sub: vendor.id, role: 'vendor', email: vendor.email, name: vendor.name });
    console.log(`✅ [TiDB] Vendor logged in: ${vendor.name} (${vendor.email})`);
    return res.status(200).json({
      success: true,
      vendor: {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        status: vendor.status,
        directSelling: Boolean(vendor.direct_selling),
        createdAt: vendor.created_at
      },
      token
    });
  } catch (err) {
    console.error('❌ Vendor login DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to process the login right now. Please try again.' });
  }
});

// Admin Login (credentials live in the `admins` table, bootstrapped via scripts/create-admin.js)
app.post('/api/auth/admin/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, email, password_hash FROM admins WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const admin = rows[0];
    const authenticated = await verifyHash(password, admin.password_hash);
    if (!authenticated) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = signToken({ sub: admin.id, role: 'admin', email: admin.email, name: 'Administrator' });
    console.log(`✅ [TiDB] Admin logged in: ${admin.email}`);
    return res.status(200).json({
      success: true,
      user: { id: admin.id, email: admin.email, role: 'admin' },
      token
    });
  } catch (err) {
    console.error('❌ Admin login DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to process the login right now. Please try again.' });
  }
});

// Session verification endpoint — verifies current token & returns session info
app.post('/api/auth/verify', requireAuth(), (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.auth
  });
});

// Session logout endpoint
app.post('/api/auth/logout', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Session terminated'
  });
});

// ================= PASSWORD RESET FLOWS (TiDB Cloud) =================

// 1. Request password reset (Forgot Password)
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  const { email, role } = req.body || {};

  const cleanEmail = String(email || '').trim().toLowerCase();
  const inputRole = String(role || '').trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return res.status(400).json({
      success: false,
      error: 'A valid email address is required'
    });
  }

  // Consistent message returned for all cases to prevent account enumeration
  const standardMessage = 'If an account exists with that email, a password reset link has been sent.';

  try {
    const findCustomer = async () => {
      const [rows] = await pool.query('SELECT id, name FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      if (rows.length > 0) return { exists: true, name: rows[0].name || 'Customer' };
      return { exists: false };
    };

    const findVendor = async () => {
      const [rows] = await pool.query('SELECT id, name FROM vendors WHERE LOWER(email) = ?', [cleanEmail]);
      if (rows.length > 0) return { exists: true, name: rows[0].name || 'Seller' };
      return { exists: false };
    };

    const findAdmin = async () => {
      const [rows] = await pool.query('SELECT id FROM admins WHERE LOWER(email) = ?', [cleanEmail]);
      if (rows.length > 0) return { exists: true, name: 'Administrator' };
      return { exists: false };
    };

    const customer = await findCustomer();
    const vendor = await findVendor();
    const admin = await findAdmin();

    let accountExists = false;
    let userName = '';
    let resolvedRole = '';

    // Direct role match preference
    if (inputRole === 'customer' && customer.exists) {
      accountExists = true; userName = customer.name; resolvedRole = 'customer';
    } else if (inputRole === 'vendor' && vendor.exists) {
      accountExists = true; userName = vendor.name; resolvedRole = 'vendor';
    } else if (inputRole === 'admin' && admin.exists) {
      accountExists = true; userName = admin.name; resolvedRole = 'admin';
    } else {
      // Prioritized cross-role fallback
      if (inputRole === 'admin') {
        if (vendor.exists) { accountExists = true; userName = vendor.name; resolvedRole = 'vendor'; }
        else if (customer.exists) { accountExists = true; userName = customer.name; resolvedRole = 'customer'; }
      } else if (inputRole === 'vendor') {
        if (customer.exists) { accountExists = true; userName = customer.name; resolvedRole = 'customer'; }
        else if (admin.exists) { accountExists = true; userName = admin.name; resolvedRole = 'admin'; }
      } else {
        // Customer or auto-detect
        if (customer.exists) { accountExists = true; userName = customer.name; resolvedRole = 'customer'; }
        else if (vendor.exists) { accountExists = true; userName = vendor.name; resolvedRole = 'vendor'; }
        else if (admin.exists) { accountExists = true; userName = admin.name; resolvedRole = 'admin'; }
      }
    }

    if (!accountExists || !resolvedRole) {
      console.log(`ℹ️ [Forgot-Password] Account not found for ${maskEmail(cleanEmail)} (requested role: ${inputRole || 'auto'})`);
      return res.status(200).json({
        success: true,
        message: standardMessage
      });
    }

    console.log(`ℹ️ [Forgot-Password] Account identified for ${maskEmail(cleanEmail)} as role: ${resolvedRole}`);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const resetId = 'pr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Record new reset token
    await pool.query(
      'INSERT INTO password_resets (id, email, role, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
      [resetId, cleanEmail, resolvedRole, tokenHash, expiresAt]
    );

    // Dispatch centralized reset email (From: EcShopping Admin)
    const emailResult = await sendPasswordResetEmail({
      email: cleanEmail,
      name: userName,
      role: resolvedRole,
      rawToken
    });

    if (!emailResult || !emailResult.success) {
      // Roll back un-delivered reset token to avoid leaving an unusable flow
      try {
        await pool.query('DELETE FROM password_resets WHERE id = ?', [resetId]);
      } catch {}
      console.error(`❌ [Forgot-Password] Delivery failure to ${maskEmail(cleanEmail)} (${resolvedRole}):`, emailResult?.error || 'Unknown dispatch error');
      return res.status(503).json({
        success: false,
        error: 'Email delivery service is currently unavailable. Please try again later or contact support.'
      });
    }

    // Email delivery succeeded: invalidate any older active tokens for this email and role
    await pool.query(
      'UPDATE password_resets SET used_at = NOW() WHERE LOWER(email) = ? AND role = ? AND id != ? AND used_at IS NULL',
      [cleanEmail, resolvedRole, resetId]
    );

    console.log(`✅ [Forgot-Password] Reset email successfully accepted by SMTP server for ${maskEmail(cleanEmail)} (${resolvedRole}) | MsgId: ${emailResult.messageId || 'N/A'}`);
    return res.status(200).json({
      success: true,
      message: standardMessage
    });
  } catch (err) {
    console.error('❌ Forgot password error:', err);
    return res.status(500).json({
      success: false,
      error: 'Unable to process your request right now. Please try again later.'
    });
  }
});

// 2. Verify password reset token
app.post('/api/auth/verify-reset-token', authLimiter, async (req, res) => {
  const { token, role } = req.body || {};

  const cleanToken = String(token || '').trim();
  const cleanRole = String(role || '').trim().toLowerCase();

  if (!cleanToken) {
    return res.status(400).json({
      success: false,
      valid: false,
      error: 'Token is required'
    });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');
    const [rows] = await pool.query(
      'SELECT id, email, role, expires_at, used_at FROM password_resets WHERE token_hash = ?',
      [tokenHash]
    );

    if (rows.length === 0 || rows[0].used_at !== null) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'Invalid or already used password reset link'
      });
    }

    const resetRecord = rows[0];
    if (new Date(resetRecord.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'Password reset link has expired. Please request a new one.'
      });
    }

    if (cleanRole && cleanRole !== resetRecord.role) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'Invalid role for this password reset link'
      });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      email: resetRecord.email,
      role: resetRecord.role
    });
  } catch (err) {
    console.error('❌ Verify reset token error:', err);
    return res.status(500).json({
      success: false,
      valid: false,
      error: 'Unable to verify reset token'
    });
  }
});

// 3. Complete password reset
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  const { token, role, newPassword } = req.body || {};

  const cleanToken = String(token || '').trim();
  const cleanRole = String(role || '').trim().toLowerCase();

  if (!cleanToken || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Token and new password are required'
    });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');
    const [rows] = await pool.query(
      'SELECT id, email, role, expires_at, used_at FROM password_resets WHERE token_hash = ?',
      [tokenHash]
    );

    if (rows.length === 0 || rows[0].used_at !== null) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or already used password reset link'
      });
    }

    const resetRecord = rows[0];
    if (new Date(resetRecord.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Password reset link has expired. Please request a new one.'
      });
    }

    if (cleanRole && cleanRole !== resetRecord.role) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role for this password reset link'
      });
    }

    // Authoritative role stored on token
    const targetRole = resetRecord.role;
    const minLength = targetRole === 'admin' ? 12 : 8;

    if (!passwordMeetsPolicy(newPassword, minLength)) {
      return res.status(400).json({
        success: false,
        error: targetRole === 'admin'
          ? 'Admin password must be at least 12 characters long'
          : 'Password must be at least 8 characters long'
      });
    }

    // Hash the new password with bcrypt
    const passwordHash = await hashPassword(newPassword);

    let updatedRows = 0;
    // Update password in the target role table
    if (targetRole === 'customer') {
      const [result] = await pool.query(
        'UPDATE users SET password_hash = ?, password = "" WHERE LOWER(email) = LOWER(?)',
        [passwordHash, resetRecord.email]
      );
      updatedRows = result.affectedRows;
    } else if (targetRole === 'vendor') {
      const [result] = await pool.query(
        'UPDATE vendors SET password_hash = ?, password = "" WHERE LOWER(email) = LOWER(?)',
        [passwordHash, resetRecord.email]
      );
      updatedRows = result.affectedRows;
    } else if (targetRole === 'admin') {
      const [result] = await pool.query(
        'UPDATE admins SET password_hash = ? WHERE LOWER(email) = LOWER(?)',
        [passwordHash, resetRecord.email]
      );
      updatedRows = result.affectedRows;
    }

    if (updatedRows === 0) {
      console.error(`❌ [Reset-Password] No database rows updated for ${maskEmail(resetRecord.email)} in role ${targetRole}`);
      return res.status(500).json({
        success: false,
        error: 'Unable to update password for this account. Please request a new reset link.'
      });
    }

    // Invalidate this token and all other outstanding tokens for this email and role
    await pool.query(
      'UPDATE password_resets SET used_at = NOW() WHERE LOWER(email) = ? AND role = ? AND used_at IS NULL',
      [resetRecord.email, targetRole]
    );

    console.log(`✅ [Reset-Password] Password updated successfully for ${maskEmail(resetRecord.email)} (${targetRole})`);
    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (err) {
    console.error('❌ Reset password error:', err);
    return res.status(500).json({
      success: false,
      error: 'Unable to reset password right now. Please try again later.'
    });
  }
});

// ================= EMAIL VERIFICATION FLOWS (TiDB Cloud) =================

// 1. Verify email address using token
app.post('/api/auth/verify-email', authLimiter, async (req, res) => {
  const { token, role } = req.body || {};
  const cleanToken = String(token || '').trim();
  const cleanRole = String(role || '').trim().toLowerCase();

  if (!cleanToken) {
    return res.status(400).json({ success: false, error: 'Verification token is required' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');
    let query = 'SELECT id, email, role, expires_at, verified_at FROM email_verifications WHERE token_hash = ?';
    const params = [tokenHash];
    if (cleanRole) {
      query += ' AND role = ?';
      params.push(cleanRole);
    }
    const [rows] = await pool.query(query, params);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid verification token or link' });
    }

    const record = rows[0];

    if (record.verified_at !== null) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'Email address has already been verified.',
        email: record.email,
        role: record.role
      });
    }

    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        expired: true,
        error: 'Verification link has expired. Please request a new verification email.'
      });
    }

    // Mark as verified
    await pool.query('UPDATE email_verifications SET verified_at = NOW() WHERE id = ?', [record.id]);
    console.log(`✅ [TiDB] Email verified for ${record.email} (${record.role})`);

    return res.status(200).json({
      success: true,
      message: 'Your email address has been verified successfully! You can now log in.',
      email: record.email,
      role: record.role
    });
  } catch (err) {
    console.error('❌ Verify email error:', err);
    return res.status(500).json({ success: false, error: 'Unable to verify email address right now. Please try again.' });
  }
});

// 2. Resend email verification link
app.post('/api/auth/resend-verification', authLimiter, async (req, res) => {
  const { email, role } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  let cleanRole = String(role || '').trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'A valid email address is required' });
  }

  const standardResponse = {
    success: true,
    message: 'If an account exists with that email address, a fresh verification link has been sent.'
  };

  try {
    // Cooldown check: prevent requesting more than once per minute
    const [recent] = await pool.query(
      'SELECT id, created_at FROM email_verifications WHERE LOWER(email) = ? AND created_at > (NOW() - INTERVAL 1 MINUTE)',
      [cleanEmail]
    );
    if (recent.length > 0) {
      return res.status(429).json({
        success: false,
        error: 'Please wait a minute before requesting another verification email.'
      });
    }

    // Verify account exists
    let accountExists = false;
    let userName = '';
    let resolvedRole = cleanRole;

    if (cleanRole === 'vendor') {
      const [vRows] = await pool.query('SELECT id, name FROM vendors WHERE LOWER(email) = ?', [cleanEmail]);
      if (vRows.length > 0) {
        accountExists = true;
        userName = vRows[0].name;
        resolvedRole = 'vendor';
      }
    } else if (cleanRole === 'customer') {
      const [uRows] = await pool.query('SELECT id, name FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      if (uRows.length > 0) {
        accountExists = true;
        userName = uRows[0].name;
        resolvedRole = 'customer';
      }
    } else {
      // Auto-detect: check vendor then user
      const [vRows] = await pool.query('SELECT id, name FROM vendors WHERE LOWER(email) = ?', [cleanEmail]);
      if (vRows.length > 0) {
        accountExists = true;
        userName = vRows[0].name;
        resolvedRole = 'vendor';
      } else {
        const [uRows] = await pool.query('SELECT id, name FROM users WHERE LOWER(email) = ?', [cleanEmail]);
        if (uRows.length > 0) {
          accountExists = true;
          userName = uRows[0].name;
          resolvedRole = 'customer';
        }
      }
    }

    if (!accountExists) {
      return res.status(200).json(standardResponse);
    }

    // Check if already verified
    const [alreadyVer] = await pool.query(
      'SELECT id FROM email_verifications WHERE LOWER(email) = ? AND role = ? AND verified_at IS NOT NULL LIMIT 1',
      [cleanEmail, resolvedRole]
    );
    if (alreadyVer.length > 0) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'This email address is already verified. You can log in.'
      });
    }

    // Invalidate existing active tokens
    await pool.query(
      'UPDATE email_verifications SET expires_at = NOW() WHERE LOWER(email) = ? AND role = ? AND verified_at IS NULL',
      [cleanEmail, resolvedRole]
    );

    // Create fresh token
    const rawVerToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawVerToken).digest('hex');
    const verId = 'ev_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO email_verifications (id, email, role, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
      [verId, cleanEmail, resolvedRole, tokenHash, expiresAt]
    );

    await sendVerificationEmail({
      email: cleanEmail,
      role: resolvedRole,
      userName: userName || (resolvedRole === 'vendor' ? 'Seller' : 'Customer'),
      rawToken: rawVerToken,
      isResend: true
    });

    return res.status(200).json({
      success: true,
      message: 'A fresh email verification link has been sent to your inbox.'
    });
  } catch (err) {
    console.error('❌ Resend verification error:', err);
    return res.status(500).json({ success: false, error: 'Unable to resend verification email right now. Please try again.' });
  }
});

// List vendors (admin) — password intentionally omitted
app.get('/api/vendors', requireAdmin, async (req, res) => {
  const { status } = req.query;
  try {
    let query = 'SELECT id, name, email, phone, status, direct_selling AS directSelling, created_at AS createdAt FROM vendors';
    const params = [];
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);
    const vendors = rows.map((v) => ({ ...v, directSelling: Boolean(v.directSelling) }));
    return res.status(200).json({ success: true, vendors });
  } catch (err) {
    console.error('❌ Get vendors DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load vendors right now. Please try again.' });
  }
});

// Get a single vendor by id (admin only)
app.get('/api/vendors/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, status, direct_selling AS directSelling, created_at AS createdAt FROM vendors WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }
    const vendor = { ...rows[0], directSelling: Boolean(rows[0].directSelling) };
    return res.status(200).json({ success: true, vendor });
  } catch (err) {
    console.error('Get vendor DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load the vendor right now. Please try again.' });
  }
});


// Approve / reject / reset / deactivate a vendor (admin)
app.put('/api/vendors/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'approved', 'rejected', 'deactivated', 'suspended'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid vendor status' });
  }

  try {
    const [vRows] = await pool.query('SELECT id, name, email, status FROM vendors WHERE id = ?', [id]);
    if (vRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }
    const vendor = vRows[0];

    const [result] = await pool.query('UPDATE vendors SET status = ? WHERE id = ?', [status, id]);

    if (status === 'deactivated') {
      await pool.query('UPDATE products SET status = "archived" WHERE vendor_id = ?', [id]);
    }

    // Dispatch status email
    sendVendorStatusNotificationEmail({ email: vendor.email, name: vendor.name, status })
      .catch((err) => console.error('⚠️ Vendor status email error:', err.message));

    console.log(`✅ [TiDB] Vendor ${id} status -> ${status}`);
    return res.status(200).json({ success: true, message: `Vendor status updated to ${status}` });
  } catch (err) {
    console.error('❌ Update vendor status DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to update the vendor right now. Please try again.' });
  }
});

// Delete / Deactivate Vendor (admin only)
app.delete('/api/vendors/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [vRows] = await pool.query('SELECT id, name, email, status FROM vendors WHERE id = ?', [id]);
    if (vRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }
    const vendor = vRows[0];

    // Check active / unfulfilled orders
    const [activeOrders] = await pool.query(`
      SELECT DISTINCT oi.order_id, o.status
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.vendor_id = ? AND o.status NOT IN ('Delivered', 'Cancelled', 'Refunded')
    `, [id]);

    if (activeOrders.length > 0) {
      const orderIds = activeOrders.map((o) => o.order_id).slice(0, 5).join(', ');
      return res.status(400).json({
        success: false,
        error: `Cannot remove vendor. There are active, unfulfilled customer orders (${activeOrders.length}: ${orderIds}${activeOrders.length > 5 ? '...' : ''}) associated with this vendor. Please fulfill or cancel these orders before removing the vendor.`
      });
    }

    // Check if vendor has ANY products or historical orders
    const [prodCount] = await pool.query('SELECT COUNT(*) AS count FROM products WHERE vendor_id = ?', [id]);
    const [itemCount] = await pool.query('SELECT COUNT(*) AS count FROM order_items WHERE vendor_id = ?', [id]);

    const hasProducts = Number(prodCount[0].count) > 0;
    const hasOrderHistory = Number(itemCount[0].count) > 0;

    if (hasProducts || hasOrderHistory) {
      // Soft-deactivation to preserve database referential integrity & customer order history
      await pool.query('UPDATE vendors SET status = "deactivated" WHERE id = ?', [id]);
      if (hasProducts) {
        await pool.query('UPDATE products SET status = "archived" WHERE vendor_id = ?', [id]);
      }
      console.log(`✅ [TiDB] Vendor ${id} (${vendor.email}) deactivated and ${prodCount[0].count} products archived`);

      sendVendorStatusNotificationEmail({ email: vendor.email, name: vendor.name, status: 'deactivated' })
        .catch(() => {});

      return res.status(200).json({
        success: true,
        mode: 'deactivated',
        message: `Vendor "${vendor.name}" has been deactivated and ${prodCount[0].count} product(s) unpublished. Historical order data has been preserved.`
      });
    }

    // Hard-delete if 0 products and 0 orders
    await pool.query('DELETE FROM email_verifications WHERE LOWER(email) = LOWER(?) AND role = "vendor"', [vendor.email]);
    await pool.query('DELETE FROM password_resets WHERE LOWER(email) = LOWER(?) AND role = "vendor"', [vendor.email]);
    await pool.query('DELETE FROM vendors WHERE id = ?', [id]);

    console.log(`✅ [TiDB] Vendor ${id} (${vendor.email}) permanently deleted`);
    return res.status(200).json({
      success: true,
      mode: 'deleted',
      message: `Vendor "${vendor.name}" has been permanently removed.`
    });
  } catch (err) {
    console.error('❌ Delete vendor error:', err);
    return res.status(500).json({ success: false, error: 'Unable to remove vendor right now. Please try again.' });
  }
});

// Enable / disable direct selling for a vendor (admin)
app.put('/api/vendors/:id/direct-selling', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { directSelling } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE vendors SET direct_selling = ? WHERE id = ?',
      [directSelling ? 1 : 0, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }
    console.log(`✅ [TiDB] Vendor ${id} direct selling -> ${Boolean(directSelling)}`);
    return res.status(200).json({ success: true, message: 'Vendor direct selling updated' });
  } catch (err) {
    console.error('❌ Update vendor direct selling DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to update the vendor right now. Please try again.' });
  }
});

// Customer accounts for the admin dashboard. Restrained shape — never
// exposes password columns; the users table is the source of truth, not a
// localStorage cache.
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, phone, created_at AS createdAt
       FROM users ORDER BY created_at DESC`
    );
    return res.status(200).json({ success: true, users: rows });
  } catch (err) {
    console.error('❌ Get users DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load customers right now. Please try again.' });
  }
});

// ================= CATEGORY MANAGEMENT (TiDB Cloud) =================

// Get all categories (vendors see their own + shared; admins see all)
// Public category summary for the storefront: active categories only,
// deduplicated by name across all vendors, each with a count of approved
// products. Restrained shape — no vendor identity and no per-vendor category
// ids/rows are exposed (approved Phase 1 decision D1).
app.get('/api/categories/public', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT MIN(c.name) AS name, MAX(c.description) AS description, MAX(c.image_url) AS image, MAX(c.created_at) AS createdAt,
              COUNT(DISTINCT p.id) AS productsCount
       FROM categories c
       LEFT JOIN products p ON p.status = 'approved' AND LOWER(p.category) = LOWER(c.name)
       WHERE c.status = 'active'
       GROUP BY LOWER(c.name)
       ORDER BY name ASC`
    );

    const categories = rows
      .filter((r) => r.name && String(r.name).trim())
      .map((r) => ({
        name: String(r.name),
        description: r.description ? String(r.description) : '',
        image: r.image ? String(r.image) : null,
        productsCount: Number(r.productsCount) || 0,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null
      }));

    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json({ success: true, categories });
  } catch (err) {
    console.error('❌ Get public categories DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load categories right now. Please try again.' });
  }
});

app.get('/api/categories', requireAuth('vendor', 'admin'), async (req, res) => {
  const { vendorId } = req.query;

  try {
    let query = `
      SELECT c.id, c.vendor_id AS vendorId, c.name, c.description, c.image_url AS image, c.status, c.created_at AS createdAt,
             (SELECT COUNT(*) FROM products p WHERE LOWER(p.category) = LOWER(c.name)) AS productsCount
      FROM categories c
    `;
    let params = [];
    let whereClauses = [];

    if (req.auth.role === 'admin') {
      if (vendorId) {
        if (vendorId === 'shared' || vendorId === 'null') {
          whereClauses.push('c.vendor_id IS NULL');
        } else {
          whereClauses.push('c.vendor_id = ?');
          params.push(vendorId);
        }
      }
    } else {
      const ownId = req.auth.vendorId;
      if (vendorId && String(vendorId) !== String(ownId)) {
        return res.status(403).json({ success: false, error: 'Vendors can only manage their own categories' });
      }
      whereClauses.push('(c.vendor_id = ? OR c.vendor_id IS NULL)');
      params.push(ownId);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    query += ' ORDER BY c.created_at DESC';

    const [rows] = await pool.query(query, params);
    return res.status(200).json({ success: true, categories: rows });
  } catch (err) {
    console.error('❌ Get categories DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load categories right now. Please try again.' });
  }
});

// Create new category (Admin can create shared or vendor-scoped; Vendor creates own)
app.post('/api/categories', requireAuth('vendor', 'admin'), async (req, res) => {
  const { name, description, status = 'active', vendorId, image, imageUrl } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Category name is required' });
  }

  const cleanName = name.trim();
  const cleanDesc = description ? description.trim() : '';
  const cleanImage = (image || imageUrl || '').trim() || null;
  const cleanStatus = status === 'inactive' ? 'inactive' : 'active';

  // Vendors always own what they create; admins may specify vendorId or default to null (shared).
  const ownerVendorId = req.auth.role === 'admin'
    ? (vendorId && vendorId !== 'shared' ? String(vendorId).trim() : null)
    : req.auth.vendorId;

  try {
    // Check if category name already exists in this scope
    let dupQuery;
    let dupParams;
    if (ownerVendorId === null) {
      dupQuery = 'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND vendor_id IS NULL';
      dupParams = [cleanName];
    } else {
      dupQuery = 'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND (vendor_id = ? OR vendor_id IS NULL)';
      dupParams = [cleanName, ownerVendorId];
    }

    const [existing] = await pool.query(dupQuery, dupParams);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Category already exists' });
    }

    const categoryId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    await pool.query(
      'INSERT INTO categories (id, vendor_id, name, description, image_url, status) VALUES (?, ?, ?, ?, ?, ?)',
      [categoryId, ownerVendorId, cleanName, cleanDesc, cleanImage, cleanStatus]
    );

    const newCategory = {
      id: categoryId,
      vendorId: ownerVendorId,
      name: cleanName,
      description: cleanDesc,
      image: cleanImage,
      status: cleanStatus,
      productsCount: 0,
      createdAt: new Date().toISOString()
    };

    console.log(`✅ [TiDB] Category created: ${newCategory.name} (${newCategory.status}, owner: ${ownerVendorId || 'shared'})`);
    return res.status(201).json({ success: true, category: newCategory });
  } catch (err) {
    console.error('❌ Create category DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to create the category right now. Please try again.' });
  }
});

// Update category status or details (Admin can update any; Vendor only own)
app.put('/api/categories/:id', requireAuth('vendor', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { name, description, status, image, imageUrl } = req.body || {};

  try {
    const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const current = rows[0];

    // Vendor can only update their own categories (cannot update shared or other vendor's categories)
    if (req.auth.role === 'vendor') {
      if (!current.vendor_id || String(current.vendor_id) !== String(req.auth.vendorId)) {
        return res.status(403).json({ success: false, error: 'Vendors can only manage their own categories' });
      }
    }

    const updatedName = name !== undefined ? name.trim() : current.name;
    const updatedDesc = description !== undefined ? description.trim() : current.description;
    const updatedImage = (image !== undefined || imageUrl !== undefined) ? ((image || imageUrl || '').trim() || null) : current.image_url;
    const updatedStatus = status !== undefined ? (status === 'inactive' ? 'inactive' : 'active') : current.status;

    if (!updatedName) {
      return res.status(400).json({ success: false, error: 'Category name cannot be empty' });
    }

    // If name changed, check uniqueness
    if (updatedName.toLowerCase() !== current.name.toLowerCase()) {
      let dupQuery;
      let dupParams;
      if (current.vendor_id === null) {
        dupQuery = 'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND vendor_id IS NULL AND id <> ?';
        dupParams = [updatedName, id];
      } else {
        dupQuery = 'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND (vendor_id = ? OR vendor_id IS NULL) AND id <> ?';
        dupParams = [updatedName, current.vendor_id, id];
      }
      const [existing] = await pool.query(dupQuery, dupParams);
      if (existing.length > 0) {
        return res.status(400).json({ success: false, error: 'A category with this name already exists' });
      }
    }

    await pool.query(
      'UPDATE categories SET name = ?, description = ?, image_url = ?, status = ? WHERE id = ?',
      [updatedName, updatedDesc, updatedImage, updatedStatus, id]
    );

    // If category name was renamed, update referenced products to preserve consistency
    if (updatedName !== current.name) {
      await pool.query(
        'UPDATE products SET category = ? WHERE LOWER(category) = LOWER(?)',
        [updatedName, current.name]
      );
    }

    console.log(`✅ [TiDB] Category updated: ${id} -> ${updatedName} (${updatedStatus})`);
    return res.status(200).json({
      success: true,
      category: {
        id,
        vendorId: current.vendor_id,
        name: updatedName,
        description: updatedDesc,
        status: updatedStatus
      }
    });
  } catch (err) {
    console.error('❌ Update category DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to update the category right now. Please try again.' });
  }
});

// Delete category with safe handling of referenced products (Admin or owner Vendor)
app.delete('/api/categories/:id', requireAuth('vendor', 'admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT id, vendor_id, name FROM categories WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const category = rows[0];

    // Vendor can only delete their own categories
    if (req.auth.role === 'vendor') {
      if (!category.vendor_id || String(category.vendor_id) !== String(req.auth.vendorId)) {
        return res.status(403).json({ success: false, error: 'Vendors can only manage their own categories' });
      }
    }

    // Safe handling: check if any products reference this category
    const [productCountRows] = await pool.query(
      'SELECT COUNT(*) AS count FROM products WHERE LOWER(category) = LOWER(?)',
      [category.name]
    );
    const productCount = productCountRows[0]?.count || 0;
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category "${category.name}" because ${productCount} product(s) are assigned to it. Deactivate the category instead or reassign the products first.`,
        productCount
      });
    }

    await pool.query('DELETE FROM categories WHERE id = ?', [id]);

    console.log(`✅ [TiDB] Category deleted: ${id} (${category.name})`);
    return res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    console.error('❌ Delete category DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to delete the category right now. Please try again.' });
  }
});

// ================= PRODUCT MANAGEMENT (multi-vendor + admin approval) =================

const PRODUCT_COLUMNS = `id, vendor_id AS vendorId, vendor_name AS vendorName, title, name, description, category,
  price, strike_price AS strikePrice, unit, image, video_url AS videoUrl, stock_status AS stockStatus, stock_quantity AS stockQuantity, status, created_at AS createdAt`;

// List products (optionally filtered by vendorId, status, category)
// Anonymous/customers see approved products only; vendors see their own
// listings in every state; admins see everything.
//
// Storefront params (approved Phase 1 scope, applied only to the
// anonymous/customer branches; vendor/admin responses are untouched):
//   search      — substring match on title/name/description (LIKE, escaped)
//   category    — one or more category names IN-style (case-insensitive)
//   minPrice / maxPrice — validated numbers; invalid values are rejected (400)
//   stockStatus — 'in_stock' | 'out_of_stock'
//   hasDiscount — '1' only; server-side strike_price > price comparison
//   vendorName  — exact seller name match
//   sort        — 'newest' (default) | 'price-asc' | 'price-desc'
//   page / limit — server-side pagination (limit default 12, cap 48)
// The response adds { total, page, limit } alongside products.

const STOREFRONT_SORTS = {
  newest: 'created_at DESC, id DESC',
  'price-asc': 'price ASC, id ASC',
  'price-desc': 'price DESC, id ASC'
};

const likeEscape = (value) => String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);

const parseMoneyParam = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0 || num >= 10_000_000_000) return { error: 'Invalid price filter' };
  return { value: num };
};

const parseCategoryNames = (value) => {
  const list = Array.isArray(value) ? [...value] : String(value ?? '').split(',');
  return list.map((c) => String(c).trim()).filter(Boolean);
};

const buildStorefrontQuery = (query = {}) => {
  const clauses = ["status = 'approved'"];
  const params = [];

  const search = String(query.search ?? '').trim();
  if (search) {
    const like = `%${likeEscape(search)}%`;
    clauses.push('(LOWER(title) LIKE ? OR LOWER(name) LIKE ? OR LOWER(description) LIKE ?)');
    params.push(like, like, like);
  }

  const categoryNames = parseCategoryNames(query.category);
  if (categoryNames.length > 0) {
    const group = categoryNames.map(() => 'LOWER(category) = LOWER(?)').join(' OR ');
    clauses.push(`(${group})`);
    categoryNames.forEach((name) => params.push(name));
  }

  const minPrice = parseMoneyParam(query.minPrice);
  if (minPrice.error) return { ok: false, error: minPrice.error };
  if (minPrice.value !== null) {
    clauses.push('price >= ?');
    params.push(minPrice.value);
  }

  const maxPrice = parseMoneyParam(query.maxPrice);
  if (maxPrice.error) return { ok: false, error: maxPrice.error };
  if (maxPrice.value !== null) {
    clauses.push('price <= ?');
    params.push(maxPrice.value);
  }

  const stockStatus = String(query.stockStatus ?? '').trim();
  if (stockStatus) {
    if (stockStatus !== 'in_stock' && stockStatus !== 'out_of_stock') {
      return { ok: false, error: 'Invalid stock status filter' };
    }
    clauses.push('stock_status = ?');
    params.push(stockStatus);
  }

  if (String(query.hasDiscount ?? '') === '1') {
    // Validated server-side comparison — the storefront never sees a
    // \"discount\" whose strike price is not actually higher.
    clauses.push('strike_price IS NOT NULL AND strike_price > price');
  }

  const vendorName = String(query.vendorName ?? '').trim();
  if (vendorName) {
    clauses.push('vendor_name = ?');
    params.push(vendorName);
  }

  const sort = String(query.sort ?? '').trim() || 'newest';
  const sortSql = STOREFRONT_SORTS[sort];
  if (!sortSql) return { ok: false, error: 'Invalid sort option' };

  let page = null;
  let limit = null;
  let offset = null;
  if (query.page !== undefined && query.page !== null && query.page !== '' || query.limit !== undefined && query.limit !== null && query.limit !== '') {
    page = query.page !== undefined && query.page !== null && query.page !== ''
      ? Number(query.page)
      : 1;
    limit = query.limit !== undefined && query.limit !== null && query.limit !== ''
      ? Number(query.limit || 12)
      : 12;
    if (!Number.isInteger(page) || page < 1) return { ok: false, error: 'Invalid page number' };
    if (!Number.isInteger(limit) || limit < 1 || limit > 48) return { ok: false, error: 'Invalid page size' };
    offset = (page - 1) * limit;
  }

  return { ok: true, where: clauses.join(' AND '), params, sort: sortSql, page: page || 1, limit, offset };
};

app.get('/api/products', optionalAuth, async (req, res) => {
  const { vendorId, status, category } = req.query;
  const auth = req.auth;
  const storefrontAccess = !auth || (auth.role === 'customer');

  try {
    if (storefrontAccess) {
      const built = buildStorefrontQuery(req.query);
      if (!built.ok) {
        return res.status(400).json({ success: false, error: built.error });
      }

      let whereSql = built.where;
      const filterParams = [...built.params];
      if (vendorId) {
        whereSql += ' AND vendor_id = ?';
        filterParams.push(vendorId);
      }

      let sql = `SELECT ${PRODUCT_COLUMNS} FROM products WHERE ${whereSql}`;
      sql += ` ORDER BY ${built.sort}`;
      if (built.limit !== null) {
        sql += ` LIMIT ${built.limit} OFFSET ${built.offset}`;
      }

      const [rows] = await pool.query(sql, filterParams);
      let total;
      if (built.limit === null) {
        total = rows.length;
      } else {
        const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM products WHERE ${whereSql}`, filterParams);
        total = countRows.length > 0 ? Number(countRows[0].total) : 0;
      }

      return res.status(200).json({
        success: true,
        products: rows,
        total,
        page: built.page || 1,
        limit: built.limit
      });
    }

    let sql = `SELECT ${PRODUCT_COLUMNS} FROM products WHERE 1 = 1`;
    const params = [];

    if (auth.role === 'vendor') {
      // Vendors see their own catalog regardless of approval state.
      sql += ' AND vendor_id = ?';
      params.push(auth.vendorId);
      if (status) { sql += ' AND status = ?'; params.push(status); }
      if (category) { sql += ' AND category = ?'; params.push(category); }
    } else {
      if (vendorId) { sql += ' AND vendor_id = ?'; params.push(vendorId); }
      if (status) { sql += ' AND status = ?'; params.push(status); }
      if (category) { sql += ' AND category = ?'; params.push(category); }
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(sql, params);
    return res.status(200).json({ success: true, products: rows });
  } catch (err) {
    console.error('❌ Get products DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load products right now. Please try again.' });
  }
});

// Get a single product
app.get('/api/products/:id', optionalAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const product = rows[0];

    // Visibility rule:
    // - Approved products are public (anyone can view).
    // - Admin can view any product regardless of status.
    // - Vendor can view their own product regardless of status.
    // - Unapproved products are NOT visible to anonymous users, customers, or different vendors.
    const isApproved = product.status === 'approved';
    const isAdmin = req.auth && req.auth.role === 'admin';
    const isOwnerVendor = req.auth && req.auth.role === 'vendor' && String(product.vendorId) === String(req.auth.vendorId);

    if (!isApproved && !isAdmin && !isOwnerVendor) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    return res.status(200).json({ success: true, product });
  } catch (err) {
    console.error('❌ Get product DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load the product right now. Please try again.' });
  }
});

// Storefront related products: up to 8 approved listings sharing the base
// product's category, newest first. Visibility of the base product follows
// the single-product rule above (anon/customers only ever get approved rows).
app.get('/api/products/:id/related', optionalAuth, async (req, res) => {
  try {
    const [baseRows] = await pool.query(
      'SELECT id, category, status, vendor_id AS vendorId FROM products WHERE id = ?',
      [req.params.id]
    );
    if (baseRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const base = baseRows[0];
    if (!req.auth) {
      if (base.status !== 'approved') {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
    } else if (req.auth.role === 'vendor' && String(base.vendorId) !== String(req.auth.vendorId) && base.status !== 'approved') {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const [rows] = await pool.query(
      `SELECT ${PRODUCT_COLUMNS} FROM products
       WHERE id <> ? AND LOWER(category) = LOWER(?) AND status = 'approved'
       ORDER BY created_at DESC, id DESC
       LIMIT 8`,
      [req.params.id, base.category]
    );

    return res.status(200).json({ success: true, products: rows });
  } catch (err) {
    console.error('❌ Get related products DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load related products right now. Please try again.' });
  }
});

// Product creation handler: Vendors submit pending listings; Admins can create approved or pending listings
const handleCreateProduct = async (req, res, isAdminEndpoint = false) => {
  if (isAdminEndpoint && req.auth?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin privileges required' });
  }

  const {
    id, vendorId: rawVendorId, vendor_id: rawVendor_id, vendorName, title: rawTitle, name: rawName, description,
    category, price, strikePrice, unit, image, videoUrl, video_url, stockStatus, stockQuantity, status
  } = req.body || {};

  const title = (rawTitle || rawName || '').trim();
  const name = (rawName || rawTitle || '').trim();

  if (!title) {
    return res.status(400).json({ success: false, error: 'Product title is required' });
  }

  if (price === undefined || price === null || price === '') {
    return res.status(400).json({ success: false, error: 'A valid selling price is required' });
  }

  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice < 0) {
    return res.status(400).json({ success: false, error: 'A valid selling price is required' });
  }

  // Strike price validation
  let strike = null;
  if (strikePrice !== undefined && strikePrice !== null && strikePrice !== '') {
    const parsedStrike = Number(strikePrice);
    if (!Number.isFinite(parsedStrike) || parsedStrike < 0) {
      return res.status(400).json({ success: false, error: 'Strike price must be a valid non-negative number' });
    }
    strike = parsedStrike;
  }

  // Category validation
  if (category !== undefined) {
    if (typeof category !== 'string' || !category.trim() || category.trim().length > 255) {
      return res.status(400).json({ success: false, error: 'Invalid product category' });
    }
  }
  const finalCategory = (category && String(category).trim()) || 'General';

  // Numerical stock quantity validation
  let quantity = 50; // default initial stock
  if (stockQuantity !== undefined && stockQuantity !== null && stockQuantity !== '') {
    const numQty = Number(stockQuantity);
    if (!Number.isInteger(numQty) || numQty < 0) {
      return res.status(400).json({ success: false, error: 'Stock quantity must be a non-negative whole number' });
    }
    quantity = numQty;
  } else if (stockStatus === 'out_of_stock') {
    quantity = 0;
  }

  const derivedStockStatus = quantity > 0 ? (stockStatus === 'out_of_stock' ? 'out_of_stock' : 'in_stock') : 'out_of_stock';

  // Vendor ownership & approval status based on authenticated role
  let ownVendorId = null;
  let ownVendorName = '';
  let finalStatus = 'pending';

  if (req.auth.role === 'vendor') {
    // Vendor identity strictly comes from auth token; vendors cannot assign arbitrary ownership
    ownVendorId = req.auth.vendorId;
    ownVendorName = req.auth.name || '';
    // Vendor submissions ALWAYS enter as pending for admin approval
    finalStatus = 'pending';
  } else if (req.auth.role === 'admin') {
    // Admin can choose status, defaulting to approved
    if (status && !['approved', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be pending, approved or rejected' });
    }
    finalStatus = (status && ['approved', 'pending', 'rejected'].includes(status)) ? status : 'approved';

    // Admin can assign to an existing approved vendor or create as platform listing (vendor_id = null)
    const targetVendorId = rawVendorId || rawVendor_id;
    if (targetVendorId && targetVendorId !== 'shared' && targetVendorId !== 'null' && targetVendorId !== 'none' && targetVendorId !== 'admin') {
      const [vRows] = await pool.query('SELECT id, name FROM vendors WHERE id = ?', [String(targetVendorId).trim()]);
      if (vRows.length === 0) {
        return res.status(400).json({ success: false, error: 'Selected vendor does not exist' });
      }
      ownVendorId = vRows[0].id;
      ownVendorName = vRows[0].name;
    } else {
      ownVendorId = null;
      ownVendorName = (vendorName && String(vendorName).trim()) ? String(vendorName).trim() : 'Platform Direct';
    }
  }

  try {
    const productId = id || ('p' + Date.now());

    if (req.auth.role === 'vendor' && id) {
      const [existing] = await pool.query('SELECT vendor_id FROM products WHERE id = ?', [productId]);
      if (existing.length > 0 && String(existing[0].vendor_id) !== String(req.auth.vendorId)) {
        return res.status(403).json({ success: false, error: 'You can only manage your own products' });
      }
    }

    const productVideoUrl = videoUrl !== undefined
      ? (videoUrl ? String(videoUrl).trim() : null)
      : (video_url !== undefined ? (video_url ? String(video_url).trim() : null) : null);

    await pool.query(
      `INSERT INTO products
        (id, vendor_id, vendor_name, title, name, description, category, price, strike_price, unit, image, video_url, stock_status, stock_quantity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         vendor_id = VALUES(vendor_id), vendor_name = VALUES(vendor_name), title = VALUES(title),
         name = VALUES(name), description = VALUES(description), category = VALUES(category),
         price = VALUES(price), strike_price = VALUES(strike_price), unit = VALUES(unit),
         image = VALUES(image), video_url = VALUES(video_url), stock_status = VALUES(stock_status), stock_quantity = VALUES(stock_quantity),
         status = VALUES(status)`,
      [
        productId,
        ownVendorId,
        ownVendorName || '',
        String(title).trim(),
        name ? String(name).trim() : String(title).trim(),
        description || '',
        finalCategory,
        numericPrice,
        strike,
        unit || '',
        image || '',
        productVideoUrl,
        derivedStockStatus,
        quantity,
        finalStatus
      ]
    );

    const [rows] = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ?`, [productId]);
    console.log(`✅ [TiDB] Product created (${finalStatus}): ${title} by ${ownVendorName || ownVendorId || 'Admin'}`);

    // If submitted by a vendor, notify the admin that a vendor submitted a product for approval.
    if (req.auth.role === 'vendor') {
      let ownVendorEmail = req.auth.email || '';
      if (ownVendorId && !ownVendorEmail) {
        try {
          const [vRows] = await pool.query('SELECT email FROM vendors WHERE id = ?', [ownVendorId]);
          if (vRows.length > 0 && vRows[0].email) {
            ownVendorEmail = vRows[0].email;
          }
        } catch {
          /* ignore vendor lookup failure */
        }
      }

      // Centralized notification: Send admin approval notification (From: EcShopping Admin)
      sendVendorProductSubmissionNotification({
        vendorName: ownVendorName,
        vendorEmail: ownVendorEmail,
        productTitle: title,
        productId,
        category: finalCategory,
        price: numericPrice
      }).catch((err) => console.error('⚠️ Admin product submission notification failed:', err.message));
    }

    return res.status(201).json({ success: true, product: rows[0] });
  } catch (err) {
    console.error('❌ Create product DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to save the product right now. Please try again.' });
  }
};

// Create product (Vendors create pending listings; Admins can create approved/pending listings)
app.post('/api/products', requireVendorOrAdmin, (req, res) => handleCreateProduct(req, res, false));

// Admin-specific product creation endpoint (strictly requireAdmin)
app.post('/api/admin/products', requireAdmin, (req, res) => handleCreateProduct(req, res, true));

// Update product fields (vendor edits own pending/rejected, or manages stock for approved; admin edits any)
app.put('/api/products/:id', requireVendorOrAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, name, description, category, price, strikePrice, unit, image, videoUrl, video_url, stockStatus, stockQuantity } = req.body || {};

  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const current = rows[0];

    if (req.auth.role === 'vendor') {
      if (String(current.vendor_id) !== String(req.auth.vendorId)) {
        return res.status(403).json({ success: false, error: 'You can only manage your own products' });
      }

      const hasContentModifications = [title, name, description, category, price, strikePrice, unit, image, videoUrl, video_url].some(
        (field) => field !== undefined
      );

      // Vendors can only edit content fields on pending or rejected products
      if (hasContentModifications && !['pending', 'rejected'].includes(current.status)) {
        return res.status(403).json({ success: false, error: 'Approved product details (pricing, title, description) cannot be edited directly. Contact support if revisions are needed.' });
      }
    }

    const wasRejected = current.status === 'rejected';

    let resolvedQuantity = current.stock_quantity ?? 50;
    if (stockQuantity !== undefined && stockQuantity !== null && stockQuantity !== '') {
      const parsed = parseInt(stockQuantity, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        return res.status(400).json({ success: false, error: 'Stock quantity must be a non-negative whole number' });
      }
      resolvedQuantity = parsed;
    } else if (stockStatus === 'out_of_stock') {
      resolvedQuantity = 0;
    } else if (stockStatus === 'in_stock' && resolvedQuantity <= 0) {
      resolvedQuantity = 50;
    }

    const resolvedStockStatus = stockStatus !== undefined
      ? stockStatus
      : (resolvedQuantity > 0 ? 'in_stock' : 'out_of_stock');

    const resolvedVideoUrl = videoUrl !== undefined
      ? (videoUrl ? String(videoUrl).trim() : null)
      : (video_url !== undefined ? (video_url ? String(video_url).trim() : null) : current.video_url);

    const updated = {
      title: title !== undefined ? String(title).trim() : current.title,
      name: name !== undefined ? String(name).trim() : current.name,
      description: description !== undefined ? description : current.description,
      category: category !== undefined ? category : current.category,
      price: price !== undefined && Number.isFinite(Number(price)) ? Number(price) : current.price,
      strikePrice: strikePrice !== undefined ? (strikePrice === '' || strikePrice === null ? null : Number(strikePrice)) : current.strike_price,
      unit: unit !== undefined ? unit : current.unit,
      image: image !== undefined ? image : current.image,
      videoUrl: resolvedVideoUrl,
      stockStatus: resolvedQuantity > 0 ? resolvedStockStatus : 'out_of_stock',
      stockQuantity: resolvedQuantity
    };

    // Vendor editing a rejected product resets it to pending for re-review
    const newStatus = (req.auth.role === 'vendor' && wasRejected) ? 'pending' : current.status;

    await pool.query(
      `UPDATE products SET title = ?, name = ?, description = ?, category = ?, price = ?, strike_price = ?, unit = ?, image = ?, video_url = ?, stock_status = ?, stock_quantity = ?, status = ?
       WHERE id = ?`,
      [updated.title, updated.name, updated.description, updated.category, updated.price, updated.strikePrice, updated.unit, updated.image, updated.videoUrl, updated.stockStatus, updated.stockQuantity, newStatus, id]
    );

    const [result] = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ?`, [id]);
    console.log(`✅ [TiDB] Product updated: ${id} (status: ${newStatus}, stock: ${updated.stockQuantity})`);
    return res.status(200).json({ success: true, product: result[0] });
  } catch (err) {
    console.error('❌ Update product DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to update the product right now. Please try again.' });
  }
});

// Admin approves / rejects / re-pends / archives a product
app.put('/api/products/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body || {};

  if (!['pending', 'approved', 'rejected', 'archived'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Status must be pending, approved, rejected, or archived' });
  }

  try {
    const [result] = await pool.query('UPDATE products SET status = ? WHERE id = ?', [status, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const [rows] = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ?`, [id]);
    const updatedProduct = rows[0];
    const vendorId = updatedProduct?.vendorId || updatedProduct?.vendor_id;

    // Bi-directional notification: notify vendor when product is approved or rejected
    if (updatedProduct && vendorId && (status === 'approved' || status === 'rejected')) {
      try {
        const [vRows] = await pool.query('SELECT name, email FROM vendors WHERE id = ?', [vendorId]);
        if (vRows.length > 0 && vRows[0].email) {
          await sendProductStatusNotificationEmail({
            vendorEmail: vRows[0].email,
            vendorName: vRows[0].name,
            productTitle: updatedProduct.title || updatedProduct.name,
            productId: updatedProduct.id,
            status,
            reason: reason || ''
          });
        }
      } catch (lookupErr) {
        console.error('⚠️ Vendor lookup for product notification error:', lookupErr.message);
      }
    }

    console.log(`✅ [TiDB] Product ${id} status -> ${status}`);
    return res.status(200).json({ success: true, product: updatedProduct });
  } catch (err) {
    console.error('❌ Update product status DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to update the product status right now. Please try again.' });
  }
});

// Delete a product (owner or admin)
app.delete('/api/products/:id', requireVendorOrAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, vendor_id FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    if (req.auth.role === 'vendor' && String(rows[0].vendor_id) !== String(req.auth.vendorId)) {
      return res.status(403).json({ success: false, error: 'You can only manage your own products' });
    }

    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    console.log(`✅ [TiDB] Product deleted: ${req.params.id}`);
    return res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('❌ Delete product DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to delete the product right now. Please try again.' });
  }
});

// ================= ORDER MANAGEMENT (multi-vendor) =================

const ORDER_COLUMNS = `id, customer_name AS customerName, customer_email AS customerEmail, customer_phone AS customerPhone,
  shipping_address AS shippingAddress, subtotal, discount, shipping, total, total AS totalAmount,
  coupon_code AS couponCode, delivery_method AS deliveryMethod, payment_method AS paymentMethod,
  payment_status AS paymentStatus, payment_reference AS paymentReference, status, created_at AS date`;

const parseShippingAddress = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const fetchOrderItems = async (orderId) => {
  const [rows] = await pool.query(
    `SELECT product_id AS id, product_id AS productId, vendor_id AS vendorId, vendor_name AS vendorName,
            title, price, quantity, image, variant
     FROM order_items WHERE order_id = ?`,
    [orderId]
  );
  return rows;
};

const hydrateOrders = async (orders, vendorId, vendorName) => {
  const hydrated = [];
  for (const order of orders) {
    const items = await fetchOrderItems(order.id);
    const decorated = {
      ...order,
      shippingAddress: parseShippingAddress(order.shippingAddress),
      items
    };
    if (vendorId || vendorName) {
      decorated.vendorItems = items.filter((item) => {
        if (vendorId && String(item.vendorId) === String(vendorId)) return true;
        const name = (item.vendorName || '').toLowerCase();
        const target = (vendorName || '').toLowerCase();
        return Boolean(name && target && (name.includes(target) || target.includes(name)));
      });
    }
    hydrated.push(decorated);
  }
  return hydrated;
};

// List orders — customers see their own, vendors see orders containing their
// items, admins see everything. Identity always comes from the token; a
// customer can never scope the query to somebody else's email.
app.get('/api/orders', requireAuth('customer', 'vendor', 'admin'), async (req, res) => {
  const { customerEmail, status } = req.query;

  try {
    let sql = `SELECT ${ORDER_COLUMNS} FROM orders WHERE 1 = 1`;
    const params = [];

    if (req.auth.role === 'customer') {
      sql += ' AND LOWER(customer_email) = LOWER(?)';
      params.push(req.auth.email);
    } else if (req.auth.role === 'vendor') {
      sql += ' AND id IN (SELECT order_id FROM order_items WHERE vendor_id = ?)';
      params.push(req.auth.vendorId);
    } else if (customerEmail) {
      // Admin-only convenience filters.
      sql += ' AND LOWER(customer_email) = LOWER(?)';
      params.push(customerEmail);
    }
    if (status) { sql += ' AND status = ?'; params.push(status); }

    sql += ' ORDER BY created_at DESC';

    const [orders] = await pool.query(sql, params);
    const hydrateVendorId = req.auth.role === 'vendor' ? req.auth.vendorId : null;
    const hydrated = await hydrateOrders(orders, hydrateVendorId);
    return res.status(200).json({ success: true, orders: hydrated });
  } catch (err) {
    console.error('❌ Get orders DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load orders right now. Please try again.' });
  }
});

// Get a single order (owner, a vendor with items on it, or an admin)
app.get('/api/orders/:id', requireAuth('customer', 'vendor', 'admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const [order] = await hydrateOrders(rows);
    const allowed =
      req.auth.role === 'admin' ||
      (req.auth.role === 'customer' && order.customerEmail && order.customerEmail.toLowerCase() === String(req.auth.email).toLowerCase()) ||
      (req.auth.role === 'vendor' && (order.items || []).some((item) => String(item.vendorId) === String(req.auth.vendorId)));

    if (!allowed) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    return res.status(200).json({ success: true, order });
  } catch (err) {
    console.error('❌ Get order DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load the order right now. Please try again.' });
  }
});

// Create a new order with its line items (transaction).
//
// Security/integrity rules (Phase 0):
//  - Order ids are generated server-side; a client-supplied id can never
//    select or overwrite an existing order (no upsert).
//  - Only { productId, quantity, variant } is accepted per item; prices,
//    titles, vendor data and totals are recomputed from trusted DB rows.
//  - Products must exist, be `approved` and in stock.
//  - Business rules are ported verbatim from the client's pricing config
//    (client/src/utils/pricing.js) so the server is the single source of
//    truth; unknown/invalid coupons simply do not apply.
//  - payment_status is never trusted from the client: it always starts
//    'pending' and may only be advanced by a provider callback (future
//    PhonePe phase) or an admin.
//  - Guest checkout stays supported: guests are validated by payload only
//    and can never read or overwrite another customer's order.
const DELIVERY_RULES = {
  standard: { price: 50, freeOver: 499 },
  express: { price: 120, freeOver: null }
};

const COUPON_RULES = {
  WELCOME10: { type: 'percent', value: 10, maxDiscount: 100, minOrder: 299, freeShipping: false },
  FRESH50: { type: 'flat', value: 50, maxDiscount: null, minOrder: 499, freeShipping: false },
  FREESHIP: { type: 'shipping', value: 0, maxDiscount: null, minOrder: 0, freeShipping: true },
  HARVEST20: { type: 'percent', value: 20, maxDiscount: 250, minOrder: 999, freeShipping: false }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const MAX_ORDER_LINES = 50;
const MAX_LINE_QUANTITY = 99;

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const generateOrderId = () => 'ORD-' + String(randomInt(0, 1000000)).padStart(6, '0');

app.post('/api/orders', optionalAuth, async (req, res) => {
  const body = req.body || {};
  const rawItems = Array.isArray(body.items) ? body.items : null;

  if (!rawItems || rawItems.length === 0) {
    return fail(res, 400, 'An order must contain at least one item');
  }
  if (rawItems.length > MAX_ORDER_LINES) {
    return fail(res, 400, 'Too many items in a single order');
  }

  const authCustomer = req.auth && req.auth.role === 'customer' ? req.auth : null;

  // Normalise + merge lines (same product+variant counts as one line).
  const lines = [];
  const lineKeys = new Map();
  for (const item of rawItems) {
    if (!item || typeof item !== 'object') {
      return fail(res, 400, 'Order payload is malformed');
    }
    const productId = String(item.productId ?? item.id ?? '').trim();
    if (!productId || productId.length > 64) {
      return fail(res, 400, 'A product reference in the order is invalid');
    }
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      return fail(res, 400, 'Item quantity must be a whole number between 1 and 99');
    }
    const variant = typeof item.variant === 'string' && item.variant.trim() !== ''
      ? item.variant.trim().slice(0, 128)
      : null;
    const key = `${productId}::${variant ?? ''}`;
    const mergedLine = lineKeys.get(key);
    if (mergedLine) {
      mergedLine.quantity += quantity;
      if (mergedLine.quantity > MAX_LINE_QUANTITY) {
        return fail(res, 400, 'Item quantity must be a whole number between 1 and 99');
      }
    } else {
      const line = { productId, quantity, variant };
      lineKeys.set(key, line);
      lines.push(line);
    }
  }

  // Contact validation. A signed-in customer's email always wins over the
  // payload; genuine guests provide their own validated contact details.
  const email = authCustomer ? authCustomer.email : String(body.customerEmail ?? body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email || '')) {
    return fail(res, 400, 'A valid contact email is required');
  }
  const customerName = (authCustomer?.name || body.customerName || '').trim().slice(0, 120);
  if (!customerName) {
    return fail(res, 400, 'A contact name is required');
  }
  const customerPhone = String(body.customerPhone ?? '').replace(/\D/g, '');
  if (!PHONE_RE.test(customerPhone)) {
    return fail(res, 400, 'A valid 10-digit Indian mobile number is required');
  }

  let shippingAddress = body.shippingAddress;
  if (shippingAddress && typeof shippingAddress === 'object' && !Array.isArray(shippingAddress)) {
    const street = String(shippingAddress.street ?? '').trim().slice(0, 200);
    const city = String(shippingAddress.city ?? '').trim().slice(0, 100);
    const state = String(shippingAddress.state ?? '').trim().slice(0, 50);
    const postcode = String(shippingAddress.postcode ?? '').replace(/\D/g, '');
    if (!street || !city || !/^\d{6}$/.test(postcode)) {
      return fail(res, 400, 'Shipping address requires a street, city and 6-digit PIN code');
    }
    shippingAddress = JSON.stringify({ street, city, state, postcode });
  } else if (typeof shippingAddress === 'string' && shippingAddress.trim() !== '') {
    shippingAddress = shippingAddress.trim().slice(0, 500);
  } else {
    shippingAddress = null;
  }
  if (!shippingAddress) {
    return fail(res, 400, 'A shipping address is required');
  }

  const deliveryId = DELIVERY_RULES[body.deliveryMethod] ? body.deliveryMethod : 'standard';
  const couponInput = typeof body.couponCode === 'string' ? body.couponCode.trim().toUpperCase().slice(0, 32) : '';
  const paymentMethod = body.paymentMethod === 'phonepe' ? 'phonepe' : body.paymentMethod === 'cod' ? 'cod' : null;
  if (!paymentMethod) {
    return fail(res, 400, 'Unsupported payment method');
  }

  try {
    const uniqueIds = [...new Set(lines.map((line) => line.productId))];
    const placeholders = uniqueIds.map(() => '?').join(',');
    const [productRows] = await pool.query(
      `SELECT id, vendor_id, vendor_name, title, name, price, image, stock_status, stock_quantity, status
       FROM products WHERE id IN (${placeholders})`,
      uniqueIds
    );
    const productById = new Map(productRows.map((row) => [String(row.id), row]));

    for (const line of lines) {
      const product = productById.get(line.productId);
      const itemTitle = product ? (product.title || product.name || line.title || 'Product') : (line.title || 'Product');
      if (!product) {
        return fail(res, 400, `One or more items are unavailable: unknown product (${itemTitle})`);
      }
      if (product.status !== 'approved') {
        return fail(res, 400, `"${itemTitle}" is not currently available in the store. Please remove it from your order to proceed.`);
      }
      const availableQty = product.stock_quantity != null ? product.stock_quantity : (product.stock_status === 'out_of_stock' ? 0 : 50);
      if (product.stock_status === 'out_of_stock' || availableQty < line.quantity) {
        return fail(res, 400, `"${itemTitle}" has insufficient stock (available: ${availableQty}). Please remove or adjust quantity.`);
      }
      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return fail(res, 400, `Item "${itemTitle}" could not be priced. Please contact support.`);
      }
      line.title = product.title || product.name || 'Product';
      line.unitPrice = round2(unitPrice);
      line.lineTotal = round2(line.unitPrice * line.quantity);
      line.vendorId = product.vendor_id;
      line.vendorName = product.vendor_name || '';
      line.image = product.image || null;
    }

    // Totals: ported verbatim from client/src/utils/pricing.js computeTotals.
    const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const couponRule = COUPON_RULES[couponInput] || null;
    const couponApplies = subtotal > 0 && Boolean(couponRule) && subtotal >= couponRule.minOrder;
    let discount = 0;
    let freeShipping = false;
    if (couponApplies) {
      if (couponRule.type === 'percent') {
        discount = Math.min(
          Math.round((subtotal * couponRule.value) / 100),
          couponRule.maxDiscount || Infinity
        );
      } else if (couponRule.type === 'flat') {
        discount = Math.min(couponRule.value, subtotal);
      }
      freeShipping = Boolean(couponRule.freeShipping);
      discount = Math.min(discount, subtotal);
    }
    const deliveryRule = DELIVERY_RULES[deliveryId];
    let shipping = subtotal === 0 ? 0 : deliveryRule.price;
    if (deliveryRule.freeOver !== null && subtotal >= deliveryRule.freeOver) shipping = 0;
    if (freeShipping) shipping = 0;
    const total = round2(Math.max(0, subtotal - discount) + shipping);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Server-issued id; uniqueness is verified inside the transaction.
      let orderId = generateOrderId();
      for (let attempt = 0; attempt < 8; attempt++) {
        const [dupe] = await conn.query('SELECT 1 FROM orders WHERE id = ? LIMIT 1', [orderId]);
        if (dupe.length === 0) break;
        orderId = attempt < 5 ? generateOrderId() : (`ORD-${Date.now()}`);
      }

      await conn.query(
        `INSERT INTO orders
          (id, customer_name, customer_email, customer_phone, shipping_address, subtotal, discount, shipping, total,
           coupon_code, delivery_method, payment_method, payment_status, payment_reference, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, 'Processing')`,
        [
          orderId,
          customerName,
          email,
          customerPhone,
          shippingAddress,
          subtotal,
          discount,
          shipping,
          total,
          couponApplies ? couponInput : null,
          deliveryId,
          paymentMethod
        ]
      );

      for (const line of lines) {
        // Atomic stock decrement: ensures concurrent checkouts cannot oversell
        const [updateRes] = await conn.query(
          `UPDATE products
           SET stock_quantity = stock_quantity - ?,
               stock_status = CASE WHEN stock_quantity - ? <= 0 THEN 'out_of_stock' ELSE stock_status END
           WHERE id = ? AND stock_quantity >= ?`,
          [line.quantity, line.quantity, line.productId, line.quantity]
        );
        if (updateRes.affectedRows === 0) {
          throw new Error(`INSUFFICIENT_STOCK:${line.title}`);
        }

        await conn.query(
          `INSERT INTO order_items (order_id, product_id, vendor_id, vendor_name, title, price, quantity, image, variant)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderId, line.productId, line.vendorId, line.vendorName, line.title, line.unitPrice, line.quantity, line.image, line.variant]
        );
      }

      await conn.commit();

      const [rows] = await pool.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ?`, [orderId]);
      const [order] = await hydrateOrders(rows);
      console.log(`✅ [TiDB] Order placed: ${orderId} (${lines.length} lines, total ₹${total})`);

      // Centralized confirmation email (From: EcShopping Admin)
      if (email) {
        sendOrderConfirmationEmail({
          order,
          items: lines,
          customerEmail: email,
          customerName
        }).catch((mailErr) => console.error('⚠️ Order confirmation email failed:', mailErr.message));
      }

      return res.status(201).json({ success: true, order });
    } catch (err) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.error('❌ Order rollback error:', rollbackErr);
      }
      console.error('❌ Create order DB error:', err);
      if (err?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, error: 'Order id collision detected. Please retry.' });
      }
      if (err?.message?.startsWith('INSUFFICIENT_STOCK:')) {
        const itemTitle = err.message.split('INSUFFICIENT_STOCK:')[1];
        return res.status(400).json({ success: false, error: `Insufficient stock for "${itemTitle}". It may have just been purchased by another customer.` });
      }
      return res.status(500).json({ success: false, error: 'Unable to place the order right now. Please try again.' });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('❌ Create order DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to place the order right now. Please try again.' });
  }
});

// Update order fulfillment status (vendor-on-order or admin)
app.put('/api/orders/:id/status', requireAuth('vendor', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!['Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Status must be Processing, Shipped, Delivered or Cancelled' });
  }

  try {
    if (req.auth.role === 'vendor') {
      const [owned] = await pool.query(
        'SELECT id FROM order_items WHERE order_id = ? AND vendor_id = ? LIMIT 1',
        [id, req.auth.vendorId]
      );
      if (owned.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
    }

    const [existingOrders] = await pool.query('SELECT id, customer_name, customer_email, total, status FROM orders WHERE id = ?', [id]);
    if (existingOrders.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    const previousStatus = existingOrders[0].status;

    const [result] = await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // If order was moved to Cancelled, restore stock quantity for all line items
    if (status === 'Cancelled' && previousStatus !== 'Cancelled') {
      const [items] = await pool.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [id]);
      for (const item of items) {
        if (item.product_id && item.quantity > 0) {
          await pool.query(
            `UPDATE products
             SET stock_quantity = stock_quantity + ?,
                 stock_status = CASE WHEN stock_quantity + ? > 0 THEN 'in_stock' ELSE stock_status END
             WHERE id = ?`,
            [item.quantity, item.quantity, item.product_id]
          );
        }
      }
      console.log(`🔄 [TiDB] Stock restored for cancelled order ${id}`);

      // Centralized notification: cancellation email (From: EcShopping Admin)
      if (existingOrders[0].customer_email) {
        sendOrderCancellationEmail({
          order: existingOrders[0],
          customerEmail: existingOrders[0].customer_email,
          customerName: existingOrders[0].customer_name,
          reason: 'Order cancelled by merchant/admin'
        }).catch((err) => console.error('⚠️ Order cancellation email error:', err.message));
      }
    } else if (status === 'Shipped' || status === 'Delivered') {
      // Centralized notification: fulfillment status email (From: EcShopping Admin)
      if (existingOrders[0].customer_email) {
        sendOrderFulfillmentStatusEmail({
          order: existingOrders[0],
          newStatus: status,
          customerEmail: existingOrders[0].customer_email,
          customerName: existingOrders[0].customer_name
        }).catch((err) => console.error('⚠️ Order fulfillment email error:', err.message));
      }
    }

    console.log(`✅ [TiDB] Order ${id} status -> ${status}`);
    return res.status(200).json({ success: true, message: 'Order status updated' });
  } catch (err) {
    console.error('❌ Update order status DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to update the order status right now. Please try again.' });
  }
});

// Customer cancels own pending/processing order
app.post('/api/orders/:id/cancel', requireCustomer, async (req, res) => {
  const { id } = req.params;
  const { reason = 'Customer requested cancellation' } = req.body || {};

  try {
    const [orders] = await pool.query(
      'SELECT id, customer_name, customer_email, total, status FROM orders WHERE id = ?',
      [id]
    );
    if (orders.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const order = orders[0];
    if (String(order.customer_email || '').toLowerCase() !== String(req.auth.email || '').toLowerCase()) {
      return res.status(403).json({ success: false, error: 'You do not have permission to cancel this order' });
    }

    if (order.status === 'Cancelled') {
      return res.status(400).json({ success: false, error: 'Order is already cancelled' });
    }

    if (order.status === 'Shipped' || order.status === 'Delivered') {
      return res.status(400).json({
        success: false,
        error: `Orders marked as ${order.status.toLowerCase()} cannot be cancelled directly. Please contact customer support.`
      });
    }

    await pool.query('UPDATE orders SET status = "Cancelled" WHERE id = ?', [id]);

    // Restore stock for cancelled order
    const [items] = await pool.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [id]);
    for (const item of items) {
      if (item.product_id && item.quantity > 0) {
        await pool.query(
          `UPDATE products
           SET stock_quantity = stock_quantity + ?,
               stock_status = CASE WHEN stock_quantity + ? > 0 THEN 'in_stock' ELSE stock_status END
           WHERE id = ?`,
          [item.quantity, item.quantity, item.product_id]
        );
      }
    }
    console.log(`🔄 [TiDB] Stock restored for customer-cancelled order ${id}`);

    console.log(`✅ [TiDB] Order ${id} cancelled by customer ${req.auth.email}. Reason: ${reason}`);

    // Centralized notification: customer cancellation confirmation (From: EcShopping Admin)
    if (order.customer_email) {
      sendOrderCancellationEmail({
        order,
        customerEmail: order.customer_email,
        customerName: order.customer_name || req.auth.name,
        reason
      }).catch((err) => console.error('⚠️ Customer order cancellation email error:', err.message));
    }
    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      status: 'Cancelled'
    });
  } catch (err) {
    console.error('❌ Cancel order DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to cancel order right now. Please try again.' });
  }
});

// ================= REVIEWS =================

// List reviews (optionally filtered by vendorId / productId). Customer email is never returned.
app.get('/api/reviews', async (req, res) => {
  const { vendorId, productId } = req.query;

  try {
    let sql = `SELECT id, product_id AS productId, vendor_id AS vendorId, product_title AS productTitle,
      customer_name AS customerName, rating, comment, created_at AS createdAt
      FROM reviews WHERE 1 = 1`;
    const params = [];

    if (vendorId) { sql += ' AND vendor_id = ?'; params.push(vendorId); }
    if (productId) { sql += ' AND product_id = ?'; params.push(productId); }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(sql, params);
    return res.status(200).json({ success: true, reviews: rows });
  } catch (err) {
    console.error('❌ Get reviews DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load reviews right now. Please try again.' });
  }
});

// Submit a product review (customer or guest submitter)
app.post('/api/reviews', requireCustomerOrAnon, reviewLimiter, async (req, res) => {
  const {
    id, productId, vendorId, productTitle,
    customerName, customerEmail, rating, comment
  } = req.body || {};

  if (!productId) {
    return res.status(400).json({ success: false, error: 'Product is required' });
  }

  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
  }

  if (!comment || !String(comment).trim()) {
    return res.status(400).json({ success: false, error: 'Review comment is required' });
  }

  // A logged-in customer's identity always wins over client-supplied values.
  const finalName = req.auth ? req.auth.name : (customerName || 'Customer');
  const finalEmail = req.auth ? req.auth.email : (customerEmail || null);

  try {
    const reviewId = id || ('rev' + Date.now());

    await pool.query(
      `INSERT INTO reviews
        (id, product_id, vendor_id, product_title, customer_name, customer_email, rating, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reviewId,
        productId,
        vendorId || null,
        productTitle || '',
        finalName,
        finalEmail,
        Math.round(numericRating),
        String(comment).trim()
      ]
    );

    const [rows] = await pool.query(
      `SELECT id, product_id AS productId, vendor_id AS vendorId, product_title AS productTitle,
        customer_name AS customerName, rating, comment, created_at AS createdAt
       FROM reviews WHERE id = ?`,
      [reviewId]
    );

    console.log(`✅ [TiDB] Review submitted for product ${productId}`);
    return res.status(201).json({ success: true, review: rows[0] });
  } catch (err) {
    console.error('❌ Create review DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to submit the review right now. Please try again.' });
  }
});

// ================= PAYMENTS (PhonePe Standard Checkout v2) =================

/** Loads an order row for payment routes; never leaks addresses in errors. */
const loadOrderForPayment = async (orderId) => {
  const [rows] = await pool.query(
    `SELECT id, customer_email AS customerEmail, total, payment_status AS paymentStatus,
            payment_method AS paymentMethod, payment_reference AS paymentReference
     FROM orders WHERE id = ?`, [String(orderId || '')]
  );
  return rows[0] || null;
};

/** Initiates a PhonePe checkout session for an existing, unpaid order.
 *  The amount ALWAYS comes from the server order row — client-supplied
 *  amounts are ignored. Never simulated: without configured sandbox
 *  credentials this fails closed with 503. */
app.post('/api/payments/phonepe/create-payment', requireCustomerOrAnon, paymentLimiter, async (req, res) => {
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ success: false, error: 'Order id is required' });

  const configCheck = validatePhonePeConfig();
  if (!configCheck.ok) {
    return res.status(503).json({
      success: false,
      error: 'PhonePe payments are not configured yet. Please contact support or pay by cash on delivery.',
      missingConfig: true
    });
  }

  try {
    const order = await loadOrderForPayment(orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    if (order.paymentStatus === 'paid') {
      return res.status(409).json({ success: false, error: 'This order is already paid' });
    }

    const amountPaisa = Math.round(Number(order.total) * 100);
    const amountError = !assertPaisa(amountPaisa);
    if (amountError) {
      return res.status(400).json({ success: false, error: 'The order amount is outside what the gateway accepts' });
    }

    const checkout = await createCheckoutPayment({
      merchantOrderId: order.id,
      amountPaisa,
      redirectUrl: getPhonePeRedirectUrl(process.env, order.id),
      // udf1..udf10: order metadata echoed back by status/webhook responses.
      metaInfo: { udf1: 'ecshopping-order', udf2: order.customerEmail || '', udf3: String(order.total) },
      expireAfter: 3600
    });

    // Persist the gateway session reference for reconciliation.
    await pool.query(
      `UPDATE orders SET payment_reference = ? WHERE id = ? AND payment_status <> 'paid'`,
      [`phonepe:${checkout.orderId}`, order.id]
    );

    console.log(`✅ [PhonePe] Checkout session created for ${order.id} (gateway id kept server-side)`);
    return res.status(200).json({
      success: true,
      redirectUrl: checkout.redirectUrl,
      state: checkout.state,
      expireAt: checkout.expireAt ?? null
    });
  } catch (err) {
    if (err?.status === 400) return res.status(400).json({ success: false, error: err.message });
    console.error('❌ PhonePe create-payment error:', err.message);
    return res.status(err?.status === 502 ? 502 : 500).json({
      success: false,
      error: err?.message || 'Payment could not be initiated. No amount was charged.'
    });
  }
});

/** Server-side verification against the gateway's own Order Status API.
 *  Trusts only the root `state`; writes 'paid'/'failed' onto the order row
 *  and returns the fresh order so the client can render an honest result. */
app.post('/api/payments/phonepe/verify', requireCustomerOrAnon, paymentLimiter, async (req, res) => {
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ success: false, error: 'Order id is required' });

  const configCheck = validatePhonePeConfig();
  if (!configCheck.ok) {
    return res.status(503).json({ success: false, error: 'PhonePe payments are not configured yet.', missingConfig: true });
  }

  try {
    const order = await loadOrderForPayment(orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    if (order.paymentStatus === 'paid') {
      const [rows] = await pool.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ?`, [order.id]);
      const [freshOrder] = await hydrateOrders(rows);
      return res.status(200).json({ success: true, paymentStatus: 'paid', order: freshOrder, alreadyPaid: true });
    }

    const status = await getOrderStatus(String(order.id));
    const paymentStatus = mapPhonePeState(status.state);
    const reference = latestTransactionId(status);

    if (paymentStatus === 'paid') {
      await pool.query(
        `UPDATE orders SET payment_status = 'paid', payment_reference = COALESCE(?, payment_reference) WHERE id = ? AND payment_status <> 'paid'`,
        [reference ? `phonepe-txn:${reference}` : null, order.id]
      );
      console.log(`✅ [PhonePe] Payment COMPLETED for ${order.id}`);
    } else if (paymentStatus === 'failed' && order.paymentStatus !== 'paid') {
      await pool.query(`UPDATE orders SET payment_status = 'failed' WHERE id = ?`, [order.id]);
      console.log(`✅ [PhonePe] Payment not completed for ${order.id}: ${status.state}`);
    }
    // 'pending' writes nothing — reconciliation continues.

    const [rows] = await pool.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ?`, [order.id]);
    const [freshOrder] = await hydrateOrders(rows);

    // Centralized notification: payment confirmation email (From: EcShopping Admin)
    if (paymentStatus === 'paid' && freshOrder?.customerEmail) {
      sendPaymentStatusEmail({
        order: freshOrder,
        paymentStatus: 'paid',
        paymentMethod: 'PhonePe',
        transactionReference: reference || '',
        customerEmail: freshOrder.customerEmail,
        customerName: freshOrder.customerName
      }).catch((err) => console.error('⚠️ Payment confirmation email error:', err.message));
    }

    return res.status(200).json({
      success: true,
      paymentStatus,
      gatewayState: String(status.state || ''),
      order: freshOrder
    });
  } catch (err) {
    console.error('❌ PhonePe verify error:', err.message);
    return res.status(err?.status === 404 ? 404 : err?.status === 502 ? 502 : 500).json({
      success: false,
      error: err?.message || 'Payment verification failed. The order stays in pending state until confirmed.'
    });
  }
});

/**
 * Server-to-server callback / webhook endpoint for PhonePe payments.
 * Reconciles gateway payment notification independently of the browser return redirect.
 */
app.post('/api/payments/phonepe/callback', paymentLimiter, async (req, res) => {
  try {
    const rawResponse = req.body?.response;
    const xVerify = req.headers['x-verify'];
    const saltKey = process.env.PHONEPE_SALT_KEY || process.env.phonepe_salt_key;
    const saltIndex = process.env.PHONEPE_SALT_INDEX || process.env.phonepe_salt_index || '1';

    let orderId = null;
    let paymentCode = null;
    let transactionId = null;

    if (rawResponse) {
      if (saltKey && xVerify) {
        const expectedHash = crypto.createHash('sha256').update(rawResponse + saltKey).digest('hex');
        const expectedChecksum = `${expectedHash}###${saltIndex}`;
        if (xVerify !== expectedChecksum) {
          console.warn('⚠️ [PhonePe Webhook] Invalid X-VERIFY signature rejected');
          return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
        }
      }
      try {
        const decoded = JSON.parse(Buffer.from(rawResponse, 'base64').toString('utf8'));
        orderId = decoded?.data?.merchantTransactionId;
        paymentCode = decoded?.code || decoded?.data?.responseCode;
        transactionId = decoded?.data?.transactionId || decoded?.data?.providerReferenceId;
      } catch (parseErr) {
        console.error('⚠️ [PhonePe Webhook] Malformed base64 payload:', parseErr.message);
        return res.status(400).json({ success: false, error: 'Malformed webhook payload' });
      }
    } else if (req.body?.orderId || req.body?.merchantOrderId) {
      orderId = req.body.orderId || req.body.merchantOrderId;
      paymentCode = req.body.state || req.body.code;
      transactionId = req.body.transactionId;
    }

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Order reference missing from webhook' });
    }

    const order = await loadOrderForPayment(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Referenced order not found' });
    }

    const normalizedStatus = mapPhonePeState(paymentCode);
    if (normalizedStatus === 'paid' && order.paymentStatus !== 'paid') {
      await pool.query(
        `UPDATE orders SET payment_status = 'paid', payment_reference = COALESCE(?, payment_reference) WHERE id = ? AND payment_status <> 'paid'`,
        [transactionId ? `phonepe-txn:${transactionId}` : null, order.id]
      );
      console.log(`✅ [PhonePe Webhook] Order ${order.id} marked as PAID via server callback`);

      if (order.customerEmail) {
        sendPaymentStatusEmail({
          order,
          paymentStatus: 'paid',
          paymentMethod: 'PhonePe',
          transactionReference: transactionId || '',
          customerEmail: order.customerEmail,
          customerName: order.customerEmail.split('@')[0]
        }).catch((err) => console.error('⚠️ [PhonePe Webhook] Payment confirmation email error:', err.message));
      }
    } else if (normalizedStatus === 'failed' && order.paymentStatus !== 'paid') {
      await pool.query(`UPDATE orders SET payment_status = 'failed' WHERE id = ?`, [order.id]);
      console.log(`⚠️ [PhonePe Webhook] Order ${order.id} marked as FAILED via server callback`);
    }

    return res.status(200).json({ success: true, message: 'Callback processed successfully' });
  } catch (err) {
    console.error('❌ PhonePe callback error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error processing callback' });
  }
});

// ================= SHORTS & VIDEO REVIEWS (Homepage & Admin) =================

// Public active videos for homepage shorts rail (joined with approved product details)
app.get('/api/videos/public', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT v.id, v.title, v.description, v.video_url AS videoUrl, v.thumbnail_url AS thumbnailUrl,
              v.product_id AS productId, v.status, v.display_order AS displayOrder,
              v.public_id AS publicId, v.format, v.duration, v.bytes, v.created_at AS createdAt,
              p.title AS productTitle, p.name AS productName, p.price AS productPrice,
              p.strike_price AS productStrikePrice, p.image AS productImage, p.category AS productCategory
       FROM product_videos v
       LEFT JOIN products p ON p.id = v.product_id
       WHERE v.status = 'active' AND (p.status = 'approved' OR v.product_id IS NULL)
       ORDER BY v.display_order ASC, v.created_at DESC
       LIMIT 12`
    );
    return res.status(200).json({ success: true, videos: rows });
  } catch (err) {
    console.error('❌ Get public videos DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load video reviews right now.' });
  }
});

// Admin list all videos (active + inactive)
app.get('/api/videos', requireAuth('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT v.id, v.title, v.description, v.video_url AS videoUrl, v.thumbnail_url AS thumbnailUrl,
              v.product_id AS productId, v.status, v.display_order AS displayOrder,
              v.public_id AS publicId, v.format, v.duration, v.bytes, v.created_at AS createdAt,
              p.title AS productTitle, p.price AS productPrice, p.image AS productImage
       FROM product_videos v
       LEFT JOIN products p ON p.id = v.product_id
       ORDER BY v.display_order ASC, v.created_at DESC`
    );
    return res.status(200).json({ success: true, videos: rows });
  } catch (err) {
    console.error('❌ Get admin videos DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load videos.' });
  }
});

// Admin create new video
app.post('/api/videos', requireAuth('admin'), async (req, res) => {
  const {
    title,
    description,
    videoUrl,
    thumbnailUrl,
    productId,
    status = 'active',
    displayOrder = 0,
    publicId,
    public_id,
    format,
    duration,
    bytes
  } = req.body || {};

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: 'Video title is required' });
  }
  if (!videoUrl || !videoUrl.trim()) {
    return res.status(400).json({ success: false, error: 'Video URL is required' });
  }
  if (!productId || !productId.trim()) {
    return res.status(400).json({ success: false, error: 'Associated product is required' });
  }

  const cleanUrl = videoUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return res.status(400).json({ success: false, error: 'A valid http(s) video URL is required' });
  }

  const finalPublicId = (publicId || public_id) ? String(publicId || public_id).trim() : null;
  const finalFormat = format ? String(format).trim() : null;
  const finalDuration = duration != null ? parseFloat(duration) : null;
  const finalBytes = bytes != null ? parseInt(bytes, 10) : null;

  try {
    const [prods] = await pool.query('SELECT id, title, price, image FROM products WHERE id = ?', [productId.trim()]);
    if (prods.length === 0) {
      return res.status(400).json({ success: false, error: 'Selected product does not exist' });
    }

    const id = 'vid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const cleanStatus = status === 'inactive' ? 'inactive' : 'active';
    const orderNum = parseInt(displayOrder, 10) || 0;

    await pool.query(
      `INSERT INTO product_videos (id, title, description, video_url, thumbnail_url, product_id, status, display_order, public_id, format, duration, bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title.trim(),
        description ? description.trim() : '',
        cleanUrl,
        thumbnailUrl ? thumbnailUrl.trim() : (prods[0].image || null),
        productId.trim(),
        cleanStatus,
        orderNum,
        finalPublicId,
        finalFormat,
        finalDuration,
        finalBytes
      ]
    );

    const newVideo = {
      id,
      title: title.trim(),
      description: description ? description.trim() : '',
      videoUrl: cleanUrl,
      thumbnailUrl: thumbnailUrl ? thumbnailUrl.trim() : prods[0].image,
      productId: productId.trim(),
      productTitle: prods[0].title,
      productPrice: prods[0].price,
      productImage: prods[0].image,
      status: cleanStatus,
      displayOrder: orderNum,
      publicId: finalPublicId,
      format: finalFormat,
      duration: finalDuration,
      bytes: finalBytes,
      createdAt: new Date().toISOString()
    };

    console.log(`✅ [TiDB] Video created: ${title.trim()} for product ${productId}`);
    return res.status(201).json({ success: true, video: newVideo });
  } catch (err) {
    console.error('❌ Create video DB error:', err);
    // Cleanup newly uploaded Cloudinary asset if DB insertion failed
    if (finalPublicId && finalPublicId.startsWith('ecshopping/products/videos/')) {
      try {
        if (cloudinary?.uploader?.destroy) {
          await cloudinary.uploader.destroy(finalPublicId, { resource_type: 'video' });
          console.log(`🧹 Cleaned up Cloudinary asset ${finalPublicId} after DB save failure`);
        }
      } catch (cleanErr) {
        console.warn('Failed to cleanup Cloudinary asset:', cleanErr?.message);
      }
    }
    return res.status(500).json({ success: false, error: 'Unable to save video right now.' });
  }
});

// Admin update video
app.put('/api/videos/:id', requireAuth('admin'), async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    videoUrl,
    thumbnailUrl,
    productId,
    status,
    displayOrder,
    publicId,
    public_id,
    format,
    duration,
    bytes
  } = req.body || {};

  try {
    const [rows] = await pool.query('SELECT * FROM product_videos WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    const current = rows[0];
    const updatedTitle = title !== undefined ? title.trim() : current.title;
    const updatedDesc = description !== undefined ? description.trim() : current.description;
    const updatedUrl = videoUrl !== undefined ? videoUrl.trim() : current.video_url;
    const updatedThumb = thumbnailUrl !== undefined ? (thumbnailUrl.trim() || null) : current.thumbnail_url;
    const updatedProdId = productId !== undefined ? productId.trim() : current.product_id;
    const updatedStatus = status !== undefined ? (status === 'inactive' ? 'inactive' : 'active') : current.status;
    const updatedOrder = displayOrder !== undefined ? (parseInt(displayOrder, 10) || 0) : current.display_order;
    const updatedPublicId = (publicId !== undefined || public_id !== undefined)
      ? ((publicId || public_id) ? String(publicId || public_id).trim() : null)
      : current.public_id;
    const updatedFormat = format !== undefined ? (format ? String(format).trim() : null) : current.format;
    const updatedDuration = duration !== undefined ? (duration != null ? parseFloat(duration) : null) : current.duration;
    const updatedBytes = bytes !== undefined ? (bytes != null ? parseInt(bytes, 10) : null) : current.bytes;

    if (!updatedTitle) {
      return res.status(400).json({ success: false, error: 'Video title cannot be empty' });
    }
    if (!updatedUrl) {
      return res.status(400).json({ success: false, error: 'Video URL cannot be empty' });
    }

    await pool.query(
      `UPDATE product_videos
       SET title = ?, description = ?, video_url = ?, thumbnail_url = ?, product_id = ?, status = ?, display_order = ?,
           public_id = ?, format = ?, duration = ?, bytes = ?
       WHERE id = ?`,
      [
        updatedTitle,
        updatedDesc,
        updatedUrl,
        updatedThumb,
        updatedProdId,
        updatedStatus,
        updatedOrder,
        updatedPublicId,
        updatedFormat,
        updatedDuration,
        updatedBytes,
        id
      ]
    );

    // If Cloudinary video was replaced, delete old asset only if not referenced elsewhere
    if (
      current.public_id &&
      updatedPublicId !== current.public_id &&
      current.public_id.startsWith('ecshopping/products/videos/')
    ) {
      const [usedElsewhere] = await pool.query(
        'SELECT id FROM product_videos WHERE public_id = ? AND id != ? LIMIT 1',
        [current.public_id, id]
      );
      if (usedElsewhere.length === 0 && cloudinary?.uploader?.destroy) {
        try {
          await cloudinary.uploader.destroy(current.public_id, { resource_type: 'video' });
          console.log(`🧹 Deleted replaced Cloudinary asset: ${current.public_id}`);
        } catch (cleanErr) {
          console.warn('Could not delete old Cloudinary asset:', cleanErr?.message);
        }
      }
    }

    console.log(`✅ [TiDB] Video updated: ${id} (${updatedStatus})`);
    return res.status(200).json({ success: true, message: 'Video updated successfully' });
  } catch (err) {
    console.error('❌ Update video DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to update video.' });
  }
});

// Admin delete video
app.delete('/api/videos/:id', requireAuth('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT * FROM product_videos WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    const current = rows[0];

    const [result] = await pool.query('DELETE FROM product_videos WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    // If record owned a Cloudinary asset, check if referenced elsewhere before destroying
    if (current.public_id && current.public_id.startsWith('ecshopping/products/videos/')) {
      const [usedElsewhere] = await pool.query(
        'SELECT id FROM product_videos WHERE public_id = ? LIMIT 1',
        [current.public_id]
      );
      if (usedElsewhere.length === 0 && cloudinary?.uploader?.destroy) {
        try {
          await cloudinary.uploader.destroy(current.public_id, { resource_type: 'video' });
          console.log(`🧹 Cleaned up deleted Cloudinary asset: ${current.public_id}`);
        } catch (cleanErr) {
          console.warn('Could not delete Cloudinary asset:', cleanErr?.message);
        }
      }
    }

    console.log(`✅ [TiDB] Video deleted: ${id}`);
    return res.status(200).json({ success: true, message: 'Video deleted successfully' });
  } catch (err) {
    console.error('❌ Delete video DB error:', err);
    return res.status(500).json({ success: false, error: 'Unable to delete video.' });
  }
});

// ============================================================
// HOMEPAGE BANNER MANAGEMENT (Admin & Public)
// ============================================================

// Public active banners for homepage carousel
app.get('/api/banners', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, subtitle, image_url AS image_url, image_public_id AS image_public_id,
              cta_text, cta_link, secondary_cta_text, secondary_cta_link,
              tag, badge, display_order, is_active, created_at, updated_at
       FROM homepage_banners
       WHERE is_active = 1
       ORDER BY display_order ASC, created_at ASC`
    );
    return res.status(200).json({ success: true, banners: rows });
  } catch (err) {
    console.error('❌ Get public banners error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load banners' });
  }
});

// Admin list all banners (active + inactive)
app.get('/api/admin/banners', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, subtitle, image_url, image_public_id,
              cta_text, cta_link, secondary_cta_text, secondary_cta_link,
              tag, badge, display_order, is_active, created_at, updated_at
       FROM homepage_banners
       ORDER BY display_order ASC, created_at ASC`
    );
    return res.status(200).json({ success: true, banners: rows });
  } catch (err) {
    console.error('❌ Admin get banners error:', err);
    return res.status(500).json({ success: false, error: 'Unable to load banners' });
  }
});

// Admin create banner
app.post('/api/admin/banners', requireAdmin, async (req, res) => {
  const {
    title,
    subtitle,
    image_url,
    imageUrl,
    image_public_id,
    imagePublicId,
    cta_text,
    ctaText,
    cta_link,
    ctaLink,
    secondary_cta_text,
    secondaryCtaText,
    secondary_cta_link,
    secondaryCtaLink,
    tag,
    badge,
    display_order,
    displayOrder,
    is_active,
    isActive
  } = req.body || {};

  const cleanTitle = String(title || '').trim();
  const cleanImgUrl = String(image_url || imageUrl || '').trim();

  if (!cleanTitle || cleanTitle.length < 2) {
    return res.status(400).json({ success: false, error: 'Banner title must be at least 2 characters long' });
  }
  if (!cleanImgUrl) {
    return res.status(400).json({ success: false, error: 'Banner image URL is required' });
  }

  const id = 'banner_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const cleanSubtitle = subtitle ? String(subtitle).trim() : '';
  const cleanTag = tag ? String(tag).trim() : 'Featured';
  const cleanBadge = badge ? String(badge).trim() : '';
  const cleanCtaText = cta_text !== undefined ? String(cta_text).trim() : (ctaText !== undefined ? String(ctaText).trim() : 'Shop Now');
  const cleanCtaLink = cta_link !== undefined ? String(cta_link).trim() : (ctaLink !== undefined ? String(ctaLink).trim() : '/shop');
  const cleanSecCtaText = secondary_cta_text !== undefined ? String(secondary_cta_text).trim() : (secondaryCtaText !== undefined ? String(secondaryCtaText).trim() : null);
  const cleanSecCtaLink = secondary_cta_link !== undefined ? String(secondary_cta_link).trim() : (secondaryCtaLink !== undefined ? String(secondaryCtaLink).trim() : null);
  const cleanPublicId = image_public_id || imagePublicId || null;
  const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : (isActive !== undefined ? (isActive ? 1 : 0) : 1);
  const orderVal = display_order !== undefined ? parseInt(display_order, 10) : (displayOrder !== undefined ? parseInt(displayOrder, 10) : 0);

  try {
    await pool.query(
      `INSERT INTO homepage_banners
        (id, title, subtitle, image_url, image_public_id, cta_text, cta_link, secondary_cta_text, secondary_cta_link, tag, badge, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        cleanTitle,
        cleanSubtitle,
        cleanImgUrl,
        cleanPublicId,
        cleanCtaText,
        cleanCtaLink,
        cleanSecCtaText,
        cleanSecCtaLink,
        cleanTag,
        cleanBadge,
        isNaN(orderVal) ? 0 : orderVal,
        activeVal
      ]
    );

    const [rows] = await pool.query('SELECT * FROM homepage_banners WHERE id = ?', [id]);
    console.log(`✅ [TiDB] Banner created: ${cleanTitle} (ID: ${id})`);
    return res.status(201).json({ success: true, banner: rows[0] });
  } catch (err) {
    console.error('❌ Create banner error:', err);
    return res.status(500).json({ success: false, error: 'Unable to save banner' });
  }
});

// Admin reorder banners
app.put('/api/admin/banners/order', requireAdmin, async (req, res) => {
  const { order } = req.body || {};
  if (!Array.isArray(order) || order.length === 0) {
    return res.status(400).json({ success: false, error: 'Order array of banner IDs is required' });
  }

  try {
    for (let i = 0; i < order.length; i++) {
      const bannerId = typeof order[i] === 'object' ? order[i].id : order[i];
      const targetOrder = typeof order[i] === 'object'
        ? (order[i].display_order !== undefined ? order[i].display_order : (order[i].displayOrder !== undefined ? order[i].displayOrder : i))
        : i;
      if (bannerId) {
        await pool.query('UPDATE homepage_banners SET display_order = ? WHERE id = ?', [targetOrder, bannerId]);
      }
    }
    console.log('✅ [TiDB] Banners reordered successfully');
    return res.status(200).json({ success: true, message: 'Banners reordered successfully' });
  } catch (err) {
    console.error('❌ Reorder banners error:', err);
    return res.status(500).json({ success: false, error: 'Unable to reorder banners' });
  }
});

// Admin update banner
app.put('/api/admin/banners/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    title,
    subtitle,
    image_url,
    imageUrl,
    image_public_id,
    imagePublicId,
    cta_text,
    ctaText,
    cta_link,
    ctaLink,
    secondary_cta_text,
    secondaryCtaText,
    secondary_cta_link,
    secondaryCtaLink,
    tag,
    badge,
    display_order,
    displayOrder,
    is_active,
    isActive
  } = req.body || {};

  try {
    const [existing] = await pool.query('SELECT * FROM homepage_banners WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Banner not found' });
    }

    const current = existing[0];
    const newTitle = title !== undefined ? String(title).trim() : current.title;
    const newSubtitle = subtitle !== undefined ? String(subtitle).trim() : current.subtitle;
    const newImageUrl = (image_url !== undefined || imageUrl !== undefined) ? String(image_url || imageUrl).trim() : current.image_url;
    const newPublicId = (image_public_id !== undefined || imagePublicId !== undefined) ? (image_public_id || imagePublicId || null) : current.image_public_id;
    const newCtaText = (cta_text !== undefined || ctaText !== undefined) ? String(cta_text !== undefined ? cta_text : ctaText).trim() : current.cta_text;
    const newCtaLink = (cta_link !== undefined || ctaLink !== undefined) ? String(cta_link !== undefined ? cta_link : ctaLink).trim() : current.cta_link;
    const newSecCtaText = (secondary_cta_text !== undefined || secondaryCtaText !== undefined) ? String(secondary_cta_text !== undefined ? secondary_cta_text : secondaryCtaText).trim() : current.secondary_cta_text;
    const newSecCtaLink = (secondary_cta_link !== undefined || secondaryCtaLink !== undefined) ? String(secondary_cta_link !== undefined ? secondary_cta_link : secondaryCtaLink).trim() : current.secondary_cta_link;
    const newTag = tag !== undefined ? String(tag).trim() : current.tag;
    const newBadge = badge !== undefined ? String(badge).trim() : current.badge;
    const newOrder = (display_order !== undefined || displayOrder !== undefined) ? parseInt(display_order !== undefined ? display_order : displayOrder, 10) : current.display_order;
    const newActive = (is_active !== undefined || isActive !== undefined) ? ((is_active !== undefined ? is_active : isActive) ? 1 : 0) : current.is_active;

    await pool.query(
      `UPDATE homepage_banners
       SET title = ?, subtitle = ?, image_url = ?, image_public_id = ?,
           cta_text = ?, cta_link = ?, secondary_cta_text = ?, secondary_cta_link = ?,
           tag = ?, badge = ?, display_order = ?, is_active = ?
       WHERE id = ?`,
      [
        newTitle,
        newSubtitle,
        newImageUrl,
        newPublicId,
        newCtaText,
        newCtaLink,
        newSecCtaText,
        newSecCtaLink,
        newTag,
        newBadge,
        isNaN(newOrder) ? 0 : newOrder,
        newActive,
        id
      ]
    );

    const [updated] = await pool.query('SELECT * FROM homepage_banners WHERE id = ?', [id]);
    console.log(`✅ [TiDB] Banner updated: ${newTitle} (ID: ${id})`);
    return res.status(200).json({ success: true, banner: updated[0] });
  } catch (err) {
    console.error('❌ Update banner error:', err);
    return res.status(500).json({ success: false, error: 'Unable to update banner' });
  }
});

// Admin delete banner
app.delete('/api/admin/banners/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await pool.query('SELECT * FROM homepage_banners WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Banner not found' });
    }

    const banner = existing[0];
    await pool.query('DELETE FROM homepage_banners WHERE id = ?', [id]);

    // Cleanup Cloudinary asset if applicable
    if (banner.image_public_id && cloudinary?.uploader?.destroy) {
      try {
        await cloudinary.uploader.destroy(banner.image_public_id);
        console.log(`🧹 Cleaned up Cloudinary image ${banner.image_public_id} after banner deletion`);
      } catch (cleanErr) {
        console.warn('Failed to cleanup Cloudinary banner image:', cleanErr?.message);
      }
    }

    console.log(`✅ [TiDB] Banner deleted: ${banner.title} (ID: ${id})`);
    return res.status(200).json({ success: true, message: 'Banner deleted successfully' });
  } catch (err) {
    console.error('❌ Delete banner error:', err);
    return res.status(500).json({ success: false, error: 'Unable to delete banner' });
  }
});

// ================= PAYMENT GATEWAY CONFIG (ADMIN READ & UPDATE) =================
// Strictly admin-only; reports runtime gateway mode, sandbox/production status,
// masked credentials, and whitelist guidance. NEVER returns secret keys or raw salts.
app.get('/api/admin/payment-config', requireAuth('admin'), (req, res) => {
  const config = validatePhonePeConfig();
  const envType = String(process.env.PHONEPE_ENV || 'sandbox').toLowerCase();
  const isProd = envType === 'prod' || envType === 'production';

  // Option B: OAuth v2
  const clientId = String(process.env.PHONEPE_CLIENT_ID || '').trim();
  const maskedClientId = clientId ? (clientId.length > 8 ? `${clientId.slice(0, 4)}••••${clientId.slice(-4)}` : '••••••••') : null;
  const hasClientSecret = Boolean(String(process.env.PHONEPE_CLIENT_SECRET || '').trim());
  const clientVersion = String(process.env.PHONEPE_CLIENT_VERSION || '').trim();

  // Option A: Hermes v1
  const merchantId = String(process.env.PHONEPE_MERCHANT_ID || '').trim();
  const maskedMerchantId = merchantId ? (merchantId.length > 8 ? `${merchantId.slice(0, 4)}••••${merchantId.slice(-4)}` : '••••••••') : null;
  const hasSaltKey = Boolean(String(process.env.PHONEPE_SALT_KEY || '').trim());
  const saltIndex = String(process.env.PHONEPE_SALT_INDEX || '1').trim();

  const redirectUrl = String(process.env.PHONEPE_REDIRECT_URL || '').trim();

  return res.status(200).json({
    success: true,
    configured: config.ok,
    mode: config.mode,
    environment: isProd ? 'production' : 'sandbox',
    endpointHost: isProd ? 'https://api.phonepe.com/apis/pg' : 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    v2: {
      hasClientId: Boolean(clientId),
      clientId: clientId || '',
      maskedClientId,
      clientVersion: clientVersion || null,
      hasClientSecret
    },
    v1: {
      hasMerchantId: Boolean(merchantId),
      merchantId: merchantId || '',
      maskedMerchantId,
      hasSaltKey,
      saltIndex
    },
    redirectUrl: redirectUrl || getPhonePeRedirectUrl(process.env),
    whitelistedDomains: [
      'https://ecshopping.in',
      'https://ec-shopping-three.vercel.app'
    ],
    notes: [
      'PhonePe credentials must be configured strictly in environment variables (Vercel Project Settings) and are never exposed in browser bundles.',
      'Origins and return URLs must be registered and whitelisted in the PhonePe Merchant Portal under Developer Settings.',
      'Hosted checkout security block (INTERNAL_SECURITY_BLOCK_1) is governed by PhonePe risk rules and account activation.'
    ]
  });
});

// Admin update payment gateway credentials (stored securely in platform_settings and memory)
app.put('/api/admin/payment-config', requireAuth('admin'), async (req, res) => {
  try {
    const {
      environment,
      merchantId,
      saltKey,
      saltIndex,
      redirectUrl,
      clientId,
      clientSecret,
      clientVersion
    } = req.body || {};

    const updates = [];

    const setSetting = async (key, val) => {
      if (val === null || val === undefined) return;
      const str = String(val).trim();
      await pool.query(
        'INSERT INTO platform_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [key, str]
      );
      process.env[key] = str;
    };

    if (environment !== undefined) {
      const cleanEnv = String(environment).trim().toLowerCase();
      if (!['production', 'prod', 'sandbox'].includes(cleanEnv)) {
        return res.status(400).json({ success: false, error: 'Environment must be either "production" or "sandbox"' });
      }
      const standardEnv = cleanEnv === 'prod' ? 'production' : cleanEnv;
      await setSetting('PHONEPE_ENV', standardEnv);
      updates.push('environment');
    }

    if (merchantId !== undefined) {
      const cleanMid = String(merchantId).trim();
      if (cleanMid) {
        if (!/^[a-zA-Z0-9_-]+$/.test(cleanMid)) {
          return res.status(400).json({ success: false, error: 'Merchant ID must contain only alphanumeric characters, underscores or hyphens' });
        }
        await setSetting('PHONEPE_MERCHANT_ID', cleanMid);
        updates.push('merchantId');
      }
    }

    if (saltKey !== undefined) {
      const cleanSalt = String(saltKey).trim();
      if (cleanSalt) {
        await setSetting('PHONEPE_SALT_KEY', cleanSalt);
        updates.push('saltKey');
      }
    }

    if (saltIndex !== undefined) {
      const cleanIdx = String(saltIndex).trim();
      if (cleanIdx) {
        if (!/^\d+$/.test(cleanIdx)) {
          return res.status(400).json({ success: false, error: 'Salt Index must be a positive integer' });
        }
        await setSetting('PHONEPE_SALT_INDEX', cleanIdx);
        updates.push('saltIndex');
      }
    }

    if (redirectUrl !== undefined) {
      const cleanUrl = String(redirectUrl).trim();
      if (cleanUrl) {
        await setSetting('PHONEPE_REDIRECT_URL', cleanUrl);
        updates.push('redirectUrl');
      }
    }

    if (clientId !== undefined) {
      const cleanCid = String(clientId).trim();
      if (cleanCid) {
        await setSetting('PHONEPE_CLIENT_ID', cleanCid);
        updates.push('clientId');
      }
    }

    if (clientSecret !== undefined) {
      const cleanSecret = String(clientSecret).trim();
      if (cleanSecret) {
        await setSetting('PHONEPE_CLIENT_SECRET', cleanSecret);
        updates.push('clientSecret');
      }
    }

    if (clientVersion !== undefined) {
      const cleanVer = String(clientVersion).trim();
      if (cleanVer) {
        await setSetting('PHONEPE_CLIENT_VERSION', cleanVer);
        updates.push('clientVersion');
      }
    }

    resetTokenCache();

    console.log(`✅ [TiDB] Admin updated PhonePe configuration (${updates.join(', ')})`);

    const updatedConfig = validatePhonePeConfig();
    const envType = String(process.env.PHONEPE_ENV || 'sandbox').toLowerCase();
    const isProd = envType === 'prod' || envType === 'production';

    return res.status(200).json({
      success: true,
      message: 'PhonePe payment gateway configuration saved successfully',
      configured: updatedConfig.ok,
      mode: updatedConfig.mode,
      environment: isProd ? 'production' : 'sandbox',
      updatedFields: updates
    });
  } catch (err) {
    console.error('❌ Failed to update payment config:', err);
    return res.status(500).json({ success: false, error: 'Failed to update payment settings. Please try again.' });
  }
});

// ================= EMAIL NOTIFICATION =================

// The legacy endpoint that emailed plaintext credentials to guests has been
// removed for security reasons. Account creation/update for guest checkouts
// is handled separately in a later phase.
app.post('/api/send-welcome', (req, res) => {
  return res.status(410).json({ success: false, error: 'Welcome emails have been discontinued.' });
});

const PORT = process.env.PORT || 5000;

// Listen only when this module is the process entry point (npm start /
// node index.js). Test suites import the app without opening a port.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

export default app;
export { initDatabase };
