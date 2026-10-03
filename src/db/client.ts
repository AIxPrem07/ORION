/**
 * ORION Database Client
 * 
 * Initializes the SQLite connection via tauri-plugin-sql.
 * This module is the single source of truth for the DB connection.
 * 
 * Uses the Drizzle sqlite-proxy pattern:
 * - Drizzle schema: for TypeScript type generation
 * - tauri-plugin-sql: for actual query execution in the Tauri runtime
 */
import Database from '@tauri-apps/plugin-sql'

let _db: Database | null = null

/** Get or initialize the SQLite database connection */
export async function getDb(): Promise<Database> {
  if (_db) return _db
  _db = await Database.load('sqlite:orion.db')
  return _db
}

/** Close the database connection (call on app exit) */
export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.close()
    _db = null
  }
}

/**
 * Execute a query that returns rows.
 * Always use parameterized queries — never string interpolation.
 */
export async function dbSelect<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await getDb()
  return db.select<T[]>(sql, params)
}

/**
 * Execute a statement that modifies data (INSERT, UPDATE, DELETE).
 * Returns the number of rows affected and the last inserted row ID.
 */
export async function dbExecute(
  sql: string,
  params: unknown[] = [],
): Promise<{ rowsAffected: number; lastInsertId?: number }> {
  const db = await getDb()
  return db.execute(sql, params)
}

/**
 * Execute multiple statements in sequence.
 * In tauri-plugin-sql with a connection pool, explicit BEGIN/COMMIT across
 * multiple IPC calls causes SQLITE_BUSY deadlocks because connections
 * are returned to the pool after each IPC call.
 * This wrapper provides a transaction-compatible interface while executing operations sequentially.
 */
export async function dbTransaction<T>(
  operations: (tx: {
    select: typeof dbSelect
    execute: typeof dbExecute
  }) => Promise<T>,
): Promise<T> {
  const tx = {
    select: dbSelect,
    execute: dbExecute,
  }
  return operations(tx)
}
