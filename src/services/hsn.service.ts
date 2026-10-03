/**
 * ORION HSN / SAC Directory Service
 * 
 * Provides access to standard Indian GST Harmonized System of Nomenclature (HSN)
 * and Services Accounting Codes (SAC).
 */
import { dbSelect } from '@db/client'

export interface HSNEntry {
  id: string
  code: string
  type: 'GOODS' | 'SERVICES'
  category: string
  description: string
  defaultGstRate: number // in basis points (e.g. 1800 for 18%)
}

function rowToHSN(r: Record<string, unknown>): HSNEntry {
  return {
    id: r.id as string,
    code: r.code as string,
    type: r.type as 'GOODS' | 'SERVICES',
    category: r.category as string,
    description: r.description as string,
    defaultGstRate: Number(r.default_gst_rate),
  }
}

/**
 * Searches the HSN directory by code, description, or category.
 */
export async function searchHSNCodes(query = '', category = ''): Promise<HSNEntry[]> {
  const trimmed = query.trim()
  const conditions: string[] = []
  const params: unknown[] = []

  if (category) {
    conditions.push('category = ?')
    params.push(category)
  }

  if (trimmed) {
    conditions.push('(code LIKE ? OR description LIKE ? OR category LIKE ?)')
    const pattern = `%${trimmed}%`
    params.push(pattern, pattern, pattern)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM hsn_directory ${whereClause} ORDER BY category ASC, code ASC LIMIT 50`,
    params,
  )

  return rows.map(rowToHSN)
}

/**
 * Lists all distinct categories in the HSN directory.
 */
export async function listHSNCategories(): Promise<string[]> {
  const rows = await dbSelect<{ category: string }>(
    `SELECT DISTINCT category FROM hsn_directory ORDER BY category ASC`,
    [],
  )
  return rows.map((r) => r.category)
}

/**
 * Gets a specific HSN record by code.
 */
export async function getHSNByCode(code: string): Promise<HSNEntry | null> {
  const rows = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM hsn_directory WHERE code = ? LIMIT 1`,
    [code.trim()],
  )
  return rows.length > 0 ? rowToHSN(rows[0]) : null
}
