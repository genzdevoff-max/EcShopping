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

let dbInitPromise = null;

// Initialize database schema (clean without any dummy data)
export const initDatabase = async () => {
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = (async () => {
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
        video_url VARCHAR(1000) DEFAULT NULL,
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

    // Create Email Verifications table (customer & vendor registration email verification)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_verifications_token (token_hash),
        INDEX idx_verifications_email_role (email, role)
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

    // Additive migration: product video link support
    if (!(await columnExists(connection, 'products', 'video_url'))) {
      await connection.query('ALTER TABLE products ADD COLUMN video_url VARCHAR(1000) NULL DEFAULT NULL');
      console.log('✅ Added products.video_url');
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
        public_id VARCHAR(255) DEFAULT NULL,
        format VARCHAR(32) DEFAULT NULL,
        duration DECIMAL(10,2) DEFAULT NULL,
        bytes BIGINT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_videos_product (product_id),
        INDEX idx_videos_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Safe additive column migrations for product_videos
    try {
      if (!(await columnExists(connection, 'product_videos', 'public_id'))) {
        await connection.query('ALTER TABLE product_videos ADD COLUMN public_id VARCHAR(255) NULL DEFAULT NULL');
        console.log('✅ Added product_videos.public_id');
      }
    } catch (e) {
      if (!e.message?.includes('Duplicate column')) throw e;
    }
    try {
      if (!(await columnExists(connection, 'product_videos', 'format'))) {
        await connection.query('ALTER TABLE product_videos ADD COLUMN format VARCHAR(32) NULL DEFAULT NULL');
        console.log('✅ Added product_videos.format');
      }
    } catch (e) {
      if (!e.message?.includes('Duplicate column')) throw e;
    }
    try {
      if (!(await columnExists(connection, 'product_videos', 'duration'))) {
        await connection.query('ALTER TABLE product_videos ADD COLUMN duration DECIMAL(10,2) NULL DEFAULT NULL');
        console.log('✅ Added product_videos.duration');
      }
    } catch (e) {
      if (!e.message?.includes('Duplicate column')) throw e;
    }
    try {
      if (!(await columnExists(connection, 'product_videos', 'bytes'))) {
        await connection.query('ALTER TABLE product_videos ADD COLUMN bytes BIGINT NULL DEFAULT NULL');
        console.log('✅ Added product_videos.bytes');
      }
    } catch (e) {
      if (!e.message?.includes('Duplicate column')) throw e;
    }

    // Additive table: Platform Settings (Key-Value Store for runtime flags)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Additive table: Homepage Banners (Admin Homepage Banner Management)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS homepage_banners (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        subtitle TEXT DEFAULT NULL,
        image_url VARCHAR(1024) NOT NULL,
        image_public_id VARCHAR(255) DEFAULT NULL,
        cta_text VARCHAR(100) DEFAULT 'Shop Now',
        cta_link VARCHAR(255) DEFAULT '/shop',
        secondary_cta_text VARCHAR(100) DEFAULT NULL,
        secondary_cta_link VARCHAR(255) DEFAULT NULL,
        tag VARCHAR(100) DEFAULT NULL,
        badge VARCHAR(255) DEFAULT NULL,
        display_order INT DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_banners_order (display_order),
        INDEX idx_banners_active_order (is_active, display_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed default promotional banners if table is empty
    try {
      const [bCount] = await connection.query('SELECT COUNT(*) as count FROM homepage_banners');
      if (bCount[0].count === 0) {
        await connection.query(`
          INSERT INTO homepage_banners (id, title, subtitle, image_url, cta_text, cta_link, secondary_cta_text, secondary_cta_link, tag, badge, display_order, is_active)
          VALUES
            ('banner-harvest-fresh', 'Pure Organic Produce & Farm Harvests', 'Residue-free vegetables, cold-pressed oils & raw forest honey directly from certified local farmers.', 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80', 'Shop Fresh Harvest', '/shop', 'Explore Deals', '/collection/deals', 'Direct Farm Harvest', '100% Certified Organic • Free Delivery over ₹499', 0, 1),
            ('banner-wood-pressed-oils', 'Authentic Wood-Pressed Oils & Pure Desi Ghee', 'Stone-ground sesame, groundnut, and coconut oils crafted by artisanal Tamil Nadu producers.', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=1600&q=80', 'Shop Pantry Staples', '/category/pantry-staples', 'Browse Catalog', '/shop', 'Traditional Cold-Pressed', 'Zero Chemical Refining • Pure Nutrient Retention', 1, 1),
            ('banner-weekend-deals', 'Save on Daily Essentials & Farm Bundles', 'Enjoy verified seller discounts on heritage rice, organic country eggs, and pure palm jaggery.', 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1600&q=80', 'View Today’s Deals', '/collection/deals', 'All Products', '/shop', 'Weekly Farmer Special', 'Limited Stock • Direct Farmer Support', 2, 1)
        `);
        console.log('✅ Seeded default promotional banners into homepage_banners table');
      }
    } catch {
      /* ignore seed failure */
    }

    // Additive migration: performance indexes (products status+category, orders customer+status)
    try {
      await connection.query('CREATE INDEX idx_products_status_category ON products (status, category)');
    } catch {
      // Non-fatal if index exists
    }
    try {
      await connection.query('CREATE INDEX idx_orders_customer_status ON orders (customer_email, status)');
    } catch {
      // Non-fatal if index exists
    }

    // ---------------- ADDITIVE MIGRATIONS: BANNERS, VENDORS, USERS, PRODUCTS, COUPONS, DEALS ----------------

    const safeAddColumn = async (table, column, definition) => {
      try {
        const exists = await columnExists(connection, table, column);
        if (!exists) {
          await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
          console.log(`✅ Added ${table}.${column}`);
        }
      } catch (err) {
        if (!err.message?.includes('Duplicate column') && err.code !== 'ER_DUP_FIELDNAME') {
          console.warn(`⚠️ Migration notice for ${table}.${column}:`, err.message);
        }
      }
    };

    // 1. Homepage banners: mobile and tablet image URLs and aspect ratios
    await safeAddColumn('homepage_banners', 'mobile_image_url', 'VARCHAR(1024) NULL DEFAULT NULL');
    await safeAddColumn('homepage_banners', 'tablet_image_url', 'VARCHAR(1024) NULL DEFAULT NULL');
    await safeAddColumn('homepage_banners', 'image_aspect_ratio', 'VARCHAR(32) NULL DEFAULT "16:5"');

    // 2. Vendors: business info, tax, certificates, bank details, verification notes, and commission
    const vendorColumns = [
      ['business_name', 'VARCHAR(255) NULL DEFAULT NULL'],
      ['business_type', 'VARCHAR(100) NULL DEFAULT NULL'],
      ['owner_name', 'VARCHAR(255) NULL DEFAULT NULL'],
      ['registered_name', 'VARCHAR(255) NULL DEFAULT NULL'],
      ['address', 'TEXT NULL DEFAULT NULL'],
      ['city', 'VARCHAR(100) NULL DEFAULT NULL'],
      ['district', 'VARCHAR(100) NULL DEFAULT NULL'],
      ['state', 'VARCHAR(100) NULL DEFAULT NULL'],
      ['pincode', 'VARCHAR(20) NULL DEFAULT NULL'],
      ['country', 'VARCHAR(100) DEFAULT "India"'],
      ['gst_status', 'VARCHAR(50) DEFAULT "not_registered"'],
      ['gstin', 'VARCHAR(50) NULL DEFAULT NULL'],
      ['gst_certificate_url', 'VARCHAR(1024) NULL DEFAULT NULL'],
      ['fssai_status', 'VARCHAR(50) DEFAULT "not_applicable"'],
      ['fssai_number', 'VARCHAR(100) NULL DEFAULT NULL'],
      ['fssai_certificate_url', 'VARCHAR(1024) NULL DEFAULT NULL'],
      ['bank_account_holder', 'VARCHAR(255) NULL DEFAULT NULL'],
      ['bank_name', 'VARCHAR(255) NULL DEFAULT NULL'],
      ['bank_account_number', 'VARCHAR(100) NULL DEFAULT NULL'],
      ['bank_ifsc', 'VARCHAR(50) NULL DEFAULT NULL'],
      ['bank_document_url', 'VARCHAR(1024) NULL DEFAULT NULL'],
      ['verification_notes', 'TEXT NULL DEFAULT NULL'],
      ['reviewed_by', 'VARCHAR(64) NULL DEFAULT NULL'],
      ['reviewed_at', 'TIMESTAMP NULL DEFAULT NULL'],
      ['commission_rate', 'DECIMAL(5,2) NULL DEFAULT NULL'],
      ['shipping_charge', 'DECIMAL(10,2) NULL DEFAULT 0.00'],
      ['shipping_free_threshold', 'DECIMAL(10,2) NULL DEFAULT NULL'],
      ['shipping_enabled', 'TINYINT(1) DEFAULT 1'],
      ['shipping_estimated_days', 'VARCHAR(64) DEFAULT "3-5 business days"']
    ];

    for (const [colName, colDef] of vendorColumns) {
      await safeAddColumn('vendors', colName, colDef);
    }

    // 3. Users: customer account status (active/deactivated) and deactivation date
    await safeAddColumn('users', 'status', 'VARCHAR(50) DEFAULT "active"');
    await safeAddColumn('users', 'deactivated_at', 'TIMESTAMP NULL DEFAULT NULL');

    // 4. Products: multiple images support (JSON / text array)
    await safeAddColumn('products', 'images', 'MEDIUMTEXT NULL DEFAULT NULL');

    // 5. Order items: commission rate and snapshot amounts
    await safeAddColumn('order_items', 'commission_rate', 'DECIMAL(5,2) NULL DEFAULT NULL');
    await safeAddColumn('order_items', 'commission_amount', 'DECIMAL(10,2) DEFAULT 0');
    await safeAddColumn('order_items', 'vendor_payout', 'DECIMAL(10,2) DEFAULT 0');

    // 6. Coupons table: database-authoritative promotions
    await connection.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        code VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) DEFAULT '',
        type ENUM('percent', 'flat', 'shipping') NOT NULL DEFAULT 'percent',
        value DECIMAL(10,2) NOT NULL DEFAULT 0,
        min_order DECIMAL(10,2) DEFAULT 0,
        max_discount DECIMAL(10,2) DEFAULT NULL,
        free_shipping BOOLEAN DEFAULT FALSE,
        applicable_to VARCHAR(32) DEFAULT 'all',
        product_ids MEDIUMTEXT DEFAULT NULL,
        vendor_id VARCHAR(64) DEFAULT NULL,
        per_customer_limit INT DEFAULT 1,
        usage_limit INT DEFAULT NULL,
        used_count INT DEFAULT 0,
        start_date TIMESTAMP NULL DEFAULT NULL,
        expiry_date TIMESTAMP NULL DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await safeAddColumn('coupons', 'title', "VARCHAR(255) DEFAULT ''");
    await safeAddColumn('coupons', 'applicable_to', "VARCHAR(32) DEFAULT 'all'");
    await safeAddColumn('coupons', 'product_ids', "MEDIUMTEXT DEFAULT NULL");
    await safeAddColumn('coupons', 'vendor_id', "VARCHAR(64) DEFAULT NULL");
    await safeAddColumn('coupons', 'per_customer_limit', "INT DEFAULT 1");

    // Seed default coupons if coupons table is empty
    try {
      const [cCount] = await connection.query('SELECT COUNT(*) as count FROM coupons');
      if (cCount[0].count === 0) {
        await connection.query(`
          INSERT INTO coupons (code, type, value, min_order, max_discount, free_shipping, usage_limit, is_active)
          VALUES
            ('WELCOME10', 'percent', 10, 299, 100, FALSE, NULL, TRUE),
            ('FRESH50', 'flat', 50, 499, NULL, FALSE, NULL, TRUE),
            ('FREESHIP', 'shipping', 0, 0, NULL, TRUE, NULL, TRUE),
            ('HARVEST20', 'percent', 20, 999, 250, FALSE, NULL, TRUE)
        `);
        console.log('✅ Seeded default coupons into coupons table');
      }
    } catch {
      /* ignore coupon seed failure */
    }

    // 7. Deals of the Day table: time-limited special values
    await connection.query(`
      CREATE TABLE IF NOT EXISTS deals (
        id VARCHAR(64) PRIMARY KEY,
        product_id VARCHAR(64) NOT NULL,
        deal_price DECIMAL(10,2) NOT NULL,
        original_price DECIMAL(10,2) NOT NULL,
        discount_percent INT DEFAULT 0,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        stock_limit INT DEFAULT NULL,
        sold_count INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_deals_product (product_id),
        INDEX idx_deals_active_time (is_active, start_time, end_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await safeAddColumn('deals', 'status', "VARCHAR(32) DEFAULT 'active'");

    connection.release();
    console.log('✅ TiDB Cloud tables (users, vendors, categories, products, orders, order_items, reviews, admins, customer_addresses, password_resets) ready & clean (no dummy data)!');
  } catch (error) {
    console.error('❌ Error initializing TiDB Cloud database:', error.message);
  }
  })();
  return dbInitPromise;
};

export default pool;
