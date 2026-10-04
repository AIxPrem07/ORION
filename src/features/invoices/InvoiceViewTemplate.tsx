import React from 'react'
import { paiseToRupees } from '@utils/decimal'
import { formatDate } from '@utils/date'
import { paiseToWords } from '@utils/number-to-words'
import type { InvoiceWithItems } from '@/types/invoice'
import type { Business, InvoicePaperSize, InvoiceTheme } from '@/types/business'
import {
  type InvoiceCustomDesign,
  DEFAULT_INVOICE_DESIGN,
  DEFAULT_COLUMNS_VISIBILITY,
  DEFAULT_TERMS_TEXT,
  calculateColumnWidths,
} from '@/types/invoice-design'

export interface InvoiceViewTemplateProps {
  invoice: InvoiceWithItems
  business: Business
  upiQrCodeUrl?: string
  paperSize?: InvoicePaperSize
  theme?: InvoiceTheme
  customDesign?: InvoiceCustomDesign
  interactive?: boolean
  selectedLayer?: string
  onSelectLayer?: (layerId: string) => void
}

export const THEME_CONFIG: Record<
  InvoiceTheme,
  {
    primary: string
    bannerBg: string
    textDark: string
    border: string
    totalRowBg: string
  }
> = {
  SLATE_BLUE: {
    primary: '#1E3A5F',
    bannerBg: '#EEF4FA',
    textDark: '#0F172A',
    border: '#1E293B',
    totalRowBg: '#F1F5F9',
  },
  CLASSIC_NAVY: {
    primary: '#1E3A5F',
    bannerBg: '#E9F0F8',
    textDark: '#0F172A',
    border: '#0F172A',
    totalRowBg: '#F1F5F9',
  },
  MONOCHROME: {
    primary: '#000000',
    bannerBg: '#F3F4F6',
    textDark: '#000000',
    border: '#000000',
    totalRowBg: '#F3F4F6',
  },
  EMERALD: {
    primary: '#064E3B',
    bannerBg: '#ECFDF5',
    textDark: '#022C22',
    border: '#064E3B',
    totalRowBg: '#F0FDF4',
  },
}

