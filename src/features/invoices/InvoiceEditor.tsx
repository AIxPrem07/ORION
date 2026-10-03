/**
 * ORION Invoice Editor
 * 
 * Handles: create new invoice, view existing invoice, edit draft.
 * Draft save → assigns temp number, NO stock deduction.
 * Finalize → assigns permanent number, deducts stock, creates ledger entry.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Save, CheckCircle2, ArrowLeft, X, ShoppingBag, Printer, FileDown, MessageSquare, Copy, Eye, Download, Sparkles, CreditCard, Edit2, RotateCcw, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { Modal } from '@components/ui/Modal'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import { useUIStore } from '@store/ui.store'
import {
  getInvoiceWithItems,
  createDraftInvoice,
  finalizeInvoice,
  cancelInvoice,
  duplicateInvoice,
  createAndFinalizeInvoice,
  updateDraftInvoice,
  moveInvoiceToBin,
  restoreInvoiceFromBin,
  permanentlyDeleteInvoice,
  updateInvoiceNumber,
} from '@services/invoice.service'
import { recordInvoicePayment } from '@services/payment.service'
import {
  openInvoicePDF,
  printInvoicePDF,
  downloadInvoicePDF,
  getInvoicePDFBlobUrl,
} from '@services/pdf.service'
import { getInvoiceDesignConfig } from '@services/invoice-design.service'
import { shareInvoiceViaWhatsApp } from '@services/whatsapp.service'
import { listCustomers } from '@services/customer.service'
import { listProducts, listTaxRates, listUnits } from '@services/product.service'
import { calculateInvoiceTotals } from '@services/gst.service'
import { getAppSetting, setAppSetting } from '@services/business.service'
import { generateUPIQRCode, generateQRCodeDataURL } from '@utils/qr'
import { formatCurrency, rupeesToPaise, paiseToRupeesNum, paiseToRupees } from '@utils/decimal'
import { todayISO } from '@utils/date'
import { InvoiceViewTemplate } from './InvoiceViewTemplate'
import type { InvoiceWithItems } from '@/types/invoice'
import type { Customer } from '@/types/customer'
import type { Product, TaxRate, Unit } from '@/types/product'
import type { InvoicePaperSize, InvoiceTheme } from '@/types/business'
import type { InvoiceCustomDesign } from '@/types/invoice-design'

interface LineItem {
  id: string
  productId: string | null
  productSnapshot: Record<string, unknown>
  description: string
  hsnCode: string
  quantity: number       // integer × 100 (e.g. 100 = 1 unit)
  unit: string
  purchasePrice: number  // paise
  unitPrice: number      // paise
  discountPercent: number  // basis points
  taxRate: number        // basis points
}

const DEFAULT_LINE: LineItem = {
  id: Math.random().toString(36).slice(2),
  productId: null,
  productSnapshot: {},
  description: '',
  hsnCode: '',
  quantity: 100,
  unit: 'pcs',
  purchasePrice: 0,
  unitPrice: 0,
  discountPercent: 0,
  taxRate: 1800,
}

export default function InvoiceEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const { success, error } = useNotificationStore()
  const { openConfirm } = useUIStore()

  const [invoice, setInvoice] = useState<InvoiceWithItems | null>(null)
  const [isLoading, setIsLoading] = useState(!!id)
  const [isSaving, setIsSaving] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)

  // Form state
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerSnapshot, setCustomerSnapshot] = useState<Record<string, unknown> | null>(null)
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')
  const [supplyType, setSupplyType] = useState<'INTRASTATE' | 'INTERSTATE'>('INTRASTATE')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [items, setItems] = useState<LineItem[]>([{ ...DEFAULT_LINE, id: Math.random().toString(36).slice(2) }])

  // Shipping Address state
  const [sameAsBillingAddress, setSameAsBillingAddress] = useState(true)
  const [shippingName, setShippingName] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [shippingState, setShippingState] = useState('')
  const [shippingStateCode, setShippingStateCode] = useState('')
  const [shippingPin, setShippingPin] = useState('')

  // Transport & Vehicle Details state
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [transportMode, setTransportMode] = useState('')
  const [transporterName, setTransporterName] = useState('')
  const [transporterId, setTransporterId] = useState('')
  const [lrRrNumber, setLrRrNumber] = useState('')
  const [lrRrDate, setLrRrDate] = useState('')

  // Additional Charges state (rupees strings for inputs)
  const [shippingCharges, setShippingCharges] = useState('0')
  const [overallDiscount, setOverallDiscount] = useState('0')
  const [additionalCharges, setAdditionalCharges] = useState('0')
  const [additionalChargesLabel, setAdditionalChargesLabel] = useState('')

  // Customer, product, tax rates, units
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [upiQrPreviewUrl, setUpiQrPreviewUrl] = useState<string | null>(null)

  const [showProductPicker, setShowProductPicker] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<number | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [paperSize, setPaperSize] = useState<InvoicePaperSize>('A4')
  const [invoiceTheme, setInvoiceTheme] = useState<InvoiceTheme>('SLATE_BLUE')
  const [customDesign, setCustomDesign] = useState<InvoiceCustomDesign | undefined>(undefined)

  const isViewMode = !!id && invoice?.status !== 'DRAFT'

  // Payment recording state
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmountInput, setPaymentAmountInput] = useState('')
  const [paymentDateInput, setPaymentDateInput] = useState(todayISO())
  const [paymentMethodInput, setPaymentMethodInput] = useState('UPI')
  const [paymentRefInput, setPaymentRefInput] = useState('')
  const [paymentNotesInput, setPaymentNotesInput] = useState('')
  const [isRecordingPayment, setIsRecordingPayment] = useState(false)

  // Edit Invoice Number state
  const [showEditNumberModal, setShowEditNumberModal] = useState(false)
  const [editNumberValue, setEditNumberValue] = useState('')
  const [isUpdatingInvoiceNumber, setIsUpdatingInvoiceNumber] = useState(false)
  const [editNumberError, setEditNumberError] = useState('')

  // Load saved paper size, theme preferences, and custom design
  useEffect(() => {
    getAppSetting('invoice_paper_size').then((s) => {
      if (s === 'A4' || s === 'A5' || s === 'THERMAL') setPaperSize(s)
    })
    getAppSetting('invoice_theme').then((t) => {
      if (t === 'SLATE_BLUE' || t === 'CLASSIC_NAVY' || t === 'MONOCHROME' || t === 'EMERALD') setInvoiceTheme(t)
    })
    getInvoiceDesignConfig().then((d) => {
      setCustomDesign(d)
      if (d.themePreset && d.themePreset !== 'CUSTOM') {
        setInvoiceTheme(d.themePreset)
      }
    })

    const handleFocus = () => {
      getInvoiceDesignConfig().then((d) => setCustomDesign(d))
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [id])

  async function handleUpdatePaperSize(size: InvoicePaperSize) {
    setPaperSize(size)
    try {
      await setAppSetting('invoice_paper_size', size)
    } catch (e) {
      console.warn('Failed to save paper size setting', e)
    }
  }

  async function handleUpdateTheme(thm: InvoiceTheme) {
    setInvoiceTheme(thm)
    try {
      await setAppSetting('invoice_theme', thm)
    } catch (e) {
      console.warn('Failed to save theme setting', e)
    }
  }

  // Load existing invoice
  useEffect(() => {
    if (!id || !business) return
    getInvoiceWithItems(id).then((inv) => {
      if (inv) {
        setInvoice(inv)
        setCustomerId(inv.customerId)
        setCustomerSnapshot(inv.customerSnapshot as unknown as Record<string, unknown>)
        setInvoiceDate(inv.invoiceDate)
        setDueDate(inv.dueDate ?? '')
        setSupplyType(inv.supplyType)
        setNotes(inv.notes ?? '')
        setPaymentMethod(inv.paymentMethod ?? '')

        // Shipping address
        if (inv.shippingName || inv.shippingAddress || inv.shippingCity) {
          setSameAsBillingAddress(false)
          setShippingName(inv.shippingName ?? '')
          setShippingAddress(inv.shippingAddress ?? '')
          setShippingCity(inv.shippingCity ?? '')
          setShippingState(inv.shippingState ?? '')
          setShippingStateCode(inv.shippingStateCode ?? '')
          setShippingPin(inv.shippingPin ?? '')
        }
        // Transport
        setVehicleNumber(inv.vehicleNumber ?? '')
        setTransportMode(inv.transportMode ?? '')
        setTransporterName(inv.transporterName ?? '')
        setTransporterId(inv.transporterId ?? '')
        setLrRrNumber(inv.lrRrNumber ?? '')
        setLrRrDate(inv.lrRrDate ?? '')
        // Charges
        setShippingCharges(String(paiseToRupeesNum(inv.shippingCharges || 0)))
        setAdditionalCharges(String(paiseToRupeesNum(inv.additionalCharges || 0)))
        setAdditionalChargesLabel(inv.additionalChargesLabel ?? '')

        if (inv.status === 'DRAFT') {
          setItems(inv.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            productSnapshot: item.productSnapshot as unknown as Record<string, unknown>,
            description: item.description,
            hsnCode: item.hsnCode ?? '',
            quantity: item.quantity,
            unit: item.unit ?? 'pcs',
            purchasePrice: item.purchasePrice,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            taxRate: item.taxRate,
          })))
        }
      }
      setIsLoading(false)
    })
  }, [id, business])

  // Load customers, products, tax rates, units
  useEffect(() => {
    if (!business) return
    Promise.all([
      listCustomers({ businessId: business.id, isActive: true, pageSize: 500 }),
      listProducts({ businessId: business.id, isActive: true, pageSize: 1000 }),
      listTaxRates(business.id),
      listUnits(business.id),
    ]).then(([custRes, prodRes, trList, unList]) => {
      setCustomers(custRes.data)
      setProducts(prodRes.data as Product[])
      setTaxRates(trList)
      setUnits(unList)
    })
  }, [business])

  // Copy billing to shipping helper
  function copyBillingToShipping() {
    if (!customerSnapshot) return
    setShippingName((customerSnapshot.name as string) || '')
    setShippingAddress((customerSnapshot.address as string) || '')
    setShippingCity((customerSnapshot.city as string) || '')
    setShippingState((customerSnapshot.state as string) || '')
    setShippingStateCode((customerSnapshot.stateCode as string) || '')
    setShippingPin((customerSnapshot.pin as string) || '')
    success('Copied', 'Billing address copied to shipping address')
  }

  // GST calculations
  const totals = (() => {
    try {
      return calculateInvoiceTotals({
        supplyType,
        gstInclusive: true,
        shippingCharges: rupeesToPaise(parseFloat(shippingCharges || '0')),
        overallDiscount: rupeesToPaise(parseFloat(overallDiscount || '0')),
        additionalCharges: rupeesToPaise(parseFloat(additionalCharges || '0')),
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

  // Generate UPI QR Code preview for current invoice total
  useEffect(() => {
    const totalAmt = invoice?.totalAmount ?? totals?.grandTotal ?? 0
    if (totalAmt > 0 && business) {
      if (business.upiId) {
        generateUPIQRCode({
          upiId: business.upiId,
          payeeName: business.name,
          amountPaise: totalAmt,
          invoiceNumber: invoice?.invoiceNumber ?? 'DRAFT',
        }).then((qr) => {
          if (qr) setUpiQrPreviewUrl(qr)
          else {
            generateQRCodeDataURL(`ORION-INVOICE:${invoice?.invoiceNumber ?? 'DRAFT'}|AMT:Rs.${paiseToRupees(totalAmt)}|SELLER:${business.name}`, 256)
              .then(setUpiQrPreviewUrl)
              .catch(() => {})
          }
        }).catch(() => {})
      } else {
        generateQRCodeDataURL(`ORION-INVOICE:${invoice?.invoiceNumber ?? 'DRAFT'}|AMT:Rs.${paiseToRupees(totalAmt)}|SELLER:${business.name}`, 256)
          .then(setUpiQrPreviewUrl)
          .catch(() => {})
      }
    }
  }, [business, invoice?.totalAmount, invoice?.invoiceNumber, totals?.grandTotal])

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

  function selectProduct(product: Product, index: number) {
    const matchedTaxRate = product.taxRateId
      ? taxRates.find((t) => t.id === product.taxRateId)?.rate ?? 1800
      : 1800
    const matchedUnit = product.unitId
      ? units.find((u) => u.id === product.unitId)?.abbreviation ?? 'pcs'
      : 'pcs'
    const taxInclusivePrice = product.mrp > 0 ? product.mrp : product.sellingPrice

    updateItem(index, {
      productId: product.id,
      productSnapshot: product as unknown as Record<string, unknown>,
      description: product.name,
      hsnCode: product.hsnCode ?? '',
      unit: matchedUnit,
      purchasePrice: product.purchasePrice,
      unitPrice: taxInclusivePrice,
      taxRate: matchedTaxRate,
    })
    setShowProductPicker(false)
    setPickerTarget(null)
    setProductSearch('')
  }

  function buildInvoiceInput() {
    if (!business) return null
    return {
      businessId: business.id,
      customer: customers.find((c) => c.id === customerId) ?? null,
      formData: {
        invoiceDate,
        dueDate: dueDate || null,
        supplyType,
        notes,
        paymentMethod,
        termsAndConditions: '',
        // Shipping address
        shippingName: sameAsBillingAddress ? ((customerSnapshot?.name as string) || null) : (shippingName || null),
        shippingAddress: sameAsBillingAddress ? ((customerSnapshot?.address as string) || null) : (shippingAddress || null),
        shippingCity: sameAsBillingAddress ? ((customerSnapshot?.city as string) || null) : (shippingCity || null),
        shippingState: sameAsBillingAddress ? ((customerSnapshot?.state as string) || null) : (shippingState || null),
        shippingStateCode: sameAsBillingAddress ? ((customerSnapshot?.stateCode as string) || null) : (shippingStateCode || null),
        shippingPin: sameAsBillingAddress ? ((customerSnapshot?.pin as string) || null) : (shippingPin || null),
        // Transport & Vehicle Details
        vehicleNumber: vehicleNumber || null,
        transportMode: transportMode || null,
        transporterName: transporterName || null,
        transporterId: transporterId || null,
        lrRrNumber: lrRrNumber || null,
        lrRrDate: lrRrDate || null,
        // Additional Charges
        shippingCharges: rupeesToPaise(parseFloat(shippingCharges || '0')),
        overallDiscount: rupeesToPaise(parseFloat(overallDiscount || '0')),
        additionalCharges: rupeesToPaise(parseFloat(additionalCharges || '0')),
        additionalChargesLabel: additionalChargesLabel || null,
      },
      items: items.filter((item) => item.description.trim()),
      gstInclusive: true,
    }
  }

  async function handleSaveDraft() {
    if (!business) return
    if (items.every((item) => !item.description.trim())) {
      error('Add at least one item to save the invoice.')
      return
    }
    const input = buildInvoiceInput()
    if (!input) return
    setIsSaving(true)
    try {
      if (id && invoice?.status === 'DRAFT') {
        const updated = await updateDraftInvoice(id, business.id, input)
        setInvoice(updated)
        success('Invoice draft updated', updated.invoiceNumber)
      } else {
        const saved = await createDraftInvoice(input)
        success('Invoice saved as draft', saved.invoiceNumber)
        navigate(`/invoices/${saved.id}/edit`)
      }
    } catch (err) {
      error('Failed to save', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveAndFinalize() {
    if (!business) return
    if (items.every((item) => !item.description.trim())) {
      error('Add at least one item to generate the invoice.')
      return
    }
    const input = buildInvoiceInput()
    if (!input) return
    setIsFinalizing(true)
    try {
      let finalized: InvoiceWithItems
      if (id && invoice?.status === 'DRAFT') {
        await updateDraftInvoice(id, business.id, input)
        finalized = await finalizeInvoice(id, business.id, business.invoicePrefix)
      } else {
        finalized = await createAndFinalizeInvoice(input, business.invoicePrefix)
      }
      setInvoice(finalized)
      success('Invoice Generated & Stock Deducted', `Invoice ${finalized.invoiceNumber} created and inventory deducted automatically`)
      navigate(`/invoices/${finalized.id}`)
    } catch (err) {
      error('Finalization failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsFinalizing(false)
    }
  }

  async function handleFinalize() {
    return handleSaveAndFinalize()
  }

  function handleCancelInvoice() {
    if (!id || !business) return
    openConfirm({
      title: 'Cancel Invoice',
      message: 'This will reverse any stock changes and ledger entries. Are you sure?',
      variant: 'danger',
      confirmLabel: 'Cancel Invoice',
      onConfirm: async () => {
        await cancelInvoice(id, business.id, 'Cancelled by user')
        success('Invoice cancelled')
        navigate('/invoices')
      },
    })
  }

  const filteredProducts = products.filter((p) =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.productCode?.toLowerCase().includes(productSearch.toLowerCase()) ?? false)
  )

  const customerOptions = [
    { value: '', label: 'Walk-in Customer' },
    ...customers.map((c) => ({ value: c.id, label: `${c.name}${c.phone ? ` (${c.phone})` : ''}` })),
  ]

  async function handleOpenPDF() {
    if (!invoice || !business) return
    setIsGeneratingPDF(true)
    try {
      const activeDesign = await getInvoiceDesignConfig()
      setCustomDesign(activeDesign)
      await openInvoicePDF(invoice, business, { paperSize, theme: invoiceTheme, customDesign: activeDesign })
      success('Opening PDF', 'Invoice opened in PDF viewer')
    } catch (err: unknown) {
      console.error('[InvoiceEditor] PDF open error:', err)
      const msg = err instanceof Error ? err.message : typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err)
      error('Failed to open PDF', msg)
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  async function handleDownloadPDF() {
    if (!invoice || !business) return
    setIsGeneratingPDF(true)
    try {
      const activeDesign = await getInvoiceDesignConfig()
      setCustomDesign(activeDesign)
      await downloadInvoicePDF(invoice, business, { paperSize, theme: invoiceTheme, customDesign: activeDesign })
      success('PDF Downloaded', 'Invoice saved to your downloads')
    } catch (err: unknown) {
      console.error('[InvoiceEditor] PDF download error:', err)
      const msg = err instanceof Error ? err.message : typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err)
      error('Failed to download PDF', msg)
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  async function handlePreviewPDF() {
    if (!invoice || !business) return
    setIsGeneratingPDF(true)
    try {
      const activeDesign = await getInvoiceDesignConfig()
      setCustomDesign(activeDesign)
      const url = await getInvoicePDFBlobUrl(invoice, business, { paperSize, theme: invoiceTheme, customDesign: activeDesign })
      setPdfPreviewUrl(url)
    } catch (err: unknown) {
      console.error('[InvoiceEditor] PDF preview error:', err)
      const msg = err instanceof Error ? err.message : typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err)
      error('Failed to preview PDF', msg)
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  async function handlePrintPDF() {
    if (!invoice || !business) return
    try {
      const activeDesign = await getInvoiceDesignConfig()
      setCustomDesign(activeDesign)
      await printInvoicePDF(invoice, business, { paperSize, theme: invoiceTheme, customDesign: activeDesign })
    } catch (err: unknown) {
      console.error('[InvoiceEditor] Print error:', err)
      const msg = err instanceof Error ? err.message : typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err)
      error('Failed to print PDF', msg)
    }
  }

  async function handleWhatsApp() {
    if (!invoice || !business) return
    try {
      await shareInvoiceViaWhatsApp(invoice, business)
    } catch (err: unknown) {
      console.error('[InvoiceEditor] WhatsApp error:', err)
      const msg = err instanceof Error ? err.message : typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err)
      error('Failed to share via WhatsApp', msg)
    }
  }

  async function handleDuplicate() {
    if (!id || !business) return
    try {
      const dup = await duplicateInvoice(id, business.id)
      success('Invoice duplicated as draft', dup.invoiceNumber)
      navigate(`/invoices/${dup.id}/edit`)
    } catch (err) {
      error('Failed to duplicate invoice', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  async function handleRecordPayment() {
    if (!invoice || !business) return
    const parsedAmount = parseFloat(paymentAmountInput || '0')
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      error('Invalid Amount', 'Please enter a payment amount greater than ₹0')
      return
    }
    const amountPaise = rupeesToPaise(parsedAmount)
    const remaining = Math.max(0, (invoice.totalAmount || 0) - (invoice.paidAmount || 0))
    if (amountPaise > remaining) {
      error('Excess Amount', `Payment cannot exceed outstanding balance of ${formatCurrency(remaining)}`)
      return
    }
    setIsRecordingPayment(true)
    try {
      await recordInvoicePayment({
        businessId: business.id,
        invoiceId: invoice.id,
        amount: amountPaise,
        paymentDate: paymentDateInput,
        method: paymentMethodInput,
        referenceNumber: paymentRefInput || undefined,
        notes: paymentNotesInput || undefined,
      })
      const updated = await getInvoiceWithItems(invoice.id)
      if (updated) setInvoice(updated)
      setShowPaymentModal(false)
      success(
        'Payment Recorded',
        `Recorded ₹${paiseToRupees(amountPaise)} via ${paymentMethodInput}. Customer ledger and invoice status updated automatically.`,
      )
    } catch (err: unknown) {
      error('Payment failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsRecordingPayment(false)
    }
  }

  async function handleMoveToBin() {
    if (!id || !business || !invoice) return
    openConfirm({
      title: 'Move Invoice to Bin',
      message: `Move ${invoice.invoiceNumber} to the Recycle Bin? Stock and customer ledger entries will be reversed while in the bin.`,
      variant: 'warning',
      confirmLabel: 'Move to Bin',
      onConfirm: async () => {
        try {
          await moveInvoiceToBin(id, business.id)
          success('Moved to Bin', `Invoice ${invoice.invoiceNumber} moved to Recycle Bin.`)
          const updated = await getInvoiceWithItems(id)
          if (updated) setInvoice(updated)
        } catch (err) {
          error('Failed to move to bin', err instanceof Error ? err.message : 'Unknown error')
        }
      },
    })
  }

  async function handleRestoreFromBin() {
    if (!id || !business || !invoice) return
    openConfirm({
      title: 'Restore Invoice',
      message: `Restore ${invoice.invoiceNumber} from the Recycle Bin? Stock deductions and customer balances will be reinstated.`,
      variant: 'default',
      confirmLabel: 'Restore Invoice',
      onConfirm: async () => {
        try {
          await restoreInvoiceFromBin(id, business.id)
          success('Restored', `Invoice ${invoice.invoiceNumber} has been restored.`)
          const updated = await getInvoiceWithItems(id)
          if (updated) setInvoice(updated)
        } catch (err) {
          error('Failed to restore invoice', err instanceof Error ? err.message : 'Unknown error')
        }
      },
    })
  }

  async function handlePermanentlyDelete() {
    if (!id || !business || !invoice) return
    openConfirm({
      title: 'Permanently Delete Invoice',
      message: `Are you sure you want to permanently delete invoice ${invoice.invoiceNumber}? This cannot be undone.`,
      variant: 'danger',
      confirmLabel: 'Delete Permanently',
      onConfirm: async () => {
        try {
          await permanentlyDeleteInvoice(id, business.id)
          success('Permanently Deleted', `Invoice ${invoice.invoiceNumber} has been removed.`)
          navigate('/invoices')
        } catch (err) {
          error('Failed to delete', err instanceof Error ? err.message : 'Unknown error')
        }
      },
    })
  }

  async function handleSaveInvoiceNumber() {
    if (!id || !business || !invoice) return
    const trimmed = editNumberValue.trim()
    if (!trimmed) {
      setEditNumberError('Invoice number cannot be empty.')
      return
    }
    if (trimmed === invoice.invoiceNumber) {
      setShowEditNumberModal(false)
      return
    }
    setIsUpdatingInvoiceNumber(true)
    setEditNumberError('')
    try {
      await updateInvoiceNumber(id, business.id, trimmed)
      success('Invoice Number Updated', `Changed to ${trimmed}`)
      setShowEditNumberModal(false)
      const updated = await getInvoiceWithItems(id)
      if (updated) setInvoice(updated)
    } catch (err) {
      setEditNumberError(err instanceof Error ? err.message : 'Failed to update invoice number.')
    } finally {
      setIsUpdatingInvoiceNumber(false)
    }
  }

  if (isLoading) return <LoadingState fullHeight />

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => navigate('/invoices')}>Back</Button>
      {invoice && invoice.isDeleted ? (
        <>
          <Button variant="primary" size="sm" leftIcon={<RotateCcw size={14} />} onClick={handleRestoreFromBin}>
            Restore Invoice
          </Button>
          <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />} onClick={handlePermanentlyDelete}>
            Permanently Delete
          </Button>
        </>
      ) : (
        <>
          {invoice && (
            <>
              <Button variant="secondary" size="sm" isLoading={isGeneratingPDF} leftIcon={<Eye size={14} />} onClick={handlePreviewPDF}>Preview</Button>
              <Button variant="secondary" size="sm" isLoading={isGeneratingPDF} leftIcon={<FileDown size={14} />} onClick={handleOpenPDF}>Open PDF</Button>
              <Button variant="secondary" size="sm" isLoading={isGeneratingPDF} leftIcon={<Download size={14} />} onClick={handleDownloadPDF}>Download</Button>
              <Button variant="secondary" size="sm" leftIcon={<Printer size={14} />} onClick={handlePrintPDF}>Print</Button>
              <Button variant="secondary" size="sm" leftIcon={<MessageSquare size={14} />} onClick={handleWhatsApp}>WhatsApp</Button>
              <Button variant="secondary" size="sm" leftIcon={<Copy size={14} />} onClick={handleDuplicate}>Duplicate</Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Edit2 size={14} />}
                onClick={() => {
                  setEditNumberValue(invoice.invoiceNumber)
                  setEditNumberError('')
                  setShowEditNumberModal(true)
                }}
              >
                Edit #
              </Button>
            </>
          )}
          {invoice && invoice.status !== 'DRAFT' && invoice.status !== 'CANCELLED' && invoice.paymentStatus !== 'PAID' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<CreditCard size={14} />}
              onClick={() => {
                const remaining = Math.max(0, (invoice.totalAmount || 0) - (invoice.paidAmount || 0))
                setPaymentAmountInput(paiseToRupees(remaining))
                setPaymentDateInput(todayISO())
                setShowPaymentModal(true)
              }}
            >
              Record Payment
            </Button>
          )}
          {invoice?.status === 'DRAFT' && (
            <>
              <Button variant="secondary" size="sm" isLoading={isSaving} leftIcon={<Save size={14} />} onClick={handleSaveDraft}>Save Draft</Button>
              <Button variant="primary" size="sm" isLoading={isFinalizing} leftIcon={<CheckCircle2 size={14} />} onClick={handleFinalize}>Finalize & Deduct Stock</Button>
            </>
          )}
          {!id && (
            <>
              <Button variant="secondary" size="sm" isLoading={isSaving} leftIcon={<Save size={14} />} onClick={handleSaveDraft}>Save Draft</Button>
              <Button variant="primary" size="sm" isLoading={isFinalizing} leftIcon={<CheckCircle2 size={14} />} onClick={handleSaveAndFinalize}>Generate & Finalize Invoice</Button>
            </>
          )}
          {(invoice?.status === 'FINALIZED' || invoice?.status === 'PARTIALLY_PAID') && (
            <Button variant="danger" size="sm" onClick={handleCancelInvoice}>Cancel Invoice</Button>
          )}
          {invoice && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              leftIcon={<Trash2 size={14} />}
              onClick={handleMoveToBin}
            >
              Move to Bin
            </Button>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <span className={invoice?.isDeleted ? 'line-through text-gray-400' : ''}>
              {id ? (invoice?.invoiceNumber ?? 'Invoice') : 'New Invoice'}
            </span>
            {invoice && !invoice.isDeleted && (
              <button
                type="button"
                onClick={() => {
                  setEditNumberValue(invoice.invoiceNumber)
                  setEditNumberError('')
                  setShowEditNumberModal(true)
                }}
                className="p-1 text-gray-400 hover:text-orion-primary rounded hover:bg-gray-100 transition-colors"
                title="Change Invoice Number"
              >
                <Edit2 size={15} />
              </button>
            )}
            {invoice?.isDeleted && (
              <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full no-underline">
                In Recycle Bin
              </span>
            )}
          </div>
        }
        breadcrumb={[{ label: 'Invoices' }, { label: id ? (invoice?.invoiceNumber ?? 'Invoice') : 'New' }]}
        actions={headerActions}
      />

      {invoice?.isDeleted && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 text-red-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">This invoice is in the Recycle Bin</p>
              <p className="text-xs text-red-700">Stock deductions and customer ledger balance are temporarily reversed. You can restore this invoice or permanently delete it.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" leftIcon={<RotateCcw size={14} />} onClick={handleRestoreFromBin}>
              Restore Invoice
            </Button>
            <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />} onClick={handlePermanentlyDelete}>
              Permanently Delete
            </Button>
          </div>
        </div>
      )}

      {invoice && invoice.status !== 'DRAFT' && (
        <div className="flex items-center gap-2">
          <Badge variant={invoice.status === 'FINALIZED' ? 'info' : invoice.status === 'PAID' ? 'primary' : 'danger'}>{invoice.status}</Badge>
          <Badge variant={invoice.paymentStatus === 'PAID' ? 'primary' : invoice.paymentStatus === 'PARTIALLY_PAID' ? 'warning' : 'danger'}>{invoice.paymentStatus}</Badge>
        </div>
      )}

      {/* View Mode vs Edit Mode */}
      {isViewMode && invoice && business ? (
        <div className="space-y-4">
          {/* Format & Size Quick Switcher */}
          <div className="bg-white border border-orion-border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700">Invoice Size:</span>
                <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                  <button
                    type="button"
                    onClick={() => handleUpdatePaperSize('A4')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      paperSize === 'A4' ? 'bg-white text-orion-primary shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    A4 (Full Page)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdatePaperSize('A5')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      paperSize === 'A5' ? 'bg-white text-orion-primary shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    A5 (Half Page)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdatePaperSize('THERMAL')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      paperSize === 'THERMAL' ? 'bg-white text-orion-primary shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Thermal (80mm POS)
                  </button>
                </div>
              </div>

              {paperSize !== 'THERMAL' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">Theme / Color:</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: 'SLATE_BLUE', label: 'Slate Blue', color: '#416788' },
                      { id: 'CLASSIC_NAVY', label: 'Classic Navy', color: '#1E3A5F' },
                      { id: 'MONOCHROME', label: 'B&W Monochrome', color: '#18191B' },
                      { id: 'EMERALD', label: 'Emerald Green', color: '#047857' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleUpdateTheme(t.id as InvoiceTheme)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                          invoiceTheme === t.id
                            ? 'border-gray-900 bg-gray-50 text-gray-900 font-semibold ring-1 ring-gray-900'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/settings/edit-invoice')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-sm"
                title="Open visual canvas designer to customize lines, logos, headers and layout"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Edit Invoice Studio
              </button>
              <span className="text-xs text-gray-500 italic">Layout selections are saved automatically</span>
            </div>
          </div>

          <InvoiceViewTemplate
            invoice={invoice}
            business={business}
            upiQrCodeUrl={upiQrPreviewUrl ?? undefined}
            paperSize={paperSize}
            theme={invoiceTheme}
            customDesign={customDesign}
          />
        </div>
      ) : (
        <>
          {/* Invoice Details */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Invoice Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <Select
                label="Customer"
                options={customerOptions}
                value={customerId ?? ''}
                onChange={(e) => {
                  const c = customers.find((cu) => cu.id === e.target.value)
                  setCustomerId(e.target.value || null)
                  setCustomerSnapshot(c ? (c as unknown as Record<string, unknown>) : null)
                  if (c?.stateCode && business?.stateCode) {
                    setSupplyType(c.stateCode === business.stateCode ? 'INTRASTATE' : 'INTERSTATE')
                  }
                }}
              />
              <Input label="Invoice Date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
              <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <Select
                label="Supply Type"
                value={supplyType}
                onChange={(e) => setSupplyType(e.target.value as 'INTRASTATE' | 'INTERSTATE')}
                options={[
                  { value: 'INTRASTATE', label: 'Intrastate (CGST + SGST)' },
                  { value: 'INTERSTATE', label: 'Interstate (IGST)' },
                ]}
              />
              <Select
                label="Payment Method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={[
                  { value: '', label: 'Not specified' },
                  { value: 'CASH', label: 'Cash' },
                  { value: 'UPI', label: 'UPI' },
                  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                  { value: 'CHEQUE', label: 'Cheque' },
                  { value: 'CREDIT', label: 'Credit' },
                ]}
              />
              <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note to customer" />
            </div>
          </Card>

          {/* Shipping Address */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Shipping / Delivery Address</h3>
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sameAsBillingAddress}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setSameAsBillingAddress(checked)
                      if (checked && customerSnapshot) {
                        copyBillingToShipping()
                      }
                    }}
                    className="rounded border-gray-300 text-orion-primary focus:ring-orion-primary"
                  />
                  Same as Billed Address
                </label>
              </div>
              {!sameAsBillingAddress && (
                <Button
                  variant="ghost"
                  size="xs"
                  type="button"
                  onClick={copyBillingToShipping}
                >
                  Copy from Billed Address
                </Button>
              )}
            </div>

            {!sameAsBillingAddress && (
              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-orion-border">
                <Input
                  label="Shipping / Consignee Name"
                  value={shippingName}
                  onChange={(e) => setShippingName(e.target.value)}
                  placeholder="Receiver or Company Name"
                />
                <Input
                  label="Shipping Address"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Street address / Landmark"
                />
                <Input
                  label="City"
                  value={shippingCity}
                  onChange={(e) => setShippingCity(e.target.value)}
                  placeholder="City"
                />
                <Input
                  label="State"
                  value={shippingState}
                  onChange={(e) => setShippingState(e.target.value)}
                  placeholder="State"
                />
                <Input
                  label="State Code"
                  value={shippingStateCode}
                  onChange={(e) => setShippingStateCode(e.target.value)}
                  placeholder="e.g. 27"
                />
                <Input
                  label="PIN Code"
                  value={shippingPin}
                  onChange={(e) => setShippingPin(e.target.value)}
                  placeholder="PIN"
                />
              </div>
            )}
          </Card>

          {/* Transport & Dispatch Details */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Transport & Dispatch Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Vehicle Number"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="e.g. MH-12-AB-1234"
              />
              <Select
                label="Transport Mode"
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
                options={[
                  { value: '', label: 'Select mode...' },
                  { value: 'ROAD', label: 'Road' },
                  { value: 'RAIL', label: 'Rail' },
                  { value: 'AIR', label: 'Air' },
                  { value: 'SHIP', label: 'Ship' },
                ]}
              />
              <Input
                label="Transporter Name"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="e.g. VRL Logistics"
              />
              <Input
                label="Transporter ID / GSTIN"
                value={transporterId}
                onChange={(e) => setTransporterId(e.target.value)}
                placeholder="Transporter GSTIN"
              />
              <Input
                label="LR / RR Number"
                value={lrRrNumber}
                onChange={(e) => setLrRrNumber(e.target.value)}
                placeholder="Lorry / Railway receipt no."
              />
              <Input
                label="LR / RR Date"
                type="date"
                value={lrRrDate}
                onChange={(e) => setLrRrDate(e.target.value)}
              />
            </div>
          </Card>

          {/* Line Items */}
          <div className="bg-white border border-orion-border rounded-lg shadow-orion overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-orion-border">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Items (Tax-Inclusive Pricing)</h3>
                <span className="text-xs text-gray-500">Select product name from catalog; price includes GST (breakdown auto-calculated below)</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="xs" leftIcon={<ShoppingBag size={12} />}
                  onClick={() => { setPickerTarget(null); setShowProductPicker(true) }}
                >
                  Product Search Dialog
                </Button>
                <Button variant="ghost" size="xs" leftIcon={<Plus size={12} />} onClick={addItem}>
                  Add row
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[950px]">
                <thead className="bg-gray-50 border-b border-orion-border">
                  <tr>
                    {['#', 'Product Name & Description', 'HSN', 'Qty', 'Unit', 'Price (Incl. Tax ₹)', 'Disc %', 'GST %', 'Amount (₹)', ''].map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-orion-secondary">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((eItem, idx) => {
                    const lineCalc = totals?.lineResults?.[idx]
                    return (
                      <tr key={eItem.id} className="border-b border-orion-border last:border-0">
                        <td className="px-3 py-2 text-orion-secondary">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <select
                              value={eItem.productId ?? ''}
                              onChange={(e) => {
                                const pId = e.target.value
                                if (!pId) {
                                  updateItem(idx, { productId: null })
                                } else {
                                  const prod = products.find((p) => p.id === pId)
                                  if (prod) selectProduct(prod, idx)
                                }
                              }}
                              className="w-56 bg-white border border-orion-border rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-orion-primary"
                            >
                              <option value="">-- Select Product Name --</option>
                              {products.map((p) => {
                                const inclPrice = p.mrp > 0 ? p.mrp : p.sellingPrice
                                return (
                                  <option key={p.id} value={p.id}>
                                    {p.name} {p.hsnCode ? `[${p.hsnCode}]` : ''} - ₹{(inclPrice / 100).toFixed(2)} (Incl. Tax)
                                  </option>
                                )
                              })}
                            </select>
                            <input
                              value={eItem.description}
                              onChange={(e) => updateItem(idx, { description: e.target.value })}
                              placeholder="Or type custom description"
                              className="w-56 bg-transparent border-0 outline-none text-xs text-gray-700 placeholder:text-gray-400"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input value={eItem.hsnCode} onChange={(e) => updateItem(idx, { hsnCode: e.target.value })} placeholder="HSN" className="w-16 bg-transparent border-0 outline-none text-sm" />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" value={(eItem.quantity / 100).toFixed(2)} min="0.01" step="0.01"
                            onChange={(e) => updateItem(idx, { quantity: Math.round(parseFloat(e.target.value || '0') * 100) })}
                            className="w-16 bg-transparent border-0 outline-none text-sm tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={eItem.unit}
                            onChange={(e) => updateItem(idx, { unit: e.target.value })}
                            placeholder="unit"
                            className="w-12 bg-transparent border-0 outline-none text-xs text-gray-600"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" value={(eItem.unitPrice / 100).toFixed(2)} min="0" step="0.01"
                            onChange={(e) => updateItem(idx, { unitPrice: Math.round(parseFloat(e.target.value || '0') * 100) })}
                            className="w-20 bg-transparent border-0 outline-none text-sm tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" value={(eItem.discountPercent / 100).toFixed(1)} min="0" max="100" step="0.1"
                            onChange={(e) => updateItem(idx, { discountPercent: Math.round(parseFloat(e.target.value || '0') * 100) })}
                            className="w-14 bg-transparent border-0 outline-none text-sm tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={eItem.taxRate}
                            onChange={(e) => updateItem(idx, { taxRate: parseInt(e.target.value) })}
                            className="bg-transparent border-0 outline-none text-sm"
                          >
                            {[0, 500, 1200, 1800, 2800].map((r) => (
                              <option key={r} value={r}>{r / 100}%</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 tabular-nums font-medium">
                          {lineCalc ? formatCurrency(lineCalc.totalAmount) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => removeItem(idx)} disabled={items.length === 1} className="text-gray-400 hover:text-red-500 disabled:opacity-30">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Charges & Totals */}
            {totals && (
              <div className="grid grid-cols-2 gap-6 border-t border-orion-border px-4 py-4">
                <div>
                  <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-orion-border">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Additional Charges & Discounts (+ / -)
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Freight / Transportation (+ ₹)"
                        type="number"
                        step="0.01"
                        value={shippingCharges}
                        onChange={(e) => setShippingCharges(e.target.value)}
                      />
                      <Input
                        label="Bill Discount (- ₹)"
                        type="number"
                        step="0.01"
                        value={overallDiscount}
                        onChange={(e) => setOverallDiscount(e.target.value)}
                      />
                      <Input
                        label="Other Charges Label"
                        value={additionalChargesLabel}
                        onChange={(e) => setAdditionalChargesLabel(e.target.value)}
                        placeholder="e.g. Packaging / Loading"
                      />
                      <Input
                        label="Other Charges Amount (+/- ₹)"
                        type="number"
                        step="0.01"
                        value={additionalCharges}
                        onChange={(e) => setAdditionalCharges(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="w-72 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-orion-secondary">Subtotal (Gross)</span>
                      <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
                    </div>
                    {totals.discountAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-orion-secondary">Total Discount</span>
                        <span className="tabular-nums text-red-600">- {formatCurrency(totals.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-orion-secondary">Taxable Amount</span>
                      <span className="tabular-nums font-medium">{formatCurrency(totals.taxableAmount)}</span>
                    </div>
                    {supplyType === 'INTRASTATE' ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-orion-secondary">CGST</span>
                          <span className="tabular-nums">{formatCurrency(totals.cgstAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-orion-secondary">SGST</span>
                          <span className="tabular-nums">{formatCurrency(totals.sgstAmount)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-orion-secondary">IGST</span>
                        <span className="tabular-nums">{formatCurrency(totals.igstAmount)}</span>
                      </div>
                    )}
                    {totals.shippingCharges > 0 && (
                      <div className="flex justify-between">
                        <span className="text-orion-secondary">Freight / Transport</span>
                        <span className="tabular-nums text-green-700">+ {formatCurrency(totals.shippingCharges)}</span>
                      </div>
                    )}
                    {totals.additionalCharges !== 0 && (
                      <div className="flex justify-between">
                        <span className="text-orion-secondary">{additionalChargesLabel || 'Other Charges'}</span>
                        <span className="tabular-nums">{totals.additionalCharges > 0 ? '+ ' : ''}{formatCurrency(totals.additionalCharges)}</span>
                      </div>
                    )}
                    {totals.roundOff !== 0 && (
                      <div className="flex justify-between">
                        <span className="text-orion-secondary">Round Off</span>
                        <span className="tabular-nums">{formatCurrency(totals.roundOff)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-orion-border font-semibold">
                      <span className="text-base text-gray-900">Grand Total</span>
                      <span className="tabular-nums text-lg text-gray-900 font-bold">{formatCurrency(totals.grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Form Action Buttons Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-orion-border bg-white p-4 rounded-lg shadow-sm">
              <Button
                type="button"
                variant="secondary"
                size="md"
                isLoading={isSaving}
                leftIcon={<Save size={16} />}
                onClick={handleSaveDraft}
              >
                Save as Draft
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                isLoading={isFinalizing}
                leftIcon={<CheckCircle2 size={16} />}
                onClick={handleSaveAndFinalize}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
              >
                {id && invoice?.status === 'DRAFT' ? 'Finalize Invoice & Deduct Stock' : 'Generate & Finalize Invoice'}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Product Picker Modal */}
      <Modal
        open={showProductPicker}
        onClose={() => { setShowProductPicker(false); setProductSearch('') }}
        title="Select Product"
        size="lg"
      >
        <input
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder="Search products..."
          autoFocus
          className="h-8 w-full rounded border border-orion-border bg-white px-3 text-sm mb-3 outline-none focus:ring-2 focus:ring-orion-primary"
        />
        <div className="max-h-72 overflow-y-auto divide-y divide-orion-border">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => {
                const targetIndex = pickerTarget !== null ? pickerTarget : items.length - 1
                selectProduct(product, targetIndex)
              }}
              className="w-full flex items-center gap-3 px-2 py-2.5 hover:bg-gray-50 text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{product.name}</p>
                <p className="text-xs text-orion-secondary">{product.productCode ?? ''} {product.hsnCode ? `· HSN: ${product.hsnCode}` : ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold tabular-nums">{formatCurrency(product.mrp > 0 ? product.mrp : product.sellingPrice)}</p>
                <p className="text-xs text-emerald-600 font-medium">Price (Incl. Tax)</p>
              </div>
            </button>
          ))}
          {filteredProducts.length === 0 && <p className="text-center py-8 text-xs text-orion-secondary">No products found.</p>}
        </div>
      </Modal>

      {/* PDF Preview Modal */}
      {pdfPreviewUrl && (
        <Modal
          isOpen={!!pdfPreviewUrl}
          onClose={() => {
            URL.revokeObjectURL(pdfPreviewUrl)
            setPdfPreviewUrl(null)
          }}
          title={`Invoice Preview: ${invoice?.invoiceNumber}`}
          size="full"
          footer={
            <div className="flex justify-between w-full items-center">
              <div className="flex gap-2">
                <Button variant="primary" size="sm" leftIcon={<Download size={14} />} onClick={handleDownloadPDF}>
                  Download PDF
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<FileDown size={14} />} onClick={handleOpenPDF}>
                  Open in System Viewer
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<Printer size={14} />} onClick={handlePrintPDF}>
                  Print
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  URL.revokeObjectURL(pdfPreviewUrl)
                  setPdfPreviewUrl(null)
                }}
              >
                Close
              </Button>
            </div>
          }
        >
          <iframe
            src={pdfPreviewUrl}
            title="Invoice PDF Preview"
            className="w-full h-[600px] rounded border border-orion-border bg-gray-50"
          />
        </Modal>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && invoice && (
        <Modal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          title={`Record Payment — Invoice ${invoice.invoiceNumber}`}
          size="md"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button variant="ghost" size="sm" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<CreditCard size={14} />}
                isLoading={isRecordingPayment}
                onClick={handleRecordPayment}
              >
                Confirm Payment
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Invoice Payment Overview */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs grid grid-cols-3 gap-2">
              <div>
                <span className="text-gray-500 block">Total Amount</span>
                <span className="font-bold text-gray-900 text-sm">{formatCurrency(invoice.totalAmount)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Already Paid</span>
                <span className="font-semibold text-emerald-600 text-sm">{formatCurrency(invoice.paidAmount)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Balance Due</span>
                <span className="font-bold text-rose-600 text-sm">
                  {formatCurrency(Math.max(0, (invoice.totalAmount || 0) - (invoice.paidAmount || 0)))}
                </span>
              </div>
            </div>

            {/* Payment Fields */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  placeholder="Enter amount in ₹"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Payment Date</label>
                  <Input
                    type="date"
                    value={paymentDateInput}
                    onChange={(e) => setPaymentDateInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Payment Method</label>
                  <Select
                    value={paymentMethodInput}
                    onChange={(e) => setPaymentMethodInput(e.target.value)}
                    options={[
                      { value: 'UPI', label: 'UPI / QR Code' },
                      { value: 'CASH', label: 'Cash' },
                      { value: 'BANK_TRANSFER', label: 'Bank Transfer (NEFT/RTGS)' },
                      { value: 'CHEQUE', label: 'Cheque' },
                      { value: 'CARD', label: 'Debit / Credit Card' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Transaction Ref / Cheque No. (Optional)</label>
                <Input
                  value={paymentRefInput}
                  onChange={(e) => setPaymentRefInput(e.target.value)}
                  placeholder="e.g. UTR12345678, CHQ-9901"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Notes (Optional)</label>
                <Input
                  value={paymentNotesInput}
                  onChange={(e) => setPaymentNotesInput(e.target.value)}
                  placeholder="e.g. Received via GPay from customer"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Invoice Number Modal */}
      {showEditNumberModal && invoice && (
        <Modal
          isOpen={showEditNumberModal}
          onClose={() => setShowEditNumberModal(false)}
          title="Change Invoice Number"
          size="md"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEditNumberModal(false)}
                disabled={isUpdatingInvoiceNumber}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isUpdatingInvoiceNumber}
                onClick={handleSaveInvoiceNumber}
              >
                Save Invoice Number
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-600">
              Updating the invoice number will automatically synchronize all associated customer ledger entries, inventory stock deduction records, and audit events.
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Current Invoice Number
              </label>
              <div className="font-mono text-sm bg-gray-50 border border-gray-200 px-3 py-2 rounded text-gray-700">
                {invoice.invoiceNumber}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                New Invoice Number *
              </label>
              <Input
                value={editNumberValue}
                onChange={(e) => {
                  setEditNumberValue(e.target.value)
                  setEditNumberError('')
                }}
                placeholder="e.g. INV-2026-0042"
                autoFocus
              />
              {editNumberError && (
                <p className="mt-1.5 text-xs text-red-600 font-medium">
                  {editNumberError}
                </p>
              )}
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
              <p className="font-semibold">Important Notes:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>The new number must be unique across all invoices in your business.</li>
                <li>Invoice dates, totals, taxes, and products will remain unchanged.</li>
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
