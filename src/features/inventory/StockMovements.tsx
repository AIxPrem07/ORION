import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, PackagePlus, CalendarDays, Search, ArrowLeft, Trash2 } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { SearchInput } from '@components/ui/SearchInput'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import { useUIStore } from '@store/ui.store'
import { dbSelect } from '@db/client'
import { formatDateTime } from '@utils/date'
import { exportStockMovementsToCSV, triggerCSVDownload } from '@services/import-export.service'
import { getAllCurrentStock, deleteStockMovement } from '@services/inventory.service'
import { StockAdjustmentModal, type StockProductOption } from './StockAdjustmentModal'

interface MovementRow {
  id: string
  created_at: string
  product_id: string
  product_name: string
  product_code: string | null
  unit_abbreviation: string | null
  movement_type: string
  quantity: number
  quantity_before: number
  quantity_after: number
  notes: string | null
}

export default function StockMovements() {
  const { business } = useBusinessStore()
  const { success, error } = useNotificationStore()
  const { openConfirm } = useUIStore()
  const navigate = useNavigate()
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [products, setProducts] = useState<StockProductOption[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  // Stock Adjustment Modal
  const [isModalOpen, setIsModalOpen] = useState(false)

  const load = useCallback(async () => {
    if (!business) return
    setIsLoading(true)
    try {
      const [rows, curStock] = await Promise.all([
        dbSelect<MovementRow>(
          `SELECT 
             sm.id,
             sm.created_at,
             sm.product_id,
             p.name as product_name,
             p.product_code,
             u.abbreviation as unit_abbreviation,
             sm.movement_type,
             sm.quantity,
             sm.quantity_before,
             sm.quantity_after,
             sm.notes 
           FROM stock_movements sm 
           JOIN products p ON sm.product_id = p.id 
           LEFT JOIN units u ON p.unit_id = u.id
           WHERE sm.business_id = ? 
           ORDER BY sm.created_at DESC 
           LIMIT 500`,
          [business.id],
        ),
        getAllCurrentStock(business.id),
      ])

      setMovements(rows)
      setProducts(
        curStock.map((s) => ({
          id: s.productId,
          name: s.productName,
          productCode: s.productCode,
          unitAbbreviation: s.unitAbbreviation,
          currentStock: s.currentStock,
        })),
      )
    } finally {
      setIsLoading(false)
    }
  }, [business])

  useEffect(() => {
    load()
  }, [load])

  const handleExport = async () => {
    if (!business) return
    setIsExporting(true)
    try {
      const csv = await exportStockMovementsToCSV(business.id)
      triggerCSVDownload('stock_movements.csv', csv)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteMovement = (m: MovementRow) => {
    openConfirm({
      title: 'Remove Stock History Entry',
      message: `Are you sure you want to remove this ${m.movement_type} entry of ${m.quantity > 0 ? '+' : ''}${m.quantity} ${m.unit_abbreviation || ''} for "${m.product_name}"? The product's stock will automatically recalculate.`,
      confirmLabel: 'Remove Entry',
      variant: 'danger',
      onConfirm: async () => {
        if (!business) return
        try {
          await deleteStockMovement(m.id, business.id)
          success(`Stock entry for ${m.product_name} removed.`)
          load()
        } catch (err: any) {
          error(err.message || 'Failed to remove stock entry')
        }
      },
    })
  }

  const filteredMovements = movements.filter((m) => {
    const term = search.toLowerCase()
    const matchesSearch =
      !term ||
      m.product_name.toLowerCase().includes(term) ||
      (m.product_code?.toLowerCase().includes(term) ?? false) ||
      (m.notes?.toLowerCase().includes(term) ?? false)

    const matchesType = filterType === 'ALL' || m.movement_type === filterType
    return matchesSearch && matchesType
  })

  if (isLoading) return <LoadingState fullHeight />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stock Movements & Timestamp Log"
        subtitle="Complete chronological audit trail with exact date, time, and calculated stock balances"
        breadcrumb={[{ label: 'Inventory' }, { label: 'Stock Movements' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={14} />}
              onClick={() => navigate('/inventory')}
            >
              Back to Inventory
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<CalendarDays size={14} />}
              onClick={() => navigate('/reports/monthly-inventory')}
            >
              Monthly Report
            </Button>
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
              variant="primary"
              size="sm"
              leftIcon={<PackagePlus size={14} />}
              onClick={() => setIsModalOpen(true)}
            >
              + Add / Adjust Stock
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white border border-orion-border rounded-lg p-3 shadow-orion flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search product name, code, or notes..."
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-500 font-medium">Type:</span>
          {['ALL', 'PURCHASE', 'SALE', 'OPENING', 'ADJUSTMENT', 'DAMAGE', 'SALE_RETURN'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                filterType === t
                  ? 'bg-orion-primary text-white border-orion-primary font-medium'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {t === 'ALL' ? 'All' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-orion-border rounded-lg shadow-orion overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-orion-border">
              <tr>
                {['Date & Time', 'Product Name', 'Packaging / Unit', 'Movement Type', 'Quantity', 'Stock Before', 'Stock After', 'Notes / Reference', 'Action'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-orion-secondary uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((m) => {
                const isPositive = m.quantity > 0
                return (
                  <tr key={m.id} className="border-b border-orion-border last:border-0 hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-medium text-gray-900 whitespace-nowrap">
                      {formatDateTime(m.created_at)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      <div>{m.product_name}</div>
                      {m.product_code && <div className="text-xs text-orion-secondary">{m.product_code}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-700">
                      <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                        {m.unit_abbreviation ?? 'Unit'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded capitalize ${
                          m.movement_type === 'PURCHASE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.movement_type === 'SALE'
                            ? 'bg-blue-100 text-blue-800'
                            : m.movement_type === 'DAMAGE'
                            ? 'bg-red-100 text-red-800'
                            : m.movement_type === 'OPENING'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {m.movement_type?.toLowerCase().replace('_', ' ')}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 tabular-nums font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isPositive ? '+' : ''}
                      {m.quantity} {m.unit_abbreviation}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-orion-secondary text-xs">
                      {m.quantity_before}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums font-semibold text-gray-900 text-xs">
                      {m.quantity_after}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-orion-secondary max-w-xs truncate">
                      {m.notes ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteMovement(m)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove stock movement entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-xs text-orion-secondary">
                    No stock movements found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StockAdjustmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={load}
        products={products}
      />
    </div>
  )
}