export const InvoiceViewTemplate: React.FC<InvoiceViewTemplateProps> = ({
  invoice,
  business,
  upiQrCodeUrl,
  paperSize = 'A4',
  theme = 'SLATE_BLUE',
  customDesign,
  interactive = false,
  selectedLayer,
  onSelectLayer,
}) => {
  const customer = invoice.customerSnapshot
  const isInterstate = invoice.supplyType === 'INTERSTATE'
  const activeTheme = THEME_CONFIG[theme] || THEME_CONFIG.SLATE_BLUE

  // Merge customDesign with default fallbacks
  const design = customDesign || DEFAULT_INVOICE_DESIGN
  const primaryColor = design.primaryColor || activeTheme.primary
  const bannerBgColor = design.bannerBgColor || activeTheme.bannerBg
  const textDarkColor = design.textDarkColor || activeTheme.textDark
  const gridBorderColor = design.gridBorderColor || activeTheme.border
  const totalRowBgColor = design.totalRowBgColor || activeTheme.totalRowBg
  const borderWidth = `${design.borderWidth || 1}px`
  const productLinesMode = design.productLinesMode || (design.showRowDividers === false ? 'clean_box' : 'all')
  const showRowDividers = productLinesMode === 'clean_box' || productLinesMode === 'none' ? false : (design.showRowDividers !== false)
  const showColDividers = productLinesMode === 'none' ? false : (design.showColumnDividers !== false)
  const cols = design.columnsVisibility || DEFAULT_COLUMNS_VISIBILITY
  const colWidths = calculateColumnWidths(cols)

  // Items quantity sum
  const totalQuantity = invoice.items.reduce((sum, it) => sum + (it.quantity / 100), 0)

  // Total tax sum
  const totalTaxAmount = invoice.items.reduce(
    (sum, it) => sum + (it.cgstAmount + it.sgstAmount + it.igstAmount),
    0,
  )

  // Balance calculation
  const paid = invoice.paidAmount || 0
  const balance = Math.max(0, invoice.totalAmount - paid)

  // Dominant GST rate
  const dominantRate = invoice.items.length > 0 ? invoice.items[0].taxRate : 1800
  const halfRatePct = (dominantRate / 200).toFixed(0) + '%'
  const fullRatePct = (dominantRate / 100).toFixed(0) + '%'

  // Shipping display fallback
  const shippingName = invoice.shippingName || customer?.name || 'Walk-in Customer'
  const shippingAddress = invoice.shippingAddress || customer?.address || ''
  const shippingCity = invoice.shippingCity || customer?.city || ''
  const shippingState = invoice.shippingState || customer?.state || ''
  const shippingPin = invoice.shippingPin || customer?.pin || ''
  const shippingStateCode = invoice.shippingStateCode || customer?.stateCode || ''

  // Terms and conditions lines
  const termsText = design.customTermsText || business.termsAndConditions || DEFAULT_TERMS_TEXT
  const termsLines = termsText.split('\n').filter((l) => l.trim().length > 0)

  // Interactive layer selection helper
  const getLayerClass = (layerId: string) => {
    if (!interactive) return ''
    const isSelected = selectedLayer === layerId
    return `cursor-pointer transition-all duration-150 relative ${
      isSelected
        ? 'ring-2 ring-indigo-500 ring-offset-2 z-10'
        : 'hover:outline hover:outline-1 hover:outline-indigo-300'
    }`
  }

  // Thermal 80mm layout
  if (paperSize === 'THERMAL') {
    return (
      <div className="max-w-[340px] mx-auto bg-white border border-gray-900 p-4 text-gray-900 font-mono text-xs shadow-md">
        <div className="text-center border-b border-gray-900 pb-3 mb-2">
          <h2 className="text-lg font-black uppercase tracking-tight">{design.brandTitle || business.name}</h2>
          {business.address && <p className="text-[11px] text-gray-700">{business.address}</p>}
          <p className="text-[11px] text-gray-700">
            {[business.city, business.state, business.pin].filter(Boolean).join(', ')}
          </p>
          {business.phone && <p className="text-[11px] text-gray-700">Ph: {business.phone}</p>}
          {business.gstin && <p className="text-[11px] font-bold">GSTIN: {business.gstin}</p>}
        </div>

        <div className="border-b border-gray-900 pb-2 mb-2 text-[11px]">
          <p className="font-bold text-center">{design.bannerTitle || 'TAX INVOICE'}</p>
          <div className="flex justify-between">
            <span>Inv #: {invoice.invoiceNumber}</span>
            <span>Date: {formatDate(invoice.invoiceDate)}</span>
          </div>
          <p>Customer: {customer?.name || 'Walk-in Customer'}</p>
        </div>

        <table className="w-full text-[11px] border-b border-gray-900 pb-2 mb-2">
          <thead>
            <tr className="border-b border-gray-900">
              <th className="text-left py-1">Item</th>
              <th className="text-center py-1">Qty</th>
              <th className="text-right py-1">Rate</th>
              <th className="text-right py-1">Amt</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, idx) => (
              <tr key={it.id || idx}>
                <td className="py-1 font-semibold text-gray-950">{it.description}</td>
                <td className="text-center py-1">{(it.quantity / 100).toFixed(0)}</td>
                <td className="text-right py-1">{paiseToRupees(it.unitPrice)}</td>
                <td className="text-right py-1 font-bold">{paiseToRupees(it.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1 text-[11px] border-b border-gray-900 pb-2 mb-2">
          <div className="flex justify-between">
            <span>Taxable Amount:</span>
            <span>₹ {paiseToRupees(invoice.taxableAmount)}</span>
          </div>
          {!isInterstate ? (
            <>
              <div className="flex justify-between">
                <span>CGST ({halfRatePct}):</span>
                <span>₹ {paiseToRupees(invoice.cgstAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST ({halfRatePct}):</span>
                <span>₹ {paiseToRupees(invoice.sgstAmount)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <span>IGST ({fullRatePct}):</span>
              <span>₹ {paiseToRupees(invoice.igstAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm border-t border-gray-800 pt-1">
            <span>Grand Total:</span>
            <span>₹ {paiseToRupees(invoice.totalAmount)}</span>
          </div>
        </div>

        {/* Thermal QR: Strictly respects showQrCode */}
        {design.showQrCode && (design.customQrUrl || upiQrCodeUrl) && (
          <div className="flex flex-col items-center my-2">
            <img src={design.customQrUrl || upiQrCodeUrl} alt="UPI QR" className="w-24 h-24" />
            <span className="text-[10px] mt-1 font-bold" style={{ color: primaryColor }}>
              Scan with UPI to Pay
            </span>
          </div>
        )}
        <p className="text-[10px] text-center mt-2 text-gray-500">Thank you for your business!</p>
      </div>
    )
  }

  // A4 / A5 Layout with Continuous Unbroken Grid Lines
  const fontScale = design.fontScale || 'normal'
  const fontScaleContainerClass =
    fontScale === 'xlarge'
      ? (paperSize === 'A5' ? 'text-xs sm:text-[14px]' : 'text-sm sm:text-[16px]')
      : fontScale === 'large'
      ? (paperSize === 'A5' ? 'text-[12px] sm:text-xs' : 'text-[13.5px] sm:text-[15px]')
      : (paperSize === 'A5' ? 'text-[11.5px]' : 'text-[13px] sm:text-[14px]')

  const containerClass = paperSize === 'A5' ? `max-w-2xl ${fontScaleContainerClass}` : `max-w-4xl ${fontScaleContainerClass}`
  const densityPadding =
    design.tableDensity === 'compact'
      ? 'py-2 px-2.5'
      : design.tableDensity === 'spacious'
      ? 'py-4 px-3.5'
      : 'py-3 px-3'

  // Brand Header Logo Renderer (ONLY renders when logoUrl exists, NO basic pre-added placeholder emblem)
  const renderLogo = () => {
    if (design.logoPosition === 'hidden' || !design.logoUrl) return null
    const shapeClass =
      design.logoShape === 'circle'
        ? 'rounded-full'
        : design.logoShape === 'rounded'
        ? 'rounded-lg'
        : 'rounded-none'
    return (
      <img
        src={design.logoUrl}
        alt="Brand Logo"
        style={{ width: `${design.logoWidth}px`, height: `${design.logoHeight}px` }}
        className={`${shapeClass} object-contain border border-gray-200 shadow-xs flex-shrink-0`}
      />
    )
  }

  // Page alignment class
  const alignClass =
    design.pageAlignment === 'left'
      ? 'mr-auto ml-0'
      : design.pageAlignment === 'right'
      ? 'ml-auto mr-0'
      : 'mx-auto'

  // Millimeter Page Margins
  const marginStyle: React.CSSProperties = {
    paddingTop: `${design.marginTop ?? 8}mm`,
    paddingBottom: `${design.marginBottom ?? 8}mm`,
    paddingLeft: `${design.marginLeft ?? 8}mm`,
    paddingRight: `${design.marginRight ?? 8}mm`,
  }

  const brandHeadingFontSize = `${Math.max(20, design.brandFontSize || 22)}px`

  return (
    <div
      className={`${containerClass} ${alignClass} bg-white text-gray-900 font-sans print:p-0 print:shadow-none print:max-w-none transition-all`}
      style={marginStyle}
    >
      {/* ======================================================== */}
      {/* UNIFIED CONTINUOUS BOUNDING FRAME — ZERO CUTS IN LINES    */}
      {/* ======================================================== */}
      <div
        className="bg-white shadow-xl print:shadow-none overflow-hidden"
        style={{
          border: `${borderWidth} solid ${gridBorderColor}`,
        }}
      >
        {/* 1. TOP BRAND HEADER - Brand Name Strong & Big */}
        <div
          onClick={() => onSelectLayer?.('header')}
          className={`p-4 ${getLayerClass('header')}`}
          style={{
            borderBottom: `${borderWidth} solid ${gridBorderColor}`,
          }}
        >
          {interactive && selectedLayer === 'header' && (
            <span className="absolute -top-3 left-2 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20">
              Selected: Header & Brand
            </span>
          )}

          {design.headerLayout === 'centered' ? (
            // Centered Header Layout
            <div className="flex flex-col items-center text-center space-y-2">
              {renderLogo()}
              <h1
                className="font-black tracking-wide uppercase leading-tight"
                style={{
                  color: textDarkColor,
                  fontSize: brandHeadingFontSize,
                }}
              >
                {design.brandTitle || business.name}
              </h1>
              {design.showBrandSubtitle && (
                <p className="text-xs font-semibold text-gray-600">{design.brandSubtitle}</p>
              )}
              <div className="text-[11px] text-gray-600 max-w-xl">
                <p>{[business.address, business.city, business.state, business.pin].filter(Boolean).join(', ')}</p>
                <p className="mt-0.5">
                  {business.phone ? `Phone: ${business.phone}` : ''}
                  {business.phone && business.email ? '  |  ' : ''}
                  {business.email ? `Email: ${business.email}` : ''}
                  {'  |  '}
                  <span className="font-bold text-gray-800">GSTIN: {business.gstin || '—'}</span>
                </p>
              </div>
            </div>
          ) : (
            // Classic Side-by-Side Header Layout
            <div className="flex justify-between items-start gap-4">
              {/* Left: Strong Brand Identity */}
              <div className="flex items-center gap-3.5">
                {renderLogo()}
                <div>
                  <h1
                    className="font-black tracking-wide uppercase leading-tight"
                    style={{
                      color: textDarkColor,
                      fontSize: brandHeadingFontSize,
                    }}
                  >
                    {design.brandTitle || business.name}
                  </h1>
                  {design.showBrandSubtitle && (
                    <p className="text-[11px] font-semibold text-gray-600 mt-0.5">
                      {design.brandSubtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Legal Registered Business Details */}
              <div className="text-right text-[11px] text-gray-600 leading-snug">
                <h2 className="text-xs font-bold text-gray-900">{business.name}</h2>
                {business.address && <p className="mt-0.5">{business.address}</p>}
                <p>{[business.city, business.state, business.pin].filter(Boolean).join(', ')}</p>
                {(business.phone || business.email) && (
                  <p className="mt-0.5">
                    {business.phone ? `Phone: ${business.phone}` : ''}
                    {business.phone && business.email ? '  |  ' : ''}
                    {business.email ? `Email: ${business.email}` : ''}
                  </p>
                )}
                <p className="mt-0.5">
                  <span className="font-bold text-gray-800">GSTIN: </span>
                  {business.gstin || '—'}
                  <span className="mx-1.5 font-bold text-gray-400">|</span>
                  <span className="font-bold text-gray-800">State: </span>
                  {business.stateCode ? `${business.stateCode}-${business.state}` : business.state || '—'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 2. TAX INVOICE BANNER & INVOICE META (CONTINUOUS DIVIDERS) */}
        {design.showTaxInvoiceBanner && (
          <div
            onClick={() => onSelectLayer?.('banner')}
            className={`flex flex-col sm:flex-row ${getLayerClass('banner')}`}
            style={{
              borderBottom: `${borderWidth} solid ${gridBorderColor}`,
              backgroundColor: bannerBgColor,
            }}
          >
            {interactive && selectedLayer === 'banner' && (
              <span className="absolute -top-3 left-2 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20">
                Selected: Tax Invoice Banner
              </span>
            )}
            <div
              className="sm:w-2/3 py-2.5 px-4 flex items-center justify-center border-b sm:border-b-0"
              style={{
                borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
              }}
            >
              <h1
                className="text-xl sm:text-2xl font-black tracking-widest uppercase"
                style={{ color: primaryColor }}
              >
                {design.bannerTitle || 'TAX INVOICE'}
              </h1>
            </div>
            <div className="sm:w-1/3 bg-white p-2.5 text-xs flex flex-col justify-center space-y-1">
              <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-0.5">
                <span className="font-bold text-gray-800 shrink-0">Invoice No.</span>
                <span className="font-semibold text-gray-900 text-right break-words min-w-0">: {invoice.invoiceNumber}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-0.5">
                <span className="font-bold text-gray-800 shrink-0">Date</span>
                <span className="text-gray-900 text-right break-words min-w-0">: {formatDate(invoice.invoiceDate)}</span>
              </div>
              {design.showDueDate && (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-gray-800 shrink-0">Due Date</span>
                  <span className="text-gray-900 text-right break-words min-w-0">
                    : {invoice.dueDate ? formatDate(invoice.dueDate) : '—'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. PARTIES & INVOICE DETAILS STRIP (CONTINUOUS 3-COLUMN SEAMLESS GRID) */}
        <div
          onClick={() => onSelectLayer?.('parties')}
          className={`grid grid-cols-1 ${design.showShipTo ? 'md:grid-cols-12' : 'md:grid-cols-12'} text-xs ${getLayerClass('parties')}`}
          style={{
            borderBottom: `${borderWidth} solid ${gridBorderColor}`,
          }}
        >
          {interactive && selectedLayer === 'parties' && (
            <span className="absolute -top-3 left-2 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20">
              Selected: Parties & Details
            </span>
          )}

          {/* Col 1: Bill To */}
          <div
            className={`${design.showShipTo ? 'md:col-span-4' : 'md:col-span-6'} flex flex-col`}
            style={{
              borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
            }}
          >
            <div
              className="text-white font-bold px-3 py-1.5 text-xs"
              style={{
                backgroundColor: primaryColor,
                borderBottom: `${borderWidth} solid ${gridBorderColor}`,
              }}
            >
              Bill To
            </div>
            <div className="p-3 bg-white flex-1 min-h-[5rem] space-y-1 leading-snug">
              <p className="font-bold text-gray-900">{customer?.name || 'Walk-in Customer'}</p>
              {customer?.address && <p className="text-gray-700">{customer.address}</p>}
              <p className="text-gray-700">
                {[customer?.pin, customer?.city].filter(Boolean).join(' ')}
              </p>
              <p className="text-gray-600 pt-1">
                <span className="text-gray-500 font-medium">Contact No. : </span>
                {customer?.phone || '—'}
              </p>
              {customer?.gstin && (
                <p className="text-gray-700">
                  <span className="font-bold text-gray-800">GSTIN : </span>
                  {customer.gstin}
                </p>
              )}
              <p className="text-gray-600">
                <span className="text-gray-500 font-medium">State : </span>
                {customer?.stateCode ? `${customer.stateCode}-${customer.state}` : customer?.state || '—'}
              </p>
            </div>
          </div>

          {/* Col 2: Ship To (Optional) */}
          {design.showShipTo && (
            <div
              className="md:col-span-4 flex flex-col"
              style={{
                borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
              }}
            >
              <div
                className="text-white font-bold px-3 py-1.5 text-xs"
                style={{
                  backgroundColor: primaryColor,
                  borderBottom: `${borderWidth} solid ${gridBorderColor}`,
                }}
              >
                Ship To
              </div>
              <div className="p-3 bg-white flex-1 min-h-[5rem] space-y-1 leading-snug">
                <p className="font-bold text-gray-900">{shippingName}</p>
                {shippingAddress ? (
                  <>
                    <p className="text-gray-700">{shippingAddress}</p>
                    <p className="text-gray-700">
                      {[shippingPin, shippingCity].filter(Boolean).join(' ')}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500 italic">Same as Billed Address</p>
                )}
                <p className="text-gray-600 pt-1">
                  <span className="text-gray-500 font-medium">Contact No. : </span>
                  {customer?.phone || '—'}
                </p>
                <p className="text-gray-600">
                  <span className="text-gray-500 font-medium">State : </span>
                  {shippingStateCode ? `${shippingStateCode}-${shippingState}` : shippingState || '—'}
                </p>
              </div>
            </div>
          )}

          {/* Col 3: Invoice Details (Aligned non-overlapping grid) */}
          <div className={`${design.showShipTo ? 'md:col-span-4' : 'md:col-span-6'} flex flex-col`}>
            <div
              className="text-white font-bold px-3 py-1.5 text-xs"
              style={{
                backgroundColor: primaryColor,
                borderBottom: `${borderWidth} solid ${gridBorderColor}`,
              }}
            >
              Invoice Details
            </div>
            <div className="p-3 bg-white flex-1 min-h-[5rem] space-y-1.5 text-xs">
              <div className="flex items-start justify-between gap-2 border-b border-gray-100/80 pb-1">
                <span className="text-gray-500 font-medium shrink-0">Place of Supply</span>
                <span className="font-semibold text-gray-900 text-right break-words min-w-0">
                  {customer?.stateCode ? `${customer.stateCode}-${customer.state}` : customer?.state || business.state || '—'}
                </span>
              </div>
              {design.showTransportInfo && (
                <>
                  <div className="flex items-start justify-between gap-2 border-b border-gray-100/80 pb-1">
                    <span className="text-gray-500 font-medium shrink-0">Transporter</span>
                    <span className="font-medium text-gray-900 text-right break-words min-w-0">
                      {invoice.transporterName || 'Self'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2 border-b border-gray-100/80 pb-1">
                    <span className="text-gray-500 font-medium shrink-0">L.R. No.</span>
                    <span className="font-medium text-gray-900 text-right break-words min-w-0">
                      {invoice.lrRrNumber || '—'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2 border-b border-gray-100/80 pb-1">
                    <span className="text-gray-500 font-medium shrink-0">Vehicle No.</span>
                    <span className="font-medium text-gray-900 text-right break-words min-w-0">
                      {invoice.vehicleNumber || '—'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2 border-b border-gray-100/80 pb-1">
                    <span className="text-gray-500 font-medium shrink-0">Transport Mode</span>
                    <span className="font-medium text-gray-900 text-right break-words min-w-0">
                      {invoice.transportMode || 'Road'}
                    </span>
                  </div>
                </>
              )}
              <div className="flex items-start justify-between gap-2 pt-0.5">
                <span className="text-gray-500 font-medium shrink-0">Date of Supply</span>
                <span className="font-medium text-gray-900 text-right break-words min-w-0">
                  {formatDate(invoice.invoiceDate)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. LINE ITEMS TABLE (SEAMLESS BORDER-COLLAPSE GRID WITH MATCHED COLUMN LINES) */}
        <div
          onClick={() => onSelectLayer?.('grid')}
          className={`w-full overflow-x-auto ${getLayerClass('grid')}`}
          style={{
            borderBottom: `${borderWidth} solid ${gridBorderColor}`,
          }}
        >
          {interactive && selectedLayer === 'grid' && (
            <span className="absolute -top-3 left-2 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20">
              Selected: Table & Grid Lines
            </span>
          )}
          <table className="w-full text-xs text-left border-collapse" style={{ borderSpacing: 0 }}>
            <thead
              className="text-white text-[11px]"
              style={{ backgroundColor: primaryColor }}
            >
              <tr
                style={{
                  borderBottom: `${borderWidth} solid ${gridBorderColor}`,
                }}
              >
                {cols.sr && (
                  <th
                    style={{
                      width: colWidths.sr,
                      borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                    className="py-2.5 px-2 text-center"
                  >
                    #
                  </th>
                )}
                {cols.desc && (
                  <th
                    style={{
                      width: colWidths.desc,
                      borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                    className="py-2.5 px-3"
                  >
                    Product Name / Description
                  </th>
                )}
                {cols.hsn && (
                  <th
                    style={{
                      width: colWidths.hsn,
                      borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                    className="py-2.5 px-2 text-center"
                  >
                    HSN/SAC
                  </th>
                )}
                {cols.qty && (
                  <th
                    style={{
                      width: colWidths.qty,
                      borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                    className="py-2.5 px-2 text-center"
                  >
                    Qty
                  </th>
                )}
                {cols.unit && (
                  <th
                    style={{
                      width: colWidths.unit,
                      borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                    className="py-2.5 px-2 text-center"
                  >
                    Unit
                  </th>
                )}
                {cols.price && (
                  <th
                    style={{
                      width: colWidths.price,
                      borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                    className="py-2.5 px-3 text-right"
                  >
                    Price (₹)
                  </th>
                )}
                {cols.taxable && (
                  <th
                    style={{
                      width: colWidths.taxable,
                      borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                    className="py-2.5 px-3 text-right"
                  >
                    Taxable (₹)
                  </th>
                )}
                {cols.gstPct && (
                  <th
                    style={{
                      width: colWidths.gstPct,
                      borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                    className="py-2.5 px-2 text-center"
                  >
                    GST %
                  </th>
                )}
                {cols.gstAmt && (
                  <th
                    style={{
                      width: colWidths.gstAmt,
                      borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                    className="py-2.5 px-3 text-right"
                  >
                    GST Amt (₹)
                  </th>
                )}
                {cols.totalAmt && (
                  <th
                    style={{ width: colWidths.totalAmt }}
                    className="py-2.5 px-3 text-right"
                  >
                    Total (₹)
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {invoice.items.map((item, idx) => {
                const itemGst = item.cgstAmount + item.sgstAmount + item.igstAmount
                const taxablePerUnit = item.quantity > 0 ? (item.taxableAmount / (item.quantity / 100)) : item.unitPrice
                return (
                  <tr
                    key={item.id || idx}
                    className={idx % 2 === 1 && design.zebraStriping ? 'bg-gray-50/70' : 'bg-white'}
                    style={{
                      borderBottom: showRowDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                  >
                    {cols.sr && (
                      <td
                        className={`${densityPadding} text-center`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        {idx + 1}
                      </td>
                    )}
                    {cols.desc && (
                      <td
                        className={`${densityPadding} font-semibold text-gray-900`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        {item.description}
                      </td>
                    )}
                    {cols.hsn && (
                      <td
                        className={`${densityPadding} text-center tabular-nums text-gray-700`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        {item.hsnCode || '—'}
                      </td>
                    )}
                    {cols.qty && (
                      <td
                        className={`${densityPadding} text-center tabular-nums font-medium text-gray-900`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        {(item.quantity / 100).toFixed(0)}
                      </td>
                    )}
                    {cols.unit && (
                      <td
                        className={`${densityPadding} text-center text-gray-600`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        {item.unit || 'Nos'}
                      </td>
                    )}
                    {cols.price && (
                      <td
                        className={`${densityPadding} text-right tabular-nums text-gray-700`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        ₹ {paiseToRupees(item.unitPrice)}
                      </td>
                    )}
                    {cols.taxable && (
                      <td
                        className={`${densityPadding} text-right tabular-nums text-gray-700`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        ₹ {paiseToRupees(taxablePerUnit)}
                      </td>
                    )}
                    {cols.gstPct && (
                      <td
                        className={`${densityPadding} text-center tabular-nums text-gray-700`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        {(item.taxRate / 100).toFixed(0)}%
                      </td>
                    )}
                    {cols.gstAmt && (
                      <td
                        className={`${densityPadding} text-right tabular-nums text-gray-700`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        ₹ {paiseToRupees(itemGst)}
                      </td>
                    )}
                    {cols.totalAmt && (
                      <td className={`${densityPadding} text-right tabular-nums font-bold text-gray-900`}>
                        ₹ {paiseToRupees(item.totalAmount)}
                      </td>
                    )}
                  </tr>
                )
              })}

              {/* Blank Padding Rows for Full Bill Layout */}
              {Array.from({ length: Math.max(0, (design.minTableRows ?? 8) - invoice.items.length) }).map((_, bIdx) => {
                const isZebra = (invoice.items.length + bIdx) % 2 === 1 && design.zebraStriping
                return (
                  <tr
                    key={`blank-row-${bIdx}`}
                    className={`h-7 sm:h-8 ${isZebra ? 'bg-gray-50/70' : 'bg-white'}`}
                    style={{
                      borderBottom: showRowDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                  >
                    {cols.sr && (
                      <td
                        className={`${densityPadding} text-center select-none text-transparent`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        &nbsp;
                      </td>
                    )}
                    {cols.desc && (
                      <td
                        className={`${densityPadding} select-none text-transparent`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        &nbsp;
                      </td>
                    )}
                    {cols.hsn && (
                      <td
                        className={`${densityPadding} select-none text-transparent`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        &nbsp;
                      </td>
                    )}
                    {cols.qty && (
                      <td
                        className={`${densityPadding} select-none text-transparent`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        &nbsp;
                      </td>
                    )}
                    {cols.unit && (
                      <td
                        className={`${densityPadding} select-none text-transparent`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        &nbsp;
                      </td>
                    )}
                    {cols.price && (
                      <td
                        className={`${densityPadding} select-none text-transparent`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        &nbsp;
                      </td>
                    )}
                    {cols.taxable && (
                      <td
                        className={`${densityPadding} select-none text-transparent`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        &nbsp;
                      </td>
                    )}
                    {cols.gstPct && (
                      <td
                        className={`${densityPadding} select-none text-transparent`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        &nbsp;
                      </td>
                    )}
                    {cols.gstAmt && (
                      <td
                        className={`${densityPadding} select-none text-transparent`}
                        style={{
                          borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                        }}
                      >
                        &nbsp;
                      </td>
                    )}
                    {cols.totalAmt && (
                      <td className={`${densityPadding} select-none text-transparent`}>
                        &nbsp;
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot
              className="font-bold text-gray-900"
              style={{
                backgroundColor: totalRowBgColor,
                borderTop: `${borderWidth} solid ${gridBorderColor}`,
              }}
            >
              <tr>
                <td
                  colSpan={(cols.sr ? 1 : 0) + (cols.desc ? 1 : 0) + (cols.hsn ? 1 : 0)}
                  className="py-2.5 px-3 text-sm"
                  style={{
                    borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                  }}
                >
                  Total
                </td>
                {cols.qty && (
                  <td
                    className="py-2.5 px-2 text-center tabular-nums"
                    style={{
                      borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                  >
                    {totalQuantity % 1 === 0 ? totalQuantity.toFixed(0) : totalQuantity.toFixed(2)}
                  </td>
                )}
                {((cols.unit ? 1 : 0) + (cols.price ? 1 : 0) + (cols.taxable ? 1 : 0) + (cols.gstPct ? 1 : 0)) > 0 && (
                  <td
                    colSpan={(cols.unit ? 1 : 0) + (cols.price ? 1 : 0) + (cols.taxable ? 1 : 0) + (cols.gstPct ? 1 : 0)}
                    style={{
                      borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                  />
                )}
                {cols.gstAmt && (
                  <td
                    className="py-2.5 px-3 text-right tabular-nums"
                    style={{
                      borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                    }}
                  >
                    ₹ {paiseToRupees(totalTaxAmount)}
                  </td>
                )}
                {cols.totalAmt && (
                  <td className="py-2.5 px-3 text-right tabular-nums text-sm">
                    ₹ {paiseToRupees(invoice.totalAmount)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 5. MIDDLE SECTION: AMOUNT IN WORDS & AMOUNTS (ZERO GAPS) */}
        <div
          className="grid grid-cols-1 md:grid-cols-12"
          style={{
            borderBottom: `${borderWidth} solid ${gridBorderColor}`,
          }}
        >
          {/* Left: Amount in Words */}
          {design.showAmountInWords && (
            <div
              onClick={() => onSelectLayer?.('words')}
              className={`md:col-span-7 flex flex-col ${getLayerClass('words')}`}
              style={{
                borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
              }}
            >
              {interactive && selectedLayer === 'words' && (
                <span className="absolute -top-3 left-2 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20">
                  Selected: Amount in Words
                </span>
              )}
              <div
                className="text-white font-bold px-3 py-1.5 text-xs"
                style={{
                  backgroundColor: primaryColor,
                  borderBottom: `${borderWidth} solid ${gridBorderColor}`,
                }}
              >
                Amount in Words
              </div>
              <div className="p-4 bg-white flex-1 flex items-center">
                <p className="text-xs font-semibold text-gray-900 italic leading-relaxed">
                  {paiseToWords(invoice.totalAmount)}
                </p>
              </div>
            </div>
          )}

          {/* Right: Amounts Summary */}
          <div
            onClick={() => onSelectLayer?.('amounts')}
            className={`${design.showAmountInWords ? 'md:col-span-5' : 'md:col-span-12'} flex flex-col ${getLayerClass('amounts')}`}
          >
            {interactive && selectedLayer === 'amounts' && (
              <span className="absolute -top-3 left-2 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20">
                Selected: Amounts Breakdown
              </span>
            )}
            <div
              className="text-white font-bold px-3 py-1.5 text-xs"
              style={{
                backgroundColor: primaryColor,
                borderBottom: `${borderWidth} solid ${gridBorderColor}`,
              }}
            >
              Amounts
            </div>
            <div className="p-3 bg-white space-y-1 text-xs divide-y divide-gray-100 flex-1">
              <div className="flex justify-between items-center gap-2 text-gray-600 pt-0.5">
                <span className="shrink-0">Sub Total</span>
                <span className="tabular-nums font-medium text-gray-800 text-right min-w-0">
                  ₹ {paiseToRupees(invoice.subtotal)}
                </span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between items-center gap-2 text-red-600 pt-0.5">
                  <span className="shrink-0">Discount</span>
                  <span className="tabular-nums text-right min-w-0">- ₹ {paiseToRupees(invoice.discountAmount)}</span>
                </div>
              )}
              {Number(invoice.shippingCharges || 0) > 0 && (
                <div className="flex justify-between items-center gap-2 text-green-700 pt-0.5">
                  <span className="shrink-0">Freight / Transportation</span>
                  <span className="tabular-nums text-right min-w-0">+ ₹ {paiseToRupees(invoice.shippingCharges)}</span>
                </div>
              )}
              {Number(invoice.additionalCharges || 0) !== 0 && (
                <div className="flex justify-between items-center gap-2 text-gray-600 pt-0.5">
                  <span className="shrink-0">{invoice.additionalChargesLabel || 'Other Charges'}</span>
                  <span className="tabular-nums text-right min-w-0">
                    {invoice.additionalCharges > 0 ? '+ ' : ''}₹ {paiseToRupees(invoice.additionalCharges)}
                  </span>
                </div>
              )}
              {invoice.roundOff !== 0 && (
                <div className="flex justify-between items-center gap-2 text-gray-600 pt-0.5">
                  <span className="shrink-0">Round Off</span>
                  <span className="tabular-nums text-right min-w-0">₹ {paiseToRupees(invoice.roundOff)}</span>
                </div>
              )}
              <div
                className="flex justify-between items-center gap-2 py-1.5 font-bold text-sm -mx-3 px-3"
                style={{
                  borderTop: `${borderWidth} solid ${gridBorderColor}`,
                  borderBottom: `${borderWidth} solid ${gridBorderColor}`,
                  backgroundColor: totalRowBgColor,
                }}
              >
                <span className="text-gray-900 shrink-0">Total</span>
                <span className="tabular-nums text-gray-900 text-right min-w-0">₹ {paiseToRupees(invoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center gap-2 text-gray-600 pt-0.5">
                <span className="shrink-0">Received</span>
                <span className="tabular-nums text-right min-w-0">₹ {paiseToRupees(paid)}</span>
              </div>
              <div className="flex justify-between items-center gap-2 font-bold text-gray-900 pt-1">
                <span className="shrink-0">Balance</span>
                <span className="tabular-nums text-sm text-right min-w-0">₹ {paiseToRupees(balance)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. GST BREAKDOWN TABLE (SEAMLESS BORDER-COLLAPSE) */}
        {design.showGstSummaryTable && (
          <div
            onClick={() => onSelectLayer?.('gst')}
            className={`w-full ${getLayerClass('gst')}`}
            style={{
              borderBottom: `${borderWidth} solid ${gridBorderColor}`,
            }}
          >
            {interactive && selectedLayer === 'gst' && (
              <span className="absolute -top-3 left-2 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20">
                Selected: GST Breakdown
              </span>
            )}
            <table className="w-full text-xs border-collapse" style={{ borderSpacing: 0 }}>
              <thead
                className="text-white text-[11px]"
                style={{ backgroundColor: primaryColor }}
              >
                <tr style={{ borderBottom: `${borderWidth} solid ${gridBorderColor}` }}>
                  <th
                    className="py-1.5 px-3 text-left w-1/4"
                    style={{ borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none' }}
                  >
                    Tax Type
                  </th>
                  <th
                    className="py-1.5 px-3 text-right w-1/4"
                    style={{ borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none' }}
                  >
                    Taxable Amount (₹)
                  </th>
                  <th
                    className="py-1.5 px-3 text-center w-1/5"
                    style={{ borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none' }}
                  >
                    Rate
                  </th>
                  <th className="py-1.5 px-3 text-right">Tax Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {!isInterstate ? (
                  <>
                    <tr style={{ borderBottom: `${borderWidth} solid ${gridBorderColor}` }}>
                      <td
                        className="py-1.5 px-3 font-semibold text-gray-800"
                        style={{ borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none' }}
                      >
                        SGST
                      </td>
                      <td
                        className="py-1.5 px-3 text-right tabular-nums text-gray-700"
                        style={{ borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none' }}
                      >
                        ₹ {paiseToRupees(invoice.taxableAmount)}
                      </td>
                      <td
                        className="py-1.5 px-3 text-center tabular-nums text-gray-700"
                        style={{ borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none' }}
                      >
                        {halfRatePct}
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums font-medium text-gray-900">
                        ₹ {paiseToRupees(invoice.sgstAmount)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="py-1.5 px-3 font-semibold text-gray-800"
                        style={{ borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none' }}
                      >
                        CGST
                      </td>
                      <td
                        className="py-1.5 px-3 text-right tabular-nums text-gray-700"
                        style={{ borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none' }}
                      >
                        ₹ {paiseToRupees(invoice.taxableAmount)}
                      </td>
                      <td
                        className="py-1.5 px-3 text-center tabular-nums text-gray-700"
                        style={{ borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none' }}
                      >
                        {halfRatePct}
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums font-medium text-gray-900">
                        ₹ {paiseToRupees(invoice.cgstAmount)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td
                      className="py-1.5 px-3 font-semibold text-gray-800"
                      style={{ borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none' }}
                    >
                      IGST
                    </td>
                    <td
                      className="py-1.5 px-3 text-right tabular-nums text-gray-700"
                      style={{ borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none' }}
                    >
                      ₹ {paiseToRupees(invoice.taxableAmount)}
                    </td>
                    <td
                      className="py-1.5 px-3 text-center tabular-nums text-gray-700"
                      style={{ borderRight: showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none' }}
                    >
                      {fullRatePct}
                    </td>
                    <td className="py-1.5 px-3 text-right tabular-nums font-medium text-gray-900">
                      ₹ {paiseToRupees(invoice.igstAmount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. FOOTER: BANK DETAILS, TERMS & CONDITIONS, AUTHORIZED SIGNATORY (CONTINUOUS GRID) */}
        {(design.showBankDetails || design.showTermsConditions || design.showSignatureBlock) && (
          <div
            onClick={() => onSelectLayer?.('footer')}
            className={`grid grid-cols-1 md:grid-cols-12 text-xs ${getLayerClass('footer')}`}
          >
            {interactive && selectedLayer === 'footer' && (
              <span className="absolute -top-3 left-2 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20">
                Selected: Bank, Terms & Signature
              </span>
            )}

            {/* Col 1: Bank Details */}
            {design.showBankDetails && (
              <div
                className={`${
                  design.showTermsConditions && design.showSignatureBlock
                    ? 'md:col-span-5'
                    : design.showTermsConditions || design.showSignatureBlock
                    ? 'md:col-span-6'
                    : 'md:col-span-12'
                } flex flex-col`}
                style={{
                  borderRight: (design.showTermsConditions || design.showSignatureBlock) && showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                }}
              >
                <div
                  className="text-white font-bold px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: primaryColor,
                    borderBottom: `${borderWidth} solid ${gridBorderColor}`,
                  }}
                >
                  Bank Details
                </div>
                <div className="p-3 bg-white flex-1 flex items-center gap-3">
                  {/* Strict QR check: only render when showQrCode is true */}
                  {design.showQrCode && (design.customQrUrl || upiQrCodeUrl) && (
                    <div className="flex flex-col items-center flex-shrink-0">
                      <img
                        src={design.customQrUrl || upiQrCodeUrl}
                        alt="Payment QR Code"
                        style={{
                          width: `${design.qrCodeSize || 46}px`,
                          height: `${design.qrCodeSize || 46}px`,
                        }}
                        className="border border-gray-300 object-contain p-0.5 bg-white"
                      />
                      {design.showUpiBadge && (
                        <span
                          className="mt-1 text-white font-bold text-[8px] px-1.5 py-0.5 rounded tracking-wide"
                          style={{ backgroundColor: primaryColor }}
                        >
                          UPI SCAN TO PAY
                        </span>
                      )}
                    </div>
                  )}
                  <div className="space-y-0.5 text-[11px] leading-tight flex-1">
                    <p>
                      <span className="font-semibold text-gray-800">Name : </span>
                      {design.customAccountHolder || business.name}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-800">Account No. : </span>
                      {design.customAccountNumber || business.accountNumber || '—'}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-800">IFSC code : </span>
                      {design.customIfsc || business.ifsc || '—'}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-800">Bank : </span>
                      {design.customBankName || business.bankName || '—'}
                    </p>
                    <p className="font-semibold text-gray-800 pt-0.5">Account holder's name :</p>
                    <p className="text-gray-600">{design.customAccountHolder || business.name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Col 2: Terms and Conditions */}
            {design.showTermsConditions && (
              <div
                className={`${
                  design.showBankDetails && design.showSignatureBlock
                    ? 'md:col-span-4'
                    : design.showBankDetails || design.showSignatureBlock
                    ? 'md:col-span-6'
                    : 'md:col-span-12'
                } flex flex-col`}
                style={{
                  borderRight: design.showSignatureBlock && showColDividers ? `${borderWidth} solid ${gridBorderColor}` : 'none',
                }}
              >
                <div
                  className="text-white font-bold px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: primaryColor,
                    borderBottom: `${borderWidth} solid ${gridBorderColor}`,
                  }}
                >
                  Terms and Conditions
                </div>
                <div
                  className="p-3 bg-white flex-1 space-y-1 text-gray-600 leading-tight"
                  style={{ fontSize: `${(design.termsFontSize || 6) * 1.6}px` }}
                >
                  {termsLines.map((line, lIdx) => (
                    <p key={lIdx}>{line}</p>
                  ))}
                  {design.jurisdictionCity && (
                    <p className="font-medium text-gray-700 pt-0.5">
                      Subject to {design.jurisdictionCity} jurisdiction only.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Col 3: Authorized Signatory */}
            {design.showSignatureBlock && (
              <div
                className={`${
                  design.showBankDetails && design.showTermsConditions
                    ? 'md:col-span-3'
                    : design.showBankDetails || design.showTermsConditions
                    ? 'md:col-span-6'
                    : 'md:col-span-12'
                } flex flex-col bg-white`}
              >
                <div className="p-3 flex-1 flex flex-col justify-between items-center text-center">
                  <p className="font-bold text-xs text-gray-900">
                    {design.signatoryForText || `For ${business.name}`}
                  </p>
                  <div className="py-2">
                    {design.signatureStyle === 'uploaded' && design.uploadedSignatureUrl ? (
                      <img
                        src={design.uploadedSignatureUrl}
                        alt="Signature"
                        className="h-10 max-w-[120px] object-contain"
                      />
                    ) : design.signatureStyle === 'blank_line' ? (
                      <div className="h-8" />
                    ) : (
                      <svg width="120" height="32" viewBox="0 0 200 60" fill="none">
                        <path
                          d="M 20 45 Q 45 10 65 40 T 95 28 Q 120 5 145 35 T 175 30 M 35 42 Q 75 52 155 42"
                          stroke={primaryColor}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                  </div>
                  <div
                    className="w-full pt-1"
                    style={{
                      borderTop: `${borderWidth} solid ${gridBorderColor}`,
                    }}
                  >
                    <p className="font-bold text-xs text-gray-800">
                      {design.signatoryLabel || 'Authorized Signatory'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
