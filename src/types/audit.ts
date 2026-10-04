import type { UUID, ISODateTimeString } from './common'

export type AuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'FINALIZED'
  | 'CANCELLED'
  | 'PAYMENT_RECORDED'
  | 'STOCK_ADJUSTED'
  | 'BACKUP_CREATED'
  | 'BACKUP_RESTORED'
  | 'SETTINGS_CHANGED'
  | 'IMPORT'
  | 'EXPORT'
  | 'RESTORED'

export type AuditEntityType =
  | 'INVOICE'
  | 'PURCHASE'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'PRODUCT'
  | 'PAYMENT'
  | 'STOCK'
  | 'CHALLAN'
  | 'BUSINESS'
  | 'BACKUP'
  | 'SETTINGS'
  | 'RETURN'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'

export interface AuditLog {
  id: UUID
  businessId: UUID
  userId: UUID | null
  action: AuditAction
  entityType: AuditEntityType
  entityId: UUID
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  createdAt: ISODateTimeString
}
