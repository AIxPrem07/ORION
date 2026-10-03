-- ============================================================
-- ORION Database Migration 0004: Invoice Bin (Trash) & Custom Numbering
-- 
-- 1. Adds is_deleted and deleted_at to Invoices for Recycle Bin
-- 2. Adds index on (business_id, is_deleted)
-- ============================================================

ALTER TABLE invoices ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_deleted ON invoices(business_id, is_deleted);
