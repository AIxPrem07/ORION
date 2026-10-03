import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Package, AlertTriangle, Download, Upload } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { SearchInput } from '@components/ui/SearchInput'
import { Table } from '@components/ui/Table'
import { Pagination } from '@components/ui/Pagination'
import { Badge } from '@components/ui/Badge'
import { EmptyState } from '@components/ui/EmptyState'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { listProducts } from '@services/product.service'
import { formatCurrency } from '@utils/decimal'
import { exportProductsToCSV, triggerCSVDownload } from '@services/import-export.service'
import { ImportModal } from '@components/shared/ImportModal'
import type { ProductWithDetails } from '@/types/product'

const PAGE_SIZE = 50

export default function Products() {
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const [products, setProducts] = useState<ProductWithDetails[]>([])
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
      const result = await listProducts({ businessId: business.id, search, page, pageSize: PAGE_SIZE, isActive: true })
      setProducts(result.data); setTotal(result.total)
    } finally { setIsLoading(false) }
  }, [business, search, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search])

  const handleExport = async () => {
    if (!business) return
    setIsExporting(true)
    try {
      const csv = await exportProductsToCSV(business.id)
      triggerCSVDownload('products.csv', csv)
    } finally {
      setIsExporting(false)
    }
  }

  const columns = [
    { key: 'name', header: 'Product', cell: (p: ProductWithDetails) => (
      <div><p className="font-medium text-gray-900">{p.name}</p>{p.productCode && <p className="text-xs text-orion-secondary">{p.productCode}</p>}</div>
    )},
    { key: 'category', header: 'Category', cell: (p: ProductWithDetails) => p.categoryName ?? '—' },
    { key: 'unit', header: 'Unit', cell: (p: ProductWithDetails) => p.unitAbbreviation ?? '—' },
    { key: 'stock', header: 'Stock', cell: (p: ProductWithDetails) => (
      <span className={`tabular-nums font-medium ${p.isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
        {p.currentStock}
        {p.isLowStock && <AlertTriangle size={12} className="inline ml-1" />}
      </span>
    )},
    { key: 'price', header: 'Selling Price', cell: (p: ProductWithDetails) => <span className="tabular-nums">{formatCurrency(p.sellingPrice)}</span> },
    { key: 'gst', header: 'GST', cell: (p: ProductWithDetails) => p.taxRateName ?? '—' },
    { key: 'status', header: '', cell: (p: ProductWithDetails) => <Badge variant={p.isActive ? 'primary' : 'muted'}>{p.isActive ? 'Active' : 'Inactive'}</Badge> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Products"
        subtitle={`${total} product${total !== 1 ? 's' : ''}`}
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
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => navigate('/products/new')}>
              Add Product
            </Button>
          </div>
        }
      />
      <div className="bg-white border border-orion-border rounded-lg shadow-orion">
        <div className="p-4 border-b border-orion-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, code, barcode, HSN..." className="max-w-xs" />
        </div>
        {isLoading ? <LoadingState fullHeight /> : (
          <Table columns={columns} data={products} keyExtractor={(p) => p.id}
            onRowClick={(p) => navigate(`/products/${p.id}`)}
            emptyState={<EmptyState icon={<Package size={32} />} title="No products yet" action={{ label: 'Add Product', onClick: () => navigate('/products/new') }} />}
          />
        )}
        <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        type="products"
        onSuccess={() => {
          setIsImportOpen(false)
          load()
        }}
      />
    </div>
  )
}
