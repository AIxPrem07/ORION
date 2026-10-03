import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@components/layout/PageHeader'
import { Table } from '@components/ui/Table'
import { Pagination } from '@components/ui/Pagination'
import LoadingState from '@components/ui/LoadingState'
import { Badge } from '@components/ui/Badge'
import { useBusinessStore } from '@store/business.store'
import { getAuditLogs } from '@services/audit.service'
import { formatDate } from '@utils/date'
import type { AuditLog as AuditLogType } from '@/types/audit'

const PAGE_SIZE = 50

export default function AuditLog() {
  const { business } = useBusinessStore()
  const [logs, setLogs] = useState<AuditLogType[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!business) return
    setIsLoading(true)
    try {
      const result = await getAuditLogs({ businessId: business.id, page, pageSize: PAGE_SIZE })
      setLogs(result.data)
      setTotal(result.total)
    } finally { setIsLoading(false) }
  }, [business, page])

  useEffect(() => { load() }, [load])

  const ACTION_VARIANT: Record<string, 'primary' | 'info' | 'danger' | 'success' | 'warning' | 'default'> = {
    CREATED: 'primary',
    UPDATED: 'info',
    DELETED: 'danger',
    CANCELLED: 'danger',
    FINALIZED: 'success',
    PAYMENT_RECORDED: 'primary',
    STOCK_ADJUSTED: 'warning',
  }

  const columns = [
    { key: 'date', header: 'Date', cell: (l: AuditLogType) => <span className="text-xs text-orion-secondary">{formatDate(l.createdAt?.slice(0, 10))}</span> },
    { key: 'action', header: 'Action', cell: (l: AuditLogType) => <Badge variant={ACTION_VARIANT[l.action] ?? 'default'}>{l.action}</Badge> },
    { key: 'entity', header: 'Entity', cell: (l: AuditLogType) => <span className="text-xs">{l.entityType}</span> },
    { key: 'details', header: 'Details', cell: (l: AuditLogType) => (
      <span className="text-xs text-orion-secondary">
        {l.newValues ? JSON.stringify(l.newValues).slice(0, 80) : '—'}
      </span>
    )},
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Audit Log" subtitle="All system events" />
      <div className="bg-white border border-orion-border rounded-lg shadow-orion">
        {isLoading ? <LoadingState fullHeight /> : (
          <Table columns={columns} data={logs} keyExtractor={(l) => l.id} />
        )}
        <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  )
}
