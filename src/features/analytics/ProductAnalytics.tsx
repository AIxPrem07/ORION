import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { PageHeader } from '@components/layout/PageHeader'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { useFiscalYearStore } from '@store/fiscal-year.store'
import { dbSelect } from '@db/client'
import { paiseToRupeesNum } from '@utils/decimal'
import { financialYearStart, financialYearEnd, formatFinancialYearLabel } from '@utils/date'

interface ProductRevenueRow {
  name: string
  id: string
  revenue: number
  qty_sold: number
}

export default function ProductAnalytics() {
  const { business } = useBusinessStore()
  const { selectedFY } = useFiscalYearStore()
  const [topProducts, setTopProducts] = useState<Array<{ name: string; id: string; revenue: number; qty_sold: number }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!business) return
    async function load() {
      try {
        const isAll = selectedFY === 'ALL'
        const whereDate = isAll
          ? ''
          : `AND (inv.financial_year = ? OR inv.invoice_date BETWEEN ? AND ?)`
        const params: unknown[] = [business!.id]
        if (!isAll) {
          params.push(selectedFY, financialYearStart(selectedFY), financialYearEnd(selectedFY))
        }

        const rows = await dbSelect<ProductRevenueRow>(
          `SELECT p.name, p.id,
             COALESCE(SUM(ii.total_amount), 0) as revenue,
             COALESCE(SUM(ii.quantity), 0) as qty_sold
           FROM products p
           JOIN invoice_items ii ON p.id = ii.product_id
           JOIN invoices inv ON ii.invoice_id = inv.id AND inv.status != 'CANCELLED' AND COALESCE(inv.is_deleted, 0) = 0
           WHERE p.business_id = ?
             ${whereDate}
           GROUP BY p.id
           ORDER BY revenue DESC
           LIMIT 15`,
          params
        )
        setTopProducts(rows.map((r) => ({ ...r, revenue: paiseToRupeesNum(r.revenue), qty_sold: Math.round(r.qty_sold / 100) })))
      } finally { setIsLoading(false) }
    }
    load()
  }, [business, selectedFY])

  if (isLoading) return <LoadingState fullHeight />

  return (
    <div className="space-y-5">
      <PageHeader title="Product Analytics" subtitle={`Top 15 products by revenue • ${formatFinancialYearLabel(selectedFY)}`} />
      <div className="bg-white border border-orion-border rounded-lg p-5 shadow-orion">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue by Product</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProducts} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
              <Tooltip formatter={(v: number) => `₹${v.toFixed(2)}`} />
              <Bar dataKey="revenue" name="Revenue" fill="#E0ECE4" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
