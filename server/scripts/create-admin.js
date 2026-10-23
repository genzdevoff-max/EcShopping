// One-time (or rotation) admin bootstrap: upserts an admin into the `admins`
// table using ADMIN_EMAIL + ADMIN_PASSWORD from the environment. The password
// is never printed or logged.
import dotenv from 'dotenv';
dotenv.config();

import { hashPassword, passwordMeetsPolicy } from '../utils/passwords.js';
import pool from '../db.js';

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('❌ ADMIN_EMAIL is missing or invalid. Set it in server/.env (see .env.example).');
  process.exit(1);
}

if (!passwordMeetsPolicy(password, 12)) {
  console.error('❌ ADMIN_PASSWORD is missing or too weak (minimum 12 characters).');
  process.exit(1);
}

const maskConfirm = (value) => `${value[0]}${'*'.repeat(Math.min(4, value.length))}`;

try {
  const passwordHash = await hashPassword(password);

  const [existing] = await pool.query('SELECT id FROM admins WHERE LOWER(email) = ?', [email]);
  if (existing.length === 0) {
    await pool.execute(
      "INSERT INTO admins (id, email, password_hash) VALUES (?, ?, ?)",
      ['a' + Date.now(), email, passwordHash]
    );
    console.log(`✅ Admin account created: ${maskConfirm(email)}***@${email.split('@')[1]} (row added to \`admins\`)`);
    console.log('   Log in at /admin with this email and ADMIN_PASSWORD. Rotate the password after first use.');
  } else {
    await pool.execute('UPDATE admins SET password_hash = ? WHERE id = ?', [passwordHash, existing[0].id]);
    console.log(`✅ Admin password rotated for ${maskConfirm(email)}***@${email.split('@')[1]} (row reused)`);
  }
  await pool.end();
} catch (err) {
  console.error('❌ Failed to bootstrap admin: code=', err.code || 'n/a');
  process.exit(1);
}
