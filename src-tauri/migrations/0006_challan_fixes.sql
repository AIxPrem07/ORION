-- ============================================================
-- ORION v1.5.2 Migration: Safe Challan Items Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS challan_items (
  id TEXT PRIMARY KEY,
  challan_id TEXT NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  description TEXT NOT NULL,
  hsn_code TEXT,
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'Nos',
  unit_price INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_challan_items_challan ON challan_items(challan_id);
CREATE INDEX IF NOT EXISTS idx_challan_items_product ON challan_items(product_id);
