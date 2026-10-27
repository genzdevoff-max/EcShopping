import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Credentials come exclusively from the environment (server/.env). The server
// refuses to start when any required value is missing instead of silently
// falling back to credentials kept in source control.
const REQUIRED_DB_ENV = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];

export const validateDbConfig = (env = process.env) => {
  const missing = REQUIRED_DB_ENV.filter((key) => !String(env[key] || '').trim());
  return { ok: missing.length === 0, missing };
};

const dbCheck = validateDbConfig();
if (!dbCheck.ok) {
  console.error(
    `❌ Missing required database configuration: ${dbCheck.missing.join(', ')}.\n` +
    '   Set them in server/.env (see server/.env.example) and restart the server.'
  );
  process.exit(1);
}

// Create TiDB Cloud MySQL Connection Pool
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // TiDB Cloud closes idle connections; keep them alive and recycle them.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 20000,
  maxIdle: 5,
  idleTimeout: 60000,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

// Transient network resets happen on TiDB Cloud; retry the query once.
const TRANSIENT_DB_ERRORS = new Set([
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_SEQUENCE_TIMEOUT'
]);

const isTransientDbError = (err) => TRANSIENT_DB_ERRORS.has(err?.code);

const retryOnce = async (operation) => {
  try {
    return await operation();
  } catch (err) {
    if (!isTransientDbError(err)) throw err;
    console.warn(`⚠️ TiDB connection reset (${err.code}); retrying once…`);
    await new Promise((resolve) => setTimeout(resolve, 350));
    return operation();
  }
};

const rawQuery = pool.query.bind(pool);
const rawExecute = pool.execute.bind(pool);
const rawGetConnection = pool.getConnection.bind(pool);

pool.query = (...args) => retryOnce(() => rawQuery(...args));
pool.execute = (...args) => retryOnce(() => rawExecute(...args));

const columnExists = async (connection, table, column) => {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
};

