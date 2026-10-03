/**
 * ORION Audit Log Service
 * Records important application events for auditability.
 */
import { dbExecute } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'
import type { AuditAction, AuditEntityType, AuditLog } from '@/types/audit'

export interface AuditEventInput {
  businessId: string
  userId?: string | null
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
}

/**
 * Record an audit event. Non-throwing — log failures silently so they
 * don't abort the primary business operation.
 */
export async function recordAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    await dbExecute(
      `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, old_values, new_values, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        event.businessId,
        event.userId ?? null,
        event.action,
        event.entityType,
        event.entityId,
        event.oldValues ? JSON.stringify(event.oldValues) : null,
        event.newValues ? JSON.stringify(event.newValues) : null,
        nowISO(),
      ],
    )
  } catch (err) {
    // Never let audit logging abort a business operation
    console.warn('[ORION Audit] Failed to record audit event:', err)
  }
}

export interface AuditLogFilters {
  businessId: string
  entityType?: AuditEntityType
  entityId?: string
  action?: AuditAction
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

export async function getAuditLogs(filters: AuditLogFilters) {
  const { dbSelect } = await import('@db/client')
  const conditions: string[] = ['business_id = ?']
  const params: unknown[] = [filters.businessId]

  if (filters.entityType) { conditions.push('entity_type = ?'); params.push(filters.entityType) }
  if (filters.entityId) { conditions.push('entity_id = ?'); params.push(filters.entityId) }
  if (filters.action) { conditions.push('action = ?'); params.push(filters.action) }
  if (filters.fromDate) { conditions.push('created_at >= ?'); params.push(filters.fromDate) }
  if (filters.toDate) { conditions.push('created_at <= ?'); params.push(filters.toDate + 'T23:59:59') }

  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const offset = (page - 1) * pageSize

  const whereClause = conditions.join(' AND ')

  const [rows, countResult] = await Promise.all([
    dbSelect<Record<string, unknown>>(
      `SELECT * FROM audit_logs WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    ),
    dbSelect<{ total: number }>(
      `SELECT COUNT(*) as total FROM audit_logs WHERE ${whereClause}`,
      params,
    ),
  ])

  const data: AuditLog[] = rows.map((r) => ({
    id: r.id as string,
    businessId: r.business_id as string,
    userId: r.user_id as string | null,
    action: r.action as AuditAction,
    entityType: r.entity_type as AuditEntityType,
    entityId: r.entity_id as string,
    oldValues: r.old_values ? JSON.parse(r.old_values as string) : null,
    newValues: r.new_values ? JSON.parse(r.new_values as string) : null,
    createdAt: r.created_at as string,
  }))

  return {
    data,
    total: countResult[0]?.total ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((countResult[0]?.total ?? 0) / pageSize),
  }
}
