import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Download,
  Printer,
  ArrowLeft,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  History,
  Layers,
} from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { SearchInput } from '@components/ui/SearchInput'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import { getMonthlyInventoryReport } from '@services/inventory.service'
import { formatDateTime } from '@utils/date'
import { triggerCSVDownload } from '@services/import-export.service'
import type { MonthlyInventoryReportData } from '@/types/inventory'

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

export default function MonthlyInventoryReport() {
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const { addToast } = useNotificationStore()

  const now = new Date()
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'summary' | 'movements'>('summary')
  const [isLoading, setIsLoading] = useState(true)
  const [report, setReport] = useState<MonthlyInventoryReportData | null>(null)

  const loadReport = useCallback(async () => {
    if (!business) return
    setIsLoading(true)
    try {
      const data = await getMonthlyInventoryReport(business.id, selectedYear, selectedMonth)
      setReport(data)
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error loading inventory report',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setIsLoading(false)
    }
  }, [business, selectedYear, selectedMonth, addToast])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const handleExportCSV = () => {
    if (!report || !business) return

    const summaryHeaders = [
      'Product Name',
      'Product Code',
      'Unit / Packaging',
      'Opening Stock',
      'Inward Stock (+)',
      'Outward Stock (-)',
      'Net Change',
      'Closing Stock',
      'Min Stock Threshold',
      'Status',
    ]

    const summaryRows = report.products.map((p) => [
      `"${p.productName.replace(/"/g, '""')}"`,
      `"${p.productCode ?? ''}"`,
      `"${p.unitAbbreviation ?? 'Unit'}"`,
      p.openingStock,
      p.inwardStock,
      p.outwardStock,
      p.inwardStock - p.outwardStock,
      p.closingStock,
      p.minimumStock,
      p.isLowStock ? 'LOW STOCK' : 'OK',
    ])

    const movementHeaders = [
      'Date & Time',
      'Product Name',
      'Product Code',
      'Packaging Unit',
      'Movement Type',
      'Quantity Changed',
      'Stock Before',
      'Stock After',
      'Notes / Reference',
    ]

    const movementRows = report.movements.map((m) => [
      `"${formatDateTime(m.createdAt)}"`,
      `"${m.productName.replace(/"/g, '""')}"`,
      `"${m.productCode ?? ''}"`,
      `"${m.unitAbbreviation ?? 'Unit'}"`,
      `"${m.movementType}"`,
      m.quantity,
      m.quantityBefore,
      m.quantityAfter,
      `"${(m.notes ?? '').replace(/"/g, '""')}"`,
    ])

    const csvContent = [
      `"MONTHLY INVENTORY REPORT - ${business.name}"`,
      `"Period: ${report.monthName} ${report.year} (${report.startDate} to ${report.endDate})"`,
      `"Generated At: ${formatDateTime(new Date().toISOString())}"`,
      '',
      '"--- PRODUCT STOCK SUMMARY ---"',
      summaryHeaders.join(','),
      ...summaryRows.map((r) => r.join(',')),
      '',
      '"--- ITEMIZED MOVEMENT LOG WITH DATE & TIME ---"',
      movementHeaders.join(','),
      ...movementRows.map((r) => r.join(',')),
    ].join('\r\n')

    triggerCSVDownload(
      `inventory_report_${report.year}_${String(report.month).padStart(2, '0')}.csv`,
      csvContent,
    )

    addToast({
      type: 'success',
      title: 'Report Downloaded',
      message: `Exported monthly inventory statement for ${report.monthName} ${report.year}.`,
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const filteredProducts =
    report?.products.filter((p) => {
      const term = search.toLowerCase()
      return (
        !term ||
        p.productName.toLowerCase().includes(term) ||
        (p.productCode?.toLowerCase().includes(term) ?? false)
      )
    }) ?? []

  const filteredMovements =
    report?.movements.filter((m) => {
      const term = search.toLowerCase()
      return (
        !term ||
        m.productName.toLowerCase().includes(term) ||
        (m.productCode?.toLowerCase().includes(term) ?? false) ||
        (m.notes?.toLowerCase().includes(term) ?? false)
      )
    }) ?? []

  const lowStockCount = report?.products.filter((p) => p.isLowStock).length ?? 0

  return (
    <div className="space-y-5 print:p-0 print:space-y-3">
      {/* Page Header */}
      <div className="print:hidden">
        <PageHeader
          title="Monthly Inventory Report"
          subtitle="Official monthly statement with exact timestamps, stock inward/outward calculations, and closing balances"
          breadcrumb={[{ label: 'Reports' }, { label: 'Monthly Inventory' }]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeft size={14} />}
                onClick={() => navigate('/reports')}
              >
                Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Printer size={14} />}
                onClick={handlePrint}
              >
                Print Statement
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Download size={14} />}
                onClick={handleExportCSV}
              >
                Export CSV / Excel
              </Button>
            </div>
          }
        />
      </div>

      {/* Printable Header (Visible during Print) */}
      <div className="hidden print:block border-b pb-3 mb-4">
        <h1 className="text-xl font-bold text-gray-900">{business?.name}</h1>
        <p className="text-sm font-semibold text-gray-700">
          Monthly Inventory Statement — {report?.monthName} {report?.year}
        </p>
        <p className="text-xs text-gray-500">
          Period: {report?.startDate} to {report?.endDate} | Generated: {formatDateTime(new Date().toISOString())}
        </p>
      </div>

      {/* Month, Year & Filter Controls */}
      <div className="bg-white border border-orion-border rounded-lg p-4 shadow-orion print:hidden flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-gray-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Period:
            </span>
          </div>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="h-9 px-3 text-sm bg-white border border-orion-border rounded-md shadow-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-orion-primary"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-9 px-3 text-sm bg-white border border-orion-border rounded-md shadow-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-orion-primary"
          >
            {[2027, 2026, 2025, 2024, 2023].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search products or notes..."
            className="w-64"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-orion-border rounded-lg p-4 shadow-orion">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-orion-secondary uppercase tracking-wider">
              Tracked Items
            </span>
            <Package size={16} className="text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {report?.products.length ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {lowStockCount > 0 ? (
              <span className="text-amber-600 font-semibold">{lowStockCount} low stock alerts</span>
            ) : (
              'All stock healthy'
            )}
          </div>
        </div>

        <div className="bg-white border border-orion-border rounded-lg p-4 shadow-orion">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-orion-secondary uppercase tracking-wider">
              Opening Stock
            </span>
            <Layers size={16} className="text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {report?.totalOpeningStock ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">At start of {report?.monthName}</div>
        </div>

        <div className="bg-white border border-orion-border rounded-lg p-4 shadow-orion">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider">
              Inward Stock (+)
            </span>
            <TrendingUp size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">
            +{report?.totalInwardStock ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Purchases & additions</div>
        </div>

        <div className="bg-white border border-orion-border rounded-lg p-4 shadow-orion">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-600 uppercase tracking-wider">
              Outward Stock (-)
            </span>
            <TrendingDown size={16} className="text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600 mt-2">
            -{report?.totalOutwardStock ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Closing: <strong className="text-gray-900">{report?.totalClosingStock ?? 0}</strong>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="print:hidden flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('summary')}
          className={`py-2 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'summary'
              ? 'border-orion-primary text-orion-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers size={14} />
          <span>Product Stock Balances ({filteredProducts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`py-2 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'movements'
              ? 'border-orion-primary text-orion-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <History size={14} />
          <span>Timestamped Movement Audit Log ({filteredMovements.length})</span>
        </button>
      </div>

      {isLoading ? (
        <LoadingState fullHeight />
      ) : activeTab === 'summary' ? (
        /* Product Stock Summary Table */
        <div className="bg-white border border-orion-border rounded-lg shadow-orion overflow-hidden">
          <div className="p-3 bg-gray-50 border-b border-orion-border flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-800 uppercase tracking-wider">
              {report?.monthName} {report?.year} Inventory Balances by Product
            </span>
            <span className="text-xs text-gray-500">
              {report?.startDate} to {report?.endDate}
            </span>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 border-b border-orion-border">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-orion-secondary uppercase">
                    Product
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-orion-secondary uppercase">
                    Packaging / Unit
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-orion-secondary uppercase">
                    Opening Stock
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-emerald-700 uppercase">
                    Inward (+)
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-red-600 uppercase">
                    Outward (-)
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-orion-secondary uppercase">
                    Net Change
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-900 uppercase">
                    Closing Stock
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-orion-secondary uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => {
                  const netChange = p.inwardStock - p.outwardStock
                  return (
                    <tr key={p.productId} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        <div>{p.productName}</div>
                        {p.productCode && (
                          <div className="text-xs text-orion-secondary">{p.productCode}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-700">
                        <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded font-medium">
                          {p.unitAbbreviation ?? 'Unit'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 font-medium">
                        {p.openingStock}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-600">
                        {p.inwardStock > 0 ? `+${p.inwardStock}` : '0'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-red-600">
                        {p.outwardStock > 0 ? `-${p.outwardStock}` : '0'}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular-nums font-semibold ${
                          netChange > 0
                            ? 'text-emerald-700'
                            : netChange < 0
                            ? 'text-red-700'
                            : 'text-gray-500'
                        }`}
                      >
                        {netChange > 0 ? `+${netChange}` : netChange}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-gray-900 text-sm">
                        {p.closingStock}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {p.isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700">
                            <AlertTriangle size={11} />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            Healthy
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-xs text-orion-secondary">
                      No products recorded for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Timestamped Movement Log */
        <div className="bg-white border border-orion-border rounded-lg shadow-orion overflow-hidden">
          <div className="p-3 bg-gray-50 border-b border-orion-border flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-800 uppercase tracking-wider">
              {report?.monthName} {report?.year} Chronological Movement Log with Exact Date & Time
            </span>
            <span className="text-xs text-gray-500">
              {filteredMovements.length} total transactions recorded
            </span>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 border-b border-orion-border">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-orion-secondary uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-orion-secondary uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-orion-secondary uppercase tracking-wider">
                    Packaging / Unit
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-orion-secondary uppercase tracking-wider">
                    Movement Type
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-orion-secondary uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-orion-secondary uppercase tracking-wider">
                    Before &rarr; After
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-orion-secondary uppercase tracking-wider">
                    Notes / Reference
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMovements.map((m) => {
                  const isPositive = m.quantity > 0
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-2.5 text-xs font-semibold text-gray-900 whitespace-nowrap">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        <div>{m.productName}</div>
                        {m.productCode && (
                          <div className="text-xs text-orion-secondary">{m.productCode}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-700">
                        <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded font-medium">
                          {m.unitAbbreviation ?? 'Unit'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded capitalize ${
                            m.movementType === 'PURCHASE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.movementType === 'SALE'
                              ? 'bg-blue-100 text-blue-800'
                              : m.movementType === 'DAMAGE'
                              ? 'bg-red-100 text-red-800'
                              : m.movementType === 'OPENING'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {m.movementType?.toLowerCase().replace('_', ' ')}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-2.5 tabular-nums font-bold ${
                          isPositive ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {m.quantity} {m.unitAbbreviation}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-xs text-gray-700 font-medium">
                        {m.quantityBefore} &rarr;{' '}
                        <strong className="text-gray-900 font-bold">{m.quantityAfter}</strong>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-orion-secondary max-w-xs truncate">
                        {m.notes ?? '—'}
                      </td>
                    </tr>
                  )
                })}
                {filteredMovements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-xs text-orion-secondary">
                      No stock movements recorded in {report?.monthName} {report?.year}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
