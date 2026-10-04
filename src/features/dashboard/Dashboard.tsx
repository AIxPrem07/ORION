import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Users, Package, TrendingUp, Plus, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { StatCard } from '@components/ui/Card'
import { Button } from '@components/ui/Button'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { useFiscalYearStore } from '@store/fiscal-year.store'
import { getDashboardStats } from '@services/invoice.service'
import { getAllCurrentStock } from '@services/inventory.service'
import { formatCurrency } from '@utils/decimal'
import { currentFinancialYear, financialYearStart, financialYearEnd, formatFinancialYearLabel } from '@utils/date'
import { listInvoices } from '@services/invoice.service'
import type { Invoice } from '@/types/invoice'
import { InvoiceStatusBadge, PaymentStatusBadge } from '@components/ui/Badge'
import { formatDate } from '@utils/date'

export default function Dashboard() {
  const { business } = useBusinessStore()
  const { selectedFY } = useFiscalYearStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getDashboardStats>> | null>(null)
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([])
  const [lowStockCount, setLowStockCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!business) return
    async function load() {
      try {
        const isAll = selectedFY === 'ALL'
        const dateFrom = isAll ? undefined : financialYearStart(selectedFY)
        const dateTo = isAll ? undefined : financialYearEnd(selectedFY)
        const [dashStats, invoices, stockItems] = await Promise.all([
          getDashboardStats(business!.id, dateFrom, dateTo),
          listInvoices({
            businessId: business!.id,
            financialYear: isAll ? undefined : selectedFY,
            pageSize: 8,
          }),
          getAllCurrentStock(business!.id),
        ])
        setStats(dashStats)
        setRecentInvoices(invoices.data)
        setLowStockCount(stockItems.filter((s) => s.isLowStock).length)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [business, selectedFY])

  if (isLoading) return <LoadingState fullHeight />

  return (
    <div className="space-y-6">
      {/* Executive Welcome & Action Header */}
      <div className="bg-white border border-orion-border rounded-xl p-5 shadow-orion flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-200/80 shadow-xs bg-white flex-shrink-0">
            <img
              src="/logo.png"
              alt="ORION"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">
                {business?.name || 'ORION Business Suite'}
              </h1>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                {formatFinancialYearLabel(selectedFY)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Billing &amp; Inventory Management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/customers/new')}
          >
            + Add Customer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/purchases/new')}
          >
            + New Purchase
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={() => navigate('/invoices/new')}
            className="bg-slate-900 hover:bg-slate-800 text-white"
          >
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-orion-border rounded-xl p-4 shadow-orion transition-shadow hover:shadow-orion-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Sales (FY)</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            {formatCurrency(stats?.totalSales ?? 0)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Recorded sales in current fiscal</p>
        </div>

        <div className="bg-white border border-orion-border rounded-xl p-4 shadow-orion transition-shadow hover:shadow-orion-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Collected</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <FileText size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            {formatCurrency(stats?.totalCollected ?? 0)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Settled payments received</p>
        </div>

        <div className="bg-white border border-orion-border rounded-xl p-4 shadow-orion transition-shadow hover:shadow-orion-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Outstanding</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <AlertTriangle size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-700 tabular-nums">
            {formatCurrency(stats?.outstandingAmount ?? 0)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {stats?.pendingInvoiceCount ?? 0} invoices awaiting payment
          </p>
        </div>

        <div className="bg-white border border-orion-border rounded-xl p-4 shadow-orion transition-shadow hover:shadow-orion-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Today's Invoices</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <Package size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            {stats?.todayInvoices ?? 0}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Invoices issued today</p>
        </div>
      </div>

      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs">
          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
            <AlertTriangle size={16} />
          </div>
          <div>
            <span className="text-amber-900 font-semibold">
              Low Stock Warning: {lowStockCount} product{lowStockCount > 1 ? 's' : ''} require reordering.
            </span>
            <p className="text-amber-700 text-[11px]">Keep your inventory replenished to avoid stockouts on counter.</p>
          </div>
          <button
            onClick={() => navigate('/inventory')}
            className="ml-auto font-semibold text-amber-900 hover:text-amber-700 underline text-xs"
          >
            View Inventory &rarr;
          </button>
        </div>
      )}

      {/* Recent Invoices Card */}
      <div className="bg-white border border-orion-border rounded-xl shadow-orion overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-orion-border bg-gray-50/50">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Recent Invoices</h2>
            <p className="text-[11px] text-gray-500">Latest transactions generated in this business</p>
          </div>
          <button
            onClick={() => navigate('/invoices')}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline flex items-center gap-1"
          >
            View all invoices &rarr;
          </button>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            <p className="text-sm text-gray-600 font-medium">No sales invoices recorded yet</p>
            <p className="text-xs text-gray-400 mt-1">Start by generating your first bill</p>
            <button
              onClick={() => navigate('/invoices/new')}
              className="mt-3 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-medium text-xs hover:bg-slate-800 transition-colors inline-block"
            >
              + Create First Invoice
            </button>
          </div>
        ) : (
          <div className="divide-y divide-orion-border">
            {recentInvoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => navigate(`/invoices/${inv.id}`)}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/80 cursor-pointer transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono font-bold text-gray-900">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {inv.customerSnapshot?.name ?? 'Walk-in Customer'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold tabular-nums text-gray-900">
                    {formatCurrency(inv.totalAmount)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(inv.invoiceDate)}</p>
                </div>
                <div className="flex-shrink-0">
                  <InvoiceStatusBadge status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
