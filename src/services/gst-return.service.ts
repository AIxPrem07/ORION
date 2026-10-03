/**
 * ORION Statutory GST Returns & Tax Filing Service
 * 
 * Supports:
 * - GSTR-1: Outward Supplies Statement
 *   - Table 4: B2B Invoices (Registered Recipients with GSTIN)
 *   - Table 5: B2CL Large Invoices (Unregistered Interstate > ₹2.5L / ₹1.0L)
 *   - Table 7: B2CS Small Supplies (All other retail consumers)
 *   - Table 9B: CDNR (Credit / Debit Notes to Registered Recipients)
 *   - Table 12: HSN Summary of Outward Supplies (HSN, UQC, Qty, Value, Tax)
 *   - Table 13: Documents Issued Summary (Serial From, To, Total, Cancelled, Net)
 * 
 * - GSTR-3B: Monthly Summary Return & Tax Settlement
 *   - Table 3.1: Details of Outward Supplies and Inward Supplies liable to Reverse Charge
 *   - Table 3.2: Interstate supplies to Unregistered persons, Composition, UIN
 *   - Table 4: Eligible Input Tax Credit (ITC from Purchases)
 *   - Table 5.1 / Tax Offset: Net Tax Payable to Government
 * 
 * - Government GST Portal Compliant Exports:
 *   - Official GSTR-1 JSON Schema (Direct upload on gst.gov.in offline utility)
 *   - C.A. Excel / CSV Multi-table bundle
 *   - GSTR-3B Summary CSV & PDF audit reports
 */

import { dbSelect } from '@db/client'
import { paiseToRupees } from '@utils/decimal'
import { generateCSV } from './import-export.service'
import { GST_STATES_MAP, stateCodeFromGSTIN } from '@utils/gst-states'
import type { Business } from '@/types/business'
import type { InvoiceWithItems, InvoiceItem, Invoice } from '@/types/invoice'
import type { Purchase } from '@/types/purchase'
import type { CreditNote, DebitNote } from '@/types/returns'
import type {
  GSTR1B2BInvoice,
  GSTR1B2CLInvoice,
  GSTR1B2CSSupply,
  GSTR1CDNRNote,
  GSTR1HSNSummary,
  GSTR1DocSummary,
  GSTR1Data,
  GSTR3BTable31,
  GSTR3BTable32,
  GSTR3BTable4ITC,
  GSTR3BTaxPayable,
  GSTR3BData,
  GSTReturnPeriod,
} from '@/types/gst-return'

// ============================================================================
// UQC & PLACE OF SUPPLY HELPERS
// ============================================================================

export const UQC_MAP: Record<string, string> = {
  pcs: 'PCS-PIECES',
  piece: 'PCS-PIECES',
  pieces: 'PCS-PIECES',
  nos: 'NOS-NUMBERS',
  number: 'NOS-NUMBERS',
  numbers: 'NOS-NUMBERS',
  kg: 'KGS-KILOGRAMS',
  kgs: 'KGS-KILOGRAMS',
  g: 'GMS-GRAMS',
  gm: 'GMS-GRAMS',
  gms: 'GMS-GRAMS',
  gram: 'GMS-GRAMS',
  grams: 'GMS-GRAMS',
  ltr: 'LTR-LITRES',
  litre: 'LTR-LITRES',
  litres: 'LTR-LITRES',
  box: 'BOX-BOX',
  boxes: 'BOX-BOX',
  mtr: 'MTR-METRES',
  meter: 'MTR-METRES',
  meters: 'MTR-METRES',
  doz: 'DOZ-DOZENS',
  dozen: 'DOZ-DOZENS',
  set: 'SET-SETS',
  sets: 'SET-SETS',
  pac: 'PAC-PACKS',
  pack: 'PAC-PACKS',
  packs: 'PAC-PACKS',
  sqm: 'SQM-SQUARE METRES',
  unt: 'UNT-UNITS',
  unit: 'UNT-UNITS',
  units: 'UNT-UNITS',
}

export function resolveUQC(unit?: string | null): string {
  if (!unit) return 'OTH-OTHERS'
  const clean = unit.trim().toLowerCase()
  return UQC_MAP[clean] || 'OTH-OTHERS'
}

export function resolvePOS(customerStateCode: string | null | undefined, gstin: string | null | undefined, businessStateCode: string | null | undefined): { code: string; label: string } {
  let code = customerStateCode?.trim() || ''
  if (!code && gstin) {
    code = stateCodeFromGSTIN(gstin) || ''
  }
  if (!code && businessStateCode) {
    code = businessStateCode.trim()
  }
  if (!code) code = '27' // Default Maharashtra if unassigned

  // Pad to 2 digits if single digit (e.g. "9" -> "09")
  if (code.length === 1) code = `0${code}`

  const stateObj = GST_STATES_MAP[code]
  const name = stateObj?.name || 'Local Jurisdiction'
  return {
    code,
    label: `${code}-${name}`,
  }
}

export function formatGSTDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    // Convert YYYY-MM-DD to DD-MM-YYYY
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  return dateStr
}

// ============================================================================
// PERIOD GENERATOR (MONTHLY & QUARTERLY)
// ============================================================================

