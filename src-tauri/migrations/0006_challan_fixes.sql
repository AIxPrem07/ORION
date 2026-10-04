-- ============================================================
-- ORION v1.5.1 Migration: Challan Items Schema & FK Fixes
-- ============================================================

-- Recreate challan_items to ensure product_id is nullable (safe for custom items & non-inventory dispatches)
CREATE TABLE IF NOT EXISTS challan_items_new (
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

INSERT INTO challan_items_new (id, challan_id, product_id, description, hsn_code, quantity, unit, unit_price, total_amount, sort_order)
  SELECT id, challan_id, CASE WHEN product_id = '' THEN NULL ELSE product_id END, description, hsn_code, quantity, unit, unit_price, total_amount, sort_order FROM challan_items;

DROP TABLE challan_items;

ALTER TABLE challan_items_new RENAME TO challan_items;

CREATE INDEX IF NOT EXISTS idx_challan_items_challan ON challan_items(challan_id);
CREATE INDEX IF NOT EXISTS idx_challan_items_product ON challan_items(product_id);
