import { useState, useEffect, useCallback } from 'react'
import { Plus, RotateCcw, FileText, Trash2, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { SearchInput } from '@components/ui/SearchInput'
import { Table } from '@components/ui/Table'
import { Pagination } from '@components/ui/Pagination'
import { Badge } from '@components/ui/Badge'
import { EmptyState } from '@components/ui/EmptyState'
import LoadingState from '@components/ui/LoadingState'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import {
  listReturns,
  createSalesReturn,
  createPurchaseReturn,
} from '@services/returns.service'
import { listCustomers } from '@services/customer.service'
import { listSuppliers } from '@services/supplier.service'
import { listProducts } from '@services/product.service'
import { formatCurrency, rupeesToPaise } from '@utils/decimal'
import { todayISO } from '@utils/date'
import type { Return, ReturnType } from '@/types/returns'
import type { Customer } from '@/types/customer'
import type { Supplier } from '@/types/supplier'
import type { Product } from '@/types/product'

const PAGE_SIZE = 50

interface ReturnItemRow {
  productId: string
  quantity: string
  unitPrice: string
}

export default function ReturnsList() {
  const { business } = useBusinessStore()
  const { addToast } = useNotificationStore()

  const [activeTab, setActiveTab] = useState<'sales' | 'purchases'>('sales')
  const [returns, setReturns] = useState<Return[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Parties & products cache for modals
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Form states
  const [selectedPartyId, setSelectedPartyId] = useState('')
  const [returnDate, setReturnDate] = useState(todayISO())
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ReturnItemRow[]>([
    { productId: '', quantity: '1', unitPrice: '0' },
  ])

  const returnType: ReturnType = activeTab === 'sales' ? 'SALE_RETURN' : 'PURCHASE_RETURN'

  const loadReturns = useCallback(async () => {
    if (!business) return
    setIsLoading(true)
    try {
      const res = await listReturns({
        businessId: business.id,
        returnType,
        search,
        page,
        pageSize: PAGE_SIZE,
      })
      setReturns(res.data)
      setTotal(res.total)
    } finally {
      setIsLoading(false)
    }
  }, [business, returnType, search, page])

  useEffect(() => {
    loadReturns()
  }, [loadReturns])

  useEffect(() => {
    setPage(1)
  }, [activeTab, search])

  // Load parties & products when modal opens
  const openCreateModal = async () => {
    if (!business) return
    setIsModalOpen(true)
    setSelectedPartyId('')
    setReturnDate(todayISO())
    setReason('')
    setNotes('')
    setItems([{ productId: '', quantity: '1', unitPrice: '0' }])

    try {
      if (activeTab === 'sales') {
        const custRes = await listCustomers({ businessId: business.id, pageSize: 200, isActive: true })
        setCustomers(custRes.data)
      } else {
        const suppRes = await listSuppliers({ businessId: business.id, pageSize: 200, isActive: true })
        setSuppliers(suppRes.data)
      }
      const prodRes = await listProducts({ businessId: business.id, pageSize: 200, isActive: true })
      setProducts(prodRes.data)
    } catch (err) {
      console.error('Failed to load modal reference data', err)
    }
  }

  const handleProductChange = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId)
    const newItems = [...items]
    const pricePaise = activeTab === 'sales' ? prod?.sellingPrice ?? 0 : prod?.purchasePrice ?? 0
    newItems[index] = {
      ...newItems[index],
      productId,
      unitPrice: (pricePaise / 100).toFixed(2),
    }
    setItems(newItems)
  }

  const handleItemChange = (index: number, field: 'quantity' | 'unitPrice', value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const addItemRow = () => {
    setItems([...items, { productId: '', quantity: '1', unitPrice: '0' }])
  }

  const removeItemRow = (index: number) => {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const q = parseFloat(item.quantity) || 0
      const p = parseFloat(item.unitPrice) || 0
      return sum + Math.round(q * p * 100)
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!business) return
    if (!selectedPartyId) {
      addToast({
        type: 'error',
        title: 'Validation Error',
        message: `Please select a ${activeTab === 'sales' ? 'customer' : 'supplier'}.`,
      })
      return
    }

    const validItems = items.filter((i) => i.productId && parseFloat(i.quantity) > 0)
    if (validItems.length === 0) {
      addToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Please add at least one valid item with a positive quantity.',
      })
      return
    }

    setIsSubmitting(true)
    try {
      if (activeTab === 'sales') {
        const res = await createSalesReturn({
          businessId: business.id,
          customerId: selectedPartyId,
          returnDate,
          reason,
          notes,
          items: validItems.map((i) => ({
            productId: i.productId,
            quantity: Math.round(parseFloat(i.quantity) * 100),
            unitPrice: rupeesToPaise(i.unitPrice),
          })),
        })
        addToast({
          type: 'success',
          title: 'Sales Return Created',
          message: `Issued Credit Note ${res.creditNote.creditNoteNumber}. Inventory and customer balance updated.`,
        })
      } else {
        const res = await createPurchaseReturn({
          businessId: business.id,
          supplierId: selectedPartyId,
          returnDate,
          reason,
          notes,
          items: validItems.map((i) => ({
            productId: i.productId,
            quantity: Math.round(parseFloat(i.quantity) * 100),
            unitPrice: rupeesToPaise(i.unitPrice),
          })),
        })
        addToast({
          type: 'success',
          title: 'Purchase Return Created',
          message: `Issued Debit Note ${res.debitNote.debitNoteNumber}. Inventory and supplier balance updated.`,
        })
      }
      setIsModalOpen(false)
      loadReturns()
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Failed to create return',
        message: err.message || 'An error occurred.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns = [
    {
      key: 'returnNumber',
      header: 'Return #',
      cell: (r: Return) => <span className="font-semibold text-gray-900">{r.returnNumber}</span>,
    },
    {
      key: 'noteNumber',
      header: activeTab === 'sales' ? 'Credit Note #' : 'Debit Note #',
      cell: (r: Return) => (
        <span className="font-mono text-xs text-gray-700 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">
          {activeTab === 'sales' ? r.creditNoteNumber ?? '—' : r.debitNoteNumber ?? '—'}
        </span>
      ),
    },
    {
      key: 'returnDate',
      header: 'Date',
      cell: (r: Return) => <span className="text-gray-600">{r.returnDate}</span>,
    },
    {
      key: 'party',
      header: activeTab === 'sales' ? 'Customer' : 'Supplier',
      cell: (r: Return) => <span className="font-medium text-gray-900">{r.partyName}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Total Amount',
      cell: (r: Return) => (
        <span className="tabular-nums font-semibold text-gray-900">
          {formatCurrency(r.totalAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: () => <Badge variant="primary">Completed</Badge>,
    },
    {
      key: 'notes',
      header: 'Notes',
      cell: (r: Return) => <span className="text-xs text-gray-500 truncate max-w-xs">{r.notes || '—'}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Returns & Credit/Debit Notes"
        subtitle="Manage customer sales returns (Credit Notes) and supplier purchase returns (Debit Notes)"
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={openCreateModal}
          >
            {activeTab === 'sales' ? 'New Sales Return (Credit Note)' : 'New Purchase Return (Debit Note)'}
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-orion-border">
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-2 pb-2.5 px-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'sales'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-orion-secondary hover:text-gray-900'
          }`}
        >
          <ArrowDownLeft size={15} />
          <span>Sales Returns & Credit Notes</span>
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`flex items-center gap-2 pb-2.5 px-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'purchases'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-orion-secondary hover:text-gray-900'
          }`}
        >
          <ArrowUpRight size={15} />
          <span>Purchase Returns & Debit Notes</span>
        </button>
      </div>

      <div className="bg-white border border-orion-border rounded-lg shadow-orion">
        <div className="p-4 border-b border-orion-border">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`Search ${activeTab === 'sales' ? 'sales returns, credit notes, customers' : 'purchase returns, debit notes, suppliers'}...`}
            className="max-w-md"
          />
        </div>

        {isLoading ? (
          <LoadingState fullHeight />
        ) : (
          <Table
            columns={columns}
            data={returns}
            keyExtractor={(r) => r.id}
            emptyState={
              <EmptyState
                icon={<RotateCcw size={32} />}
                title={activeTab === 'sales' ? 'No sales returns yet' : 'No purchase returns yet'}
                description={
                  activeTab === 'sales'
                    ? 'Create a sales return to take back products, restore stock, and issue a credit note.'
                    : 'Create a purchase return to send items back to a supplier, deduct stock, and issue a debit note.'
                }
                action={{
                  label: activeTab === 'sales' ? 'New Sales Return' : 'New Purchase Return',
                  onClick: openCreateModal,
                }}
              />
            }
          />
        )}

        <Pagination
          page={page}
          totalPages={Math.ceil(total / PAGE_SIZE)}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* Create Return Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={activeTab === 'sales' ? 'Create Sales Return & Credit Note' : 'Create Purchase Return & Debit Note'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={activeTab === 'sales' ? 'Select Customer *' : 'Select Supplier *'}
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              options={[
                { value: '', label: `-- Choose ${activeTab === 'sales' ? 'Customer' : 'Supplier'} --` },
                ...(activeTab === 'sales'
                  ? customers.map((c) => ({ value: c.id, label: c.name }))
                  : suppliers.map((s) => ({ value: s.id, label: s.name }))),
              ]}
              required
            />
            <Input
              label="Return Date *"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Reason for Return"
              placeholder="e.g. Defective item, excess stock, wrong specification"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Input
              label="Additional Notes"
              placeholder="Internal tracking notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Returned Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Returned Products
              </span>
              <Button type="button" variant="ghost" size="sm" leftIcon={<Plus size={12} />} onClick={addItemRow}>
                Add Item
              </Button>
            </div>

            <div className="border border-orion-border rounded divide-y divide-gray-100 max-h-56 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="p-2.5 flex items-center gap-2 bg-white">
                  <div className="flex-1">
                    <Select
                      value={item.productId}
                      onChange={(e) => handleProductChange(idx, e.target.value)}
                      options={[
                        { value: '', label: '-- Select Product --' },
                        ...products.map((p) => ({ value: p.id, label: `${p.name} (SKU: ${p.sku || '—'})` })),
                      ]}
                      required
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Price (₹)"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-28 text-right text-xs font-semibold tabular-nums text-gray-900 pr-2">
                    {formatCurrency(
                      Math.round((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0) * 100),
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    disabled={items.length === 1}
                    className="text-gray-400 hover:text-red-500 disabled:opacity-30 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Total & Action */}
          <div className="flex items-center justify-between p-3 bg-gray-50 border border-orion-border rounded">
            <span className="text-xs font-medium text-gray-700">Total Credit/Debit Amount:</span>
            <span className="text-base font-bold text-gray-900">{formatCurrency(calculateTotal())}</span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-orion-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting} leftIcon={<RotateCcw size={13} />}>
              Issue {activeTab === 'sales' ? 'Credit Note' : 'Debit Note'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
