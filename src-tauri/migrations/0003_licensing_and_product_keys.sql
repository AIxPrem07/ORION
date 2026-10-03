-- ============================================================
-- ORION Database Migration 0003: Product Keys & Offline Licensing
-- ============================================================

CREATE TABLE IF NOT EXISTS product_keys (
  id TEXT PRIMARY KEY,
  product_key TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  contact_info TEXT,
  plan TEXT NOT NULL DEFAULT 'lifetime',
  edition TEXT NOT NULL DEFAULT 'pro',
  device_id TEXT,
  is_activated INTEGER NOT NULL DEFAULT 0,
  activated_device_id TEXT,
  activated_at TEXT,
  expires_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_keys_key ON product_keys(product_key);
CREATE INDEX IF NOT EXISTS idx_product_keys_client ON product_keys(client_name);

INSERT OR IGNORE INTO app_settings (id, key, value, description, updated_at)
VALUES
  ('aset_license_status', 'license_status', 'unactivated', 'License activation status: unactivated or active', datetime('now')),
  ('aset_license_key', 'license_key', '', 'Active software product key', datetime('now')),
  ('aset_license_client', 'license_client_name', '', 'Registered client or business name', datetime('now')),
  ('aset_license_plan', 'license_plan', 'lifetime', 'License plan: lifetime, annual, trial', datetime('now')),
  ('aset_license_edition', 'license_edition', 'pro', 'Software edition: standard, pro, enterprise', datetime('now')),
  ('aset_license_activated_at', 'license_activated_at', '', 'Timestamp when license was activated', datetime('now')),
  ('aset_license_device_id', 'license_device_id', '', 'Device fingerprint where license is activated', datetime('now'));
