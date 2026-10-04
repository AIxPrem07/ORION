/**
 * ORION Database Migration Runner
 * 
 * Runs all pending SQL migrations on application startup.
 * Migrations are idempotent (IF NOT EXISTS pattern).
 * Tracks applied migrations in app_settings.db_version.
 * 
 * IMPORTANT: Migrations must NEVER make destructive changes to data.
 * Adding columns, tables, indexes is safe.
 * Dropping or renaming requires a careful new migration with data preservation.
 */

// Import migration SQL files using Vite's ?raw import
import migration_0001 from '../../src-tauri/migrations/0001_initial.sql?raw'
import migration_0002 from '../../src-tauri/migrations/0002_gst_enhancements.sql?raw'
import migration_0003 from '../../src-tauri/migrations/0003_licensing_and_product_keys.sql?raw'
import migration_0004 from '../../src-tauri/migrations/0004_invoice_bin_and_numbering.sql?raw'
import migration_0005 from '../../src-tauri/migrations/0005_challan_and_financial_year.sql?raw'
import migration_0006 from '../../src-tauri/migrations/0006_challan_fixes.sql?raw'

import { dbExecute, dbSelect, getDb } from './client'
import { nowISO } from '@utils/date'

interface Migration {
  version: number
  description: string
  sql: string
}

/** All migrations in order. Add new migrations here. */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema — all 30 tables',
    sql: migration_0001,
  },
  {
    version: 2,
    description: 'GST enhancements: shipping address, transport & vehicle details, HSN directory',
    sql: migration_0002,
  },
  {
    version: 3,
    description: 'Product keys & offline licensing system',
    sql: migration_0003,
  },
  {
    version: 4,
    description: 'Invoice Recycle Bin & Custom Numbering',
    sql: migration_0004,
  },
  {
    version: 5,
    description: 'Delivery Challans & Financial Year partitioning',
    sql: migration_0005,
  },
  {
    version: 6,
    description: 'Delivery Challan items foreign key & nullability fixes',
    sql: migration_0006,
  },
]

const CURRENT_DB_VERSION = MIGRATIONS.length

/**
 * Initialize the database:
 * 1. Enable foreign keys
 * 2. Enable WAL mode for better concurrency
 * 3. Run any pending migrations
 */
export async function initializeDatabase(): Promise<void> {
  const db = await getDb()

  // Enable foreign key enforcement
  await db.execute('PRAGMA foreign_keys = ON', [])

  // Enable WAL mode for better performance and crash recovery
  await db.execute('PRAGMA journal_mode = WAL', [])

  // Set page cache size (10MB)
  await db.execute('PRAGMA cache_size = -10000', [])

  // Run migrations
  await runMigrations()

  // Self-heal check: ensure challan_items table exists regardless of previous upgrade states
  try {
    const hasItems = await dbSelect<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='challan_items'`,
      [],
    )
    if (hasItems.length === 0) {
      console.warn('[ORION DB] challan_items table missing on startup, auto-repairing schema...')
      await applyMigration0006()
    }
  } catch (healErr) {
    console.warn('[ORION DB] Schema self-heal warning:', healErr)
  }
}

/** Get the current database version from app_settings */
async function getCurrentVersion(): Promise<number> {
  try {
    const rows = await dbSelect<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'db_version' LIMIT 1`,
      [],
    )
    if (rows.length === 0) return 0
    return parseInt(rows[0].value, 10) || 0
  } catch {
    // Table doesn't exist yet (very first run)
    return 0
  }
}

