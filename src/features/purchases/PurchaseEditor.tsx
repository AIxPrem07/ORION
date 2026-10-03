import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Card } from '@components/ui/Card'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import { getPurchaseWithItems, createDraftPurchase, finalizePurchase } from '@services/purchase.service'
import { listSuppliers } from '@services/supplier.service'
import { listProducts } from '@services/product.service'
import { calculateInvoiceTotals } from '@services/gst.service'
import { formatCurrency } from '@utils/decimal'
import { todayISO } from '@utils/date'
import type { PurchaseWithItems } from '@/types/purchase'
import type { Supplier } from '@/types/supplier'
import type { Product } from '@/types/product'

interface LineItem {
  id: string
  productId: string | null
  productSnapshot: Record<string, unknown>
  description: string
  hsnCode: string
  quantity: number
  unit: string
  unitPrice: number
  discountPercent: number
  taxRate: number
}

const DEFAULT_LINE: LineItem = {
  id: Math.random().toString(36).slice(2),
  productId: null,
  productSnapshot: {},
  description: '',
  hsnCode: '',
  quantity: 100,
  unit: 'pcs',
  unitPrice: 0,
  discountPercent: 0,
  taxRate: 1800,
}

export default function PurchaseEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const { success, error } = useNotificationStore()

  const [purchase, setPurchase] = useState<PurchaseWithItems | null>(null)
  const [isLoading, setIsLoading] = useState(!!id)
  const [isSaving, setIsSaving] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)

  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [purchaseNumber, setPurchaseNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')
  const [supplyType, setSupplyType] = useState<'INTRASTATE' | 'INTERSTATE'>('INTRASTATE')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([{ ...DEFAULT_LINE, id: Math.random().toString(36).slice(2) }])

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    if (!business) return
    listSuppliers({ businessId: business.id, isActive: true, pageSize: 500 }).then((r) => setSuppliers(r.data))
    listProducts({ businessId: business.id, isActive: true, pageSize: 1000 }).then((r) => setProducts(r.data as Product[]))
  }, [business])

  useEffect(() => {
    if (!id || !business) return
    getPurchaseWithItems(id).then((p) => {
      if (p) {
        setPurchase(p)
        setSupplierId(p.supplierId)
        setPurchaseNumber(p.purchaseNumber ?? '')
        setPurchaseDate(p.purchaseDate)
        setDueDate(p.dueDate ?? '')
        setSupplyType(p.supplyType)
        setNotes(p.notes ?? '')
      }
      setIsLoading(false)
    })
  }, [id, business])

  const totals = (() => {
    try {
      return calculateInvoiceTotals({
        supplyType,
        gstInclusive: false,
        lines: items.map((item) => ({
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          discountPercent: item.discountPercent,
          taxRate: item.taxRate,
          supplyType,
        })),
      })
    } catch {
      return null
    }
  })()

  function updateItem(index: number, updates: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)))
  }

  function addItem() {
    setItems((prev) => [...prev, { ...DEFAULT_LINE, id: Math.random().toString(36).slice(2) }])
  }

  function removeItem(index: number) {
    if (items.length === 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSaveDraft() {
    if (!business) return
    if (items.every((item) => !item.description.trim())) {
      error('Add at least one item.')
      return
    }
    setIsSaving(true)
    try {
      const saved = await createDraftPurchase({
        businessId: business.id,
        supplier: suppliers.find((s) => s.id === supplierId) ?? null,
        purchaseNumber: purchaseNumber || undefined,
        purchaseDate,
        dueDate: dueDate || undefined,
        supplyType,
        notes,
        items: items.filter((item) => item.description.trim()),
      })
      success('Purchase saved as draft')
      navigate(`/purchases/${saved.id}`)
    } catch (err) {
      error('Failed to save', err instanceof Error ? err.message : 'Unknown error')
    } finally { setIsSaving(false) }
  }

  async function handleFinalize() {
    if (!business || !id) return
    setIsFinalizing(true)
    try {
      const finalized = await finalizePurchase(id, business.id)
      setPurchase(finalized)
      success('Purchase finalized and stock added')
    } catch (err) {
      error('Finalization failed', err instanceof Error ? err.message : 'Unknown error')
    } finally { setIsFinalizing(false) }
  }

  if (isLoading) return <LoadingState fullHeight />

  const supplierOptions = [
    { value: '', label: 'Select Supplier...' },
    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={id ? (purchase?.purchaseNumber ?? 'Purchase Order') : 'New Purchase'}
        breadcrumb={[{ label: 'Purchases' }, { label: id ? 'View' : 'New' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => navigate('/purchases')}>Back</Button>
            {!id && <Button variant="primary" size="sm" isLoading={isSaving} leftIcon={<Save size={14} />} onClick={handleSaveDraft}>Save Purchase</Button>}
            {id && purchase?.status === 'DRAFT' && <Button variant="primary" size="sm" isLoading={isFinalizing} onClick={handleFinalize}>Finalize & Add to Stock</Button>}
          </div>
        }
      />
      <Card>
        <div className="grid grid-cols-3 gap-4">
          <Select label="Supplier" options={supplierOptions} value={supplierId ?? ''} onChange={(e) => setSupplierId(e.target.value || null)} />
          <Input label="Purchase Date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
          <Input label="Supplier Invoice / Bill #" value={purchaseNumber} onChange={(e) => setPurchaseNumber(e.target.value)} placeholder="e.g. BILL-9921" />
        </div>
      </Card>

      <div className="bg-white border border-orion-border rounded-lg shadow-orion overflow-hidden p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold">Items</h3>
          <Button variant="ghost" size="xs" leftIcon={<Plus size={12} />} onClick={addItem}>Add Row</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-orion-border">
            <tr>
              {['#', 'Description', 'Qty', 'Unit Price (₹)', 'GST %', 'Amount', ''].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-orion-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} className="border-b border-orion-border last:border-0">
                <td className="px-3 py-2 text-orion-secondary">{idx + 1}</td>
                <td className="px-3 py-2">
                  <input value={item.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder="Item name" className="w-56 bg-transparent border-0 outline-none text-sm" />
                </td>
                <td className="px-3 py-2">
                  <input type="number" value={(item.quantity / 100).toFixed(2)} onChange={(e) => updateItem(idx, { quantity: Math.round(parseFloat(e.target.value || '0') * 100) })} className="w-20 bg-transparent border-0 outline-none text-sm tabular-nums" />
                </td>
                <td className="px-3 py-2">
                  <input type="number" value={(item.unitPrice / 100).toFixed(2)} onChange={(e) => updateItem(idx, { unitPrice: Math.round(parseFloat(e.target.value || '0') * 100) })} className="w-24 bg-transparent border-0 outline-none text-sm tabular-nums" />
                </td>
                <td className="px-3 py-2">
                  <select value={item.taxRate} onChange={(e) => updateItem(idx, { taxRate: parseInt(e.target.value) })} className="bg-transparent border-0 outline-none text-sm">
                    {[0, 500, 1200, 1800, 2800].map((r) => (<option key={r} value={r}>{r / 100}%</option>))}
                  </select>
                </td>
                <td className="px-3 py-2 font-medium tabular-nums">{totals?.lineResults?.[idx] ? formatCurrency(totals.lineResults[idx].totalAmount) : '—'}</td>
                <td className="px-3 py-2"><button onClick={() => removeItem(idx)} disabled={items.length === 1} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {totals && (
          <div className="flex justify-end pt-4 border-t border-orion-border mt-4">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-orion-secondary">Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-orion-secondary">Tax</span><span>{formatCurrency(totals.totalTax)}</span></div>
              <div className="flex justify-between font-semibold pt-1 border-t border-orion-border"><span>Grand Total</span><span>{formatCurrency(totals.grandTotal)}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
