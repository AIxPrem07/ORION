import type { InvoiceTheme, InvoicePaperSize } from './business'
export type { InvoiceTheme, InvoicePaperSize }

export type HeaderLayoutStyle = 'classic' | 'centered' | 'split' | 'minimal'
export type HeaderHeightStyle = 'compact' | 'normal' | 'tall'
export type LogoPositionStyle = 'left' | 'center' | 'right' | 'hidden'
export type LogoShapeStyle = 'square' | 'rounded' | 'circle'
export type TableDensityStyle = 'compact' | 'normal' | 'spacious'
export type BorderGridStyle = 'solid' | 'framed' | 'minimal'
export type ProductLinesModeStyle = 'all' | 'clean_box' | 'none'
export type BottomBlocksLayout = 'standard' | 'stacked' | 'terms_left'
export type SignatureStyle = 'digital_wave' | 'uploaded' | 'blank_line'

export interface ColumnVisibilityMap {
  sr: boolean
  desc: boolean
  hsn: boolean
  qty: boolean
  unit: boolean
  price: boolean
  taxable: boolean
  gstPct: boolean
  gstAmt: boolean
  totalAmt: boolean
}

export type PageAlignmentStyle = 'center' | 'left' | 'right'
export type FontScaleStyle = 'normal' | 'large' | 'xlarge'

export interface InvoiceCustomDesign {
  // 1. Grid & Lines
  showColumnDividers: boolean
  showRowDividers: boolean
  productLinesMode?: ProductLinesModeStyle // 'all' (solid lines) | 'clean_box' (no inner row lines in products) | 'none' (borderless list)
  borderWidth: number          // in pt/px (0.5, 1, 1.5, 2)
  borderStyle: BorderGridStyle
  tableDensity: TableDensityStyle
  zebraStriping: boolean
  columnsVisibility: ColumnVisibilityMap
  unifiedGrid: boolean         // Continuous seamless unbroken frame (zero cuts/gaps)
  minTableRows: number         // 0 to 15 (default 8: pads single-product invoices with blank rows & column grid lines)
  fontScale: FontScaleStyle    // 'normal' | 'large' | 'xlarge' (adjusts overall print text size for maximum readability)

  // 2. Header & Brand Logo
  headerLayout: HeaderLayoutStyle
  headerHeight: HeaderHeightStyle
  brandFontSize: number        // 14 to 36 (default 22 for strong & big brand)
  brandTitle: string           // If non-empty, overrides business name in brand heading
  showBrandSubtitle: boolean
  brandSubtitle: string
  logoUrl: string | null       // Base64 or image URL (only renders when explicitly uploaded)
  logoWidth: number            // 24 to 120
  logoHeight: number           // 24 to 120
  logoPosition: LogoPositionStyle
  logoShape: LogoShapeStyle

  // 3. Tax Invoice Banner
  showTaxInvoiceBanner: boolean
  bannerTitle: string          // Default: "TAX INVOICE"
  showDueDate: boolean

  // 4. Section Visibility & Layouts
  showShipTo: boolean
  showTransportInfo: boolean
  showAmountInWords: boolean
  showGstSummaryTable: boolean
  showBankDetails: boolean
  showTermsConditions: boolean
  showSignatureBlock: boolean
  bottomBlocksLayout: BottomBlocksLayout

  // 5. QR Code & Bank
  showQrCode: boolean
  qrCodeType: 'upi' | 'custom'
  qrCodeSize: number           // 30 to 90
  customQrUrl: string | null
  showUpiBadge: boolean
  customBankName: string
  customAccountNumber: string
  customIfsc: string
  customAccountHolder: string

  // 6. Terms & Conditions
  customTermsText: string
  termsFontSize: number        // 5 to 10
  jurisdictionCity: string

  // 7. Signature
  signatoryForText: string
  signatoryLabel: string
  signatureStyle: SignatureStyle
  uploadedSignatureUrl: string | null

  // 8. Colors & Palette
  themePreset: InvoiceTheme | 'CUSTOM'
  primaryColor: string
  bannerBgColor: string
  textDarkColor: string
  gridBorderColor: string
  totalRowBgColor: string

