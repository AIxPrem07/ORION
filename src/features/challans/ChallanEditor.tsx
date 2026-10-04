import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft, Printer, Save, Truck, User, Calendar, FileText } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Card } from '@components/ui/Card'
import { useBusinessStore } from '@store/business.store'
import { useAuthStore } from '@store/auth.store'
import { useNotificationStore } from '@store/notification.store'
import { useFiscalYearStore } from '@store/fiscal-year.store'
import { listCustomers } from '@services/customer.service'
import { listProducts } from '@services/product.service'
import { createChallan, getNextChallanNumber } from '@services/challan.service'
import { printChallanPDF } from '@services/pdf.service'
import { todayISO, getFinancialYearFromDate, formatFinancialYearLabel } from '@utils/date'
import { formatCurrency, paiseToRupees } from '@utils/decimal'
import type { Customer } from '@/types/customer'
import type { Product } from '@/types/product'
import type { ChallanItemFormData } from '@/types/challan'

export default function ChallanEditor() {
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const { user } = useAuthStore()
  const { success, error } = useNotificationStore()
  const { selectedFY } = useFiscalYearStore()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [challanDate, setChallanDate] = useState(todayISO())
  const [financialYear, setFinancialYear] = useState(() => {
    return selectedFY && selectedFY !== 'ALL' ? selectedFY : getFinancialYearFromDate(todayISO())
  })
  const [challanNumberPreview, setChallanNumberPreview] = useState('')
  const [transportMode, setTransportMode] = useState('Road')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [transporterName, setTransporterName] = useState('')
  const [lrRrNumber, setLrRrNumber] = useState('')
  const [notes, setNotes] = useState('')

  const [items, setItems] = useState<ChallanItemFormData[]>([
    {
      id: 'item-1',
      productId: '',
      description: '',
      hsnCode: '',
      quantity: '1',
      unit: 'Nos',
      unitPrice: '0',
      totalAmount: 0,
    },
  ])

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load Customers & Products
  useEffect(() => {
    if (!business) return
    listCustomers({ businessId: business.id, isActive: true, pageSize: 500 }).then((r) => setCustomers(r.data))
    listProducts({ businessId: business.id, isActive: true, pageSize: 500 }).then((r) => setProducts(r.data))
  }, [business])

  // Update FY when challanDate changes
  useEffect(() => {
    const derivedFY = getFinancialYearFromDate(challanDate)
    setFinancialYear(derivedFY)
  }, [challanDate])

  // Load preview sequence number for current FY
  useEffect(() => {
    if (!business) return
    getNextChallanNumber(business.id, financialYear).then(setChallanNumberPreview).catch(() => {})
  }, [business, financialYear])

  const handleProductSelect = (index: number, productId: string) => {
    const p = products.find((prod) => prod.id === productId)
    if (!p) return

    setItems((prev) => {
      const next = [...prev]
      const rateRupees = (p.sellingPrice / 100).toFixed(2)
      const qty = parseFloat(next[index].quantity || '1')
      const totalPaise = Math.round(qty * p.sellingPrice)

      next[index] = {
        ...next[index],
        productId: p.id,
        description: p.name,
        hsnCode: p.hsnCode || '',
        unit: 'Nos',
        unitPrice: rateRupees,
        totalAmount: totalPaise,
      }
      return next
    })
  }

  const handleItemChange = (index: number, field: keyof ChallanItemFormData, val: string) => {
    setItems((prev) => {
      const next = [...prev]
      const current = { ...next[index], [field]: val }

      const qty = parseFloat(current.quantity || '0')
      const rate = parseFloat(current.unitPrice || '0')
      current.totalAmount = Math.round(qty * rate * 100)

      next[index] = current
      return next
    })
  }

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        productId: '',
        description: '',
        hsnCode: '',
        quantity: '1',
        unit: 'Nos',
        unitPrice: '0',
        totalAmount: 0,
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const totalPaise = items.reduce((s, it) => s + (it.totalAmount || 0), 0)

  const handleSubmit = async (andPrint = false) => {
    if (!business) return
    if (items.some((it) => !it.description.trim())) {
      error('Please enter descriptions for all items.')
      return
    }

    setIsSubmitting(true)
    try {
      const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)
      const challan = await createChallan(
        business.id,
        {
          customerId: selectedCustomerId || '',
          customer: selectedCustomer,
          challanDate,
          financialYear,
          transportMode,
          vehicleNumber,
          transporterName,
          lrRrNumber,
          notes,
          items,
        },
        user?.id,
      )

      success(`Delivery Challan #${challan.challanNumber} created! Stock deducted and customer ledger updated.`)

      if (andPrint) {
        await printChallanPDF(challan, business)
      }

      navigate('/challans')
    } catch (err: any) {
      error(err.message || 'Failed to create challan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: `${c.name} ${c.phone ? `(${c.phone})` : ''}`,
  }))

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10">
      <PageHeader
        title="New Delivery Challan"
        subtitle="Issue goods dispatch without GST; reduces stock & records to Customer Ledger"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft size={14} />}
              onClick={() => navigate('/challans')}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Printer size={14} />}
              isLoading={isSubmitting}
              onClick={() => handleSubmit(true)}
            >
              Save & Print
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Save size={14} />}
              isLoading={isSubmitting}
              onClick={() => handleSubmit(false)}
            >
              Save Challan
            </Button>
          </div>
        }
      />

      {/* Meta Card: Customer, Date, FY, Vehicle */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Select
              label="Select Customer"
              options={customerOptions}
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              placeholder="Search or pick customer..."
            />
          </div>

          <div>
            <Input
              type="date"
              label="Challan Date"
              value={challanDate}
              onChange={(e) => setChallanDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Financial Year (FY)
            </label>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs font-bold text-indigo-900 flex items-center justify-between">
              <span>{formatFinancialYearLabel(financialYear)}</span>
              <span className="text-[10px] text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono">
                {challanNumberPreview || 'CH/26-27/0001'}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Sequence starts from 1 for every Financial Year.
            </p>
          </div>
        </div>

        {/* Transport Details Strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 pt-3 border-t border-gray-100">
          <Input
            label="Vehicle Number"
            placeholder="e.g. GJ-01-AB-1234"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
          />
          <Input
            label="Transporter Name"
            placeholder="e.g. Maruti Roadlines"
            value={transporterName}
            onChange={(e) => setTransporterName(e.target.value)}
          />
          <Input
            label="Transport Mode"
            placeholder="Road, Rail, Air"
            value={transportMode}
            onChange={(e) => setTransportMode(e.target.value)}
          />
          <Input
            label="L.R. / R.R. Number"
            placeholder="L.R. / B/L No."
            value={lrRrNumber}
            onChange={(e) => setLrRrNumber(e.target.value)}
          />
        </div>
      </Card>

      {/* Items Section: NO GST */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Dispatched Products & Items</h3>
            <p className="text-xs text-gray-500">
              Quantities entered here will be deducted immediately from warehouse inventory. (No GST applied)
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Plus size={13} />}
            onClick={handleAddItem}
          >
            Add Item
          </Button>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-700">
              <tr>
                <th className="py-2.5 px-3 w-8 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[200px]">Product / Description</th>
                <th className="py-2.5 px-3 w-28">HSN/SAC</th>
                <th className="py-2.5 px-3 w-24 text-center">Qty</th>
                <th className="py-2.5 px-3 w-20 text-center">Unit</th>
                <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>
                <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {items.map((it, idx) => (
                <tr key={it.id}>
                  <td className="py-2 px-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                  <td className="py-2 px-3 space-y-1">
                    <select
                      className="w-full text-xs border border-gray-200 rounded p-1 bg-gray-50/50 focus:bg-white"
                      value={it.productId}
                      onChange={(e) => handleProductSelect(idx, e.target.value)}
                    >
                      <option value="">-- Pick from Catalog --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.productCode ? `(${p.productCode})` : ''} — ₹{paiseToRupees(p.sellingPrice)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="w-full text-xs border border-gray-200 rounded p-1"
                      placeholder="Item description..."
                      value={it.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      className="w-full text-xs border border-gray-200 rounded p-1 text-center"
                      placeholder="HSN"
                      value={it.hsnCode}
                      onChange={(e) => handleItemChange(idx, 'hsnCode', e.target.value)}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="w-full text-xs border border-gray-200 rounded p-1 text-center font-bold"
                      value={it.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      className="w-full text-xs border border-gray-200 rounded p-1 text-center"
                      value={it.unit}
                      onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="w-full text-xs border border-gray-200 rounded p-1 text-right"
                      value={it.unitPrice}
                      onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-bold tabular-nums text-gray-900">
                    {formatCurrency(it.totalAmount)}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => handleRemoveItem(idx)}
                      className="text-gray-300 hover:text-red-600 disabled:opacity-20 p-1 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Notes & Grand Total */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-3 border-t border-gray-100">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Dispatch Notes & Remarks
            </label>
            <textarea
              className="w-full text-xs border border-gray-200 rounded-lg p-2 h-20 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Sent for job work / delivery to site..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4 flex flex-col justify-between border border-gray-200">
            <div className="flex justify-between items-center text-xs text-gray-600 pb-2 border-b border-gray-200">
              <span>Total Items / Quantity:</span>
              <span className="font-bold text-gray-900">
                {items.reduce((s, it) => s + parseFloat(it.quantity || '0'), 0).toFixed(0)} units
              </span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-bold text-gray-800">Total Goods Value:</span>
              <span className="text-xl font-black text-indigo-900">
                {formatCurrency(totalPaise)}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
