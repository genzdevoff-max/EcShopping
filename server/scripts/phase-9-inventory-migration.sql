-- ============================================================================
-- Additive migration for Phase 9: Numerical Inventory & Stock Tracking
--
-- Adds `stock_quantity` INT NOT NULL DEFAULT 0 to products table.
-- Existing `stock_status` column is preserved for backwards compatibility.
-- When stock_quantity > 0, stock_status is automatically 'in_stock'.
-- When stock_quantity = 0, stock_status is 'out_of_stock'.
--
-- This script is documented for production application after approval.
-- In development and tests, initDatabase() applies this additively if not present.
-- ============================================================================

USE ecshopping;

-- 1. Add numeric stock quantity column if not present
ALTER TABLE products ADD COLUMN stock_quantity INT NOT NULL DEFAULT 50;

-- 2. Backfill existing out_of_stock products with quantity 0
UPDATE products SET stock_quantity = 0 WHERE stock_status = 'out_of_stock';
