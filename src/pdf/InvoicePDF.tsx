import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, Svg, Path } from '@react-pdf/renderer'
import { paiseToRupees } from '@utils/decimal'
import { formatDate } from '@utils/date'
import { paiseToWords } from '@utils/number-to-words'
import type { InvoiceWithItems } from '@/types/invoice'
import type { Business, InvoicePaperSize, InvoiceTheme } from '@/types/business'
import type { InvoiceCustomDesign, ColumnVisibilityMap } from '@/types/invoice-design'
import {
  DEFAULT_INVOICE_DESIGN,
  DEFAULT_COLUMNS_VISIBILITY,
  DEFAULT_TERMS_TEXT,
  calculateColumnWidths,
} from '@/types/invoice-design'

/**
 * Standard Indian Currency Formatter for PDF.
 * Uses Rs. prefix to ensure universal compatibility across all PDF engines,
 * native printers, and mobile previewers without missing glyphs.
 */
function formatPDFCurrency(paise: number, prefix = 'Rs. '): string {
  const rupees = paiseToRupees(paise)
  const num = parseFloat(rupees)
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(isNaN(num) ? 0 : num)
  return `${prefix}${formatted}`
}

const THEME_COLORS: Record<
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
    primary: '#416788',
    bannerBg: '#EEF4FA',
    textDark: '#1E3A5F',
    border: '#94A3B8',
    totalRowBg: '#F1F5F9',
  },
  CLASSIC_NAVY: {
    primary: '#1E3A5F',
    bannerBg: '#E9F0F8',
    textDark: '#1E3A5F',
    border: '#94A3B8',
    totalRowBg: '#F1F5F9',
  },
  MONOCHROME: {
    primary: '#18191B',
    bannerBg: '#F3F4F6',
    textDark: '#111827',
    border: '#6B7280',
    totalRowBg: '#F3F4F6',
  },
  EMERALD: {
    primary: '#047857',
    bannerBg: '#ECFDF5',
    textDark: '#064E3B',
    border: '#10B981',
    totalRowBg: '#F0FDF4',
  },
}

export interface InvoicePDFProps {
  invoice: InvoiceWithItems
  business: Business
  upiQrCodeUrl?: string
  paperSize?: InvoicePaperSize
  theme?: InvoiceTheme
  customDesign?: InvoiceCustomDesign
}

