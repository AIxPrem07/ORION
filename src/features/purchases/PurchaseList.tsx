import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ShoppingCart, Download } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { SearchInput } from '@components/ui/SearchInput'
import { Table } from '@components/ui/Table'
import { Pagination } from '@components/ui/Pagination'
import { EmptyState } from '@components/ui/EmptyState'
import LoadingState from '@components/ui/LoadingState'
import { Badge } from '@components/ui/Badge'
import { useBusinessStore } from '@store/business.store'
import { listPurchases } from '@services/purchase.service'
import { formatCurrency } from '@utils/decimal'
import { formatDate } from '@utils/date'
import { exportPurchasesToCSV, triggerCSVDownload } from '@services/import-export.service'
import type { Purchase } from '@/types/purchase'

const PAGE_SIZE = 50

export default function PurchaseList() {
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  const load = useCallback(async () => {
    if (!business) return
    setIsLoading(true)
    try {
      const result = await listPurchases({ businessId: business.id, page, pageSize: PAGE_SIZE })
      setPurchases(result.data)
      setTotal(result.total)
    } finally {
      setIsLoading(false)
    }
  }, [business, page])

  useEffect(() => { load() }, [load])

  const handleExport = async () => {
    if (!business) return
    setIsExporting(true)
    try {
      const csv = await exportPurchasesToCSV(business.id)
      triggerCSVDownload('purchases.csv', csv)
    } finally {
      setIsExporting(false)
    }
  }

  const columns = [
    { key: 'number', header: 'Purchase #', cell: (p: Purchase) => <span className="font-medium">{p.purchaseNumber ?? 'Draft'}</span> },
    { key: 'supplier', header: 'Supplier', cell: (p: Purchase) => p.supplierSnapshot?.name ?? '—' },
    { key: 'date', header: 'Date', cell: (p: Purchase) => formatDate(p.purchaseDate) },
    { key: 'amount', header: 'Amount', cell: (p: Purchase) => <span className="tabular-nums font-medium">{formatCurrency(p.totalAmount)}</span> },
    { key: 'status', header: 'Status', cell: (p: Purchase) => <Badge variant={p.status === 'FINALIZED' ? 'info' : p.status === 'PAID' ? 'primary' : 'muted'}>{p.status}</Badge> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Purchases"
        subtitle={`${total} purchase${total !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download size={13} />}
              onClick={handleExport}
              isLoading={isExporting}
            >
              Export CSV
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => navigate('/purchases/new')}>
              New Purchase
            </Button>
          </div>
        }
      />
      <div className="bg-white border border-orion-border rounded-lg shadow-orion">
        {isLoading ? <LoadingState fullHeight /> : (
          <Table columns={columns} data={purchases} keyExtractor={(p) => p.id}
            onRowClick={(p) => navigate(`/purchases/${p.id}`)}
            emptyState={<EmptyState icon={<ShoppingCart size={32} />} title="No purchases yet" action={{ label: 'Create Purchase', onClick: () => navigate('/purchases/new') }} />}
          />
        )}
        <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  )
}
