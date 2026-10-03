import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Card } from '@components/ui/Card'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import { getProduct, createProduct, updateProduct, listTaxRates, ensureAllDefaultUnits } from '@services/product.service'
import { calculateReverseTaxFromMRP } from '@services/gst.service'
import { rupeesToPaise, paiseToRupeesNum, formatCurrency } from '@utils/decimal'
import type { ProductFormData, TaxRate, Unit } from '@/types/product'

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const { success, error } = useNotificationStore()

  const [name, setName] = useState('')
  const [productCode, setProductCode] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [hsnCode, setHsnCode] = useState('')
  const [brand, setBrand] = useState('')
  const [description, setDescription] = useState('')
  const [sellingPrice, setSellingPrice] = useState('0')
  const [purchasePrice, setPurchasePrice] = useState('0')
  const [mrp, setMrp] = useState('0')
  const [taxRateId, setTaxRateId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [minimumStock, setMinimumStock] = useState('0')
  const [openingStock, setOpeningStock] = useState('0')

  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [isLoading, setIsLoading] = useState(!isNew)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!business) return
    Promise.all([
      listTaxRates(business.id),
      ensureAllDefaultUnits(business.id),
    ]).then(([tr, un]) => {
      setTaxRates(tr)
      setUnits(un)
      if (tr.length > 0 && !taxRateId) setTaxRateId(tr.find((r) => r.rate === 1800)?.id ?? tr[0].id)
      if (un.length > 0 && !unitId) setUnitId(un.find((u) => u.abbreviation === 'Pcs' || u.abbreviation === 'pcs')?.id ?? un[0].id)
    })
  }, [business])

  const selectedTaxRate = taxRates.find((r) => r.id === taxRateId)
  const taxRateBp = selectedTaxRate ? selectedTaxRate.rate : 1800

  // Reverse tax calculation from MRP
  const mrpPaise = rupeesToPaise(parseFloat(mrp || '0'))
  const mrpBreakdown = mrpPaise > 0 ? calculateReverseTaxFromMRP(mrpPaise, taxRateBp) : null

  useEffect(() => {
    if (isNew || !business) return
    getProduct(id!).then((p) => {
      if (p) {
        setName(p.name)
        setProductCode(p.productCode ?? '')
        setSku(p.sku ?? '')
        setBarcode(p.barcode ?? '')
        setHsnCode(p.hsnCode ?? '')
        setBrand(p.brand ?? '')
        setDescription(p.description ?? '')
        setSellingPrice(String(paiseToRupeesNum(p.sellingPrice)))
        setPurchasePrice(String(paiseToRupeesNum(p.purchasePrice)))
        setMrp(String(paiseToRupeesNum(p.mrp)))
        setTaxRateId(p.taxRateId ?? '')
        setUnitId(p.unitId ?? '')
        setMinimumStock(String(p.minimumStock))
      }
      setIsLoading(false)
    })
  }, [id, isNew, business])

  async function handleSave() {
    if (!business) return
    if (!name.trim()) {
      error('Product name is required')
      return
    }
    setIsSaving(true)
    try {
      const data: ProductFormData = {
        name,
        productCode: productCode || null,
        sku: sku || null,
        barcode: barcode || null,
        hsnCode: hsnCode || null,
        brand: brand || null,
        description: description || null,
        purchasePrice: rupeesToPaise(parseFloat(purchasePrice || '0')),
        sellingPrice: rupeesToPaise(parseFloat(sellingPrice || '0')),
        mrp: rupeesToPaise(parseFloat(mrp || '0')),
        taxRateId: taxRateId || null,
        unitId: unitId || null,
        minimumStock: parseInt(minimumStock || '0', 10),
        openingStock: parseInt(openingStock || '0', 10),
      }

      if (isNew) {
        const created = await createProduct(business.id, data)
        success('Product created', created.name)
        navigate(`/products/${created.id}`)
      } else {
        const updated = await updateProduct(id!, business.id, data)
        success('Product updated', updated.name)
        navigate(`/products/${updated.id}`)
      }
    } catch (err) {
      error('Failed to save product', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <LoadingState fullHeight />

  return (
    <div className="space-y-4">
      <PageHeader
        title={isNew ? 'New Product' : 'Edit Product'}
        breadcrumb={[{ label: 'Products' }, { label: isNew ? 'New' : name }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => navigate(-1)}>Back</Button>
            <Button variant="primary" size="sm" isLoading={isSaving} leftIcon={<Save size={14} />} onClick={handleSave}>Save Product</Button>
          </div>
        }
      />
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Product Details</h3>
          <span className="text-xs text-[#797A7E]">Enter item details, HSN code, and material unit</span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input label="Product Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basmati Rice 10kg" />
          <Input label="Product Code" value={productCode} onChange={(e) => setProductCode(e.target.value)} placeholder="e.g. ITEM-001" />
          <Input label="HSN Code" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} placeholder="e.g. 100630" />
          <Input label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Stock keeping unit" />
          <Input label="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="UPC / EAN / Code128" />
          <Input label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name" />
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold mb-4">Pricing & Tax</h3>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Selling Price (₹)" type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
          <Input label="Purchase Price (₹)" type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
          <Input label="MRP (₹, Incl. of GST)" type="number" step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} />
          <Select
            label="GST Rate"
            value={taxRateId}
            onChange={(e) => setTaxRateId(e.target.value)}
            options={taxRates.map((r) => ({ value: r.id, label: `${r.name} (${r.rate / 100}%)` }))}
          />
          <Select
            label="Measuring Unit / Material Type"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.abbreviation})` }))}
          />
          <Input label="Minimum Stock Alert" type="number" value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} />
          {isNew && (
            <Input label="Initial Opening Stock" type="number" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} />
          )}

          {mrpBreakdown && (
            <div className="col-span-3 bg-[#E0ECE4]/20 p-3 rounded-lg border border-[#E0ECE4] flex items-center justify-between">
              <div>
                <div className="text-xs text-[#797A7E] font-medium">MRP Tax Breakdown (MRP is GST-Inclusive by Law)</div>
                <div className="text-sm font-semibold text-[#18191B] mt-0.5">
                  Taxable Base: {formatCurrency(mrpBreakdown.taxableBase)} | GST ({taxRateBp / 100}%): {formatCurrency(mrpBreakdown.taxAmount)}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setSellingPrice(String(paiseToRupeesNum(mrpBreakdown.taxableBase)))}
              >
                Set Selling Price = Base ({formatCurrency(mrpBreakdown.taxableBase)})
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
