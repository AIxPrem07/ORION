import { useState, useEffect } from 'react'
import { Plus, Minus, SlidersHorizontal, Calendar, PackageCheck, AlertCircle } from 'lucide-react'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import { addManualStockEntry } from '@services/inventory.service'
import type { StockMovementType } from '@/types/inventory'

export interface StockProductOption {
  id: string
  name: string
  productCode: string | null
  unitAbbreviation: string | null
  currentStock: number
}

interface StockAdjustmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  preSelectedProductId?: string
  initialMode?: 'ADD' | 'DEDUCT' | 'SET'
  products: StockProductOption[]
}

function getCurrentLocalDateTime(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function StockAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  preSelectedProductId,
  initialMode = 'ADD',
  products,
}: StockAdjustmentModalProps) {
  const { business } = useBusinessStore()
  const { addToast } = useNotificationStore()

  const [productId, setProductId] = useState(preSelectedProductId || (products[0]?.id ?? ''))
  const [mode, setMode] = useState<'ADD' | 'DEDUCT' | 'SET'>(initialMode)
  const [quantity, setQuantity] = useState<string>('1')
  const [movementType, setMovementType] = useState<StockMovementType>('PURCHASE')
  const [dateTime, setDateTime] = useState<string>(getCurrentLocalDateTime())
  const [notes, setNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (preSelectedProductId) {
      setProductId(preSelectedProductId)
    } else if (products.length > 0 && !productId) {
      setProductId(products[0].id)
    }
  }, [preSelectedProductId, products, productId])

  useEffect(() => {
    setMode(initialMode)
    if (initialMode === 'ADD') setMovementType('PURCHASE')
    else if (initialMode === 'DEDUCT') setMovementType('DAMAGE')
    else setMovementType('ADJUSTMENT')
  }, [initialMode, isOpen])

  const selectedProduct = products.find((p) => p.id === productId)
  const currentStock = selectedProduct?.currentStock ?? 0
  const unit = selectedProduct?.unitAbbreviation || 'Units'

  const parsedQty = parseFloat(quantity) || 0

  let newCalculatedStock = currentStock
  let changeDescription = ''

  if (mode === 'ADD') {
    newCalculatedStock = currentStock + parsedQty
    changeDescription = `+${parsedQty} ${unit}`
  } else if (mode === 'DEDUCT') {
    newCalculatedStock = currentStock - parsedQty
    changeDescription = `-${parsedQty} ${unit}`
  } else if (mode === 'SET') {
    newCalculatedStock = parsedQty
    const diff = parsedQty - currentStock
    changeDescription = `${diff >= 0 ? '+' : ''}${diff} ${unit}`
  }

  const handleModeChange = (newMode: 'ADD' | 'DEDUCT' | 'SET') => {
    setMode(newMode)
    setErrorMsg(null)
    if (newMode === 'ADD') {
      setMovementType('PURCHASE')
      if (quantity === '0') setQuantity('1')
    } else if (newMode === 'DEDUCT') {
      setMovementType('DAMAGE')
      if (quantity === '0') setQuantity('1')
    } else if (newMode === 'SET') {
      setMovementType('ADJUSTMENT')
      setQuantity(String(currentStock))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!business) return
    if (!productId) {
      setErrorMsg('Please select a product')
      return
    }

    if (mode !== 'SET' && parsedQty <= 0) {
      setErrorMsg('Quantity must be greater than zero')
      return
    }

    if (mode === 'SET' && parsedQty < 0) {
      setErrorMsg('Stock count cannot be negative')
      return
    }

    if (mode === 'DEDUCT' && parsedQty > currentStock && movementType !== 'DAMAGE' && movementType !== 'ADJUSTMENT') {
      setErrorMsg(`Cannot deduct more than current stock (${currentStock} ${unit})`)
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const result = await addManualStockEntry({
        businessId: business.id,
        productId,
        mode,
        quantity: parsedQty,
        movementType,
        customDateTime: dateTime ? new Date(dateTime).toISOString() : undefined,
        notes: notes.trim() || undefined,
      })

      addToast({
        type: 'success',
        title: 'Stock Updated',
        message: `${result.productName}: ${result.quantityBefore} -> ${result.quantityAfter} ${unit}`,
      })

      onSuccess()
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update stock'
      setErrorMsg(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Add / Adjust Product Stock"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            leftIcon={<PackageCheck size={14} />}
          >
            Save Stock Entry
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-md p-3 flex items-start gap-2">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Product selector */}
        <div>
          <Select
            label="Product"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value)
              const p = products.find((prod) => prod.id === e.target.value)
              if (mode === 'SET' && p) setQuantity(String(p.currentStock))
            }}
            options={products.map((p) => ({
              value: p.id,
              label: `${p.name} ${p.productCode ? `(${p.productCode})` : ''} — Current: ${p.currentStock} ${p.unitAbbreviation || ''}`,
            }))}
          />
          {selectedProduct && (
            <div className="mt-1 flex items-center justify-between text-xs text-orion-secondary bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
              <span>Current Stock: <strong className="text-gray-900 font-semibold">{currentStock} {unit}</strong></span>
              {selectedProduct.productCode && <span>Code: {selectedProduct.productCode}</span>}
            </div>
          )}
        </div>

        {/* Operation Mode Tabs */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Action / Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleModeChange('ADD')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-md border transition-all ${
                mode === 'ADD'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Plus size={14} className={mode === 'ADD' ? 'text-emerald-600' : 'text-gray-400'} />
              <span>+ Add Stock</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('DEDUCT')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-md border transition-all ${
                mode === 'DEDUCT'
                  ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Minus size={14} className={mode === 'DEDUCT' ? 'text-amber-600' : 'text-gray-400'} />
              <span>- Deduct Stock</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('SET')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-md border transition-all ${
                mode === 'SET'
                  ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal size={14} className={mode === 'SET' ? 'text-blue-600' : 'text-gray-400'} />
              <span>Set Count</span>
            </button>
          </div>
        </div>

        {/* Quantity and Real-time Calculation */}
        <div className="grid grid-cols-2 gap-3 items-start">
          <Input
            label={
              mode === 'ADD'
                ? `Quantity to Add (${unit})`
                : mode === 'DEDUCT'
                ? `Quantity to Deduct (${unit})`
                : `New Physical Count (${unit})`
            }
            type="number"
            step="any"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
          />

          <Select
            label="Reason / Movement Type"
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as StockMovementType)}
            options={
              mode === 'ADD'
                ? [
                    { value: 'PURCHASE', label: 'Purchase / Inward Stock' },
                    { value: 'OPENING', label: 'Opening Stock Balance' },
                    { value: 'ADJUSTMENT', label: 'General Adjustment / Found' },
                  ]
                : mode === 'DEDUCT'
                ? [
                    { value: 'DAMAGE', label: 'Damage / Broken / Expired' },
                    { value: 'ADJUSTMENT', label: 'Audit Shortage / Wastage' },
                    { value: 'PURCHASE_RETURN', label: 'Return to Supplier' },
                  ]
                : [{ value: 'ADJUSTMENT', label: 'Physical Warehouse Audit' }]
            }
          />
        </div>

        {/* Active Stock Preview Calculation Card */}
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Active Stock Calculation
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Current: <span className="font-semibold text-gray-900">{currentStock}</span>
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
              {changeDescription}
            </span>
            <span className="text-gray-900 font-bold">
              New: <span className={newCalculatedStock < 0 ? 'text-red-600' : 'text-emerald-700'}>{newCalculatedStock}</span> {unit}
            </span>
          </div>
        </div>

        {/* Date and Time */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1.5">
            <Calendar size={13} className="text-gray-500" />
            <span>Date & Time of Movement</span>
          </label>
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className="w-full h-9 px-3 text-sm bg-white border border-orion-border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-orion-primary focus:border-orion-primary"
            required
          />
          <span className="text-[11px] text-gray-500 mt-1 block">
            Recorded in the monthly audit log with exact date and time.
          </span>
        </div>

        {/* Notes / Reference */}
        <div>
          <Input
            label="Notes / Reference (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Received fresh batch from supplier, physical count audit, carton damaged"
          />
        </div>
      </form>
    </Modal>
  )
}
