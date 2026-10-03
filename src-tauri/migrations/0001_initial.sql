-- ORION Database Migration 0001: Core Schema
-- Applies: Initial schema creation for all 30 tables
-- PRAGMA foreign_keys is set at connection time by the migration runner.
-- All monetary values: INTEGER (paise). All dates: TEXT (ISO 8601).
-- All PKs: TEXT (UUID v4).

-- ============================================================
-- BUSINESS
-- ============================================================
CREATE TABLE IF NOT EXISTS business (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_path TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  state_code TEXT,
  pin TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  gstin TEXT,
  pan TEXT,
  bank_name TEXT,
  account_number TEXT,
  ifsc TEXT,
  upi_id TEXT,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  financial_year_start INTEGER NOT NULL DEFAULT 4,
  signature_path TEXT,
  terms_and_conditions TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS business_settings (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(business_id, key)
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'owner',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  customer_code TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  state_code TEXT,
  pin TEXT,
  gstin TEXT,
  pan TEXT,
  opening_balance INTEGER NOT NULL DEFAULT 0,
  credit_limit INTEGER NOT NULL DEFAULT 0,
  payment_terms INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(business_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(business_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_gstin ON customers(business_id, gstin);

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  supplier_code TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  state_code TEXT,
  pin TEXT,
  gstin TEXT,
  pan TEXT,
  opening_balance INTEGER NOT NULL DEFAULT 0,
  payment_terms INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_suppliers_business ON suppliers(business_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(business_id, name);

-- ============================================================
-- PRODUCT CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id TEXT REFERENCES product_categories(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_business ON product_categories(business_id);

-- ============================================================
-- UNITS
-- ============================================================
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_units_business ON units(business_id);

-- ============================================================
-- TAX RATES
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_rates (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rate INTEGER NOT NULL,
  hsn_code TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_business ON tax_rates(business_id);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  product_code TEXT,
  sku TEXT,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category_id TEXT REFERENCES product_categories(id),
  brand TEXT,
  unit_id TEXT REFERENCES units(id),
  purchase_price INTEGER NOT NULL DEFAULT 0,
  selling_price INTEGER NOT NULL DEFAULT 0,
  mrp INTEGER NOT NULL DEFAULT 0,
  tax_rate_id TEXT REFERENCES tax_rates(id),
  hsn_code TEXT,
  opening_stock INTEGER NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 0,
  default_supplier_id TEXT REFERENCES suppliers(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(business_id, name);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(business_id, product_code);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(business_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(business_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(business_id, category_id);

-- ============================================================
-- INVOICE SEQUENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_sequences (
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

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  customer_snapshot TEXT NOT NULL DEFAULT '{}',
  invoice_date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  payment_status TEXT NOT NULL DEFAULT 'UNPAID',
  supply_type TEXT NOT NULL DEFAULT 'INTRASTATE',
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  taxable_amount INTEGER NOT NULL DEFAULT 0,
  cgst_amount INTEGER NOT NULL DEFAULT 0,
  sgst_amount INTEGER NOT NULL DEFAULT 0,
  igst_amount INTEGER NOT NULL DEFAULT 0,
  total_tax INTEGER NOT NULL DEFAULT 0,
  round_off INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  terms_and_conditions TEXT,
  payment_method TEXT,
  created_by TEXT REFERENCES users(id),
  cancelled_at TEXT,
  cancelled_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(business_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(business_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(business_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(business_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(business_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(business_id, invoice_number);

-- ============================================================
-- INVOICE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  product_snapshot TEXT NOT NULL DEFAULT '{}',
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  hsn_code TEXT,
  quantity INTEGER NOT NULL DEFAULT 100,
  unit TEXT,
  purchase_price INTEGER NOT NULL DEFAULT 0,
  unit_price INTEGER NOT NULL DEFAULT 0,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  taxable_amount INTEGER NOT NULL DEFAULT 0,
  tax_rate INTEGER NOT NULL DEFAULT 0,
  cgst_rate INTEGER NOT NULL DEFAULT 0,
  sgst_rate INTEGER NOT NULL DEFAULT 0,
  igst_rate INTEGER NOT NULL DEFAULT 0,
  cgst_amount INTEGER NOT NULL DEFAULT 0,
  sgst_amount INTEGER NOT NULL DEFAULT 0,
  igst_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);

-- ============================================================
-- PURCHASES
-- ============================================================
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  purchase_number TEXT,
  supplier_id TEXT REFERENCES suppliers(id),
  supplier_snapshot TEXT NOT NULL DEFAULT '{}',
  purchase_date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  payment_status TEXT NOT NULL DEFAULT 'UNPAID',
  supply_type TEXT NOT NULL DEFAULT 'INTRASTATE',
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  taxable_amount INTEGER NOT NULL DEFAULT 0,
  cgst_amount INTEGER NOT NULL DEFAULT 0,
  sgst_amount INTEGER NOT NULL DEFAULT 0,
  igst_amount INTEGER NOT NULL DEFAULT 0,
  total_tax INTEGER NOT NULL DEFAULT 0,
  round_off INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_business ON purchases(business_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(business_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(business_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(business_id, status);

-- ============================================================
-- PURCHASE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  product_snapshot TEXT NOT NULL DEFAULT '{}',
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  hsn_code TEXT,
  quantity INTEGER NOT NULL DEFAULT 100,
  unit TEXT,
  unit_price INTEGER NOT NULL DEFAULT 0,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  taxable_amount INTEGER NOT NULL DEFAULT 0,
  tax_rate INTEGER NOT NULL DEFAULT 0,
  cgst_rate INTEGER NOT NULL DEFAULT 0,
  sgst_rate INTEGER NOT NULL DEFAULT 0,
  igst_rate INTEGER NOT NULL DEFAULT 0,
  cgst_amount INTEGER NOT NULL DEFAULT 0,
  sgst_amount INTEGER NOT NULL DEFAULT 0,
  igst_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL,
  party_type TEXT NOT NULL,
  party_id TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'CASH',
  reference_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(business_id, party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(business_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(business_id, payment_type);

-- ============================================================
-- PAYMENT ALLOCATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id TEXT REFERENCES invoices(id),
  purchase_id TEXT REFERENCES purchases(id),
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_invoice ON payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_allocations_purchase ON payment_allocations(purchase_id);

-- ============================================================
-- LEDGER ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  party_type TEXT,
  party_id TEXT,
  reference_type TEXT NOT NULL,
  reference_id TEXT,
  description TEXT NOT NULL,
  debit INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_business ON ledger_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_ledger_party ON ledger_entries(business_id, party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON ledger_entries(business_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON ledger_entries(reference_type, reference_id);

-- ============================================================
-- STOCK MOVEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  quantity INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_business ON stock_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_movements(business_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_date ON stock_movements(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_reference ON stock_movements(reference_type, reference_id);

-- ============================================================
-- RETURNS
-- ============================================================
CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  return_type TEXT NOT NULL,
  return_number TEXT NOT NULL,
  original_invoice_id TEXT REFERENCES invoices(id),
  original_purchase_id TEXT REFERENCES purchases(id),
  party_id TEXT NOT NULL,
  return_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  total_amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_returns_business ON returns(business_id);

-- ============================================================
-- RETURN ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);

-- ============================================================
-- CREDIT NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_notes (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  credit_note_number TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  return_id TEXT REFERENCES returns(id),
  invoice_id TEXT REFERENCES invoices(id),
  issue_date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'ISSUED',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_business ON credit_notes(business_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer ON credit_notes(business_id, customer_id);

-- ============================================================
-- DEBIT NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS debit_notes (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  debit_note_number TEXT NOT NULL,
  supplier_id TEXT REFERENCES suppliers(id),
  return_id TEXT REFERENCES returns(id),
  purchase_id TEXT REFERENCES purchases(id),
  issue_date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'ISSUED',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_debit_notes_business ON debit_notes(business_id);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  expense_date TEXT NOT NULL,
  category TEXT,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT,
  reference_number TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_business ON expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(business_id, expense_date);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_business ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(business_id, created_at);

-- ============================================================
-- BACKUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  backup_type TEXT NOT NULL,
  file_path TEXT,
  cloud_key TEXT,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'PENDING',
  checksum TEXT,
  provider_metadata TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_backups_business ON backups(business_id);

-- ============================================================
-- SYNC RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_records (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  sync_type TEXT NOT NULL,
  direction TEXT,
  status TEXT NOT NULL,
  last_sync_at TEXT,
  conflict_strategy TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ============================================================
-- APP SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_at TEXT NOT NULL
);

-- Seed default app settings
INSERT OR IGNORE INTO app_settings (id, key, value, description, updated_at)
VALUES
  ('aset_db_version', 'db_version', '1', 'Current database schema version', datetime('now')),
  ('aset_gst_mode', 'gst_mode', 'exclusive', 'GST pricing mode: inclusive or exclusive', datetime('now')),
  ('aset_setup_complete', 'setup_complete', '0', 'Whether initial setup wizard has been completed', datetime('now'));
