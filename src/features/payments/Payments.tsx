import { useEffect, useState, useCallback } from 'react'
import { CreditCard } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Table } from '@components/ui/Table'
import { Pagination } from '@components/ui/Pagination'
import { EmptyState } from '@components/ui/EmptyState'
import LoadingState from '@components/ui/LoadingState'
import { Badge } from '@components/ui/Badge'
import { useBusinessStore } from '@store/business.store'
import { dbSelect } from '@db/client'
import { formatCurrency } from '@utils/decimal'
import { formatDate } from '@utils/date'

const PAGE_SIZE = 50

interface PaymentRecord {
  id: string
  payment_type: string
  payment_date: string
  amount: number
  method: string
  reference_number: string | null
  notes: string | null
}

export default function Payments() {
  const { business } = useBusinessStore()
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!business) return
    setIsLoading(true)
    const offset = (page - 1) * PAGE_SIZE
    try {
      const [rows, countResult] = await Promise.all([
        dbSelect<PaymentRecord>(`SELECT * FROM payments WHERE business_id = ? ORDER BY payment_date DESC, created_at DESC LIMIT ? OFFSET ?`, [business.id, PAGE_SIZE, offset]),
        dbSelect<{ total: number }>(`SELECT COUNT(*) as total FROM payments WHERE business_id = ?`, [business.id]),
      ])
      setPayments(rows)
      setTotal(countResult[0]?.total ?? 0)
    } finally {
      setIsLoading(false)
    }
  }, [business, page])

  useEffect(() => { load() }, [load])

  const columns = [
    { key: 'type', header: 'Type', cell: (p: PaymentRecord) => <Badge variant={p.payment_type === 'RECEIPT' ? 'primary' : 'warning'}>{p.payment_type}</Badge> },
    { key: 'date', header: 'Date', cell: (p: PaymentRecord) => formatDate(p.payment_date) },
    { key: 'amount', header: 'Amount', cell: (p: PaymentRecord) => <span className="tabular-nums font-semibold">{formatCurrency(p.amount)}</span> },
    { key: 'method', header: 'Method', cell: (p: PaymentRecord) => p.method },
    { key: 'ref', header: 'Reference', cell: (p: PaymentRecord) => p.reference_number ?? '—' },
    { key: 'notes', header: 'Notes', cell: (p: PaymentRecord) => p.notes ?? '—' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Payments" subtitle={`${total} payment${total !== 1 ? 's' : ''}`} />
      <div className="bg-white border border-orion-border rounded-lg shadow-orion">
        {isLoading ? <LoadingState fullHeight /> : (
          <Table columns={columns} data={payments} keyExtractor={(p) => p.id}
            emptyState={<EmptyState icon={<CreditCard size={32} />} title="No payments recorded" />}
          />
        )}
        <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  )
}
