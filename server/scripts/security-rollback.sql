-- Manual rollback for additive security-schema changes (run on purpose, after
-- approval, against the target database):
--
--   mysql -h <host> -P 4000 -u <user> -p <database> < server/scripts/security-rollback.sql
--
-- These structures are intentionally left in place by the code rollback path;
-- they become inert once the reverted code stops reading them.

USE ecshopping;

DROP TABLE IF EXISTS admins;

ALTER TABLE users DROP COLUMN password_hash;
ALTER TABLE vendors DROP COLUMN password_hash;
