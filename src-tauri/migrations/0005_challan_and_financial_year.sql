-- ============================================================
-- ORION v1.5 Migration: Delivery Challans & Financial Year
-- ============================================================

-- 1. Invoices: Financial Year column & index
ALTER TABLE invoices ADD COLUMN financial_year TEXT;
CREATE INDEX IF NOT EXISTS idx_invoices_fy ON invoices(business_id, financial_year);

-- 2. Delivery Challans Table
CREATE TABLE IF NOT EXISTS challans (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  challan_number TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  customer_snapshot TEXT NOT NULL DEFAULT '{}',
  challan_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DELIVERED', -- 'DELIVERED', 'RETURNED', 'CANCELLED'
  subtotal INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  transport_mode TEXT,
  vehicle_number TEXT,
  transporter_name TEXT,
  lr_rr_number TEXT,
  created_by TEXT REFERENCES users(id),
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(business_id, challan_number)
);

CREATE INDEX IF NOT EXISTS idx_challans_business ON challans(business_id);
CREATE INDEX IF NOT EXISTS idx_challans_customer ON challans(business_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_challans_fy ON challans(business_id, financial_year);
CREATE INDEX IF NOT EXISTS idx_challans_date ON challans(business_id, challan_date);
CREATE INDEX IF NOT EXISTS idx_challans_deleted ON challans(business_id, is_deleted);

-- 3. Challan Items Table (Pure quantities and amounts, NO GST)
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

-- 4. Challan Sequence Counters per FY
CREATE TABLE IF NOT EXISTS challan_sequences (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  current_number INTEGER NOT NULL DEFAULT 0,
  padding INTEGER NOT NULL DEFAULT 4,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(business_id, prefix, financial_year)
);
