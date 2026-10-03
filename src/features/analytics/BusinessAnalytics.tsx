import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { PageHeader } from '@components/layout/PageHeader'
import { StatCard } from '@components/ui/Card'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { dbSelect } from '@db/client'
import { formatCurrency, paiseToRupeesNum } from '@utils/decimal'
import { currentFinancialYear } from '@utils/date'

interface MonthlyRow {
  month: string
  total_sales: number
  total_collected: number
}

export default function BusinessAnalytics() {
  const { business } = useBusinessStore()
  const [monthlyData, setMonthlyData] = useState<Array<{ month: string; sales: number; collected: number }>>([])
  const [totals, setTotals] = useState({ sales: 0, collected: 0, outstanding: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!business) return
    async function load() {
      try {
        const fy = currentFinancialYear()
        const [year] = fy.split('-').map((s, i) => parseInt(s) + (i === 0 ? 2000 : 2000))
        const rows = await dbSelect<MonthlyRow>(
          `SELECT strftime('%Y-%m', invoice_date) as month,
             COALESCE(SUM(total_amount), 0) as total_sales,
             COALESCE(SUM(paid_amount), 0) as total_collected
           FROM invoices
           WHERE business_id = ? AND status != 'CANCELLED'
             AND invoice_date BETWEEN ? AND ?
           GROUP BY month
           ORDER BY month ASC`,
          [business!.id, `${year}-04-01`, `${year + 1}-03-31`]
        )
        const chartData = rows.map((r) => ({
          month: r.month,
          sales: paiseToRupeesNum(r.total_sales),
          collected: paiseToRupeesNum(r.total_collected),
        }))
        setMonthlyData(chartData)
        const total_sales = rows.reduce((acc, r) => acc + r.total_sales, 0)
        const total_collected = rows.reduce((acc, r) => acc + r.total_collected, 0)
        setTotals({ sales: total_sales, collected: total_collected, outstanding: total_sales - total_collected })
      } finally { setIsLoading(false) }
    }
    load()
  }, [business])

  if (isLoading) return <LoadingState fullHeight />

  return (
    <div className="space-y-5">
      <PageHeader title="Business Analytics" subtitle={`FY ${currentFinancialYear()}`} />
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Sales" value={formatCurrency(totals.sales)} />
        <StatCard label="Collected" value={formatCurrency(totals.collected)} />
        <StatCard label="Outstanding" value={formatCurrency(totals.outstanding)} />
      </div>
      <div className="bg-white border border-orion-border rounded-lg p-5 shadow-orion">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Sales vs Collection</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => `₹${v.toFixed(2)}`} />
              <Bar dataKey="sales" name="Sales" fill="#E0ECE4" radius={[3, 3, 0, 0]} />
              <Bar dataKey="collected" name="Collected" fill="#797A7E" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
