import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_COST = 10;

export const hashPassword = (plain) => bcrypt.hash(String(plain), BCRYPT_COST);

export const verifyHash = async (plain, hash) => {
  if (!hash) return false;
  try {
    return await bcrypt.compare(String(plain), String(hash));
  } catch {
    return false;
  }
};

export const isHashed = (value) =>
  /^\$2[aby]\$\d{1,2}\$/.test(String(value || ''));

// Length-safe, timing-insensitive string comparison (hashes both sides first
// so different lengths cannot be distinguished from the comparison timing).
export const timingSafeEqualStrings = (a, b) => {
  const da = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const dbv = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(da, dbv);
};

export const passwordMeetsPolicy = (plain, min = 8) =>
  typeof plain === 'string' && plain.length >= min;
