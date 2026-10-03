import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Download, Upload } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { SearchInput } from '@components/ui/SearchInput'
import { Table } from '@components/ui/Table'
import { Pagination } from '@components/ui/Pagination'
import { Badge } from '@components/ui/Badge'
import { EmptyState } from '@components/ui/EmptyState'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { listCustomers } from '@services/customer.service'
import { formatCurrency } from '@utils/decimal'
import { exportCustomersToCSV, triggerCSVDownload } from '@services/import-export.service'
import { ImportModal } from '@components/shared/ImportModal'
import type { Customer } from '@/types/customer'

const PAGE_SIZE = 50

export default function Customers() {
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const load = useCallback(async () => {
    if (!business) return
    setIsLoading(true)
    try {
      const result = await listCustomers({ businessId: business.id, search, page, pageSize: PAGE_SIZE, isActive: true })
      setCustomers(result.data)
      setTotal(result.total)
    } finally { setIsLoading(false) }
  }, [business, search, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search])

  const handleExport = async () => {
    if (!business) return
    setIsExporting(true)
    try {
      const csv = await exportCustomersToCSV(business.id)
      triggerCSVDownload('customers.csv', csv)
    } finally {
      setIsExporting(false)
    }
  }

  const columns = [
    { key: 'name', header: 'Name', cell: (c: Customer) => <span className="font-medium text-gray-900">{c.name}</span> },
    { key: 'phone', header: 'Phone', cell: (c: Customer) => c.phone ?? <span className="text-gray-400">—</span> },
    { key: 'gstin', header: 'GSTIN', cell: (c: Customer) => c.gstin ?? <span className="text-gray-400">—</span> },
    { key: 'city', header: 'City', cell: (c: Customer) => c.city ?? '—' },
    { key: 'balance', header: 'Opening Balance', cell: (c: Customer) => <span className="tabular-nums">{formatCurrency(c.openingBalance)}</span> },
    { key: 'status', header: 'Status', cell: (c: Customer) => <Badge variant={c.isActive ? 'primary' : 'muted'}>{c.isActive ? 'Active' : 'Inactive'}</Badge> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Customers"
        subtitle={`${total} customer${total !== 1 ? 's' : ''}`}
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
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Upload size={13} />}
              onClick={() => setIsImportOpen(true)}
            >
              Import CSV
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => navigate('/customers/new')}>
              Add Customer
            </Button>
          </div>
        }
      />
      <div className="bg-white border border-orion-border rounded-lg shadow-orion">
        <div className="p-4 border-b border-orion-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, phone, GSTIN..." className="max-w-xs" />
        </div>
        {isLoading ? <LoadingState fullHeight /> : (
          <Table
            columns={columns}
            data={customers}
            keyExtractor={(c) => c.id}
            onRowClick={(c) => navigate(`/customers/${c.id}`)}
            emptyState={
              <EmptyState
                icon={<Users size={32} />}
                title="No customers yet"
                description="Add your first customer to start creating invoices."
                action={{ label: 'Add Customer', onClick: () => navigate('/customers/new') }}
              />
            }
          />
        )}
        <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        type="customers"
        onSuccess={() => {
          setIsImportOpen(false)
          load()
        }}
      />
    </div>
  )
}