export function getGSTReturnPeriods(currentYear = 2026): GSTReturnPeriod[] {
  const periods: GSTReturnPeriod[] = []
  const fyLabel = `${currentYear}-${String(currentYear + 1).slice(2)}`

  // 12 Months of Indian Financial Year: April (Month 4) to March (Month 3 of next year)
  const months = [
    { m: 4, y: currentYear, name: 'April' },
    { m: 5, y: currentYear, name: 'May' },
    { m: 6, y: currentYear, name: 'June' },
    { m: 7, y: currentYear, name: 'July' },
    { m: 8, y: currentYear, name: 'August' },
    { m: 9, y: currentYear, name: 'September' },
    { m: 10, y: currentYear, name: 'October' },
    { m: 11, y: currentYear, name: 'November' },
    { m: 12, y: currentYear, name: 'December' },
    { m: 1, y: currentYear + 1, name: 'January' },
    { m: 2, y: currentYear + 1, name: 'February' },
    { m: 3, y: currentYear + 1, name: 'March' },
  ]

  for (const { m, y, name } of months) {
    const padM = String(m).padStart(2, '0')
    const lastDay = new Date(y, m, 0).getDate()
    periods.push({
      financialYear: fyLabel,
      periodType: 'MONTHLY',
      month: m,
      quarter: m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : m >= 10 && m <= 12 ? 3 : 4,
      startDate: `${y}-${padM}-01`,
      endDate: `${y}-${padM}-${String(lastDay).padStart(2, '0')}`,
      periodCode: `${padM}${y}`,
      label: `${name} ${y}`,
    })
  }

  // 4 Quarters (QRMP Scheme)
  const quarters = [
    { q: 1, name: `Q1 (Apr - Jun ${currentYear})`, start: `${currentYear}-04-01`, end: `${currentYear}-06-30`, code: `06${currentYear}` },
    { q: 2, name: `Q2 (Jul - Sep ${currentYear})`, start: `${currentYear}-07-01`, end: `${currentYear}-09-30`, code: `09${currentYear}` },
    { q: 3, name: `Q3 (Oct - Dec ${currentYear})`, start: `${currentYear}-10-01`, end: `${currentYear}-12-31`, code: `12${currentYear}` },
    { q: 4, name: `Q4 (Jan - Mar ${currentYear + 1})`, start: `${currentYear + 1}-01-01`, end: `${currentYear + 1}-03-31`, code: `03${currentYear + 1}` },
  ]

  for (const q of quarters) {
    periods.push({
      financialYear: fyLabel,
      periodType: 'QUARTERLY',
      month: 0,
      quarter: q.q,
      startDate: q.start,
      endDate: q.end,
      periodCode: q.code,
      label: q.name,
    })
  }

  return periods
}

// ============================================================================
// DATA FETCHING & RETURN COMPUTATIONS
// ============================================================================

