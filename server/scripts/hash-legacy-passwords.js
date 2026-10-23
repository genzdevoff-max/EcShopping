// One-off migration: bcrypt-hashes legacy plaintext passwords into the
// `password_hash` column for users/vendors. The legacy `password` column is
// deliberately LEFT UNTOUCHED (data preservation first); clearing it is a
// separate, explicitly approved cleanup.
//
// Dry run (default):   node scripts/hash-legacy-passwords.js
// Apply:               node scripts/hash-legacy-passwords.js --apply
import dotenv from 'dotenv';
dotenv.config();

import { hashPassword } from '../utils/passwords.js';
import pool from '../db.js';

const apply = process.argv.includes('--apply');

const migrate = async (table) => {
  const [rows] = await pool.query(
    `SELECT id, password, password_hash FROM ${table}
     WHERE password IS NOT NULL AND password <> ''
       AND (password_hash IS NULL OR password_hash = '')`
  );

  let converted = 0;
  let skippedPlaintextInHash = 0;

  for (const row of rows) {
    if (String(row.password).startsWith('$2')) {
      skippedPlaintextInHash++;
      continue;
    }
    if (apply) {
      const passwordHash = await hashPassword(row.password);
      await pool.execute(`UPDATE ${table} SET password_hash = ? WHERE id = ?`, [passwordHash, row.id]);
    }
    converted++;
  }

  console.log(`${table}: ${apply ? 'hashed' : 'would hash (rows 1 by 1)'} ${converted} account(s)` +
    (skippedPlaintextInHash ? `, ${skippedPlaintextInHash} skipped (password looks like a hash already)` : ''));
};

try {
  await migrate('users');
  await migrate('vendors');
  if (!apply) {
    console.log('DRY RUN — nothing was written. Re-run with --apply to write the hashes.');
  } else {
    console.log('Done. Legacy plaintexts remain in the `password` columns until the approved cleanup runs.');
  }
  await pool.end();
} catch (err) {
  console.error('❌ Migration failed: code=', err.code || 'n/a');
  process.exit(1);
}
