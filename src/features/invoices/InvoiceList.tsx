import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Download } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { SearchInput } from '@components/ui/SearchInput'
import { Table } from '@components/ui/Table'
import { Pagination } from '@components/ui/Pagination'
import { InvoiceStatusBadge, PaymentStatusBadge } from '@components/ui/Badge'
import { EmptyState } from '@components/ui/EmptyState'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { listInvoices } from '@services/invoice.service'
import { formatCurrency } from '@utils/decimal'
import { formatDate } from '@utils/date'
import { exportInvoicesToCSV, triggerCSVDownload } from '@services/import-export.service'
import type { Invoice } from '@/types/invoice'

const PAGE_SIZE = 50

export default function InvoiceList() {
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  const load = useCallback(async () => {
    if (!business) return
    setIsLoading(true)
    try {
      const result = await listInvoices({ businessId: business.id, search, page, pageSize: PAGE_SIZE })
      setInvoices(result.data); setTotal(result.total)
    } finally { setIsLoading(false) }
  }, [business, search, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search])

  const handleExport = async () => {
    if (!business) return
    setIsExporting(true)
    try {
      const csv = await exportInvoicesToCSV(business.id)
      triggerCSVDownload('invoices.csv', csv)
    } finally {
      setIsExporting(false)
    }
  }

  const columns = [
    { key: 'number', header: 'Invoice #', cell: (inv: Invoice) => <span className="font-medium text-gray-900">{inv.invoiceNumber}</span> },
    { key: 'customer', header: 'Customer', cell: (inv: Invoice) => inv.customerSnapshot?.name ?? 'Walk-in' },
    { key: 'date', header: 'Date', cell: (inv: Invoice) => formatDate(inv.invoiceDate) },
    { key: 'amount', header: 'Amount', cell: (inv: Invoice) => <span className="tabular-nums font-medium">{formatCurrency(inv.totalAmount)}</span>, className: 'text-right', headerClassName: 'text-right' },
    { key: 'status', header: 'Status', cell: (inv: Invoice) => <InvoiceStatusBadge status={inv.status} /> },
    { key: 'payment', header: 'Payment', cell: (inv: Invoice) => <PaymentStatusBadge status={inv.paymentStatus} /> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Invoices"
        subtitle={`${total} invoice${total !== 1 ? 's' : ''}`}
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
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => navigate('/invoices/new')}>
              New Invoice
            </Button>
          </div>
        }
      />
      <div className="bg-white border border-orion-border rounded-lg shadow-orion">
        <div className="p-4 border-b border-orion-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by invoice number or customer name..." className="max-w-xs" />
        </div>
        {isLoading ? <LoadingState fullHeight /> : (
          <Table columns={columns} data={invoices} keyExtractor={(inv) => inv.id}
            onRowClick={(inv) => navigate(`/invoices/${inv.id}`)}
            emptyState={<EmptyState icon={<FileText size={32} />} title="No invoices yet" action={{ label: 'Create Invoice', onClick: () => navigate('/invoices/new') }} />}
          />
        )}
        <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  )
}
