import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { Card, StatCard } from '@components/ui/Card'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { getSupplier, getSupplierSummary } from '@services/supplier.service'
import { listPurchases } from '@services/purchase.service'
import { formatCurrency } from '@utils/decimal'
import type { Supplier, SupplierSummary } from '@/types/supplier'
import type { Purchase } from '@/types/purchase'

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [summary, setSummary] = useState<SupplierSummary | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id || !business) return
    async function load() {
      const [s, sum, p] = await Promise.all([
        getSupplier(id!),
        getSupplierSummary(business!.id, id!),
        listPurchases({ businessId: business!.id, supplierId: id!, pageSize: 20 }),
      ])
      setSupplier(s)
      setSummary(sum)
      setPurchases(p.data)
      setIsLoading(false)
    }
    load()
  }, [id, business])

  if (isLoading) return <LoadingState fullHeight />
  if (!supplier) return <div className="text-center py-12 text-gray-500">Supplier not found.</div>

  return (
    <div className="space-y-5">
      <PageHeader title={supplier.name} breadcrumb={[{ label: 'Suppliers' }, { label: supplier.name }]}
        actions={<Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => navigate('/suppliers')}>Back</Button>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Purchased" value={formatCurrency(summary?.totalPurchased ?? 0)} />
        <StatCard label="Total Paid" value={formatCurrency(summary?.totalPaid ?? 0)} />
        <StatCard label="Outstanding" value={formatCurrency(summary?.outstanding ?? 0)} />
        <StatCard label="Purchases" value={summary?.purchaseCount ?? 0} />
      </div>
      <Card>
        <h3 className="text-sm font-semibold mb-3">Contact Details</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[['Phone', supplier.phone], ['Email', supplier.email], ['GSTIN', supplier.gstin], ['State', supplier.state], ['City', supplier.city]].map(([label, value]) => (
            <div key={label as string}><dt className="text-xs text-orion-secondary">{label}</dt><dd className="font-medium">{value ?? '—'}</dd></div>
          ))}
        </dl>
      </Card>
    </div>
  )
}