// Initialize database schema (clean without any dummy data)
export const initDatabase = async () => {
  try {
    const connection = await retryOnce(() => rawGetConnection());
    console.log('⚡ Connected to TiDB Cloud Database successfully!');

    // Create Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(50) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create Vendors table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(50) DEFAULT '',
        status VARCHAR(50) DEFAULT 'approved',
        direct_selling BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create Categories table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(64) PRIMARY KEY,
        vendor_id VARCHAR(64) DEFAULT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create Products table (multi-vendor listings + admin approval)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(64) PRIMARY KEY,
        vendor_id VARCHAR(64) DEFAULT NULL,
        vendor_name VARCHAR(255) DEFAULT '',
        title VARCHAR(255) NOT NULL,
        name VARCHAR(255) DEFAULT NULL,
        description TEXT DEFAULT NULL,
        category VARCHAR(255) DEFAULT 'General',
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        strike_price DECIMAL(10,2) DEFAULT NULL,
        unit VARCHAR(100) DEFAULT '',
        image TEXT DEFAULT NULL,
        stock_status VARCHAR(50) DEFAULT 'in_stock',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_products_vendor (vendor_id),
        INDEX idx_products_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create Orders table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(64) PRIMARY KEY,
        customer_name VARCHAR(255) DEFAULT '',
        customer_email VARCHAR(255) DEFAULT '',
        customer_phone VARCHAR(50) DEFAULT '',
        shipping_address TEXT DEFAULT NULL,
        subtotal DECIMAL(10,2) DEFAULT 0,
        discount DECIMAL(10,2) DEFAULT 0,
        shipping DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) DEFAULT 0,
        coupon_code VARCHAR(64) DEFAULT NULL,
        delivery_method VARCHAR(50) DEFAULT NULL,
        payment_method VARCHAR(50) DEFAULT NULL,
        payment_status VARCHAR(50) DEFAULT NULL,
        payment_reference VARCHAR(128) DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'Processing',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_orders_customer (customer_email),
        INDEX idx_orders_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create Order Items table (per-vendor line items)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) DEFAULT NULL,
        vendor_id VARCHAR(64) DEFAULT NULL,
        vendor_name VARCHAR(255) DEFAULT NULL,
        title VARCHAR(255) DEFAULT NULL,
        price DECIMAL(10,2) DEFAULT 0,
        quantity INT DEFAULT 1,
        image TEXT DEFAULT NULL,
        variant VARCHAR(128) DEFAULT NULL,
        INDEX idx_items_order (order_id),
        INDEX idx_items_vendor (vendor_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create Reviews table (customer feedback per product/vendor)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(64) PRIMARY KEY,
        product_id VARCHAR(64) DEFAULT NULL,
        vendor_id VARCHAR(64) DEFAULT NULL,
        product_title VARCHAR(255) DEFAULT NULL,
        customer_name VARCHAR(255) DEFAULT NULL,
        customer_email VARCHAR(255) DEFAULT NULL,
        rating INT DEFAULT 5,
        comment TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reviews_vendor (vendor_id),
        INDEX idx_reviews_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Admin credentials for the admin dashboard (bcrypt hashes only)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create Customer Addresses table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customer_addresses (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) DEFAULT '',
        street VARCHAR(255) NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        postcode VARCHAR(20) NOT NULL,
        country VARCHAR(100) DEFAULT 'India',
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_addresses_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create Password Resets table (customer, vendor, admin forgot password)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_resets_token (token_hash),
        INDEX idx_resets_email_role (email, role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Additive migration: hashed password columns for existing users/vendors.
    // The legacy `password` columns are kept until a separate cleanup is
    // approved so this upgrade can never destroy existing data.
    if (!(await columnExists(connection, 'users', 'password_hash'))) {
      await connection.query('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL');
      console.log('✅ Added users.password_hash');
    }
    if (!(await columnExists(connection, 'vendors', 'password_hash'))) {
      await connection.query('ALTER TABLE vendors ADD COLUMN password_hash VARCHAR(255) NULL');
      console.log('✅ Added vendors.password_hash');
    }

    // Additive migration: numerical stock quantity tracking (Phase 9)
    if (!(await columnExists(connection, 'products', 'stock_quantity'))) {
      await connection.query('ALTER TABLE products ADD COLUMN stock_quantity INT NOT NULL DEFAULT 50');
      await connection.query("UPDATE products SET stock_quantity = 0 WHERE stock_status = 'out_of_stock'");
      console.log('✅ Added products.stock_quantity');
    }

    // Additive migration: category thumbnail support
    if (!(await columnExists(connection, 'categories', 'image_url'))) {
      await connection.query('ALTER TABLE categories ADD COLUMN image_url VARCHAR(500) NULL');
      console.log('✅ Added categories.image_url');
    }

    // Additive migration: widen image columns to MEDIUMTEXT to prevent payload truncation
    try {
      await connection.query('ALTER TABLE products MODIFY COLUMN image MEDIUMTEXT DEFAULT NULL');
      await connection.query('ALTER TABLE order_items MODIFY COLUMN image MEDIUMTEXT DEFAULT NULL');
    } catch {
      // Non-fatal if already MEDIUMTEXT or unsupported
    }

    // Additive table: Homepage Shorts & Video Reviews
    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_videos (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT DEFAULT NULL,
        video_url VARCHAR(500) NOT NULL,
        thumbnail_url VARCHAR(500) DEFAULT NULL,
        product_id VARCHAR(64) NOT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        display_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_videos_product (product_id),
        INDEX idx_videos_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Additive table: Platform Settings (Key-Value Store for runtime flags)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    connection.release();
    console.log('✅ TiDB Cloud tables (users, vendors, categories, products, orders, order_items, reviews, admins, customer_addresses, password_resets) ready & clean (no dummy data)!');
  } catch (error) {
    console.error('❌ Error initializing TiDB Cloud database:', error.message);
  }
};

export default pool;
