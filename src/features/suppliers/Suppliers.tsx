import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Truck } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { SearchInput } from '@components/ui/SearchInput'
import { Table } from '@components/ui/Table'
import { Pagination } from '@components/ui/Pagination'
import { EmptyState } from '@components/ui/EmptyState'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { listSuppliers } from '@services/supplier.service'
import { formatCurrency } from '@utils/decimal'
import type { Supplier } from '@/types/supplier'

const PAGE_SIZE = 50

export default function Suppliers() {
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!business) return
    setIsLoading(true)
    try {
      const result = await listSuppliers({ businessId: business.id, search, page, pageSize: PAGE_SIZE, isActive: true })
      setSuppliers(result.data)
      setTotal(result.total)
    } finally { setIsLoading(false) }
  }, [business, search, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search])

  const columns = [
    { key: 'name', header: 'Name', cell: (s: Supplier) => <span className="font-medium text-gray-900">{s.name}</span> },
    { key: 'phone', header: 'Phone', cell: (s: Supplier) => s.phone ?? <span className="text-gray-400">—</span> },
    { key: 'gstin', header: 'GSTIN', cell: (s: Supplier) => s.gstin ?? <span className="text-gray-400">—</span> },
    { key: 'city', header: 'City', cell: (s: Supplier) => s.city ?? '—' },
    { key: 'balance', header: 'Opening Balance', cell: (s: Supplier) => <span className="tabular-nums">{formatCurrency(s.openingBalance)}</span> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Suppliers" subtitle={`${total} supplier${total !== 1 ? 's' : ''}`}
        actions={<Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => navigate('/suppliers/new')}>Add Supplier</Button>}
      />
      <div className="bg-white border border-orion-border rounded-lg shadow-orion">
        <div className="p-4 border-b border-orion-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search suppliers..." className="max-w-xs" />
        </div>
        {isLoading ? <LoadingState fullHeight /> : (
          <Table columns={columns} data={suppliers} keyExtractor={(s) => s.id}
            onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
            emptyState={<EmptyState icon={<Truck size={32} />} title="No suppliers yet" action={{ label: 'Add Supplier', onClick: () => navigate('/suppliers/new') }} />}
          />
        )}
        <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  )
}