export function InvoicePDF({
  invoice,
  business,
  upiQrCodeUrl,
  paperSize = 'A4',
  theme = 'SLATE_BLUE',
  customDesign,
}: InvoicePDFProps) {
  const customer = invoice.customerSnapshot
  const isInterstate = invoice.supplyType === 'INTERSTATE'
  const design = customDesign || DEFAULT_INVOICE_DESIGN
  const activeTheme = {
    primary: design.primaryColor || THEME_COLORS[theme]?.primary || THEME_COLORS.SLATE_BLUE.primary,
    bannerBg: design.bannerBgColor || THEME_COLORS[theme]?.bannerBg || THEME_COLORS.SLATE_BLUE.bannerBg,
    textDark: design.textDarkColor || THEME_COLORS[theme]?.textDark || THEME_COLORS.SLATE_BLUE.textDark,
    border: design.gridBorderColor || THEME_COLORS[theme]?.border || THEME_COLORS.SLATE_BLUE.border,
    totalRowBg: design.totalRowBgColor || THEME_COLORS[theme]?.totalRowBg || THEME_COLORS.SLATE_BLUE.totalRowBg,
  }

  const borderWidthNum = design.borderWidth || 1
  const showColDividers = design.showColumnDividers !== false
  const showRowDividers = design.showRowDividers !== false
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

  // Is Thermal Receipt layout?
  if (paperSize === 'THERMAL') {
    return (
      <Document title={`Invoice-${invoice.invoiceNumber}`} author={business.name}>
        <Page size={[226.77, 850]} style={{ fontFamily: 'Helvetica', fontSize: 7, padding: 8, color: '#111827', backgroundColor: '#FFFFFF' }}>
          {/* Thermal Header */}
          <View style={{ alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 4, marginBottom: 4 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase' }}>
              {design.brandTitle || business.name}
            </Text>
            {business.address && <Text style={{ fontSize: 6.5, textAlign: 'center', marginTop: 1 }}>{business.address}</Text>}
            <Text style={{ fontSize: 6.5, textAlign: 'center' }}>
              {[business.city, business.state, business.pin].filter(Boolean).join(', ')}
            </Text>
            {business.phone && <Text style={{ fontSize: 6.5 }}>Phone: {business.phone}</Text>}
            {business.gstin && <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold' }}>GSTIN: {business.gstin}</Text>}
          </View>

          {/* Thermal Invoice Meta */}
          <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 3, marginBottom: 4 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 2 }}>
              {design.bannerTitle || 'TAX INVOICE'}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text>Inv #: {invoice.invoiceNumber}</Text>
              <Text>Date: {formatDate(invoice.invoiceDate)}</Text>
            </View>
            <Text>Customer: {customer?.name || 'Walk-in Customer'}</Text>
          </View>

          {/* Thermal Items Table */}
          <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 3, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#666', paddingBottom: 2, marginBottom: 2 }}>
              <Text style={{ width: '45%', fontFamily: 'Helvetica-Bold' }}>Item</Text>
              <Text style={{ width: '15%', textAlign: 'center', fontFamily: 'Helvetica-Bold' }}>Qty</Text>
              <Text style={{ width: '20%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>Rate</Text>
              <Text style={{ width: '20%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>Amt</Text>
            </View>
            {invoice.items.map((it, idx) => (
              <View key={it.id || idx} style={{ flexDirection: 'row', paddingVertical: 1 }}>
                <Text style={{ width: '45%' }}>{it.description}</Text>
                <Text style={{ width: '15%', textAlign: 'center' }}>{(it.quantity / 100).toFixed(0)}</Text>
                <Text style={{ width: '20%', textAlign: 'right' }}>{formatPDFCurrency(it.unitPrice, '')}</Text>
                <Text style={{ width: '20%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{formatPDFCurrency(it.totalAmount, '')}</Text>
              </View>
            ))}
          </View>

          {/* Thermal Totals */}
          <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 3, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text>Taxable Amount:</Text>
              <Text>{formatPDFCurrency(invoice.taxableAmount)}</Text>
            </View>
            {!isInterstate ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text>CGST ({halfRatePct}):</Text>
                  <Text>{formatPDFCurrency(invoice.cgstAmount)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text>SGST ({halfRatePct}):</Text>
                  <Text>{formatPDFCurrency(invoice.sgstAmount)}</Text>
                </View>
              </>
            ) : (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>IGST ({fullRatePct}):</Text>
                <Text>{formatPDFCurrency(invoice.igstAmount)}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#000', paddingTop: 2, marginTop: 2 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>Grand Total:</Text>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>{formatPDFCurrency(invoice.totalAmount)}</Text>
            </View>
          </View>

          {/* Thermal QR: Strictly respects showQrCode */}
          {design.showQrCode && (design.customQrUrl || upiQrCodeUrl) && (
            <View style={{ alignItems: 'center', marginVertical: 4 }}>
              <Image src={design.customQrUrl || upiQrCodeUrl} style={{ width: 64, height: 64 }} />
              <Text style={{ fontSize: 6, marginTop: 1 }}>Scan with UPI App to Pay</Text>
            </View>
          )}

          <Text style={{ fontSize: 6, textAlign: 'center', marginTop: 4 }}>Thank you for your business!</Text>
        </Page>
      </Document>
    )
  }

  // A4 / A5 Layout with Continuous Unbroken Grid Lines
  const isA5 = paperSize === 'A5'

  // Margins converted to PDF points (1 mm = 2.8346 pt)
  const padTop = (design.marginTop ?? 8) * 2.834
  const padBottom = (design.marginBottom ?? 8) * 2.834
  const padLeft = (design.marginLeft ?? 8) * 2.834
  const padRight = (design.marginRight ?? 8) * 2.834

  // Adaptive scaling for large margins (up to 50mm top/bottom)
  const verticalMarginTotal = (design.marginTop ?? 8) + (design.marginBottom ?? 8)
  const isLargeVMargin = verticalMarginTotal >= 35
  const isExtremeVMargin = verticalMarginTotal >= 65

  const fontScaleMult =
    design.fontScale === 'xlarge'
      ? 1.25
      : design.fontScale === 'large'
      ? 1.12
      : 1.0

  const fontSizeBase = (
    isA5
      ? (isExtremeVMargin ? 6.5 : isLargeVMargin ? 7.0 : 7.6)
      : (isExtremeVMargin ? 7.4 : isLargeVMargin ? 8.0 : 8.5)
  ) * fontScaleMult

  // Density padding
  const densityPadV = isExtremeVMargin
    ? 2.0
    : isLargeVMargin
    ? 2.8
    : (design.tableDensity === 'compact' ? 2.5 : design.tableDensity === 'spacious' ? 5.5 : 4.0)

  const brandHeadingFontSize = (
    isA5
      ? Math.max(14, (design.brandFontSize || 22) * 0.75)
      : Math.max(18, design.brandFontSize || 22)
  ) * fontScaleMult

  const amountRowFontSize = (isA5 ? 6.6 : (isExtremeVMargin ? 7.2 : 8.2)) * fontScaleMult
  const amountTotalFontSize = (isA5 ? 9.5 : (isExtremeVMargin ? 10.5 : 12.0)) * fontScaleMult

  const styles = StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: fontSizeBase,
      paddingTop: padTop,
      paddingBottom: padBottom,
      paddingLeft: padLeft,
      paddingRight: padRight,
      color: activeTheme.textDark,
      backgroundColor: '#ffffff',
    },

    // Outer Master Bounding Box (No breaks, no cuts)
    invoiceFrame: {
      borderWidth: borderWidthNum,
      borderColor: activeTheme.border,
      backgroundColor: '#ffffff',
    },

    // 1. Top Brand Header
    topHeader: {
      padding: isExtremeVMargin ? (isA5 ? 3.5 : 4.5) : isLargeVMargin ? (isA5 ? 4.5 : 6) : (isA5 ? 6 : 8),
      borderBottomWidth: borderWidthNum,
      borderBottomColor: activeTheme.border,
    },
    brandNamePrimary: {
      fontSize: brandHeadingFontSize,
      fontFamily: 'Helvetica-Bold',
      color: activeTheme.primary,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    businessLegalName: {
      fontSize: (isA5 ? 7.5 : 9.5) * fontScaleMult,
      fontFamily: 'Helvetica-Bold',
      color: activeTheme.textDark,
    },
    businessAddressLine: {
      fontSize: (isA5 ? 6.2 : 7.6) * fontScaleMult,
      color: '#475569',
      marginTop: 0.5,
    },
    businessMetaLine: {
      fontSize: (isA5 ? 6.2 : 7.6) * fontScaleMult,
      color: '#475569',
      marginTop: 0.5,
    },

    // 2. Tax Invoice Banner
    bannerContainer: {
      flexDirection: 'row',
      backgroundColor: activeTheme.bannerBg,
      borderBottomWidth: borderWidthNum,
      borderBottomColor: activeTheme.border,
    },
    bannerTitleBox: {
      width: '66%',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: isExtremeVMargin ? (isA5 ? 2.5 : 3.5) : isLargeVMargin ? (isA5 ? 3.5 : 4.5) : (isA5 ? 4 : 6),
      borderRightWidth: showColDividers ? borderWidthNum : 0,
      borderRightColor: activeTheme.border,
    },
    bannerTitleText: {
      fontSize: (isA5 ? 13 : 16) * fontScaleMult,
      fontFamily: 'Helvetica-Bold',
      color: activeTheme.primary,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    bannerMetaBox: {
      width: '34%',
      backgroundColor: '#ffffff',
      padding: isExtremeVMargin ? (isA5 ? 2.5 : 3.5) : (isA5 ? 4 : 5),
      justifyContent: 'center',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: isExtremeVMargin ? 0.4 : (isLargeVMargin ? 0.7 : 1),
    },
    metaLabel: {
      width: '45%',
      fontSize: (isA5 ? 6.2 : (isExtremeVMargin ? 6.8 : 8.0)) * fontScaleMult,
      fontFamily: 'Helvetica-Bold',
      color: activeTheme.textDark,
    },
    metaVal: {
      width: '55%',
      textAlign: 'right',
      fontSize: (isA5 ? 6.2 : (isExtremeVMargin ? 6.8 : 8.0)) * fontScaleMult,
      color: activeTheme.textDark,
    },

    // 3. Parties Container
    partiesContainer: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderBottomWidth: borderWidthNum,
      borderBottomColor: activeTheme.border,
    },
    colHeaderBar: {
      backgroundColor: activeTheme.primary,
      paddingVertical: isExtremeVMargin ? 1.8 : 2.5,
      paddingHorizontal: 4,
      borderBottomWidth: borderWidthNum,
      borderBottomColor: activeTheme.border,
    },
    colHeaderText: {
      fontSize: (isA5 ? 6.8 : (isExtremeVMargin ? 7.2 : 8.5)) * fontScaleMult,
      fontFamily: 'Helvetica-Bold',
      color: '#ffffff',
    },
    colBody: {
      padding: isExtremeVMargin ? (isA5 ? 2.5 : 3.5) : (isA5 ? 4 : 5),
      minHeight: isA5 ? 46 : (isExtremeVMargin ? 48 : (isLargeVMargin ? 54 : 62)),
    },
    partyName: {
      fontSize: (isA5 ? 8.0 : (isExtremeVMargin ? 8.5 : 10.0)) * fontScaleMult,
      fontFamily: 'Helvetica-Bold',
      color: activeTheme.textDark,
      marginBottom: 1,
    },
    partyLine: {
      fontSize: (isA5 ? 6.2 : (isExtremeVMargin ? 6.8 : 7.8)) * fontScaleMult,
      color: '#475569',
      lineHeight: 1.25,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingVertical: isExtremeVMargin ? 0.4 : (isLargeVMargin ? 0.6 : 0.8),
    },
    infoLabel: {
      width: '45%',
      fontSize: (isA5 ? 6.2 : (isExtremeVMargin ? 6.8 : 7.8)) * fontScaleMult,
      color: '#64748B',
    },
    infoVal: {
      width: '55%',
      fontSize: (isA5 ? 6.2 : (isExtremeVMargin ? 6.8 : 7.8)) * fontScaleMult,
      fontFamily: 'Helvetica-Bold',
      color: activeTheme.textDark,
      textAlign: 'right',
    },

    // 4. Line Items Table
    tableContainer: {
      borderBottomWidth: borderWidthNum,
      borderBottomColor: activeTheme.border,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: activeTheme.primary,
      borderBottomWidth: borderWidthNum,
      borderBottomColor: activeTheme.border,
      alignItems: 'center',
    },
    thCell: {
      borderRightWidth: showColDividers ? borderWidthNum : 0,
      borderRightColor: activeTheme.border,
      paddingVertical: isA5 ? 2.8 : 3.8,
      paddingHorizontal: 2,
    },
    thText: {
      fontSize: (isA5 ? 6.8 : 8.2) * fontScaleMult,
      fontFamily: 'Helvetica-Bold',
      color: '#ffffff',
      textAlign: 'center',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: showRowDividers ? borderWidthNum : 0,
      borderBottomColor: activeTheme.border,
      alignItems: 'center',
    },
    tdCell: {
      borderRightWidth: showColDividers ? borderWidthNum : 0,
      borderRightColor: activeTheme.border,
      paddingVertical: densityPadV,
      paddingHorizontal: 2.5,
    },
    tdText: {
      fontSize: (isA5 ? 6.8 : 8.2) * fontScaleMult,
      color: activeTheme.textDark,
    },
    tdTextBold: {
      fontSize: (isA5 ? 7.0 : 8.5) * fontScaleMult,
      fontFamily: 'Helvetica-Bold',
      color: activeTheme.textDark,
    },

    // Total Row
    totalRow: {
      flexDirection: 'row',
      backgroundColor: activeTheme.totalRowBg,
      borderTopWidth: borderWidthNum,
      borderTopColor: activeTheme.border,
      paddingVertical: isA5 ? 2.8 : 3.8,
      alignItems: 'center',
    },

    // 5. Middle Section
    middleSection: {
      flexDirection: 'row',
      borderBottomWidth: borderWidthNum,
      borderBottomColor: activeTheme.border,
    },
    wordsContainer: {
      width: '58%',
      borderRightWidth: showColDividers ? borderWidthNum : 0,
      borderRightColor: activeTheme.border,
    },
    wordsBody: {
      padding: isExtremeVMargin ? (isA5 ? 2.5 : 3.5) : (isA5 ? 4 : 5),
      backgroundColor: '#ffffff',
      justifyContent: 'center',
      minHeight: isExtremeVMargin ? 24 : (isLargeVMargin ? 32 : (isA5 ? 38 : 46)),
    },
    wordsText: {
      fontSize: (isA5 ? 7.0 : (isExtremeVMargin ? 7.4 : 8.5)) * fontScaleMult,
      fontFamily: 'Helvetica-Bold',
      color: activeTheme.textDark,
      lineHeight: 1.25,
    },
    amountsContainer: {
      width: design.showAmountInWords ? '42%' : '100%',
    },
    amountsBody: {
      backgroundColor: '#ffffff',
      paddingVertical: 1,
    },
    amountLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: isExtremeVMargin ? 0.8 : (isLargeVMargin ? 1.1 : 1.5),
      paddingHorizontal: 4,
      borderBottomWidth: 0.5,
      borderBottomColor: '#F1F5F9',
    },
    amountLineTotal: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: isExtremeVMargin ? 1.4 : (isLargeVMargin ? 1.8 : 2.4),
      paddingHorizontal: 4,
      borderTopWidth: borderWidthNum,
      borderTopColor: activeTheme.border,
      borderBottomWidth: borderWidthNum,
      borderBottomColor: activeTheme.border,
      backgroundColor: activeTheme.totalRowBg,
    },

    // 6. GST Summary Table
    taxSummaryContainer: {
      borderBottomWidth: borderWidthNum,
      borderBottomColor: activeTheme.border,
    },
    taxSummaryHeader: {
      flexDirection: 'row',
      backgroundColor: activeTheme.primary,
      borderBottomWidth: borderWidthNum,
      borderBottomColor: activeTheme.border,
    },
    taxCellHeader: {
      borderRightWidth: showColDividers ? borderWidthNum : 0,
      borderRightColor: activeTheme.border,
      paddingVertical: 2,
      paddingHorizontal: 4,
    },
    taxSummaryRow: {
      flexDirection: 'row',
      borderBottomWidth: borderWidthNum,
      borderBottomColor: activeTheme.border,
    },
    taxCell: {
      borderRightWidth: showColDividers ? borderWidthNum : 0,
      borderRightColor: activeTheme.border,
      paddingVertical: 2,
      paddingHorizontal: 4,
    },

    // 7. Footer
    footerContainer: {
      flexDirection: 'row',
    },
    bankBody: {
      padding: isExtremeVMargin ? (isA5 ? 2.5 : 3) : isLargeVMargin ? (isA5 ? 3 : 3.8) : (isA5 ? 3.5 : 4.5),
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: '#ffffff',
    },
    qrWrapper: {
      alignItems: 'center',
      marginRight: 4,
    },
    upiPillBadge: {
      backgroundColor: activeTheme.primary,
      paddingVertical: 1,
      paddingHorizontal: 3,
      borderRadius: 2,
      marginTop: 2,
    },
    upiPillText: {
      fontSize: 4.8 * fontScaleMult,
      fontFamily: 'Helvetica-Bold',
      color: '#ffffff',
      textAlign: 'center',
    },
    bankTextCol: {
      flex: 1,
    },
    bankDetailRow: {
      fontSize: (isA5 ? 6.2 : 7.6) * fontScaleMult,
      color: activeTheme.textDark,
      lineHeight: 1.25,
      marginBottom: 0.8,
    },
    termsBody: {
      padding: isExtremeVMargin ? (isA5 ? 2.5 : 3) : isLargeVMargin ? (isA5 ? 3 : 3.8) : (isA5 ? 3.5 : 4.5),
      backgroundColor: '#ffffff',
    },
    termsItem: {
      fontSize: (isA5 ? (design.termsFontSize || 6.5) * 0.9 : (design.termsFontSize || 7.2)) * fontScaleMult,
      color: '#475569',
      lineHeight: 1.25,
      marginBottom: 1.5,
    },
    signatoryBody: {
      padding: isExtremeVMargin ? (isA5 ? 2.5 : 3) : isLargeVMargin ? (isA5 ? 3 : 3.8) : (isA5 ? 3.5 : 4.5),
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#ffffff',
      minHeight: isExtremeVMargin ? 36 : (isLargeVMargin ? 46 : (isA5 ? 54 : 64)),
    },
    signatoryFor: {
      fontSize: (isA5 ? 7.2 : 8.8) * fontScaleMult,
      fontFamily: 'Helvetica-Bold',
      color: activeTheme.textDark,
      textAlign: 'center',
    },
    signatureGraphic: {
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 2,
    },
    signatureLine: {
      borderTopWidth: borderWidthNum,
      borderTopColor: activeTheme.border,
      width: '90%',
      paddingTop: 1.5,
      alignItems: 'center',
    },
    signatoryLabel: {
      fontSize: (isA5 ? 6.2 : 7.6) * fontScaleMult,
      fontFamily: 'Helvetica-Bold',
      color: '#64748B',
      textAlign: 'center',
    },
  })

  // Width proportions for visible footer columns
  const hasBank = design.showBankDetails
  const hasTerms = design.showTermsConditions
  const hasSign = design.showSignatureBlock
  const footerColCount = (hasBank ? 1 : 0) + (hasTerms ? 1 : 0) + (hasSign ? 1 : 0)

  let bankColWidth = '42%'
  let termsColWidth = '36%'
  let signColWidth = '22%'
  if (footerColCount === 2) {
    if (hasBank && hasTerms) { bankColWidth = '54%'; termsColWidth = '46%' }
    else if (hasBank && hasSign) { bankColWidth = '65%'; signColWidth = '35%' }
    else if (hasTerms && hasSign) { termsColWidth = '65%'; signColWidth = '35%' }
  } else if (footerColCount === 1) {
    bankColWidth = '100%'
    termsColWidth = '100%'
    signColWidth = '100%'
  }

  // Parties column widths - Ensure Invoice Details has ample non-overlapping width
  const billToWidth = design.showShipTo ? '35%' : '52%'
  const shipToWidth = '33%'
  const detailsWidth = design.showShipTo ? '32%' : '48%'

  // Active column keys for line item table
  const activeColKeys = (['sr', 'desc', 'hsn', 'qty', 'unit', 'price', 'taxable', 'gstPct', 'gstAmt', 'totalAmt'] as (keyof ColumnVisibilityMap)[]).filter(
    (k) => cols[k],
  )

  const termsLines = (design.customTermsText || business.termsAndConditions || DEFAULT_TERMS_TEXT)
    .split('\n')
    .filter(Boolean)

  return (
    <Document title={`Invoice-${invoice.invoiceNumber}`} author={business.name}>
      <Page size={isA5 ? 'A5' : 'A4'} style={styles.page}>
        {/* ======================================================== */}
        {/* UNIFIED CONTINUOUS BOUNDING FRAME — ZERO CUTS IN LINES    */}
        {/* ======================================================== */}
        <View style={styles.invoiceFrame}>
          
          {/* 1. TOP BRAND HEADER - Brand Name Strong & Big */}
          <View style={styles.topHeader}>
            {design.headerLayout === 'centered' ? (
              // Centered Header
              <View style={{ alignItems: 'center', textAlign: 'center' }}>
                {design.logoUrl && design.logoPosition !== 'hidden' ? (
                  <Image
                    src={design.logoUrl}
                    style={{
                      width: isA5 ? (design.logoWidth || 36) * 0.8 : design.logoWidth || 36,
                      height: isA5 ? (design.logoHeight || 36) * 0.8 : design.logoHeight || 36,
                      objectFit: 'contain',
                      marginBottom: 3,
                    }}
                  />
                ) : null}
                <Text style={styles.brandNamePrimary}>
                  {design.brandTitle || business.name}
                </Text>
                {design.showBrandSubtitle && (
                  <Text style={{ fontSize: isA5 ? 5.5 : 6.5, color: '#475569', marginTop: 1 }}>
                    {design.brandSubtitle}
                  </Text>
                )}
                <Text style={[styles.businessAddressLine, { textAlign: 'center', marginTop: 2 }]}>
                  {[business.address, business.city, business.state, business.pin].filter(Boolean).join(', ')}
                </Text>
                <Text style={[styles.businessMetaLine, { textAlign: 'center' }]}>
                  {business.phone ? `Phone : ${business.phone}` : ''}
                  {business.phone && business.email ? '  |  ' : ''}
                  {business.email ? `Email : ${business.email}` : ''}
                  {'  |  '}
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>GSTIN: </Text>
                  {business.gstin || '—'}
                </Text>
              </View>
            ) : (
              // Classic Side-by-Side Header
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                {/* Left: Strong Brand Identity */}
                <View style={{ width: '50%', flexDirection: 'row', alignItems: 'center' }}>
                  {design.logoUrl && design.logoPosition !== 'hidden' ? (
                    <Image
                      src={design.logoUrl}
                      style={{
                        width: isA5 ? (design.logoWidth || 36) * 0.8 : design.logoWidth || 36,
                        height: isA5 ? (design.logoHeight || 36) * 0.8 : design.logoHeight || 36,
                        objectFit: 'contain',
                        marginRight: 6,
                      }}
                    />
                  ) : null}
                  <View>
                    <Text style={styles.brandNamePrimary}>
                      {design.brandTitle || business.name}
                    </Text>
                    {design.showBrandSubtitle && (
                      <Text style={{ fontSize: isA5 ? 5.5 : 6.2, color: '#475569', marginTop: 1 }}>
                        {design.brandSubtitle}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Right: Legal Company Details */}
                <View style={{ width: '48%', alignItems: 'flex-end' }}>
                  <Text style={styles.businessLegalName}>{business.name}</Text>
                  {business.address && (
                    <Text style={styles.businessAddressLine}>{business.address}</Text>
                  )}
                  <Text style={styles.businessAddressLine}>
                    {[business.city, business.state, business.pin].filter(Boolean).join(', ')}
                  </Text>
                  {(business.phone || business.email) && (
                    <Text style={styles.businessMetaLine}>
                      {business.phone ? `Phone : ${business.phone}` : ''}
                      {business.phone && business.email ? '  |  ' : ''}
                      {business.email ? `Email : ${business.email}` : ''}
                    </Text>
                  )}
                  <Text style={styles.businessMetaLine}>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>GSTIN: </Text>
                    {business.gstin || '—'}
                    {'  |  '}
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>State: </Text>
                    {business.stateCode ? `${business.stateCode}-${business.state}` : (business.state || '—')}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* 2. TAX INVOICE BANNER & INVOICE META */}
          {design.showTaxInvoiceBanner && (
            <View style={styles.bannerContainer}>
              <View style={styles.bannerTitleBox}>
                <Text style={styles.bannerTitleText}>{design.bannerTitle || 'TAX INVOICE'}</Text>
              </View>
              <View style={styles.bannerMetaBox}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Invoice No. :</Text>
                  <Text style={styles.metaVal}>{invoice.invoiceNumber}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Date :</Text>
                  <Text style={styles.metaVal}>{formatDate(invoice.invoiceDate)}</Text>
                </View>
                {design.showDueDate && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Due Date :</Text>
                    <Text style={styles.metaVal}>{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* 3. PARTIES & INVOICE DETAILS STRIP (CONTINUOUS 3-COLUMN GRID) */}
          <View style={styles.partiesContainer}>
            {/* Col 1: Bill To */}
            <View style={{ width: billToWidth, borderRightWidth: showColDividers ? borderWidthNum : 0, borderRightColor: activeTheme.border }}>
              <View style={styles.colHeaderBar}>
                <Text style={styles.colHeaderText}>Bill To</Text>
              </View>
              <View style={styles.colBody}>
                <Text style={styles.partyName}>{customer?.name || 'Walk-in Customer'}</Text>
                {customer?.address && <Text style={styles.partyLine}>{customer.address}</Text>}
                <Text style={styles.partyLine}>
                  {[customer?.pin, customer?.city].filter(Boolean).join(' ')}
                </Text>
                <Text style={[styles.partyLine, { marginTop: 1 }]}>
                  Contact No. : {customer?.phone || '—'}
                </Text>
                {customer?.gstin && (
                  <Text style={styles.partyLine}>GSTIN: {customer.gstin}</Text>
                )}
                <Text style={styles.partyLine}>
                  State: {customer?.stateCode ? `${customer.stateCode}-${customer.state}` : (customer?.state || '—')}
                </Text>
              </View>
            </View>

            {/* Col 2: Ship To (Optional) */}
            {design.showShipTo && (
              <View style={{ width: shipToWidth, borderRightWidth: showColDividers ? borderWidthNum : 0, borderRightColor: activeTheme.border }}>
                <View style={styles.colHeaderBar}>
                  <Text style={styles.colHeaderText}>Ship To</Text>
                </View>
                <View style={styles.colBody}>
                  <Text style={styles.partyName}>{shippingName}</Text>
                  {shippingAddress ? (
                    <>
                      <Text style={styles.partyLine}>{shippingAddress}</Text>
                      <Text style={styles.partyLine}>
                        {[shippingPin, shippingCity].filter(Boolean).join(' ')}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.partyLine, { fontStyle: 'italic', color: '#94A3B8' }]}>Same as Billed Address</Text>
                  )}
                  <Text style={[styles.partyLine, { marginTop: 1 }]}>
                    Contact No. : {customer?.phone || '—'}
                  </Text>
                  <Text style={styles.partyLine}>
                    State: {shippingStateCode ? `${shippingStateCode}-${shippingState}` : (shippingState || '—')}
                  </Text>
                </View>
              </View>
            )}

            {/* Col 3: Invoice Details */}
            <View style={{ width: detailsWidth }}>
              <View style={styles.colHeaderBar}>
                <Text style={styles.colHeaderText}>Invoice Details</Text>
              </View>
              <View style={styles.colBody}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Place of Supply :</Text>
                  <Text style={styles.infoVal}>
                    {customer?.stateCode ? `${customer.stateCode}-${customer.state}` : (customer?.state || business.state || '—')}
                  </Text>
                </View>
                {design.showTransportInfo && (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Transporter :</Text>
                      <Text style={styles.infoVal}>{invoice.transporterName || 'Self'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>L.R. No. :</Text>
                      <Text style={styles.infoVal}>{invoice.lrRrNumber || '—'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Vehicle No. :</Text>
                      <Text style={styles.infoVal}>{invoice.vehicleNumber || '—'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Mode :</Text>
                      <Text style={styles.infoVal}>{invoice.transportMode || 'Road'}</Text>
                    </View>
                  </>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date of Supply :</Text>
                  <Text style={styles.infoVal}>{formatDate(invoice.invoiceDate)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 4. LINE ITEMS TABLE (DYNAMIC ACTIVE COLUMNS & FULL SEAMLESS DIVIDERS) */}
          <View style={styles.tableContainer}>
            {/* Header Row */}
            <View style={styles.tableHeaderRow}>
              {cols.sr && (
                <View style={[{ width: colWidths.sr }, styles.thCell]}>
                  <Text style={styles.thText}>#</Text>
                </View>
              )}
              {cols.desc && (
                <View style={[{ width: colWidths.desc }, styles.thCell]}>
                  <Text style={[styles.thText, { textAlign: 'left', paddingLeft: 2 }]}>Product Name / Description</Text>
                </View>
              )}
              {cols.hsn && (
                <View style={[{ width: colWidths.hsn }, styles.thCell]}>
                  <Text style={styles.thText}>HSN/SAC</Text>
                </View>
              )}
              {cols.qty && (
                <View style={[{ width: colWidths.qty }, styles.thCell]}>
                  <Text style={styles.thText}>Qty</Text>
                </View>
              )}
              {cols.unit && (
                <View style={[{ width: colWidths.unit }, styles.thCell]}>
                  <Text style={styles.thText}>Unit</Text>
                </View>
              )}
              {cols.price && (
                <View style={[{ width: colWidths.price }, styles.thCell]}>
                  <Text style={[styles.thText, { textAlign: 'right' }]}>Price</Text>
                </View>
              )}
              {cols.taxable && (
                <View style={[{ width: colWidths.taxable }, styles.thCell]}>
                  <Text style={[styles.thText, { textAlign: 'right' }]}>Taxable</Text>
                </View>
              )}
              {cols.gstPct && (
                <View style={[{ width: colWidths.gstPct }, styles.thCell]}>
                  <Text style={styles.thText}>GST %</Text>
                </View>
              )}
              {cols.gstAmt && (
                <View style={[{ width: colWidths.gstAmt }, styles.thCell]}>
                  <Text style={[styles.thText, { textAlign: 'right' }]}>GST Amt</Text>
                </View>
              )}
              {cols.totalAmt && (
                <View style={[{ width: colWidths.totalAmt }, styles.thCell, { borderRightWidth: 0 }]}>
                  <Text style={[styles.thText, { textAlign: 'right' }]}>Total (Rs.)</Text>
                </View>
              )}
            </View>

            {/* Line Item Rows */}
            {invoice.items.map((item, idx) => {
              const qtyNum = item.quantity / 100
              const itemGst = item.cgstAmount + item.sgstAmount + item.igstAmount
              const taxablePerUnit = qtyNum > 0 ? (item.taxableAmount / qtyNum) : item.unitPrice
              const isZebra = idx % 2 === 1 && design.zebraStriping

              return (
                <View
                  key={item.id || idx}
                  style={[
                    styles.tableRow,
                    isZebra ? { backgroundColor: '#F8FAFC' } : { backgroundColor: '#ffffff' },
                  ]}
                >
                  {cols.sr && (
                    <View style={[{ width: colWidths.sr }, styles.tdCell]}>
                      <Text style={[styles.tdText, { textAlign: 'center' }]}>{idx + 1}</Text>
                    </View>
                  )}
                  {cols.desc && (
                    <View style={[{ width: colWidths.desc }, styles.tdCell]}>
                      <Text style={styles.tdTextBold}>{item.description}</Text>
                    </View>
                  )}
                  {cols.hsn && (
                    <View style={[{ width: colWidths.hsn }, styles.tdCell]}>
                      <Text style={[styles.tdText, { textAlign: 'center' }]}>{item.hsnCode || '—'}</Text>
                    </View>
                  )}
                  {cols.qty && (
                    <View style={[{ width: colWidths.qty }, styles.tdCell]}>
                      <Text style={[styles.tdText, { textAlign: 'center' }]}>
                        {qtyNum % 1 === 0 ? qtyNum.toFixed(0) : qtyNum.toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {cols.unit && (
                    <View style={[{ width: colWidths.unit }, styles.tdCell]}>
                      <Text style={[styles.tdText, { textAlign: 'center' }]}>{item.unit || 'Nos'}</Text>
                    </View>
                  )}
                  {cols.price && (
                    <View style={[{ width: colWidths.price }, styles.tdCell]}>
                      <Text style={[styles.tdText, { textAlign: 'right' }]}>
                        {formatPDFCurrency(item.unitPrice, '')}
                      </Text>
                    </View>
                  )}
                  {cols.taxable && (
                    <View style={[{ width: colWidths.taxable }, styles.tdCell]}>
                      <Text style={[styles.tdText, { textAlign: 'right' }]}>
                        {formatPDFCurrency(taxablePerUnit, '')}
                      </Text>
                    </View>
                  )}
                  {cols.gstPct && (
                    <View style={[{ width: colWidths.gstPct }, styles.tdCell]}>
                      <Text style={[styles.tdText, { textAlign: 'center' }]}>
                        {(item.taxRate / 100).toFixed(0)}%
                      </Text>
                    </View>
                  )}
                  {cols.gstAmt && (
                    <View style={[{ width: colWidths.gstAmt }, styles.tdCell]}>
                      <Text style={[styles.tdText, { textAlign: 'right' }]}>
                        {formatPDFCurrency(itemGst, '')}
                      </Text>
                    </View>
                  )}
                  {cols.totalAmt && (
                    <View style={[{ width: colWidths.totalAmt }, styles.tdCell, { borderRightWidth: 0 }]}>
                      <Text style={[styles.tdTextBold, { textAlign: 'right' }]}>
                        {formatPDFCurrency(item.totalAmount, '')}
                      </Text>
                    </View>
                  )}
                </View>
              )
            })}

            {/* Blank Padding Rows for Full Bill Layout & In-Hand Quality */}
            {(() => {
              const minTableRows = typeof design.minTableRows === 'number' ? design.minTableRows : 8
              const blankRowsCount = Math.max(0, minTableRows - invoice.items.length)
              const blankRowHeight = (isA5 ? 15 : 20) * fontScaleMult

              return Array.from({ length: blankRowsCount }).map((_, bIdx) => {
                const isZebra = (invoice.items.length + bIdx) % 2 === 1 && design.zebraStriping
                return (
                  <View
                    key={`blank-row-${bIdx}`}
                    style={[
                      styles.tableRow,
                      { minHeight: blankRowHeight },
                      isZebra ? { backgroundColor: '#F8FAFC' } : { backgroundColor: '#ffffff' },
                    ]}
                  >
                    {cols.sr && (
                      <View style={[{ width: colWidths.sr }, styles.tdCell]}>
                        <Text style={[styles.tdText, { opacity: 0 }]}> </Text>
                      </View>
                    )}
                    {cols.desc && (
                      <View style={[{ width: colWidths.desc }, styles.tdCell]}>
                        <Text style={[styles.tdText, { opacity: 0 }]}> </Text>
                      </View>
                    )}
                    {cols.hsn && (
                      <View style={[{ width: colWidths.hsn }, styles.tdCell]}>
                        <Text style={[styles.tdText, { opacity: 0 }]}> </Text>
                      </View>
                    )}
                    {cols.qty && (
                      <View style={[{ width: colWidths.qty }, styles.tdCell]}>
                        <Text style={[styles.tdText, { opacity: 0 }]}> </Text>
                      </View>
                    )}
                    {cols.unit && (
                      <View style={[{ width: colWidths.unit }, styles.tdCell]}>
                        <Text style={[styles.tdText, { opacity: 0 }]}> </Text>
                      </View>
                    )}
                    {cols.price && (
                      <View style={[{ width: colWidths.price }, styles.tdCell]}>
                        <Text style={[styles.tdText, { opacity: 0 }]}> </Text>
                      </View>
                    )}
                    {cols.taxable && (
                      <View style={[{ width: colWidths.taxable }, styles.tdCell]}>
                        <Text style={[styles.tdText, { opacity: 0 }]}> </Text>
                      </View>
                    )}
                    {cols.gstPct && (
                      <View style={[{ width: colWidths.gstPct }, styles.tdCell]}>
                        <Text style={[styles.tdText, { opacity: 0 }]}> </Text>
                      </View>
                    )}
                    {cols.gstAmt && (
                      <View style={[{ width: colWidths.gstAmt }, styles.tdCell]}>
                        <Text style={[styles.tdText, { opacity: 0 }]}> </Text>
                      </View>
                    )}
                    {cols.totalAmt && (
                      <View style={[{ width: colWidths.totalAmt }, styles.tdCell, { borderRightWidth: 0 }]}>
                        <Text style={[styles.tdText, { opacity: 0 }]}> </Text>
                      </View>
                    )}
                  </View>
                )
              })
            })()}

            {/* Total Row */}
            <View style={styles.totalRow}>
              {/* Calculate leading span width before qty */}
              {(() => {
                let leadingWidthPct = 0
                if (cols.sr) leadingWidthPct += parseFloat(colWidths.sr)
                if (cols.desc) leadingWidthPct += parseFloat(colWidths.desc)
                if (cols.hsn) leadingWidthPct += parseFloat(colWidths.hsn)
                return (
                  <View style={[{ width: `${leadingWidthPct.toFixed(2)}%`, paddingLeft: 4 }, styles.tdCell]}>
                    <Text style={{ fontSize: (isA5 ? 7.2 : 9.0) * fontScaleMult, fontFamily: 'Helvetica-Bold', color: activeTheme.textDark }}>
                      Total
                    </Text>
                  </View>
                )
              })()}
              {cols.qty && (
                <View style={[{ width: colWidths.qty }, styles.tdCell]}>
                  <Text style={[styles.tdTextBold, { textAlign: 'center' }]}>
                    {totalQuantity % 1 === 0 ? totalQuantity.toFixed(0) : totalQuantity.toFixed(2)}
                  </Text>
                </View>
              )}
              {/* Mid empty span if unit/price/taxable/gstPct visible */}
              {(() => {
                let midWidthPct = 0
                if (cols.unit) midWidthPct += parseFloat(colWidths.unit)
                if (cols.price) midWidthPct += parseFloat(colWidths.price)
                if (cols.taxable) midWidthPct += parseFloat(colWidths.taxable)
                if (cols.gstPct) midWidthPct += parseFloat(colWidths.gstPct)
                if (midWidthPct > 0) {
                  return <View style={[{ width: `${midWidthPct.toFixed(2)}%` }, styles.tdCell]} />
                }
                return null
              })()}
              {cols.gstAmt && (
                <View style={[{ width: colWidths.gstAmt }, styles.tdCell]}>
                  <Text style={[styles.tdTextBold, { textAlign: 'right' }]}>
                    {formatPDFCurrency(totalTaxAmount, '')}
                  </Text>
                </View>
              )}
              {cols.totalAmt && (
                <View style={[{ width: colWidths.totalAmt }, styles.tdCell, { borderRightWidth: 0 }]}>
                  <Text style={[styles.tdTextBold, { textAlign: 'right' }]}>
                    {formatPDFCurrency(invoice.totalAmount, '')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* 5. MIDDLE SECTION: AMOUNT IN WORDS & AMOUNTS (ZERO GAPS) */}
          <View style={styles.middleSection}>
            {/* Left: Amount in Words */}
            {design.showAmountInWords && (
              <View style={styles.wordsContainer}>
                <View style={styles.colHeaderBar}>
                  <Text style={styles.colHeaderText}>Amount in Words</Text>
                </View>
                <View style={styles.wordsBody}>
                  <Text style={styles.wordsText}>{paiseToWords(invoice.totalAmount)}</Text>
                </View>
              </View>
            )}

            {/* Right: Amounts Summary */}
            <View style={styles.amountsContainer}>
              <View style={styles.colHeaderBar}>
                <Text style={styles.colHeaderText}>Amounts</Text>
              </View>
              <View style={styles.amountsBody}>
                <View style={styles.amountLine}>
                  <Text style={{ width: '54%', fontSize: amountRowFontSize, color: '#475569' }}>Sub Total</Text>
                  <Text style={{ width: '46%', textAlign: 'right', fontSize: amountRowFontSize, color: activeTheme.textDark }}>{formatPDFCurrency(invoice.subtotal)}</Text>
                </View>
                {invoice.discountAmount > 0 && (
                  <View style={styles.amountLine}>
                    <Text style={{ width: '54%', fontSize: amountRowFontSize, color: '#475569' }}>Discount</Text>
                    <Text style={{ width: '46%', textAlign: 'right', fontSize: amountRowFontSize, color: '#DC2626' }}>
                      - {formatPDFCurrency(invoice.discountAmount)}
                    </Text>
                  </View>
                )}
                {Number(invoice.shippingCharges || 0) > 0 && (
                  <View style={styles.amountLine}>
                    <Text style={{ width: '54%', fontSize: amountRowFontSize, color: '#475569' }}>Freight / Transportation</Text>
                    <Text style={{ width: '46%', textAlign: 'right', fontSize: amountRowFontSize, color: activeTheme.textDark }}>+ {formatPDFCurrency(invoice.shippingCharges)}</Text>
                  </View>
                )}
                {Number(invoice.additionalCharges || 0) !== 0 && (
                  <View style={styles.amountLine}>
                    <Text style={{ width: '54%', fontSize: amountRowFontSize, color: '#475569' }}>{invoice.additionalChargesLabel || 'Other Charges'}</Text>
                    <Text style={{ width: '46%', textAlign: 'right', fontSize: amountRowFontSize, color: activeTheme.textDark }}>
                      {invoice.additionalCharges > 0 ? '+ ' : ''}{formatPDFCurrency(invoice.additionalCharges)}
                    </Text>
                  </View>
                )}
                {invoice.roundOff !== 0 && (
                  <View style={styles.amountLine}>
                    <Text style={{ width: '54%', fontSize: amountRowFontSize, color: '#475569' }}>Round Off</Text>
                    <Text style={{ width: '46%', textAlign: 'right', fontSize: amountRowFontSize, color: activeTheme.textDark }}>{formatPDFCurrency(invoice.roundOff)}</Text>
                  </View>
                )}
                <View style={styles.amountLineTotal}>
                  <Text style={{ width: '54%', fontSize: amountTotalFontSize, fontFamily: 'Helvetica-Bold', color: activeTheme.textDark }}>Total</Text>
                  <Text style={{ width: '46%', textAlign: 'right', fontSize: amountTotalFontSize, fontFamily: 'Helvetica-Bold', color: activeTheme.textDark }}>{formatPDFCurrency(invoice.totalAmount)}</Text>
                </View>
                <View style={styles.amountLine}>
                  <Text style={{ width: '54%', fontSize: amountRowFontSize, color: '#475569' }}>Received</Text>
                  <Text style={{ width: '46%', textAlign: 'right', fontSize: amountRowFontSize, color: activeTheme.textDark }}>{formatPDFCurrency(paid)}</Text>
                </View>
                <View style={[styles.amountLine, { borderBottomWidth: 0 }]}>
                  <Text style={{ width: '54%', fontSize: amountRowFontSize, fontFamily: 'Helvetica-Bold', color: activeTheme.textDark }}>Balance</Text>
                  <Text style={{ width: '46%', textAlign: 'right', fontSize: amountRowFontSize, fontFamily: 'Helvetica-Bold', color: activeTheme.textDark }}>{formatPDFCurrency(balance)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 6. GST BREAKDOWN TABLE (OPTIONAL) */}
          {design.showGstSummaryTable && (
            <View style={styles.taxSummaryContainer}>
              <View style={styles.taxSummaryHeader}>
                <View style={[{ width: '28%' }, styles.taxCellHeader]}>
                  <Text style={styles.colHeaderText}>Tax Type</Text>
                </View>
                <View style={[{ width: '28%' }, styles.taxCellHeader]}>
                  <Text style={[styles.colHeaderText, { textAlign: 'right' }]}>Taxable Amount</Text>
                </View>
                <View style={[{ width: '18%' }, styles.taxCellHeader]}>
                  <Text style={[styles.colHeaderText, { textAlign: 'center' }]}>Rate</Text>
                </View>
                <View style={[{ width: '26%' }, styles.taxCellHeader, { borderRightWidth: 0 }]}>
                  <Text style={[styles.colHeaderText, { textAlign: 'right' }]}>Tax Amount</Text>
                </View>
              </View>
              {!isInterstate ? (
                <>
                  <View style={styles.taxSummaryRow}>
                    <View style={[{ width: '28%' }, styles.taxCell]}>
                      <Text style={styles.tdTextBold}>SGST</Text>
                    </View>
                    <View style={[{ width: '28%' }, styles.taxCell]}>
                      <Text style={[styles.tdText, { textAlign: 'right' }]}>{formatPDFCurrency(invoice.taxableAmount)}</Text>
                    </View>
                    <View style={[{ width: '18%' }, styles.taxCell]}>
                      <Text style={[styles.tdText, { textAlign: 'center' }]}>{halfRatePct}</Text>
                    </View>
                    <View style={[{ width: '26%' }, styles.taxCell, { borderRightWidth: 0 }]}>
                      <Text style={[styles.tdText, { textAlign: 'right' }]}>{formatPDFCurrency(invoice.sgstAmount)}</Text>
                    </View>
                  </View>
                  <View style={[styles.taxSummaryRow, { borderBottomWidth: 0 }]}>
                    <View style={[{ width: '28%' }, styles.taxCell]}>
                      <Text style={styles.tdTextBold}>CGST</Text>
                    </View>
                    <View style={[{ width: '28%' }, styles.taxCell]}>
                      <Text style={[styles.tdText, { textAlign: 'right' }]}>{formatPDFCurrency(invoice.taxableAmount)}</Text>
                    </View>
                    <View style={[{ width: '18%' }, styles.taxCell]}>
                      <Text style={[styles.tdText, { textAlign: 'center' }]}>{halfRatePct}</Text>
                    </View>
                    <View style={[{ width: '26%' }, styles.taxCell, { borderRightWidth: 0 }]}>
                      <Text style={[styles.tdText, { textAlign: 'right' }]}>{formatPDFCurrency(invoice.cgstAmount)}</Text>
                    </View>
                  </View>
                </>
              ) : (
                <View style={[styles.taxSummaryRow, { borderBottomWidth: 0 }]}>
                  <View style={[{ width: '28%' }, styles.taxCell]}>
                    <Text style={styles.tdTextBold}>IGST</Text>
                  </View>
                  <View style={[{ width: '28%' }, styles.taxCell]}>
                    <Text style={[styles.tdText, { textAlign: 'right' }]}>{formatPDFCurrency(invoice.taxableAmount)}</Text>
                  </View>
                  <View style={[{ width: '18%' }, styles.taxCell]}>
                    <Text style={[styles.tdText, { textAlign: 'center' }]}>{fullRatePct}</Text>
                  </View>
                  <View style={[{ width: '26%' }, styles.taxCell, { borderRightWidth: 0 }]}>
                    <Text style={[styles.tdText, { textAlign: 'right' }]}>{formatPDFCurrency(invoice.igstAmount)}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* 7. FOOTER: BANK DETAILS, TERMS, AUTHORIZED SIGNATORY (CONTINUOUS GRID) */}
          {footerColCount > 0 && (
            <View style={styles.footerContainer}>
              {/* Col 1: Bank Details */}
              {hasBank && (
                <View style={{ width: bankColWidth, borderRightWidth: (hasTerms || hasSign) && showColDividers ? borderWidthNum : 0, borderRightColor: activeTheme.border }}>
                  <View style={styles.colHeaderBar}>
                    <Text style={styles.colHeaderText}>Bank Details</Text>
                  </View>
                  <View style={styles.bankBody}>
                    {/* Strict QR check: only render when showQrCode is true */}
                    {design.showQrCode && (design.customQrUrl || upiQrCodeUrl) && (
                      <View style={styles.qrWrapper}>
                        <Image
                          src={design.customQrUrl || upiQrCodeUrl}
                          style={{
                            width: isA5 ? (design.qrCodeSize || 46) * 0.8 : (design.qrCodeSize || 46),
                            height: isA5 ? (design.qrCodeSize || 46) * 0.8 : (design.qrCodeSize || 46),
                            objectFit: 'contain',
                          }}
                        />
                        {design.showUpiBadge && (
                          <View style={styles.upiPillBadge}>
                            <Text style={styles.upiPillText}>UPI SCAN TO PAY</Text>
                          </View>
                        )}
                      </View>
                    )}
                    <View style={styles.bankTextCol}>
                      <Text style={styles.bankDetailRow}>
                        <Text style={{ fontFamily: 'Helvetica-Bold' }}>Name : </Text>
                        {design.customAccountHolder || business.name}
                      </Text>
                      <Text style={styles.bankDetailRow}>
                        <Text style={{ fontFamily: 'Helvetica-Bold' }}>Account No. : </Text>
                        {design.customAccountNumber || business.accountNumber || '—'}
                      </Text>
                      <Text style={styles.bankDetailRow}>
                        <Text style={{ fontFamily: 'Helvetica-Bold' }}>IFSC code : </Text>
                        {design.customIfsc || business.ifsc || '—'}
                      </Text>
                      <Text style={styles.bankDetailRow}>
                        <Text style={{ fontFamily: 'Helvetica-Bold' }}>Bank : </Text>
                        {design.customBankName || business.bankName || '—'}
                      </Text>
                      <Text style={styles.bankDetailRow}>
                        <Text style={{ fontFamily: 'Helvetica-Bold' }}>Account holder's name : </Text>
                      </Text>
                      <Text style={[styles.bankDetailRow, { color: '#475569' }]}>
                        {design.customAccountHolder || business.name}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Col 2: Terms and Conditions */}
              {hasTerms && (
                <View style={{ width: termsColWidth, borderRightWidth: hasSign && showColDividers ? borderWidthNum : 0, borderRightColor: activeTheme.border }}>
                  <View style={styles.colHeaderBar}>
                    <Text style={styles.colHeaderText}>Terms and Conditions</Text>
                  </View>
                  <View style={styles.termsBody}>
                    {termsLines.map((termLine: string, tIdx: number) => (
                      <Text
                        key={tIdx}
                        style={[
                          styles.termsItem,
                          { fontSize: isA5 ? (design.termsFontSize || 6) * 0.85 : design.termsFontSize || 6 },
                        ]}
                      >
                        {termLine}
                      </Text>
                    ))}
                    {design.jurisdictionCity ? (
                      <Text
                        style={[
                          styles.termsItem,
                          {
                            fontSize: isA5 ? (design.termsFontSize || 6) * 0.85 : design.termsFontSize || 6,
                            fontFamily: 'Helvetica-Bold',
                          },
                        ]}
                      >
                        Subject to {design.jurisdictionCity} jurisdiction only.
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Col 3: Authorized Signatory */}
              {hasSign && (
                <View style={{ width: signColWidth }}>
                  <View style={styles.signatoryBody}>
                    <Text style={styles.signatoryFor}>
                      {design.signatoryForText || `For ${business.name}`}
                    </Text>
                    <View style={[styles.signatureGraphic, { height: isExtremeVMargin ? 13 : isLargeVMargin ? 16 : 20 }]}>
                      {design.signatureStyle === 'uploaded' && design.uploadedSignatureUrl ? (
                        <Image
                          src={design.uploadedSignatureUrl}
                          style={{ height: isExtremeVMargin ? 13 : isLargeVMargin ? 16 : 20, width: 80, objectFit: 'contain' }}
                        />
                      ) : design.signatureStyle === 'blank_line' ? null : (
                        <Svg width={80} height={isExtremeVMargin ? 13 : isLargeVMargin ? 16 : 20} viewBox="0 0 200 60">
                          <Path
                            d="M 20 45 Q 45 10 65 40 T 95 28 Q 120 5 145 35 T 175 30 M 35 42 Q 75 52 155 42"
                            fill="none"
                            stroke={activeTheme.primary}
                            strokeWidth="2.5"
                          />
                        </Svg>
                      )}
                    </View>
                    <View style={styles.signatureLine}>
                      <Text style={styles.signatoryLabel}>
                        {design.signatoryLabel || 'Authorized Signatory'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

        </View>
      </Page>
    </Document>
  )
}
