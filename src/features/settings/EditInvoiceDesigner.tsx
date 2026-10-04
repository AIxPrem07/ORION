import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sliders,
  Palette,
  Grid,
  Type,
  Image as ImageIcon,
  QrCode,
  FileText,
  CheckCircle2,
  RotateCcw,
  Eye,
  Printer,
  Download,
  Upload,
  Trash2,
  Layout,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  HelpCircle,
  Building,
  Settings,
  ShieldCheck,
  CreditCard,
  PenTool,
} from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Card } from '@components/ui/Card'
import { Modal } from '@components/ui/Modal'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import {
  getInvoiceDesignConfig,
  saveInvoiceDesignConfig,
  resetInvoiceDesignConfig,
} from '@services/invoice-design.service'
import { getInvoicePDFBlobUrl, downloadInvoicePDF, printInvoicePDF } from '@services/pdf.service'
import {
  type InvoiceCustomDesign,
  type InvoicePaperSize,
  type InvoiceTheme,
  DEFAULT_INVOICE_DESIGN,
  INVOICE_DESIGN_PRESETS,
  DEFAULT_TERMS_TEXT,
} from '@/types/invoice-design'
import { InvoiceViewTemplate } from '@/features/invoices/InvoiceViewTemplate'
import type { InvoiceWithItems } from '@/types/invoice'

// Realistic Sample Invoice for Interactive Canvas Preview
const SAMPLE_INVOICE: InvoiceWithItems = {
  id: 'sample-inv-001',
  businessId: 'biz-001',
  invoiceNumber: 'INV/26-27/0042',
  customerId: 'cust-001',
  customerSnapshot: {
    id: 'cust-001',
    name: 'KASHYAP BHANUSHALI & CO.',
    phone: '9988998800',
    email: 'kashyap@example.com',
    address: 'Plot 42, GIDC Industrial Estate, Phase 2',
    city: 'PRANTIJ',
    state: 'Gujarat',
    stateCode: '24',
    pin: '383120',
    gstin: '24AALLK8899H1Z5',
    pan: 'AALLK8899H',
  },
  invoiceDate: '2026-10-01',
  dueDate: '2026-10-15',
  status: 'FINALIZED',
  paymentStatus: 'UNPAID',
  supplyType: 'INTRASTATE',
  subtotal: 21483050,
  discountAmount: 0,
  taxableAmount: 21483050,
  cgstAmount: 1933475,
  sgstAmount: 1933475,
  igstAmount: 0,
  totalTax: 3866950,
  roundOff: 0,
  totalAmount: 25350000,
  paidAmount: 0,
  notes: 'Supplied under statutory GST rules. Goods to be checked at delivery.',
  termsAndConditions: DEFAULT_TERMS_TEXT,
  paymentMethod: 'BANK_TRANSFER',
  createdBy: 'user-001',
  cancelledAt: null,
  cancelledReason: null,
  shippingName: 'KASHYAP BHANUSHALI (WAREHOUSE 3)',
  shippingAddress: 'Godown 12, Highway Ring Road, Near Toll Plaza',
  shippingCity: 'HIMATNAGAR',
  shippingState: 'Gujarat',
  shippingStateCode: '24',
  shippingPin: '383001',
  vehicleNumber: 'GJ-09-AX-7788',
  transportMode: 'Road (Freight Carrier)',
  transporterName: 'Shree Sai Logistics',
  transporterId: '24AABCS9988L1Z2',
  lrRrNumber: 'LR-998877',
  lrRrDate: '2026-10-01',
  shippingCharges: 0,
  additionalCharges: 0,
  additionalChargesLabel: null,
  createdAt: '2026-10-01T10:30:00.000Z',
  updatedAt: '2026-10-01T10:30:00.000Z',
  items: [
    {
      id: 'item-001',
      invoiceId: 'sample-inv-001',
      productId: 'prod-001',
      productSnapshot: {
        id: 'prod-001',
        name: 'Industrial Polymer Resin #NK001 (Chemical Grade A)',
        productCode: 'NK001',
        hsnCode: '3901',
        unitAbbreviation: 'Bags',
        taxRate: 1800,
      },
      lineNumber: 1,
      description: 'Industrial Polymer Resin #NK001 (Chemical Grade A)',
      hsnCode: '3901',
      quantity: 23000, // 230 bags
      unit: 'Bags',
      purchasePrice: 350000,
      unitPrice: 450000,
      discountPercent: 0,
      discountAmount: 0,
      taxableAmount: 8771186,
      taxRate: 1800,
      cgstRate: 900,
      sgstRate: 900,
      igstRate: 0,
      cgstAmount: 789407,
      sgstAmount: 789407,
      igstAmount: 0,
      totalAmount: 10350000,
      createdAt: '2026-10-01T10:30:00.000Z',
    },
    {
      id: 'item-002',
      invoiceId: 'sample-inv-001',
      productId: 'prod-002',
      productSnapshot: {
        id: 'prod-002',
        name: 'Standard Packaging Rigid Corrugated Boxes #NK007',
        productCode: 'NK007',
        hsnCode: '4819',
        unitAbbreviation: 'Boxes',
        taxRate: 1800,
      },
      lineNumber: 2,
      description: 'Standard Packaging Rigid Corrugated Boxes #NK007',
      hsnCode: '4819',
      quantity: 50000, // 500 boxes
      unit: 'Boxes',
      purchasePrice: 220000,
      unitPrice: 300000,
      discountPercent: 0,
      discountAmount: 0,
      taxableAmount: 12711864,
      taxRate: 1800,
      cgstRate: 900,
      sgstRate: 900,
      igstRate: 0,
      cgstAmount: 1144068,
      sgstAmount: 1144068,
      igstAmount: 0,
      totalAmount: 15000000,
      createdAt: '2026-10-01T10:30:00.000Z',
    },
  ],
}