export async function fetchGSTDataForPeriod(
  businessId: string,
  startDate: string,
  endDate: string,
): Promise<{
  invoices: InvoiceWithItems[]
  cancelledInvoices: Invoice[]
  purchases: Purchase[]
  creditNotes: CreditNote[]
  debitNotes: DebitNote[]
}> {
  // 1. Fetch valid finalized/paid invoices
  const invoiceRows = await dbSelect<any>(
    `SELECT * FROM invoices
     WHERE business_id = ?
       AND invoice_date >= ?
       AND invoice_date <= ?
       AND status NOT IN ('DRAFT', 'CANCELLED')
     ORDER BY invoice_date ASC, created_at ASC`,
    [businessId, startDate, endDate],
  )

  // 2. Fetch invoice items for these invoices
  const invoiceIds = invoiceRows.map((r: any) => r.id)
  let itemRows: any[] = []
  if (invoiceIds.length > 0) {
    const placeholders = invoiceIds.map(() => '?').join(',')
    itemRows = await dbSelect<any>(
      `SELECT * FROM invoice_items WHERE invoice_id IN (${placeholders}) ORDER BY line_number ASC`,
      invoiceIds,
    )
  }

  const itemsByInvoiceId = new Map<string, InvoiceItem[]>()
  for (const it of itemRows) {
    const list = itemsByInvoiceId.get(it.invoice_id) || []
    list.push({
      id: it.id,
      invoiceId: it.invoice_id,
      productId: it.product_id,
      productSnapshot: JSON.parse(it.product_snapshot || '{}'),
      lineNumber: it.line_number,
      description: it.description,
      hsnCode: it.hsn_code,
      quantity: it.quantity,
      unit: it.unit,
      purchasePrice: it.purchase_price,
      unitPrice: it.unit_price,
      discountPercent: it.discount_percent,
      discountAmount: it.discount_amount,
      taxableAmount: it.taxable_amount,
      taxRate: it.tax_rate,
      cgstRate: it.cgst_rate,
      sgstRate: it.sgst_rate,
      igstRate: it.igst_rate,
      cgstAmount: it.cgst_amount,
      sgstAmount: it.sgst_amount,
      igstAmount: it.igst_amount,
      totalAmount: it.total_amount,
      createdAt: it.created_at,
    })
    itemsByInvoiceId.set(it.invoice_id, list)
  }

  const invoices: InvoiceWithItems[] = invoiceRows.map((r: any) => ({
    id: r.id,
    businessId: r.business_id,
    invoiceNumber: r.invoice_number,
    customerId: r.customer_id,
    customerSnapshot: JSON.parse(r.customer_snapshot || '{}'),
    invoiceDate: r.invoice_date,
    dueDate: r.due_date,
    status: r.status,
    paymentStatus: r.payment_status,
    supplyType: r.supply_type,
    subtotal: r.subtotal,
    discountAmount: r.discount_amount,
    taxableAmount: r.taxable_amount,
    cgstAmount: r.cgst_amount,
    sgstAmount: r.sgst_amount,
    igstAmount: r.igst_amount,
    totalTax: r.total_tax,
    roundOff: r.round_off,
    totalAmount: r.total_amount,
    paidAmount: r.paid_amount,
    notes: r.notes,
    termsAndConditions: r.terms_and_conditions,
    paymentMethod: r.payment_method,
    createdBy: r.created_by,
    cancelledAt: r.cancelled_at,
    cancelledReason: r.cancelled_reason,
    shippingName: r.shipping_name,
    shippingAddress: r.shipping_address,
    shippingCity: r.shipping_city,
    shippingState: r.shipping_state,
    shippingStateCode: r.shipping_state_code,
    shippingPin: r.shipping_pin,
    vehicleNumber: r.vehicle_number,
    transportMode: r.transport_mode,
    transporterName: r.transporter_name,
    transporterId: r.transporter_id,
    lrRrNumber: r.lr_rr_number,
    lrRrDate: r.lr_rr_date,
    shippingCharges: r.shipping_charges || 0,
    additionalCharges: r.additional_charges || 0,
    additionalChargesLabel: r.additional_charges_label,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items: itemsByInvoiceId.get(r.id) || [],
  }))

  // 3. Fetch cancelled invoices for Document Summary Table 13
  const cancelledRows = await dbSelect<any>(
    `SELECT * FROM invoices
     WHERE business_id = ?
       AND invoice_date >= ?
       AND invoice_date <= ?
       AND status = 'CANCELLED'
     ORDER BY invoice_number ASC`,
    [businessId, startDate, endDate],
  )
  const cancelledInvoices: Invoice[] = cancelledRows.map((r: any) => ({
    ...r,
    customerSnapshot: JSON.parse(r.customer_snapshot || '{}'),
  }))

  // 4. Fetch purchases for GSTR-3B Input Tax Credit (ITC Table 4)
  const purchaseRows = await dbSelect<any>(
    `SELECT * FROM purchases
     WHERE business_id = ?
       AND purchase_date >= ?
       AND purchase_date <= ?
       AND status NOT IN ('DRAFT', 'CANCELLED')
     ORDER BY purchase_date ASC`,
    [businessId, startDate, endDate],
  )
  const purchases: Purchase[] = purchaseRows.map((r: any) => ({
    ...r,
    supplierSnapshot: JSON.parse(r.supplier_snapshot || '{}'),
  }))

  // 5. Fetch Credit Notes & Debit Notes
  const creditRows = await dbSelect<any>(
    `SELECT * FROM credit_notes
     WHERE business_id = ?
       AND issue_date >= ?
       AND issue_date <= ?
       AND status != 'CANCELLED'
     ORDER BY issue_date ASC`,
    [businessId, startDate, endDate],
  )
  const creditNotes: CreditNote[] = creditRows

  const debitRows = await dbSelect<any>(
    `SELECT * FROM debit_notes
     WHERE business_id = ?
       AND issue_date >= ?
       AND issue_date <= ?
       AND status != 'CANCELLED'
     ORDER BY issue_date ASC`,
    [businessId, startDate, endDate],
  )
  const debitNotes: DebitNote[] = debitRows

  return {
    invoices,
    cancelledInvoices,
    purchases,
    creditNotes,
    debitNotes,
  }
}

/**
 * Computes official GSTR-1 outward supply tables
 */