  // 9. Margins & Page Positioning (in mm)
  marginTop: number            // 0 to 50 mm
  marginBottom: number         // 0 to 50 mm
  marginLeft: number           // 0 to 40 mm
  marginRight: number          // 0 to 40 mm
  pageAlignment: PageAlignmentStyle // 'center' | 'left' | 'right'
}

export const DEFAULT_TERMS_TEXT = `1. Goods once sold will not be taken back or exchanged.
2. Please make payment within the due date mentioned above.
3. Interest @ 18% p.a. will be charged on delayed payments.
4. All disputes are subject to local jurisdiction only.`

export const DEFAULT_COLUMNS_VISIBILITY: ColumnVisibilityMap = {
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
}

export const DEFAULT_INVOICE_DESIGN: InvoiceCustomDesign = {
  // Grid & Lines
  showColumnDividers: true,
  showRowDividers: true,
  productLinesMode: 'all',
  borderWidth: 1,
  borderStyle: 'solid',
  tableDensity: 'normal',
  zebraStriping: false,
  columnsVisibility: DEFAULT_COLUMNS_VISIBILITY,
  unifiedGrid: true, // Continuous unbroken frame with zero cuts/gaps
  minTableRows: 8, // Pads single product bills with 7 empty rows and full column grid lines
  fontScale: 'normal',

  // Header & Logo (Brand name strong and big, no pre-added placeholder logo)
  headerLayout: 'classic',
  headerHeight: 'normal',
  brandFontSize: 24,
  brandTitle: '',
  showBrandSubtitle: false,
  brandSubtitle: 'Statutory GST Tax Invoice',
  logoUrl: null, // No pre-added logo by default
  logoWidth: 36,
  logoHeight: 36,
  logoPosition: 'left',
  logoShape: 'rounded',

  // Banner
  showTaxInvoiceBanner: true,
  bannerTitle: 'TAX INVOICE',
  showDueDate: true,

  // Sections
  showShipTo: true,
  showTransportInfo: true,
  showAmountInWords: true,
  showGstSummaryTable: true,
  showBankDetails: true,
  showTermsConditions: true,
  showSignatureBlock: true,
  bottomBlocksLayout: 'standard',

  // QR Code & Bank
  showQrCode: true,
  qrCodeType: 'upi',
  qrCodeSize: 46,
  customQrUrl: null,
  showUpiBadge: true,
  customBankName: '',
  customAccountNumber: '',
  customIfsc: '',
  customAccountHolder: '',

  // Terms
  customTermsText: DEFAULT_TERMS_TEXT,
  termsFontSize: 8,
  jurisdictionCity: '',

  // Signature
  signatoryForText: '',
  signatoryLabel: 'Authorized Signatory',
  signatureStyle: 'digital_wave',
  uploadedSignatureUrl: null,

  // Theme & Colors - Crisp, high-contrast, solid dark borders
  themePreset: 'SLATE_BLUE',
  primaryColor: '#1E3A5F',
  bannerBgColor: '#EEF4FA',
  textDarkColor: '#0F172A',
  gridBorderColor: '#1E293B',
  totalRowBgColor: '#F1F5F9',

  // Margins & Page Positioning (in mm)
  marginTop: 8,
  marginBottom: 8,
  marginLeft: 8,
  marginRight: 8,
  pageAlignment: 'center',
}

export interface InvoiceDesignPreset {
  id: string
  name: string
  description: string
  design: Partial<InvoiceCustomDesign>
}