type StudioToolTab = 'grid' | 'header' | 'margins' | 'layers' | 'bank' | 'terms' | 'colors'

export default function EditInvoiceDesigner() {
  const { business } = useBusinessStore()
  const { success, error } = useNotificationStore()
  const navigate = useNavigate()

  const [design, setDesign] = useState<InvoiceCustomDesign>(DEFAULT_INVOICE_DESIGN)
  const [activeTab, setActiveTab] = useState<StudioToolTab>('grid')
  const [selectedLayer, setSelectedLayer] = useState<string>('grid')
  const [paperSize, setPaperSize] = useState<InvoicePaperSize>('A4')
  const [zoomLevel, setZoomLevel] = useState<number>(90)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const signInputRef = useRef<HTMLInputElement | null>(null)

  // Load saved design from SQLite app_settings
  useEffect(() => {
    getInvoiceDesignConfig()
      .then((saved) => {
        setDesign(saved)
      })
      .catch((err) => {
        console.error('Failed to load invoice design config:', err)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  // Update a single property
  const updateDesign = <K extends keyof InvoiceCustomDesign>(
    key: K,
    value: InvoiceCustomDesign[K],
  ) => {
    setDesign((prev) => ({ ...prev, [key]: value }))
  }

  // Update column visibility
  const toggleColumn = (colKey: keyof typeof DEFAULT_INVOICE_DESIGN.columnsVisibility) => {
    setDesign((prev) => ({
      ...prev,
      columnsVisibility: {
        ...prev.columnsVisibility,
        [colKey]: !prev.columnsVisibility[colKey],
      },
    }))
  }

  // Handle Preset selection
  const applyPreset = (presetId: string) => {
    const found = INVOICE_DESIGN_PRESETS.find((p) => p.id === presetId)
    if (!found) return
    setDesign((prev) => ({
      ...prev,
      ...found.design,
    }))
    success('Preset Applied', `Loaded "${found.name}"`)
  }

  // Save changes to Database
  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveInvoiceDesignConfig(design)
      success('Invoice Design Saved', 'Your customized invoice format is active for all bills & PDFs!')
    } catch (err) {
      error('Failed to save', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSaving(false)
    }
  }

  // Reset to statutory defaults
  const handleReset = async () => {
    if (confirm('Reset your invoice design back to standard factory settings?')) {
      const reset = await resetInvoiceDesignConfig()
      setDesign(reset)
      success('Reset Successful', 'Default statutory layout restored.')
    }
  }

  // Image Upload handler for Logo
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      error('Invalid File', 'Please upload a PNG, JPG, or SVG image.')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      updateDesign('logoUrl', dataUrl)
      success('Logo Uploaded', 'Custom brand logo applied to invoice.')
    }
    reader.readAsDataURL(file)
  }

  // Signature Upload handler
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setDesign((prev) => ({
        ...prev,
        signatureStyle: 'uploaded',
        uploadedSignatureUrl: dataUrl,
      }))
      success('Signature Uploaded', 'Custom signature graphic applied.')
    }
    reader.readAsDataURL(file)
  }

  // Generate real PDF preview
  const handlePreviewPdf = async () => {
    if (!business) return
    setIsGeneratingPdf(true)
    try {
      const url = await getInvoicePDFBlobUrl(SAMPLE_INVOICE, business, {
        paperSize,
        customDesign: design,
      })
      setPdfPreviewUrl(url)
    } catch (err) {
      error('PDF Error', err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  // Interactive Layer selection from Canvas click
  const handleCanvasLayerClick = (layerId: string) => {
    setSelectedLayer(layerId)
    if (layerId === 'header') setActiveTab('header')
    else if (layerId === 'grid') setActiveTab('grid')
    else if (layerId === 'parties' || layerId === 'banner') setActiveTab('layers')
    else if (layerId === 'footer') setActiveTab('bank')
    else if (layerId === 'words' || layerId === 'amounts' || layerId === 'gst') setActiveTab('layers')
  }

  if (isLoading || !business) {
    return <LoadingState message="Loading Invoice Visual Studio..." />
  }

  return (
    <div className="space-y-4">
      {/* Top Header & Settings Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-orion-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Edit Invoice Studio
            </h1>
            <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider border border-indigo-200">
              Visual Designer
            </span>
          </div>
          <p className="text-xs text-orion-secondary mt-0.5">
            Photoshop-style live canvas editor: customize lines, columns, rows, header, logo, QR code & bank details.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw size={14} />}
            onClick={handleReset}
          >
            Reset Default
          </Button>
          <Button
            variant="secondary"
            size="sm"
            isLoading={isGeneratingPdf}
            leftIcon={<Eye size={14} />}
            onClick={handlePreviewPdf}
          >
            Preview PDF
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isSaving}
            leftIcon={<CheckCircle2 size={14} />}
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
          >
            Save Design
          </Button>
        </div>
      </div>

      {/* Settings Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-orion-border pb-1 overflow-x-auto text-xs">
        <button
          onClick={() => navigate('/settings/profile')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <Building size={14} />
          Business Profile
        </button>
        <button
          onClick={() => navigate('/settings/edit-invoice')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 transition-colors"
        >
          <Sparkles size={14} />
          Edit Invoice (Studio)
        </button>
        <button
          onClick={() => navigate('/settings/invoice')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <FileText size={14} />
          Sequences & Formats
        </button>
        <button
          onClick={() => navigate('/settings/backup')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <CreditCard size={14} />
          Backup & Data
        </button>
        <button
          onClick={() => navigate('/settings/app')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <Settings size={14} />
          App Settings
        </button>
      </div>

      {/* Quick Studio Bar: Preset Selector, Paper Size & Zoom Controls */}
      <div className="bg-white border border-orion-border rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Preset Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
            <Layout size={13} className="text-indigo-600" />
            Design Presets:
          </span>
          <select
            onChange={(e) => applyPreset(e.target.value)}
            className="h-8 rounded border border-orion-border bg-gray-50 px-2.5 text-xs font-medium text-gray-800 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select a ready template...</option>
            {INVOICE_DESIGN_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Paper Size Quick Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">Canvas Size:</span>
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => setPaperSize('A4')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                paperSize === 'A4'
                  ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              A4 Full
            </button>
            <button
              type="button"
              onClick={() => setPaperSize('A5')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                paperSize === 'A5'
                  ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              A5 Half
            </button>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-700">Zoom:</span>
          <button
            onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs font-mono font-semibold text-gray-800 w-10 text-center">
            {zoomLevel}%
          </span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoomLevel(90)}
            className="text-[10px] text-indigo-600 hover:underline font-semibold ml-1"
          >
            Fit
          </button>
        </div>
      </div>

      {/* Main Studio Workspace: Left Inspector Panel + Right Interactive Artboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ======================================================== */}
        {/* LEFT TOOLBAR / INSPECTOR (Photoshop / Mobile Tool Deck) */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 bg-white border border-orion-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Tool Category Tabs */}
          <div className="grid grid-cols-7 border-b border-orion-border bg-gray-50 text-center text-xs">
            {[
              { id: 'grid', label: 'Lines', icon: Grid },
              { id: 'header', label: 'Header', icon: ImageIcon },
              { id: 'margins', label: 'Margins', icon: Sliders },
              { id: 'layers', label: 'Layers', icon: Layout },
              { id: 'bank', label: 'Bank/QR', icon: QrCode },
              { id: 'terms', label: 'Terms', icon: FileText },
              { id: 'colors', label: 'Colors', icon: Palette },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as StudioToolTab)}
                  className={`py-3 px-0.5 flex flex-col items-center justify-center gap-1 border-b-2 transition-all ${
                    isActive
                      ? 'border-indigo-600 text-indigo-700 bg-white font-bold'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={15} />
                  <span className="text-[9.5px] truncate max-w-full">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tool Inspector Body */}
          <div className="p-4 space-y-4 max-h-[720px] overflow-y-auto">
            {/* ---------------------------------------------------- */}
            {/* 1. LINES & GRID STUDIO */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'grid' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    Lines of Columns & Rows
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Manage table grid line separators, border thickness, cell density, and columns.
                  </p>
                </div>

                {/* Product Section Lines Style */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-gray-700">Product Section Lines Style</label>
                    <span className="text-xs font-semibold text-indigo-600">
                      {(design.productLinesMode || (design.showRowDividers === false ? 'clean_box' : 'all')) === 'clean_box'
                        ? 'Clean Box (No Inner Lines)'
                        : (design.productLinesMode || 'all') === 'none'
                        ? 'Borderless'
                        : 'Solid Grid Lines'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-2">
                    Select how product items are separated. Clean Box leaves the product area open and readable without broken/dotted lines while keeping the solid outer frame and headers intact.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: 'all',
                        label: 'Solid Grid',
                        desc: 'Full row & col solid lines',
                      },
                      {
                        id: 'clean_box',
                        label: 'Clean Box',
                        desc: 'No row lines in products',
                      },
                      {
                        id: 'none',
                        label: 'Borderless',
                        desc: 'Open minimalist layout',
                      },
                    ].map((mode) => {
                      const currentMode = design.productLinesMode || (design.showRowDividers === false ? 'clean_box' : 'all')
                      const isSelected = currentMode === mode.id
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            if (mode.id === 'clean_box') {
                              updateDesign('productLinesMode', 'clean_box')
                              updateDesign('showRowDividers', false)
                              updateDesign('showColumnDividers', true)
                            } else if (mode.id === 'none') {
                              updateDesign('productLinesMode', 'none')
                              updateDesign('showRowDividers', false)
                              updateDesign('showColumnDividers', false)
                            } else {
                              updateDesign('productLinesMode', 'all')
                              updateDesign('showRowDividers', true)
                              updateDesign('showColumnDividers', true)
                            }
                          }}
                          className={`p-2 rounded border text-left text-xs transition-all ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold'
                              : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <p className="font-semibold text-xs">{mode.label}</p>
                          <p className="text-[10px] text-gray-500">{mode.desc}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Line Dividers Toggles */}
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                    <input
                      type="checkbox"
                      checked={design.showColumnDividers}
                      onChange={(e) => updateDesign('showColumnDividers', e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    Column Lines
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                    <input
                      type="checkbox"
                      checked={design.showRowDividers}
                      onChange={(e) => updateDesign('showRowDividers', e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    Row Lines
                  </label>
                </div>

                {/* Line Thickness */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-gray-700">Border Thickness</label>
                    <span className="text-xs font-mono text-indigo-600 font-bold">
                      {design.borderWidth}px
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { val: 0.5, label: 'Hairline (0.5px)' },
                      { val: 1, label: 'Standard (1px)' },
                      { val: 1.5, label: 'Medium (1.5px)' },
                      { val: 2, label: 'Bold (2px)' },
                    ].map((t) => (
                      <button
                        key={t.val}
                        type="button"
                        onClick={() => updateDesign('borderWidth', t.val)}
                        className={`py-1.5 px-2 text-[11px] rounded border text-center transition-all ${
                          design.borderWidth === t.val
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {t.val}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table Density */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Row Spacing & Density</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'compact', label: 'Compact', desc: 'Dense rows' },
                      { id: 'normal', label: 'Standard', desc: 'Balanced' },
                      { id: 'spacious', label: 'Spacious', desc: 'Airy feel' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => updateDesign('tableDensity', d.id as any)}
                        className={`p-2 rounded border text-left text-xs transition-all ${
                          design.tableDensity === d.id
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-semibold text-xs">{d.label}</p>
                        <p className="text-[10px] text-gray-500">{d.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zebra Striping Toggle */}
                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Zebra Striping</p>
                    <p className="text-[10px] text-gray-500">Alternating subtle gray row background</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={design.zebraStriping}
                    onChange={(e) => updateDesign('zebraStriping', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                </div>

                {/* Minimum Table Rows / Blank Rows Padding */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-gray-700">
                      Minimum Table Rows (Blank Rows)
                    </label>
                    <span className="text-xs font-mono text-indigo-600 font-bold">
                      {design.minTableRows ?? 8} rows
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-2">
                    Draws empty rows with vertical column dividers when an invoice has fewer items, ensuring single-product bills look full, weighty, and balanced in-hand.
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { val: 0, label: 'Dynamic (0)' },
                      { val: 5, label: '5 Rows' },
                      { val: 8, label: '8 Rows (Std)' },
                      { val: 10, label: '10 Rows' },
                      { val: 12, label: '12 Rows (Tall)' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => updateDesign('minTableRows', opt.val)}
                        className={`py-1.5 px-1 text-[11px] rounded border text-center transition-all ${
                          (design.minTableRows ?? 8) === opt.val
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Print Font & Text Size Scale */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-gray-700">
                      Print Text Size & Readability
                    </label>
                    <span className="text-xs font-semibold text-indigo-600 uppercase">
                      {design.fontScale || 'normal'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-2">
                    Controls font size on printed bills across item names, rates, GST columns, customer details, and totals.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'normal', label: 'Standard', desc: 'Crisp 10.5pt (Clean)' },
                      { id: 'large', label: 'Large (Bold)', desc: '+15% Bigger (No specs)' },
                      { id: 'xlarge', label: 'Extra Large', desc: '13pt (Maximum Clarity)' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => updateDesign('fontScale', f.id as any)}
                        className={`p-2 rounded border text-left text-xs transition-all ${
                          (design.fontScale || 'normal') === f.id
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-semibold text-xs">{f.label}</p>
                        <p className="text-[10px] text-gray-500">{f.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Columns Visibility Selector */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-gray-700">
                      Visible Columns in Table
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          updateDesign('columnsVisibility', {
                            sr: true,
                            desc: true,
                            hsn: true,
                            qty: true,
                            unit: true,
                            price: true,
                            taxable: true,
                            gstPct: true,
                            gstAmt: true,
                            totalAmt: true,
                          })
                        }}
                        className="text-[10px] text-indigo-600 hover:underline font-semibold"
                        title="Show all 10 columns"
                      >
                        All 10 Cols
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          updateDesign('columnsVisibility', {
                            sr: true,
                            desc: true,
                            hsn: true,
                            qty: true,
                            unit: false,
                            price: true,
                            taxable: false,
                            gstPct: true,
                            gstAmt: false,
                            totalAmt: true,
                          })
                        }}
                        className="text-[10px] text-indigo-600 hover:underline font-semibold"
                        title="Standard GST 6 columns"
                      >
                        Standard GST
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { key: 'sr', label: '# (Serial Number)' },
                      { key: 'desc', label: 'Product Name / Description' },
                      { key: 'hsn', label: 'HSN / SAC Code' },
                      { key: 'qty', label: 'Quantity' },
                      { key: 'unit', label: 'Packaging / Unit' },
                      { key: 'price', label: 'Price (Incl. Tax)' },
                      { key: 'taxable', label: 'Taxable Amount' },
                      { key: 'gstPct', label: 'GST Rate (%)' },
                      { key: 'gstAmt', label: 'GST Amount (₹)' },
                      { key: 'totalAmt', label: 'Total Amount (₹)' },
                    ].map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200"
                      >
                        <input
                          type="checkbox"
                          checked={design.columnsVisibility[col.key as keyof typeof design.columnsVisibility]}
                          onChange={() => toggleColumn(col.key as any)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] text-gray-800 truncate">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* 2. HEADER & LOGO STUDIO */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'header' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    Header & Brand Identity
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Upload your company logo, choose alignment, and adjust title typography.
                  </p>
                </div>

                {/* Logo Image Upload Box */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center bg-gray-50 hover:bg-gray-100/60 transition-colors">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  {design.logoUrl ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={design.logoUrl}
                          alt="Brand Logo"
                          className="w-12 h-12 object-contain bg-white rounded border border-gray-200 p-1"
                        />
                        <div className="text-left">
                          <p className="text-xs font-semibold text-gray-800">Custom Logo Active</p>
                          <p className="text-[10px] text-emerald-600 font-medium">Applied to preview & PDF</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs text-indigo-600 font-semibold hover:underline"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => updateDesign('logoUrl', null)}
                          className="text-xs text-red-600 font-semibold hover:underline ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs font-medium text-gray-700">Upload Your Business Logo</p>
                      <p className="text-[10px] text-gray-500 mb-2">PNG, JPG, or SVG up to 2MB</p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Select Image File
                      </Button>
                    </div>
                  )}
                </div>

                {/* Logo Size & Shape */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Logo Size: {design.logoWidth}px
                    </label>
                    <input
                      type="range"
                      min={24}
                      max={90}
                      value={design.logoWidth}
                      onChange={(e) => {
                        const val = parseInt(e.target.value)
                        setDesign((prev) => ({ ...prev, logoWidth: val, logoHeight: val }))
                      }}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Logo Shape</label>
                    <select
                      value={design.logoShape}
                      onChange={(e) => updateDesign('logoShape', e.target.value as any)}
                      className="h-8 w-full rounded border border-orion-border bg-gray-50 px-2 text-xs"
                    >
                      <option value="rounded">Rounded Corners</option>
                      <option value="square">Square</option>
                      <option value="circle">Circular</option>
                    </select>
                  </div>
                </div>

                {/* Header Layout */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Header Layout Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'classic', label: 'Classic Side-by-Side', desc: 'Logo left, Legal right' },
                      { id: 'centered', label: 'Centered Studio', desc: 'Logo & Name centered' },
                    ].map((hl) => (
                      <button
                        key={hl.id}
                        type="button"
                        onClick={() => updateDesign('headerLayout', hl.id as any)}
                        className={`p-2 rounded border text-left text-xs transition-all ${
                          design.headerLayout === hl.id
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-semibold text-xs">{hl.label}</p>
                        <p className="text-[10px] text-gray-500">{hl.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brand Name Typography */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-gray-700">Brand Title Font Size</label>
                    <span className="text-xs font-mono font-bold text-indigo-600">
                      {design.brandFontSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={16}
                    max={36}
                    value={design.brandFontSize}
                    onChange={(e) => updateDesign('brandFontSize', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Make your brand name bold, strong and prominent.</p>
                </div>

                {/* Clean Logo Note */}
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-[11px] text-gray-600">
                  <span className="font-semibold text-gray-800">Clean Header: </span>
                  No basic placeholder logo is shown by default. The header cleanly emphasizes your brand name. Only your uploaded logo appears when provided.
                </div>

                {/* Brand Title Override */}
                <div>
                  <Input
                    label="Brand Name Display"
                    value={design.brandTitle}
                    onChange={(e) => updateDesign('brandTitle', e.target.value)}
                    placeholder={business.name}
                    hint="Leave blank to use registered business name"
                  />
                </div>

                {/* Tagline / Subtitle */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                    <input
                      type="checkbox"
                      checked={design.showBrandSubtitle}
                      onChange={(e) => updateDesign('showBrandSubtitle', e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    Display Subtitle / Tagline below Brand
                  </label>
                  {design.showBrandSubtitle && (
                    <Input
                      value={design.brandSubtitle}
                      onChange={(e) => updateDesign('brandSubtitle', e.target.value)}
                      placeholder="e.g. Authorized Chemical Distributors"
                    />
                  )}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* 2.5. PAGE MARGINS & POSITIONING STUDIO              */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'margins' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    Page Margins & Overall Positioning
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Customize top, bottom, left, and right print margins (in mm) and align the overall invoice.
                  </p>
                </div>

                {/* Quick Margin Presets */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Quick Margin Presets</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[
                      { label: 'Zero (0mm)', top: 0, bottom: 0, left: 0, right: 0 },
                      { label: 'Compact (4mm)', top: 4, bottom: 4, left: 4, right: 4 },
                      { label: 'Standard (8mm)', top: 8, bottom: 8, left: 8, right: 8 },
                      { label: 'Letterhead (25mm)', top: 25, bottom: 8, left: 8, right: 8 },
                      { label: 'Large (35mm)', top: 35, bottom: 35, left: 10, right: 10 },
                      { label: 'Max (50mm)', top: 50, bottom: 50, left: 8, right: 8 },
                    ].map((pr) => (
                      <button
                        key={pr.label}
                        type="button"
                        onClick={() => {
                          setDesign((prev) => ({
                            ...prev,
                            marginTop: pr.top,
                            marginBottom: pr.bottom,
                            marginLeft: pr.left,
                            marginRight: pr.right,
                          }))
                        }}
                        className="py-1.5 px-1 text-[10px] rounded border border-gray-200 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 text-gray-700 font-medium text-center transition-all"
                      >
                        {pr.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom 4-way Margins */}
                <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-gray-700">Top Margin (Letterhead & Header clearance)</label>
                      <span className="text-xs font-mono font-bold text-indigo-600">{design.marginTop ?? 8} mm</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={design.marginTop ?? 8}
                      onChange={(e) => updateDesign('marginTop', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                      <span>0 mm</span>
                      <span>25 mm</span>
                      <span>50 mm (Max)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-gray-700">Bottom Margin</label>
                      <span className="text-xs font-mono font-bold text-indigo-600">{design.marginBottom ?? 8} mm</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={design.marginBottom ?? 8}
                      onChange={(e) => updateDesign('marginBottom', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                      <span>0 mm</span>
                      <span>25 mm</span>
                      <span>50 mm (Max)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-gray-700">Left Margin</label>
                      <span className="text-xs font-mono font-bold text-indigo-600">{design.marginLeft ?? 8} mm</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      value={design.marginLeft ?? 8}
                      onChange={(e) => updateDesign('marginLeft', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-gray-700">Right Margin</label>
                      <span className="text-xs font-mono font-bold text-indigo-600">{design.marginRight ?? 8} mm</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      value={design.marginRight ?? 8}
                      onChange={(e) => updateDesign('marginRight', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                </div>

                {/* Overall Invoice Page Alignment */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Overall Invoice Alignment</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'center', label: 'Center (Default)' },
                      { id: 'left', label: 'Left Aligned' },
                      { id: 'right', label: 'Right Aligned' },
                    ].map((al) => (
                      <button
                        key={al.id}
                        type="button"
                        onClick={() => updateDesign('pageAlignment', al.id as any)}
                        className={`p-2 rounded border text-center text-xs transition-all ${
                          (design.pageAlignment || 'center') === al.id
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {al.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Continuous Seamless Grid Info */}
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">Continuous Unbroken Grid</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Active</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-snug">
                    All horizontal and vertical dividing lines connect seamlessly edge-to-edge with zero cuts or floating gaps.
                  </p>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* 3. LAYERS & SECTIONS STUDIO */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'layers' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    Sections & Layer Visibility
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Toggle visibility of sections and re-arrange invoice blocks.
                  </p>
                </div>

                {/* Tax Invoice Banner Settings */}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-semibold text-gray-800">Tax Invoice Banner</span>
                    <input
                      type="checkbox"
                      checked={design.showTaxInvoiceBanner}
                      onChange={(e) => updateDesign('showTaxInvoiceBanner', e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                  {design.showTaxInvoiceBanner && (
                    <Input
                      label="Banner Heading Text"
                      value={design.bannerTitle}
                      onChange={(e) => updateDesign('bannerTitle', e.target.value)}
                      placeholder="TAX INVOICE"
                    />
                  )}
                </div>

                {/* Section Visibility Switches */}
                <div className="space-y-2 text-xs divide-y divide-gray-100">
                  {[
                    { key: 'showTaxInvoiceBanner', label: 'Tax Invoice Header Banner' },
                    { key: 'showShipTo', label: 'Shipping Address (Ship To)' },
                    { key: 'showTransportInfo', label: 'Transport & Vehicle Details' },
                    { key: 'showAmountInWords', label: 'Amount in Words Box' },
                    { key: 'showGstSummaryTable', label: 'GST Tax Summary Breakdown Table' },
                    { key: 'showBankDetails', label: 'Bank Account & Payment Details' },
                    { key: 'showQrCode', label: 'UPI Payment QR Code' },
                    { key: 'showTermsConditions', label: 'Terms and Conditions Box' },
                    { key: 'showSignatureBlock', label: 'Authorized Signatory Block' },
                  ].map((sec) => (
                    <div key={sec.key} className="flex items-center justify-between pt-2">
                      <span className="text-gray-800 font-medium">{sec.label}</span>
                      <input
                        type="checkbox"
                        checked={design[sec.key as keyof typeof design] as boolean}
                        onChange={(e) => updateDesign(sec.key as any, e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* 4. BANK DETAILS & QR CODE STUDIO */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'bank' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    Bank Details & UPI QR Code
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Configure payment details and customize the scan-to-pay QR code.
                  </p>
                </div>

                {/* QR Code Controls */}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-gray-800">Display QR Code</span>
                      <p className="text-[10px] text-gray-500">Scan-and-pay UPI QR on printed invoice and PDF</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={design.showQrCode}
                      onChange={(e) => updateDesign('showQrCode', e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                  </div>

                  {design.showQrCode ? (
                    <>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-semibold text-gray-700">QR Code Size</label>
                          <span className="text-xs font-mono text-indigo-600 font-bold">
                            {design.qrCodeSize}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={32}
                          max={80}
                          value={design.qrCodeSize}
                          onChange={(e) => updateDesign('qrCodeSize', parseInt(e.target.value))}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-700">
                        <input
                          type="checkbox"
                          checked={design.showUpiBadge}
                          onChange={(e) => updateDesign('showUpiBadge', e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        Display "UPI SCAN TO PAY" badge below QR
                      </label>
                      <button
                        type="button"
                        onClick={() => updateDesign('showQrCode', false)}
                        className="text-xs text-red-600 font-semibold hover:underline flex items-center gap-1 pt-1"
                      >
                        <Trash2 size={12} />
                        Remove QR Code from Invoice
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-gray-500 italic">QR code is currently hidden</span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => updateDesign('showQrCode', true)}
                      >
                        Show QR Code
                      </Button>
                    </div>
                  )}
                </div>

                {/* Bank Account Details Override */}
                <div className="space-y-2.5">
                  <label className="text-xs font-semibold text-gray-700 block">Bank Account Details</label>
                  <Input
                    label="Bank Name"
                    value={design.customBankName}
                    onChange={(e) => updateDesign('customBankName', e.target.value)}
                    placeholder={business.bankName || 'State Bank of India'}
                  />
                  <Input
                    label="Account Number"
                    value={design.customAccountNumber}
                    onChange={(e) => updateDesign('customAccountNumber', e.target.value)}
                    placeholder={business.accountNumber || '448899001122'}
                  />
                  <Input
                    label="IFSC Code"
                    value={design.customIfsc}
                    onChange={(e) => updateDesign('customIfsc', e.target.value)}
                    placeholder={business.ifsc || 'SBIN0001234'}
                  />
                  <Input
                    label="Account Holder's Name"
                    value={design.customAccountHolder}
                    onChange={(e) => updateDesign('customAccountHolder', e.target.value)}
                    placeholder={business.name}
                  />
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* 5. TERMS & CONDITIONS & SIGNATURE STUDIO */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'terms' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    Terms & Authorized Signatory
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Customize invoice legal declarations, jurisdiction city, and signature graphic.
                  </p>
                </div>

                {/* Terms Editor */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-gray-700">Terms and Conditions</label>
                    <span className="text-[10px] text-gray-500">1 per line</span>
                  </div>
                  <textarea
                    rows={5}
                    value={design.customTermsText}
                    onChange={(e) => updateDesign('customTermsText', e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-orion-border bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                    placeholder="Enter invoice terms, 1 per line..."
                  />

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => updateDesign('customTermsText', DEFAULT_TERMS_TEXT)}
                      className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded"
                    >
                      Default GST Terms
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateDesign(
                          'customTermsText',
                          `1. Goods once dispatched will not be accepted for return.\n2. Payment strictly within 15 days of invoice date.\n3. Delayed payments subject to 24% annual interest.\n4. Disputes subject to local jurisdiction.`,
                        )
                      }
                      className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded"
                    >
                      Wholesale Terms
                    </button>
                  </div>
                </div>

                {/* Jurisdiction City */}
                <div>
                  <Input
                    label="Jurisdiction City"
                    value={design.jurisdictionCity}
                    onChange={(e) => updateDesign('jurisdictionCity', e.target.value)}
                    placeholder={business.city || 'local'}
                    hint="Shown as: Subject to [City] jurisdiction only."
                  />
                </div>

                {/* Signature Style */}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                  <label className="text-xs font-semibold text-gray-800 block">Signatory Section</label>
                  <Input
                    label="Signatory Label"
                    value={design.signatoryLabel}
                    onChange={(e) => updateDesign('signatoryLabel', e.target.value)}
                    placeholder="Authorized Signatory"
                  />
                  <Input
                    label="Signatory Heading"
                    value={design.signatoryForText}
                    onChange={(e) => updateDesign('signatoryForText', e.target.value)}
                    placeholder={`For ${business.name}`}
                  />

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                      Signature Representation
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'digital_wave', label: 'Security Wave' },
                        { id: 'blank_line', label: 'Blank Line' },
                        { id: 'uploaded', label: 'Upload Sign' },
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => updateDesign('signatureStyle', st.id as any)}
                          className={`py-1.5 px-2 text-[11px] rounded border text-center transition-all ${
                            design.signatureStyle === st.id
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                              : 'border-gray-200 text-gray-700 hover:bg-white'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>

                    {design.signatureStyle === 'uploaded' && (
                      <div className="mt-2 text-center">
                        <input
                          type="file"
                          ref={signInputRef}
                          onChange={handleSignatureUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => signInputRef.current?.click()}
                        >
                          Upload Sign Image
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* 6. COLORS & PALETTE STUDIO */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'colors' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    Color Palette & Theme
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Pick from designer swatches or customize exact hex colors for headers and borders.
                  </p>
                </div>

                {/* Preset Themes */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Theme Presets</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'SLATE_BLUE', label: 'Slate Blue', primary: '#416788', border: '#94A3B8' },
                      { id: 'CLASSIC_NAVY', label: 'Classic Navy', primary: '#1E3A5F', border: '#94A3B8' },
                      { id: 'EMERALD', label: 'Emerald Green', primary: '#047857', border: '#10B981' },
                      { id: 'MONOCHROME', label: 'B&W Monochrome', primary: '#18191B', border: '#6B7280' },
                    ].map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => {
                          setDesign((prev) => ({
                            ...prev,
                            themePreset: th.id as any,
                            primaryColor: th.primary,
                            gridBorderColor: th.border,
                          }))
                        }}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs text-left transition-all ${
                          design.primaryColor === th.primary
                            ? 'border-indigo-600 bg-indigo-50/60 font-semibold text-gray-900 ring-1 ring-indigo-500'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: th.primary }}
                        />
                        <span className="truncate">{th.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Color Pickers */}
                <div className="space-y-2.5 pt-2 border-t border-gray-100">
                  <label className="text-xs font-semibold text-gray-700 block">Fine-Tune Exact Colors</label>

                  {/* Primary Accent Color */}
                  <div className="flex items-center justify-between p-2 rounded border border-gray-200 bg-gray-50">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Primary Accent</p>
                      <p className="text-[10px] text-gray-500">Table headers & titles</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={design.primaryColor}
                        onChange={(e) => updateDesign('primaryColor', e.target.value)}
                        className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                      />
                      <span className="text-xs font-mono font-medium text-gray-700">
                        {design.primaryColor}
                      </span>
                    </div>
                  </div>

                  {/* Grid Border Color */}
                  <div className="flex items-center justify-between p-2 rounded border border-gray-200 bg-gray-50">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Grid & Border Line</p>
                      <p className="text-[10px] text-gray-500">Dividers and column lines</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={design.gridBorderColor}
                        onChange={(e) => updateDesign('gridBorderColor', e.target.value)}
                        className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                      />
                      <span className="text-xs font-mono font-medium text-gray-700">
                        {design.gridBorderColor}
                      </span>
                    </div>
                  </div>

                  {/* Banner Background */}
                  <div className="flex items-center justify-between p-2 rounded border border-gray-200 bg-gray-50">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Banner Background</p>
                      <p className="text-[10px] text-gray-500">Tax invoice header box</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={design.bannerBgColor}
                        onChange={(e) => updateDesign('bannerBgColor', e.target.value)}
                        className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                      />
                      <span className="text-xs font-mono font-medium text-gray-700">
                        {design.bannerBgColor}
                      </span>
                    </div>
                  </div>

                  {/* Total Row Background */}
                  <div className="flex items-center justify-between p-2 rounded border border-gray-200 bg-gray-50">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Total Row Fill</p>
                      <p className="text-[10px] text-gray-500">Total row shading</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={design.totalRowBgColor}
                        onChange={(e) => updateDesign('totalRowBgColor', e.target.value)}
                        className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                      />
                      <span className="text-xs font-mono font-medium text-gray-700">
                        {design.totalRowBgColor}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT INTERACTIVE ARTBOARD / CANVAS (Photoshop Canvas)    */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 flex flex-col items-center">
          {/* Canvas Wrapper with Dark Studio Background */}
          <div className="w-full bg-slate-900/95 border border-slate-700 rounded-xl p-4 sm:p-6 overflow-x-auto min-h-[740px] flex flex-col items-center justify-start shadow-inner relative">
            {/* Interactive Canvas Notice */}
            <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-3 px-2">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Studio Canvas — Click any block to edit directly
              </span>
              <span className="text-[11px] text-slate-500">
                {paperSize} {paperSize === 'A4' ? '210 × 297 mm' : '148 × 210 mm'}
              </span>
            </div>

            {/* Scaled Printable Paper Canvas */}
            <div
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
              }}
              className="w-full flex justify-center"
            >
              <InvoiceViewTemplate
                invoice={SAMPLE_INVOICE}
                business={business}
                upiQrCodeUrl={
                  design.showQrCode
                    ? (design.customQrUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi%3A%2F%2Fpay%3Fpa%3Dsaarthi%40upi%26pn%3DSAARTHI%2BCHEMICALS')
                    : undefined
                }
                paperSize={paperSize}
                customDesign={design}
                interactive={true}
                selectedLayer={selectedLayer}
                onSelectLayer={handleCanvasLayerClick}
              />
            </div>
          </div>
        </div>
      </div>

      {/* PDF Modal Preview */}
      {pdfPreviewUrl && (
        <Modal
          open={!!pdfPreviewUrl}
          onClose={() => {
            URL.revokeObjectURL(pdfPreviewUrl)
            setPdfPreviewUrl(null)
          }}
          title="Custom Invoice Design: PDF Print Preview"
          size="full"
        >
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 font-medium">
                Preview how your custom layout renders when printed or exported.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Download size={14} />}
                  onClick={() => downloadInvoicePDF(SAMPLE_INVOICE, business, { customDesign: design, paperSize })}
                >
                  Download PDF
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Printer size={14} />}
                  onClick={() => printInvoicePDF(SAMPLE_INVOICE, business, { customDesign: design, paperSize })}
                >
                  Print
                </Button>
              </div>
            </div>
            <iframe
              src={pdfPreviewUrl}
              title="Invoice PDF Preview"
              className="w-full h-[640px] rounded border border-gray-300 bg-white"
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