/** Update the database version in app_settings */
async function setCurrentVersion(version: number): Promise<void> {
  await dbExecute(
    `INSERT INTO app_settings (id, key, value, description, updated_at)
     VALUES ('aset_db_version', 'db_version', ?, 'Current database schema version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [String(version), nowISO()],
  )
}

/**
 * Clean SQL string and split into individual executable statements.
 * Removes line comments (-- ...) and block comments (/* ... *\/).
 */
export function cleanAndSplitSQL(sql: string): string[] {
  // Strip single-line comments (-- ...)
  const withoutLineComments = sql.replace(/--.*$/gm, '')
  // Strip multi-line block comments (/* ... */)
  const withoutBlockComments = withoutLineComments.replace(/\/\*[\s\S]*?\*\//g, '')
  // Split by semicolon and trim
  return withoutBlockComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Split SQL migration file into individual statements and execute each.
 * Handles comments properly so table creation statements are never skipped.
 */
async function executeMigrationSQL(sql: string): Promise<void> {
  const statements = cleanAndSplitSQL(sql)
  const db = await getDb()
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await db.execute(statement, [])
      } catch (err: unknown) {
        const errMsg = String(err).toLowerCase()
        const isDuplicateColumn = errMsg.includes('duplicate column name')
        const isAlterTable = statement.trim().toUpperCase().startsWith('ALTER TABLE')
        if (isAlterTable && isDuplicateColumn) {
          console.warn(`[ORION DB] Column already exists, skipping: ${statement.slice(0, 60)}...`)
          continue
        }
        throw err
      }
    }
  }
}

/**
 * Safely migrate and repair challan_items schema.
 * Handles all possible previous states:
 * - Table does not exist -> creates it directly
 * - challan_items_new exists from a previous partial run -> recovers it
 * - challan_items exists with NOT NULL product_id -> safely recreates it with PRAGMA foreign_keys = OFF
 * - Already healthy -> preserves all data and ensures indexes
 */
export async function applyMigration0006(): Promise<void> {
  const db = await getDb()

  // 1. Temporarily disable foreign keys for structural table adjustments
  await db.execute('PRAGMA foreign_keys = OFF', [])

  try {
    const tables = await dbSelect<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('challan_items', 'challan_items_new')`,
      [],
    )
    const tableNames = new Set(tables.map((t) => t.name))

    const hasChallanItems = tableNames.has('challan_items')
    const hasChallanItemsNew = tableNames.has('challan_items_new')

    if (!hasChallanItems && hasChallanItemsNew) {
      // challan_items was dropped in a previous failed attempt, but challan_items_new exists: recover it!
      await db.execute(`ALTER TABLE challan_items_new RENAME TO challan_items`, [])
    } else if (!hasChallanItems && !hasChallanItemsNew) {
      // Neither exists: create clean table directly
      await db.execute(
        `CREATE TABLE IF NOT EXISTS challan_items (
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
        )`,
        [],
      )
    } else if (hasChallanItems) {
      // challan_items exists: check if product_id has NOT NULL constraint
      const columns = await dbSelect<{ name: string; notnull: number }>(
        `PRAGMA table_info(challan_items)`,
        [],
      )
      const prodCol = columns.find((c) => c.name === 'product_id')

      if (prodCol && prodCol.notnull === 1) {
        // Need to recreate table to drop NOT NULL constraint
        await db.execute(`DROP TABLE IF EXISTS challan_items_new`, [])

        await db.execute(
          `CREATE TABLE challan_items_new (
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
          )`,
          [],
        )

        await db.execute(
          `INSERT INTO challan_items_new (id, challan_id, product_id, description, hsn_code, quantity, unit, unit_price, total_amount, sort_order)
           SELECT id, challan_id, CASE WHEN product_id = '' THEN NULL ELSE product_id END, description, hsn_code, quantity, unit, unit_price, total_amount, sort_order
           FROM challan_items`,
          [],
        )

        await db.execute(`DROP TABLE challan_items`, [])
        await db.execute(`ALTER TABLE challan_items_new RENAME TO challan_items`, [])
      } else {
        // Already nullable! Clean up any leftover temp table
        if (hasChallanItemsNew) {
          await db.execute(`DROP TABLE IF EXISTS challan_items_new`, [])
        }
      }
    }

    // Always ensure indexes exist
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_challan_items_challan ON challan_items(challan_id)`, [])
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_challan_items_product ON challan_items(product_id)`, [])
  } finally {
    // Re-enable foreign keys
    await db.execute('PRAGMA foreign_keys = ON', [])
  }
}

/** Run all pending migrations */
async function runMigrations(): Promise<void> {
  const currentVersion = await getCurrentVersion()

  if (currentVersion >= CURRENT_DB_VERSION) {
    console.log(`[ORION DB] Schema up to date (version ${currentVersion})`)
    return
  }

  console.log(`[ORION DB] Migrating from version ${currentVersion} to ${CURRENT_DB_VERSION}`)

  const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion)

  for (const migration of pendingMigrations) {
    console.log(`[ORION DB] Applying migration ${migration.version}: ${migration.description}`)
    try {
      if (migration.version === 6) {
        await applyMigration0006()
      } else {
        await executeMigrationSQL(migration.sql)
      }
      await setCurrentVersion(migration.version)
      console.log(`[ORION DB] Migration ${migration.version} applied successfully`)
    } catch (err) {
      console.error(`[ORION DB] Migration ${migration.version} FAILED:`, err)
      throw new Error(
        `Database migration ${migration.version} failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  console.log(`[ORION DB] All migrations applied successfully`)
}

/** Check database integrity */
export async function checkDatabaseIntegrity(): Promise<{ ok: boolean; result: string }> {
  const rows = await dbSelect<{ integrity_check: string }>(
    'PRAGMA integrity_check',
    [],
  )
  const result = rows[0]?.integrity_check ?? 'unknown'
  return { ok: result === 'ok', result }
}

/** Get database statistics */
export async function getDatabaseStats(): Promise<{
  version: number
  pageCount: number
  pageSize: number
  sizeBytes: number
}> {
  const [versionResult, pageCountResult, pageSizeResult] = await Promise.all([
    dbSelect<{ value: string }>(`SELECT value FROM app_settings WHERE key = 'db_version'`, []),
    dbSelect<{ page_count: number }>('PRAGMA page_count', []),
    dbSelect<{ page_size: number }>('PRAGMA page_size', []),
  ])

  const pageCount = pageCountResult[0]?.page_count ?? 0
  const pageSize = pageSizeResult[0]?.page_size ?? 4096

  return {
    version: parseInt(versionResult[0]?.value ?? '0', 10),
    pageCount,
    pageSize,
    sizeBytes: pageCount * pageSize,
  }
}