export const INVOICE_DESIGN_PRESETS: InvoiceDesignPreset[] = [
  {
    id: 'statutory_default',
    name: 'Statutory GST Standard',
    description: 'Clean full-border grid with complete GST breakdown and 3-column party strips.',
    design: {
      ...DEFAULT_INVOICE_DESIGN,
      themePreset: 'SLATE_BLUE',
      primaryColor: '#416788',
      bannerBgColor: '#EEF4FA',
      textDarkColor: '#1E3A5F',
      gridBorderColor: '#94A3B8',
      totalRowBgColor: '#F1F5F9',
    },
  },
  {
    id: 'classic_navy',
    name: 'Executive Classic Navy',
    description: 'Deep navy professional corporate theme with crisp contrast borders.',
    design: {
      ...DEFAULT_INVOICE_DESIGN,
      themePreset: 'CLASSIC_NAVY',
      primaryColor: '#1E3A5F',
      bannerBgColor: '#E9F0F8',
      textDarkColor: '#1E3A5F',
      gridBorderColor: '#94A3B8',
      totalRowBgColor: '#F1F5F9',
      borderWidth: 1,
    },
  },
  {
    id: 'emerald_green',
    name: 'Emerald Forest Clean',
    description: 'Fresh emerald accenting with green borders and crisp summary styling.',
    design: {
      ...DEFAULT_INVOICE_DESIGN,
      themePreset: 'EMERALD',
      primaryColor: '#047857',
      bannerBgColor: '#ECFDF5',
      textDarkColor: '#064E3B',
      gridBorderColor: '#10B981',
      totalRowBgColor: '#F0FDF4',
    },
  },
  {
    id: 'monochrome_minimal',
    name: 'Monochrome B&W High-Contrast',
    description: 'High contrast black & white design optimized for thermal printing and fax.',
    design: {
      ...DEFAULT_INVOICE_DESIGN,
      themePreset: 'MONOCHROME',
      primaryColor: '#18191B',
      bannerBgColor: '#F3F4F6',
      textDarkColor: '#111827',
      gridBorderColor: '#6B7280',
      totalRowBgColor: '#F3F4F6',
    },
  },
  {
    id: 'centered_modern',
    name: 'Centered Modern Studio',
    description: 'Centered prominent brand title with spacious rows and soft zebra striping.',
    design: {
      ...DEFAULT_INVOICE_DESIGN,
      headerLayout: 'centered',
      brandFontSize: 20,
      tableDensity: 'spacious',
      zebraStriping: true,
      borderWidth: 1,
      themePreset: 'SLATE_BLUE',
      primaryColor: '#3B82F6',
      bannerBgColor: '#EFF6FF',
      textDarkColor: '#1E3A8A',
      gridBorderColor: '#93C5FD',
      totalRowBgColor: '#F0F9FF',
    },
  },
  {
    id: 'wholesale_logistics',
    name: 'Wholesale & Logistics',
    description: 'Emphasizes vehicle and transport details with compact dense grid for high item counts.',
    design: {
      ...DEFAULT_INVOICE_DESIGN,
      tableDensity: 'compact',
      showTransportInfo: true,
      showShipTo: true,
      borderWidth: 1,
      themePreset: 'CLASSIC_NAVY',
      primaryColor: '#0F172A',
      bannerBgColor: '#F1F5F9',
      textDarkColor: '#0F172A',
      gridBorderColor: '#64748B',
      totalRowBgColor: '#E2E8F0',
    },
  },
]

/**
 * Calculates exact proportional percentage widths for active columns.
 * Guaranteed to sum to 100% across visible columns in both HTML canvas and PDF.
 */
export function calculateColumnWidths(cols: ColumnVisibilityMap): Record<keyof ColumnVisibilityMap, string> {
  const baseWeights: Record<keyof ColumnVisibilityMap, number> = {
    sr: 4,
    desc: 26,
    hsn: 9,
    qty: 7,
    unit: 6,
    price: 11,
    taxable: 11,
    gstPct: 7,
    gstAmt: 8,
    totalAmt: 11,
  }
  let totalWeight = 0
  for (const k of Object.keys(baseWeights) as (keyof ColumnVisibilityMap)[]) {
    if (cols[k]) totalWeight += baseWeights[k]
  }
  if (totalWeight <= 0) totalWeight = 100

  const result = {} as Record<keyof ColumnVisibilityMap, string>
  for (const k of Object.keys(baseWeights) as (keyof ColumnVisibilityMap)[]) {
    if (cols[k]) {
      const pct = ((baseWeights[k] / totalWeight) * 100).toFixed(2)
      result[k] = `${pct}%`
    } else {
      result[k] = '0%'
    }
  }
  return result
}
