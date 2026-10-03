import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2 } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { Card, StatCard } from '@components/ui/Card'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { getProduct } from '@services/product.service'
import { getCurrentStock, getStockMovements } from '@services/inventory.service'
import { formatCurrency } from '@utils/decimal'
import type { Product } from '@/types/product'

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const [product, setProduct] = useState<Product | null>(null)
  const [stock, setStock] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id || !business) return
    async function load() {
      const [p, s] = await Promise.all([
        getProduct(id!),
        getCurrentStock(id!),
      ])
      setProduct(p)
      setStock(s)
      setIsLoading(false)
    }
    load()
  }, [id, business])

  if (isLoading) return <LoadingState fullHeight />
  if (!product) return <div className="text-center py-12 text-gray-500">Product not found.</div>

  return (
    <div className="space-y-5">
      <PageHeader title={product.name} breadcrumb={[{ label: 'Products' }, { label: product.name }]}
        actions={
          <>
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => navigate('/products')}>Back</Button>
            <Button variant="secondary" size="sm" leftIcon={<Edit2 size={14} />} onClick={() => navigate(`/products/${product.id}/edit`)}>Edit</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Current Stock" value={stock} />
        <StatCard label="Selling Price" value={formatCurrency(product.sellingPrice)} />
        <StatCard label="Purchase Price" value={formatCurrency(product.purchasePrice)} />
        <StatCard label="MRP" value={formatCurrency(product.mrp)} />
      </div>
      <Card>
        <h3 className="text-sm font-semibold mb-3">Product Details</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[['Code', product.productCode], ['SKU', product.sku], ['Barcode', product.barcode], ['HSN Code', product.hsnCode], ['Brand', product.brand], ['Min Stock', product.minimumStock]].map(([label, value]) => (
            <div key={label as string}><dt className="text-xs text-orion-secondary">{label}</dt><dd className="font-medium">{value ?? '—'}</dd></div>
          ))}
        </dl>
      </Card>
    </div>
  )
}
