import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart2,
  TrendingUp,
  FileText,
  Package,
  Download,
  Users,
  ShoppingCart,
  ClipboardList,
  Layers,
  BookOpen,
} from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import {
  exportInvoicesToCSV,
  exportPurchasesToCSV,
  exportProductsToCSV,
  exportCustomersToCSV,
  exportStockMovementsToCSV,
  exportLedgerToCSV,
  triggerCSVDownload,
} from '@services/import-export.service'

export default function Reports() {
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const { addToast } = useNotificationStore()
  const [exportingType, setExportingType] = useState<string | null>(null)

  const reportCards = [
    {
      title: 'GST Returns (GSTR-1 & 3B)',
      desc: 'Official GSTR-1, GSTR-3B statements, C.A. audit package & direct GST Portal JSON',
      icon: <BarChart2 size={24} className="text-emerald-700" />,
      href: '/reports/gst-filing',
    },
    {
      title: 'Monthly Inventory Report',
      desc: 'Monthly opening, inward, outward & closing stock with exact timestamp movement audit',
      icon: <Layers size={24} className="text-blue-600" />,
      href: '/reports/monthly-inventory',
    },
    {
      title: 'Sales Report',
      desc: 'Invoice-wise sales, GST breakdown, payment collection',
      icon: <FileText size={24} />,
      href: '/analytics/business',
    },
    {
      title: 'Product Analytics',
      desc: 'Top-selling products, revenue rankings, unit sales',
      icon: <Package size={24} />,
      href: '/analytics/products',
    },
    {
      title: 'Business Analytics',
      desc: 'Revenue trends, collections vs outstanding, FY comparisons',
      icon: <TrendingUp size={24} />,
      href: '/analytics/business',
    },
  ]

  const handleExport = async (type: string) => {
    if (!business) return
    setExportingType(type)
    try {
      let csv = ''
      let filename = ''
      switch (type) {
        case 'invoices':
          csv = await exportInvoicesToCSV(business.id)
          filename = 'sales_invoices.csv'
          break
        case 'purchases':
          csv = await exportPurchasesToCSV(business.id)
          filename = 'purchases.csv'
          break
        case 'products':
          csv = await exportProductsToCSV(business.id)
          filename = 'products_inventory.csv'
          break
        case 'customers':
          csv = await exportCustomersToCSV(business.id)
          filename = 'customers_ledger.csv'
          break
        case 'stock':
          csv = await exportStockMovementsToCSV(business.id)
          filename = 'inventory_movements.csv'
          break
        case 'ledger':
          csv = await exportLedgerToCSV(business.id)
          filename = 'general_ledger.csv'
          break
      }
      triggerCSVDownload(filename, csv)
      addToast({
        type: 'success',
        title: 'Export Downloaded',
        message: `Saved ${filename} to your downloads.`,
      })
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: err.message || 'Could not export data.',
      })
    } finally {
      setExportingType(null)
    }
  }

  const exportActions = [
    { id: 'invoices', label: 'Export Invoices', icon: FileText },
    { id: 'purchases', label: 'Export Purchases', icon: ShoppingCart },
    { id: 'products', label: 'Export Products & Stock', icon: Package },
    { id: 'customers', label: 'Export Customers', icon: Users },
    { id: 'ledger', label: 'Export General Ledger', icon: BookOpen },
    { id: 'stock', label: 'Export Stock Movements', icon: ClipboardList },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Business insights, GST summaries, and spreadsheet data exports"
      />

      {/* Visual Analytics Cards */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-orion-secondary">
          Analytics & Interactive Dashboards
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {reportCards.map((card) => (
            <div
              key={card.title}
              onClick={() => navigate(card.href)}
              className="bg-white border border-orion-border rounded-lg p-5 shadow-orion hover:shadow-orion-lg cursor-pointer transition-shadow"
            >
              <div className="text-orion-secondary mb-3">{card.icon}</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{card.title}</h3>
              <p className="text-xs text-orion-secondary">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CSV / Excel Data Exports */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-orion-secondary">
          Spreadsheet Data Exports (CSV / Excel Compatible)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {exportActions.map((action) => {
            const Icon = action.icon
            return (
              <div
                key={action.id}
                className="bg-white border border-orion-border rounded-lg p-4 shadow-orion flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={16} className="text-orion-secondary" />
                  <span className="text-xs font-medium text-gray-900">{action.label}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download size={12} />}
                  onClick={() => handleExport(action.id)}
                  isLoading={exportingType === action.id}
                >
                  CSV
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
