import { describe, it, expect } from 'vitest'
import { cleanAndSplitSQL } from '@db/migrations'
import migration0001 from '../../src-tauri/migrations/0001_initial.sql?raw'
import migration0002 from '../../src-tauri/migrations/0002_gst_enhancements.sql?raw'

import migration0003 from '../../src-tauri/migrations/0003_licensing_and_product_keys.sql?raw'

describe('db/migrations — cleanAndSplitSQL', () => {
  it('does not drop statements that start with section comments', () => {
    const rawSql = `
      -- ============================================================
      -- USERS TABLE
      -- ============================================================
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT);
      -- Next table
      CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY);
    `
    const stmts = cleanAndSplitSQL(rawSql)
    expect(stmts.length).toBe(2)
    expect(stmts[0]).toContain('CREATE TABLE IF NOT EXISTS users')
    expect(stmts[1]).toContain('CREATE TABLE IF NOT EXISTS items')
  })

  it('correctly extracts all 28 tables from 0001_initial.sql', () => {
    const stmts = cleanAndSplitSQL(migration0001)
    const tableStmts = stmts.filter((s) => s.toUpperCase().startsWith('CREATE TABLE'))
    expect(tableStmts.length).toBe(28)

    // Verify key tables are present
    const joined = tableStmts.join(' ')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS business')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS customers')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS suppliers')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS products')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS invoices')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS payments')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS returns')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS credit_notes')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS debit_notes')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS app_settings')
  })

  it('correctly parses 0002_gst_enhancements.sql with ALTER TABLE, CREATE TABLE, and HSN seeds', () => {
    const stmts = cleanAndSplitSQL(migration0002)
    expect(stmts.length).toBeGreaterThan(15)

    const joined = stmts.join(' ')
    expect(joined).toContain('ALTER TABLE invoices ADD COLUMN shipping_name')
    expect(joined).toContain('ALTER TABLE invoices ADD COLUMN vehicle_number')
    expect(joined).toContain('ALTER TABLE invoices ADD COLUMN shipping_charges')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS hsn_directory')
    expect(joined).toContain('INSERT OR IGNORE INTO hsn_directory')
  })

  it('correctly parses 0004_invoice_bin_and_numbering.sql with is_deleted and deleted_at columns', () => {
    const raw0004 = `
      ALTER TABLE invoices ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN deleted_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_invoices_deleted ON invoices(business_id, is_deleted);
    `
    const stmts = cleanAndSplitSQL(raw0004)
    expect(stmts.length).toBe(3)
    const joined = stmts.join(' ')
    expect(joined).toContain('ALTER TABLE invoices ADD COLUMN is_deleted')
    expect(joined).toContain('ALTER TABLE invoices ADD COLUMN deleted_at')
    expect(joined).toContain('CREATE INDEX IF NOT EXISTS idx_invoices_deleted')
  })
})

