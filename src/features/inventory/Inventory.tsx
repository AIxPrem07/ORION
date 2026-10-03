import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Package, PackagePlus, SlidersHorizontal, CalendarDays, History, Plus } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { SearchInput } from '@components/ui/SearchInput'
import { Table } from '@components/ui/Table'
import { EmptyState } from '@components/ui/EmptyState'
import LoadingState from '@components/ui/LoadingState'
import { Button } from '@components/ui/Button'
import { useBusinessStore } from '@store/business.store'
import { getAllCurrentStock } from '@services/inventory.service'
import { ensureAllDefaultUnits } from '@services/product.service'
import { StockAdjustmentModal, type StockProductOption } from './StockAdjustmentModal'
import type { CurrentStock } from '@/types/inventory'

export default function Inventory() {
  const { business } = useBusinessStore()
  const navigate = useNavigate()
  const [stock, setStock] = useState<CurrentStock[]>([])
  const [search, setSearch] = useState('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Stock Adjustment Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalProductId, setModalProductId] = useState<string | undefined>(undefined)
  const [modalMode, setModalMode] = useState<'ADD' | 'DEDUCT' | 'SET'>('ADD')

  const load = useCallback(async () => {
    if (!business) return
    setIsLoading(true)
    try {
      // Also ensure standard packaging units are seeded
      await ensureAllDefaultUnits(business.id)
      const data = await getAllCurrentStock(business.id)
      setStock(data)
    } finally {
      setIsLoading(false)
    }
  }, [business])

  useEffect(() => {
    load()
  }, [load])

  const openAdjustmentModal = (productId?: string, mode: 'ADD' | 'DEDUCT' | 'SET' = 'ADD') => {
    setModalProductId(productId)
    setModalMode(mode)
    setIsModalOpen(true)
  }

  const filtered = stock.filter((s) => {
    const matchesSearch =
      !search ||
      s.productName.toLowerCase().includes(search.toLowerCase()) ||
      (s.productCode?.toLowerCase().includes(search.toLowerCase()) ?? false)
    const matchesLowStock = !showLowStockOnly || s.isLowStock
    return matchesSearch && matchesLowStock
  })

  const lowCount = stock.filter((s) => s.isLowStock).length

  const modalProducts: StockProductOption[] = stock.map((s) => ({
    id: s.productId,
    name: s.productName,
    productCode: s.productCode,
    unitAbbreviation: s.unitAbbreviation,
    currentStock: s.currentStock,
  }))

  const columns = [
    {
      key: 'name',
      header: 'Product',
      cell: (s: CurrentStock) => (
        <div onClick={() => navigate(`/products/${s.productId}`)} className="cursor-pointer group">
          <p className="font-medium text-gray-900 group-hover:text-orion-primary transition-colors">
            {s.productName}
          </p>
          {s.productCode && <p className="text-xs text-orion-secondary">{s.productCode}</p>}
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Packaging / Unit',
      cell: (s: CurrentStock) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
          {s.unitAbbreviation ?? 'Unit'}
        </span>
      ),
    },
    {
      key: 'current',
      header: 'Active Stock',
      cell: (s: CurrentStock) => (
        <div className="flex items-center gap-1.5">
          <span className={`tabular-nums font-bold text-sm ${s.isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
            {s.currentStock}
          </span>
          <span className="text-xs text-gray-500">{s.unitAbbreviation}</span>
          {s.isLowStock && <AlertTriangle size={13} className="text-amber-500" />}
        </div>
      ),
    },
    {
      key: 'min',
      header: 'Min Threshold',
      cell: (s: CurrentStock) => (
        <span className="tabular-nums text-xs text-orion-secondary">
          {s.minimumStock} {s.unitAbbreviation}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (s: CurrentStock) =>
        s.isLowStock ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
            Low Stock
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
            In Stock
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Stock Actions',
      cell: (s: CurrentStock) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
            onClick={(e) => {
              e.stopPropagation()
              openAdjustmentModal(s.productId, 'ADD')
            }}
            leftIcon={<Plus size={11} />}
          >
            Add Stock
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-gray-600 hover:bg-gray-100"
            onClick={(e) => {
              e.stopPropagation()
              openAdjustmentModal(s.productId, 'SET')
            }}
            leftIcon={<SlidersHorizontal size={11} />}
          >
            Adjust
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Inventory"
        subtitle={`${stock.length} products tracked${lowCount > 0 ? `, ${lowCount} low stock` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<CalendarDays size={14} />}
              onClick={() => navigate('/reports/monthly-inventory')}
            >
              Monthly Report
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<History size={14} />}
              onClick={() => navigate('/inventory/movements')}
            >
              Movement History
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<PackagePlus size={14} />}
              onClick={() => openAdjustmentModal(undefined, 'ADD')}
            >
              + Add / Adjust Stock
            </Button>
          </div>
        }
      />

      <div className="bg-white border border-orion-border rounded-lg shadow-orion">
        <div className="p-4 border-b border-orion-border flex items-center justify-between gap-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search products by name or code..."
            className="max-w-xs"
          />

          <div className="flex items-center gap-2">
            {lowCount > 0 && (
              <button
                type="button"
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={`text-xs px-2.5 py-1.5 rounded border transition-colors flex items-center gap-1.5 ${
                  showLowStockOnly
                    ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <AlertTriangle size={12} className="text-amber-600" />
                <span>Low Stock Only ({lowCount})</span>
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <LoadingState fullHeight />
        ) : (
          <Table
            columns={columns}
            data={filtered}
            keyExtractor={(s) => s.productId}
            emptyState={
              <EmptyState
                icon={<Package size={32} />}
                title="No products in inventory"
                description={
                  search ? 'No products match your search query.' : 'Add your products to begin managing inventory.'
                }
                action={{
                  label: 'Add Product',
                  onClick: () => navigate('/products/new'),
                }}
              />
            }
          />
        )}
      </div>

      {/* Reusable Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={load}
        preSelectedProductId={modalProductId}
        initialMode={modalMode}
        products={modalProducts}
      />
    </div>
  )
}
