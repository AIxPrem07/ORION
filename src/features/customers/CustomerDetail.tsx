import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Users } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { Card, StatCard } from '@components/ui/Card'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { getCustomer, getCustomerSummary } from '@services/customer.service'
import { listInvoices } from '@services/invoice.service'
import { formatCurrency } from '@utils/decimal'
import { formatDate } from '@utils/date'
import type { Customer, CustomerSummary } from '@/types/customer'
import type { Invoice } from '@/types/invoice'
import { InvoiceStatusBadge } from '@components/ui/Badge'

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [summary, setSummary] = useState<CustomerSummary | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id || !business) return
    async function load() {
      const [c, s, inv] = await Promise.all([
        getCustomer(id!),
        getCustomerSummary(business!.id, id!),
        listInvoices({ businessId: business!.id, customerId: id!, pageSize: 20 }),
      ])
      setCustomer(c); setSummary(s); setInvoices(inv.data)
      setIsLoading(false)
    }
    load()
  }, [id, business])

  if (isLoading) return <LoadingState fullHeight />
  if (!customer) return <div className="text-center py-12 text-gray-500">Customer not found.</div>

  return (
    <div className="space-y-5">
      <PageHeader
        title={customer.name}
        breadcrumb={[{ label: 'Customers' }, { label: customer.name }]}
        actions={
          <>
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => navigate('/customers')}>Back</Button>
            <Button variant="secondary" size="sm" leftIcon={<Edit2 size={14} />} onClick={() => navigate(`/customers/${customer.id}/edit`)}>Edit</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Invoiced" value={formatCurrency(summary?.totalInvoiced ?? 0)} />
        <StatCard label="Total Paid" value={formatCurrency(summary?.totalPaid ?? 0)} />
        <StatCard label="Outstanding" value={formatCurrency(summary?.outstanding ?? 0)} />
        <StatCard label="Invoices" value={summary?.invoiceCount ?? 0} />
      </div>
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact Details</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[['Phone', customer.phone], ['Email', customer.email], ['GSTIN', customer.gstin], ['PAN', customer.pan], ['State', customer.state], ['City', customer.city]].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-xs text-orion-secondary">{label}</dt>
              <dd className="font-medium text-gray-900">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div className="bg-white border border-orion-border rounded-lg shadow-orion">
        <div className="px-5 py-4 border-b border-orion-border">
          <h3 className="text-sm font-semibold text-gray-900">Recent Invoices</h3>
        </div>
        <div className="divide-y divide-orion-border">
          {invoices.length === 0 && <p className="text-center py-8 text-xs text-orion-secondary">No invoices for this customer.</p>}
          {invoices.map((inv) => (
            <div key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                <p className="text-xs text-orion-secondary">{formatDate(inv.invoiceDate)}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(inv.totalAmount)}</p>
              <InvoiceStatusBadge status={inv.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
