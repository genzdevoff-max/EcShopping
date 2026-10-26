import rateLimit from 'express-rate-limit';

// In-memory stores: fine for a single server process. For horizontal
// deployments swap in a shared store (e.g. rate-limit-redis) per instance.
const quietValidation = { validate: { trustProxy: false } };
const isTest = () => process.env.NODE_ENV === 'test';

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

export const authLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.RATE_LIMIT_AUTH_MAX) || 10,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  ...quietValidation,
  message: { success: false, error: 'Too many attempts. Please wait a few minutes and try again.' }
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_REGISTER_MAX) || 5,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  ...quietValidation,
  message: { success: false, error: 'Too many registrations from this address. Please try again later.' }
});

export const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_REVIEW_MAX) || 20,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  ...quietValidation,
  message: { success: false, error: 'Too many reviews submitted. Please try again later.' }
});

export const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PAYMENT_MAX) || 30,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  ...quietValidation,
  message: { success: false, error: 'Too many payment requests. Please wait a few minutes and try again.' }
});