export function computeGSTR1Data(
  business: Business,
  invoices: InvoiceWithItems[],
  creditNotes: CreditNote[],
  cancelledInvoices: Invoice[],
): GSTR1Data {
  const b2b: GSTR1B2BInvoice[] = []
  const b2cl: GSTR1B2CLInvoice[] = []
  const b2csMap = new Map<string, GSTR1B2CSSupply>()
  const hsnMap = new Map<string, GSTR1HSNSummary>()

  let totalTaxableValue = 0
  let totalIgst = 0
  let totalCgst = 0
  let totalSgst = 0
  let totalTax = 0
  let totalGrossValue = 0

  for (const inv of invoices) {
    totalTaxableValue += inv.taxableAmount
    totalIgst += inv.igstAmount
    totalCgst += inv.cgstAmount
    totalSgst += inv.sgstAmount
    totalTax += inv.totalTax
    totalGrossValue += inv.totalAmount

    const customer = inv.customerSnapshot
    const gstin = customer?.gstin?.trim()
    const isRegistered = !!gstin && gstin.length >= 15
    const pos = resolvePOS(customer?.stateCode, gstin, business.stateCode)

    // Check if B2CL: Unregistered AND Interstate AND Total Invoice Value > ₹2.5 Lakhs (25,000,000 paise)
    const isB2CL = !isRegistered && inv.supplyType === 'INTERSTATE' && inv.totalAmount > 25000000

    // Group items by rate for invoice-level tax breakdown
    const rateGroupMap = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>()

    for (const it of inv.items) {
      const ratePct = it.taxRate / 100 // e.g. 1800 -> 18
      const curr = rateGroupMap.get(ratePct) || { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
      curr.taxable += it.taxableAmount
      curr.cgst += it.cgstAmount
      curr.sgst += it.sgstAmount
      curr.igst += it.igstAmount
      rateGroupMap.set(ratePct, curr)

      // Table 12: HSN Summary aggregation
      const rawHsn = it.hsnCode?.trim() || '9999'
      const uqc = resolveUQC(it.unit)
      const hsnKey = `${rawHsn}_${uqc}_${it.description.trim().toLowerCase()}`

      const hsnItem = hsnMap.get(hsnKey) || {
        hsnCode: rawHsn,
        description: it.description || 'Product Supply',
        uqc,
        totalQuantity: 0,
        totalValue: 0,
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        cessAmount: 0,
      }

      hsnItem.totalQuantity += it.quantity / 100
      hsnItem.totalValue += it.totalAmount
      hsnItem.taxableValue += it.taxableAmount
      hsnItem.cgstAmount += it.cgstAmount
      hsnItem.sgstAmount += it.sgstAmount
      hsnItem.igstAmount += it.igstAmount
      hsnMap.set(hsnKey, hsnItem)
    }

    // Default rate if no items
    if (rateGroupMap.size === 0) {
      const fallbackRate = 18
      rateGroupMap.set(fallbackRate, {
        taxable: inv.taxableAmount,
        cgst: inv.cgstAmount,
        sgst: inv.sgstAmount,
        igst: inv.igstAmount,
      })
    }

    // Populate B2B, B2CL, or B2CS
    for (const [ratePct, val] of rateGroupMap.entries()) {
      if (isRegistered) {
        // Table 4: B2B Invoice
        b2b.push({
          receiverGstin: gstin!,
          receiverName: customer?.name || 'Registered Recipient',
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          invoiceValue: inv.totalAmount,
          pos: pos.label,
          reverseCharge: 'N',
          rate: ratePct,
          taxableValue: val.taxable,
          cgstAmount: val.cgst,
          sgstAmount: val.sgst,
          igstAmount: val.igst,
          cessAmount: 0,
        })
      } else if (isB2CL) {
        // Table 5: B2CL Large Invoices
        b2cl.push({
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          invoiceValue: inv.totalAmount,
          pos: pos.label,
          rate: ratePct,
          taxableValue: val.taxable,
          igstAmount: val.igst,
          cessAmount: 0,
        })
      } else {
        // Table 7: B2CS Small Consumer Sales (aggregated by Supply Type + POS + Rate)
        const splyType = inv.supplyType === 'INTRASTATE' ? 'INTRA' : 'INTER'
        const b2csKey = `${splyType}_${pos.code}_${ratePct}`
        const curr = b2csMap.get(b2csKey) || {
          supplyType: splyType,
          pos: pos.label,
          rate: ratePct,
          taxableValue: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          cessAmount: 0,
        }
        curr.taxableValue += val.taxable
        curr.cgstAmount += val.cgst
        curr.sgstAmount += val.sgst
        curr.igstAmount += val.igst
        b2csMap.set(b2csKey, curr)
      }
    }
  }

  // Table 9B: CDNR (Credit Notes to Registered / Unregistered)
  const cdnr: GSTR1CDNRNote[] = []
  for (const cn of creditNotes) {
    cdnr.push({
      receiverGstin: business.gstin || 'UNREGISTERED',
      receiverName: cn.customerName || 'Customer',
      noteNumber: cn.creditNoteNumber,
      noteDate: cn.issueDate,
      noteType: 'C',
      pos: resolvePOS(null, null, business.stateCode).label,
      reverseCharge: 'N',
      noteValue: cn.amount,
      rate: 18,
      taxableValue: Math.round((cn.amount * 10000) / 11800),
      cgstAmount: Math.round(((cn.amount - Math.round((cn.amount * 10000) / 11800)) / 2)),
      sgstAmount: Math.round(((cn.amount - Math.round((cn.amount * 10000) / 11800)) / 2)),
      igstAmount: 0,
      cessAmount: 0,
    })
  }

  // Table 13: Documents Summary
  const docs: GSTR1DocSummary[] = []
  const allInvoiceNumbers = [...invoices.map((i) => i.invoiceNumber), ...cancelledInvoices.map((i) => i.invoiceNumber)]
    .filter(Boolean)
    .sort()

  if (allInvoiceNumbers.length > 0) {
    docs.push({
      docType: 'Invoices for outward supply',
      fromSerial: allInvoiceNumbers[0],
      toSerial: allInvoiceNumbers[allInvoiceNumbers.length - 1],
      totalCount: allInvoiceNumbers.length,
      cancelledCount: cancelledInvoices.length,
      netCount: invoices.length,
    })
  } else {
    docs.push({
      docType: 'Invoices for outward supply',
      fromSerial: '—',
      toSerial: '—',
      totalCount: 0,
      cancelledCount: 0,
      netCount: 0,
    })
  }

  if (creditNotes.length > 0) {
    const cnNums = creditNotes.map((c) => c.creditNoteNumber).sort()
    docs.push({
      docType: 'Credit Note',
      fromSerial: cnNums[0],
      toSerial: cnNums[cnNums.length - 1],
      totalCount: creditNotes.length,
      cancelledCount: 0,
      netCount: creditNotes.length,
    })
  }

  return {
    b2b,
    b2cl,
    b2cs: Array.from(b2csMap.values()),
    cdnr,
    hsn: Array.from(hsnMap.values()),
    docs,
    totalTaxableValue,
    totalIgst,
    totalCgst,
    totalSgst,
    totalTax,
    totalGrossValue,
    invoiceCount: invoices.length,
  }
}

/**
 * Computes official GSTR-3B summary tables & tax settlement
 */
export function computeGSTR3BData(
  business: Business,
  gstr1Data: GSTR1Data,
  purchases: Purchase[],
): GSTR3BData {
  // Table 3.1: Details of Outward Supplies and Inward Supplies liable to Reverse Charge
  const table31: GSTR3BTable31[] = [
    {
      code: '3.1(a)',
      description: 'Outward taxable supplies (other than zero rated, nil rated and exempted)',
      taxableValue: gstr1Data.totalTaxableValue,
      igstAmount: gstr1Data.totalIgst,
      cgstAmount: gstr1Data.totalCgst,
      sgstAmount: gstr1Data.totalSgst,
      cessAmount: 0,
    },
    {
      code: '3.1(b)',
      description: 'Outward taxable supplies (zero rated / exports)',
      taxableValue: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      cessAmount: 0,
    },
    {
      code: '3.1(c)',
      description: 'Other outward supplies (Nil rated, exempted)',
      taxableValue: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      cessAmount: 0,
    },
    {
      code: '3.1(d)',
      description: 'Inward supplies (liable to reverse charge)',
      taxableValue: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      cessAmount: 0,
    },
    {
      code: '3.1(e)',
      description: 'Non-GST outward supplies',
      taxableValue: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      cessAmount: 0,
    },
  ]

  // Table 3.2: Interstate supplies to unregistered persons
  const interstateUnregisteredMap = new Map<string, { code: string; name: string; taxable: number; igst: number }>()

  for (const b2clItem of gstr1Data.b2cl) {
    const code = b2clItem.pos.split('-')[0] || '99'
    const name = GST_STATES_MAP[code]?.name || b2clItem.pos
    const curr = interstateUnregisteredMap.get(code) || { code, name, taxable: 0, igst: 0 }
    curr.taxable += b2clItem.taxableValue
    curr.igst += b2clItem.igstAmount
    interstateUnregisteredMap.set(code, curr)
  }

  for (const b2csItem of gstr1Data.b2cs) {
    if (b2csItem.supplyType === 'INTER') {
      const code = b2csItem.pos.split('-')[0] || '99'
      const name = GST_STATES_MAP[code]?.name || b2csItem.pos
      const curr = interstateUnregisteredMap.get(code) || { code, name, taxable: 0, igst: 0 }
      curr.taxable += b2csItem.taxableValue
      curr.igst += b2csItem.igstAmount
      interstateUnregisteredMap.set(code, curr)
    }
  }

  const table32: GSTR3BTable32[] = Array.from(interstateUnregisteredMap.values()).map((item) => ({
    posCode: item.code,
    posName: item.name,
    taxableValue: item.taxable,
    igstAmount: item.igst,
  }))

  // Table 4: Eligible Input Tax Credit (ITC from Purchases)
  let itcTaxable = 0
  let itcIgst = 0
  let itcCgst = 0
  let itcSgst = 0

  for (const p of purchases) {
    itcTaxable += p.taxableAmount
    itcIgst += p.igstAmount
    itcCgst += p.cgstAmount
    itcSgst += p.sgstAmount
  }

  const table4: GSTR3BTable4ITC[] = [
    {
      code: '4(A)(1)',
      description: 'Import of goods',
      taxableValue: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      cessAmount: 0,
    },
    {
      code: '4(A)(2)',
      description: 'Import of services',
      taxableValue: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      cessAmount: 0,
    },
    {
      code: '4(A)(3)',
      description: 'Inward supplies liable to reverse charge',
      taxableValue: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      cessAmount: 0,
    },
    {
      code: '4(A)(4)',
      description: 'Inward supplies from ISD',
      taxableValue: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      cessAmount: 0,
    },
    {
      code: '4(A)(5)',
      description: 'All other ITC (Domestic purchases from registered vendors)',
      taxableValue: itcTaxable,
      igstAmount: itcIgst,
      cgstAmount: itcCgst,
      sgstAmount: itcSgst,
      cessAmount: 0,
    },
    {
      code: '4(B)(1)',
      description: 'ITC Reversed (As per rules 42 & 43 of CGST Rules)',
      taxableValue: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      cessAmount: 0,
    },
    {
      code: '4(C)',
      description: 'Net ITC Available [4(A) - 4(B)]',
      taxableValue: itcTaxable,
      igstAmount: itcIgst,
      cgstAmount: itcCgst,
      sgstAmount: itcSgst,
      cessAmount: 0,
    },
  ]

  // Table 5.1 & Tax Settlement
  const taxPayable: GSTR3BTaxPayable[] = [
    {
      taxHead: 'IGST',
      outwardLiability: gstr1Data.totalIgst,
      itcOffset: Math.min(gstr1Data.totalIgst, itcIgst),
      netTaxPayable: Math.max(0, gstr1Data.totalIgst - itcIgst),
    },
    {
      taxHead: 'CGST',
      outwardLiability: gstr1Data.totalCgst,
      itcOffset: Math.min(gstr1Data.totalCgst, itcCgst),
      netTaxPayable: Math.max(0, gstr1Data.totalCgst - itcCgst),
    },
    {
      taxHead: 'SGST',
      outwardLiability: gstr1Data.totalSgst,
      itcOffset: Math.min(gstr1Data.totalSgst, itcSgst),
      netTaxPayable: Math.max(0, gstr1Data.totalSgst - itcSgst),
    },
    {
      taxHead: 'CESS',
      outwardLiability: 0,
      itcOffset: 0,
      netTaxPayable: 0,
    },
  ]

  const totalOutwardTax = gstr1Data.totalTax
  const totalEligibleITC = itcIgst + itcCgst + itcSgst
  const netCashPayable = taxPayable.reduce((sum, t) => sum + t.netTaxPayable, 0)

  return {
    table31,
    table32,
    table4,
    taxPayable,
    totalOutwardTaxable: gstr1Data.totalTaxableValue,
    totalOutwardTax,
    totalEligibleITC,
    netCashPayable,
  }
}

// ============================================================================
// OFFICIAL GOVERNMENT JSON GENERATOR
// ============================================================================

/**
 * Generates the official GST Offline Utility JSON format (GSTR-1 v3.0+)
 * Uploadable directly to the GST Common Portal (https://gst.gov.in)
 */
export function generateGSTR1JSON(
  business: Business,
  gstr1: GSTR1Data,
  periodCode: string, // e.g. "052026"
): string {
  // 1. Structure B2B invoices grouped by recipient GSTIN
  const b2bMap = new Map<string, any[]>()

  for (const item of gstr1.b2b) {
    const list = b2bMap.get(item.receiverGstin) || []
    let invObj = list.find((i) => i.inum === item.invoiceNumber)
    if (!invObj) {
      invObj = {
        inum: item.invoiceNumber,
        idt: formatGSTDate(item.invoiceDate),
        val: parseFloat(paiseToRupees(item.invoiceValue)),
        pos: item.pos.split('-')[0] || '27',
        rchrg: item.reverseCharge,
        inv_typ: 'R',
        itms: [],
      }
      list.push(invObj)
    }

    invObj.itms.push({
      num: invObj.itms.length + 1,
      itm_det: {
        rt: item.rate,
        txval: parseFloat(paiseToRupees(item.taxableValue)),
        iamt: parseFloat(paiseToRupees(item.igstAmount)),
        camt: parseFloat(paiseToRupees(item.cgstAmount)),
        samt: parseFloat(paiseToRupees(item.sgstAmount)),
        csamt: parseFloat(paiseToRupees(item.cessAmount)),
      },
    })
    b2bMap.set(item.receiverGstin, list)
  }

  const b2bPayload = Array.from(b2bMap.entries()).map(([ctin, inv]) => ({
    ctin,
    inv,
  }))

  // 2. Structure B2CL invoices
  const b2clPayload = gstr1.b2cl.map((item, idx) => ({
    pos: item.pos.split('-')[0] || '99',
    inv: [
      {
        inum: item.invoiceNumber,
        idt: formatGSTDate(item.invoiceDate),
        val: parseFloat(paiseToRupees(item.invoiceValue)),
        itms: [
          {
            num: idx + 1,
            itm_det: {
              rt: item.rate,
              txval: parseFloat(paiseToRupees(item.taxableValue)),
              iamt: parseFloat(paiseToRupees(item.igstAmount)),
              csamt: parseFloat(paiseToRupees(item.cessAmount)),
            },
          },
        ],
      },
    ],
  }))

  // 3. Structure B2CS supplies
  const b2csPayload = gstr1.b2cs.map((item) => ({
    sply_ty: item.supplyType,
    pos: item.pos.split('-')[0] || '27',
    typ: 'OE',
    rt: item.rate,
    txval: parseFloat(paiseToRupees(item.taxableValue)),
    iamt: parseFloat(paiseToRupees(item.igstAmount)),
    camt: parseFloat(paiseToRupees(item.cgstAmount)),
    samt: parseFloat(paiseToRupees(item.sgstAmount)),
    csamt: parseFloat(paiseToRupees(item.cessAmount)),
  }))

  // 4. Structure CDNR credit notes
  const cdnrPayload = gstr1.cdnr.map((item, idx) => ({
    ctin: item.receiverGstin,
    nt: [
      {
        nt_num: item.noteNumber,
        nt_dt: formatGSTDate(item.noteDate),
        ntty: item.noteType,
        pos: item.pos.split('-')[0] || '27',
        val: parseFloat(paiseToRupees(item.noteValue)),
        rchrg: item.reverseCharge,
        itms: [
          {
            num: idx + 1,
            itm_det: {
              rt: item.rate,
              txval: parseFloat(paiseToRupees(item.taxableValue)),
              iamt: parseFloat(paiseToRupees(item.igstAmount)),
              camt: parseFloat(paiseToRupees(item.cgstAmount)),
              samt: parseFloat(paiseToRupees(item.sgstAmount)),
              csamt: parseFloat(paiseToRupees(item.cessAmount)),
            },
          },
        ],
      },
    ],
  }))

  // 5. Structure HSN Summary Table 12
  const hsnPayload = {
    data: gstr1.hsn.map((h, idx) => ({
      num: idx + 1,
      hsn_sc: h.hsnCode,
      desc: h.description,
      uqc: h.uqc.split('-')[0] || 'OTH',
      qty: h.totalQuantity,
      val: parseFloat(paiseToRupees(h.totalValue)),
      txval: parseFloat(paiseToRupees(h.taxableValue)),
      iamt: parseFloat(paiseToRupees(h.igstAmount)),
      camt: parseFloat(paiseToRupees(h.cgstAmount)),
      samt: parseFloat(paiseToRupees(h.sgstAmount)),
      csamt: parseFloat(paiseToRupees(h.cessAmount)),
    })),
  }

  // 6. Structure Document Summary Table 13
  const docIssuePayload = {
    doc_det: gstr1.docs.map((d, idx) => ({
      doc_num: idx + 1,
      doc_typ: d.docType,
      docs: [
        {
          num: 1,
          from: d.fromSerial,
          to: d.toSerial,
          totnum: d.totalCount,
          canc: d.cancelledCount,
          net_issue: d.netCount,
        },
      ],
    })),
  }

  const rootPayload = {
    gstin: business.gstin || '27AABCU9603R1ZM',
    fp: periodCode,
    version: 'GSTR1_V3.0.4',
    hash: 'hash',
    b2b: b2bPayload,
    b2cl: b2clPayload,
    b2cs: b2csPayload,
    cdnr: cdnrPayload,
    hsn: hsnPayload,
    doc_issue: docIssuePayload,
  }

  return JSON.stringify(rootPayload, null, 2)
}

// ============================================================================
// CSV EXPORT GENERATORS (C.A. & EXCEL COMPLIANT)
// ============================================================================

export function exportGSTR1B2BCSV(items: GSTR1B2BInvoice[]): string {
  const headers = [
    'GSTIN/UIN of Recipient',
    'Receiver Name',
    'Invoice Number',
    'Invoice Date',
    'Invoice Value (₹)',
    'Place Of Supply',
    'Reverse Charge',
    'Applicable % of Tax Rate',
    'Invoice Type',
    'E-Commerce GSTIN',
    'Rate (%)',
    'Taxable Value (₹)',
    'Integrated Tax (₹)',
    'Central Tax (₹)',
    'State/UT Tax (₹)',
    'Cess Amount (₹)',
  ]

  const rows = items.map((it) => [
    it.receiverGstin,
    it.receiverName,
    it.invoiceNumber,
    formatGSTDate(it.invoiceDate),
    paiseToRupees(it.invoiceValue),
    it.pos,
    it.reverseCharge,
    '',
    'Regular',
    '',
    it.rate,
    paiseToRupees(it.taxableValue),
    paiseToRupees(it.igstAmount),
    paiseToRupees(it.cgstAmount),
    paiseToRupees(it.sgstAmount),
    '0.00',
  ])

  return generateCSV(headers, rows)
}

export function exportGSTR1B2CLCSV(items: GSTR1B2CLInvoice[]): string {
  const headers = [
    'Invoice Number',
    'Invoice Date',
    'Invoice Value (₹)',
    'Place Of Supply',
    'Applicable % of Tax Rate',
    'Rate (%)',
    'Taxable Value (₹)',
    'Integrated Tax (₹)',
    'Cess Amount (₹)',
    'E-Commerce GSTIN',
  ]

  const rows = items.map((it) => [
    it.invoiceNumber,
    formatGSTDate(it.invoiceDate),
    paiseToRupees(it.invoiceValue),
    it.pos,
    '',
    it.rate,
    paiseToRupees(it.taxableValue),
    paiseToRupees(it.igstAmount),
    '0.00',
    '',
  ])

  return generateCSV(headers, rows)
}

export function exportGSTR1B2CSCSV(items: GSTR1B2CSSupply[]): string {
  const headers = [
    'Type',
    'Place Of Supply',
    'Applicable % of Tax Rate',
    'Rate (%)',
    'Taxable Value (₹)',
    'Integrated Tax (₹)',
    'Central Tax (₹)',
    'State/UT Tax (₹)',
    'Cess Amount (₹)',
    'E-Commerce GSTIN',
  ]

  const rows = items.map((it) => [
    'OE',
    it.pos,
    '',
    it.rate,
    paiseToRupees(it.taxableValue),
    paiseToRupees(it.igstAmount),
    paiseToRupees(it.cgstAmount),
    paiseToRupees(it.sgstAmount),
    '0.00',
    '',
  ])

  return generateCSV(headers, rows)
}

export function exportGSTR1CDNRCSV(items: GSTR1CDNRNote[]): string {
  const headers = [
    'GSTIN/UIN of Recipient',
    'Receiver Name',
    'Note Number',
    'Note Date',
    'Note Type',
    'Place Of Supply',
    'Reverse Charge',
    'Note Supply Type',
    'Note Value (₹)',
    'Applicable % of Tax Rate',
    'Rate (%)',
    'Taxable Value (₹)',
    'Integrated Tax (₹)',
    'Central Tax (₹)',
    'State/UT Tax (₹)',
    'Cess Amount (₹)',
  ]

  const rows = items.map((it) => [
    it.receiverGstin,
    it.receiverName,
    it.noteNumber,
    formatGSTDate(it.noteDate),
    it.noteType === 'C' ? 'C' : 'D',
    it.pos,
    it.reverseCharge,
    'Regular',
    paiseToRupees(it.noteValue),
    '',
    it.rate,
    paiseToRupees(it.taxableValue),
    paiseToRupees(it.igstAmount),
    paiseToRupees(it.cgstAmount),
    paiseToRupees(it.sgstAmount),
    '0.00',
  ])

  return generateCSV(headers, rows)
}

export function exportGSTR1HSNCSV(items: GSTR1HSNSummary[]): string {
  const headers = [
    'HSN',
    'Description',
    'UQC',
    'Total Quantity',
    'Total Value (₹)',
    'Taxable Value (₹)',
    'Integrated Tax Amount (₹)',
    'Central Tax Amount (₹)',
    'State/UT Tax Amount (₹)',
    'Cess Amount (₹)',
  ]

  const rows = items.map((it) => [
    it.hsnCode,
    it.description,
    it.uqc,
    it.totalQuantity.toFixed(2),
    paiseToRupees(it.totalValue),
    paiseToRupees(it.taxableValue),
    paiseToRupees(it.igstAmount),
    paiseToRupees(it.cgstAmount),
    paiseToRupees(it.sgstAmount),
    '0.00',
  ])

  return generateCSV(headers, rows)
}

export function exportGSTR1DocsCSV(items: GSTR1DocSummary[]): string {
  const headers = [
    'Nature of Document',
    'Sr. No. From',
    'Sr. No. To',
    'Total Number',
    'Cancelled',
    'Net Issued',
  ]

  const rows = items.map((it) => [
    it.docType,
    it.fromSerial,
    it.toSerial,
    it.totalCount,
    it.cancelledCount,
    it.netCount,
  ])

  return generateCSV(headers, rows)
}

export function exportGSTR3BCSV(data: GSTR3BData, periodLabel: string): string {
  const headers = [
    'Table',
    'Nature of Supplies / Description',
    'Taxable Value (₹)',
    'Integrated Tax (₹)',
    'Central Tax (₹)',
    'State/UT Tax (₹)',
    'Cess (₹)',
  ]

  const rows: (string | number)[][] = []

  // Header banner row
  rows.push([`GSTR-3B Summary Report for ${periodLabel}`, '', '', '', '', '', ''])
  rows.push(['--------------------------------', '--------------------------------', '----------', '----------', '----------', '----------', '----------'])

  // Table 3.1
  for (const row of data.table31) {
    rows.push([
      row.code,
      row.description,
      paiseToRupees(row.taxableValue),
      paiseToRupees(row.igstAmount),
      paiseToRupees(row.cgstAmount),
      paiseToRupees(row.sgstAmount),
      '0.00',
    ])
  }

  // Table 4: Eligible ITC
  rows.push(['--------------------------------', '--------------------------------', '----------', '----------', '----------', '----------', '----------'])
  rows.push(['TABLE 4: ELIGIBLE INPUT TAX CREDIT (ITC)', '', '', '', '', '', ''])
  for (const row of data.table4) {
    rows.push([
      row.code,
      row.description,
      paiseToRupees(row.taxableValue),
      paiseToRupees(row.igstAmount),
      paiseToRupees(row.cgstAmount),
      paiseToRupees(row.sgstAmount),
      '0.00',
    ])
  }

  // Table 5.1: Tax Settlement
  rows.push(['--------------------------------', '--------------------------------', '----------', '----------', '----------', '----------', '----------'])
  rows.push(['TABLE 5.1: NET TAX PAYABLE TO GOVERNMENT', '', '', '', '', '', ''])
  for (const row of data.taxPayable) {
    rows.push([
      row.taxHead,
      `Outward Liability: ₹${paiseToRupees(row.outwardLiability)} | ITC Credit Offset: ₹${paiseToRupees(row.itcOffset)}`,
      '',
      row.taxHead === 'IGST' ? paiseToRupees(row.netTaxPayable) : '0.00',
      row.taxHead === 'CGST' ? paiseToRupees(row.netTaxPayable) : '0.00',
      row.taxHead === 'SGST' ? paiseToRupees(row.netTaxPayable) : '0.00',
      '0.00',
    ])
  }

  rows.push(['TOTAL NET CASH PAYABLE', '', '', '', '', '', paiseToRupees(data.netCashPayable)])

  return generateCSV(headers, rows)
}

// ============================================================================
// FILE DOWNLOAD TRIGGERS
// ============================================================================

export function triggerJSONDownload(filename: string, jsonContent: string): void {
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
