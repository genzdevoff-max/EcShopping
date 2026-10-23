-- ============================================================================
-- Rollback script for Phase 9: Numerical Inventory & Stock Tracking
--
-- Reverts `stock_quantity` from products table.
-- Does not alter or drop existing `stock_status` column.
-- ============================================================================

USE ecshopping;

ALTER TABLE products DROP COLUMN stock_quantity;
