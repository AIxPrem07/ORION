import { describe, it, expect } from 'vitest'
import {
  getGSTReturnPeriods,
  resolveUQC,
  resolvePOS,
  formatGSTDate,
  computeGSTR1Data,
  computeGSTR3BData,
  generateGSTR1JSON,
  exportGSTR1B2BCSV,
  exportGSTR1HSNCSV,
  exportGSTR3BCSV,
} from '../../src/services/gst-return.service'
import type { Business } from '../../src/types/business'
import type { InvoiceWithItems, Invoice } from '../../src/types/invoice'
import type { Purchase } from '../../src/types/purchase'
import type { CreditNote } from '../../src/types/returns'

const MOCK_BUSINESS: Business = {
  id: 'biz-1',
  name: 'Acme Enterprises',
  logoPath: null,
  address: '123 MG Road',
  city: 'Mumbai',
  state: 'Maharashtra',
  stateCode: '27',
  pin: '400001',
  phone: '9876543210',
  email: 'contact@acme.com',
  website: null,
  gstin: '27AABCU9603R1ZM',
  pan: 'AABCU9603R',
  bankName: 'HDFC Bank',
  accountNumber: '50200012345678',
  ifsc: 'HDFC0000001',
  upiId: 'acme@okhdfcbank',
  invoicePrefix: 'INV',
  financialYearStart: 4,
  signaturePath: null,
  termsAndConditions: null,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
}

function makeMockInvoice(overrides: Partial<InvoiceWithItems> = {}): InvoiceWithItems {
  return {
    id: 'inv-' + Math.random().toString(36).slice(2),
    businessId: 'biz-1',
    invoiceNumber: 'INV/26-27/0001',
    customerId: 'cust-1',
    customerSnapshot: {
      id: 'cust-1',
      name: 'Registered Retailer Pvt Ltd',
      phone: '9988776655',
      email: 'buyer@retailer.com',
      address: 'Shop 4, Market',
      city: 'Pune',
      state: 'Maharashtra',
      stateCode: '27',
      pin: '411001',
      gstin: '27AAECR1234F1Z5',
      pan: 'AAECR1234F',
    },
    invoiceDate: '2026-05-15',
    dueDate: '2026-05-30',
    status: 'FINALIZED',
    paymentStatus: 'UNPAID',
    supplyType: 'INTRASTATE',
    subtotal: 100000, // ₹1,000.00
    discountAmount: 0,
    taxableAmount: 100000,
    cgstAmount: 9000, // 9% = ₹90.00
    sgstAmount: 9000, // 9% = ₹90.00
    igstAmount: 0,
    totalTax: 18000,
    roundOff: 0,
    totalAmount: 118000, // ₹1,180.00
    paidAmount: 0,
    notes: null,
    termsAndConditions: null,
    paymentMethod: null,
    createdBy: null,
    cancelledAt: null,
    cancelledReason: null,
    shippingName: null,
    shippingAddress: null,
    shippingCity: null,
    shippingState: null,
    shippingStateCode: null,
    shippingPin: null,
    vehicleNumber: null,
    transportMode: null,
    transporterName: null,
    transporterId: null,
    lrRrNumber: null,
    lrRrDate: null,
    shippingCharges: 0,
    additionalCharges: 0,
    additionalChargesLabel: null,
    createdAt: '2026-05-15T10:00:00.000Z',
    updatedAt: '2026-05-15T10:00:00.000Z',
    items: [
      {
        id: 'item-1',
        invoiceId: 'inv-1',
        productId: 'prod-1',
        productSnapshot: {} as any,
        lineNumber: 1,
        description: 'Cotton Shirts',
        hsnCode: '6205',
        quantity: 200, // 2.00 pcs
        unit: 'pcs',
        purchasePrice: 30000,
        unitPrice: 50000,
        discountPercent: 0,
        discountAmount: 0,
        taxableAmount: 100000,
        taxRate: 1800,
        cgstRate: 900,
        sgstRate: 900,
        igstRate: 0,
        cgstAmount: 9000,
        sgstAmount: 9000,
        igstAmount: 0,
        totalAmount: 118000,
        createdAt: '2026-05-15T10:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

describe('gst-return.service — Return Periods & Helpers', () => {
  it('generates standard financial year monthly and quarterly periods', () => {
    const periods = getGSTReturnPeriods(2026)
    expect(periods.length).toBe(16) // 12 months + 4 quarters

    const april = periods[0]
    expect(april.label).toBe('April 2026')
    expect(april.startDate).toBe('2026-04-01')
    expect(april.endDate).toBe('2026-04-30')
    expect(april.periodCode).toBe('042026')
    expect(april.financialYear).toBe('2026-27')

    const q1 = periods.find((p) => p.periodType === 'QUARTERLY' && p.quarter === 1)
    expect(q1?.label).toContain('Q1')
    expect(q1?.startDate).toBe('2026-04-01')
    expect(q1?.endDate).toBe('2026-06-30')
  })

  it('correctly formats dates to GST portal DD-MM-YYYY standard', () => {
    expect(formatGSTDate('2026-05-15')).toBe('15-05-2026')
    expect(formatGSTDate('2026-12-31')).toBe('31-12-2026')
  })

  it('resolves Place of Supply (POS) and UQC mapping accurately', () => {
    const pos = resolvePOS('27', null, '27')
    expect(pos.code).toBe('27')
    expect(pos.label).toBe('27-Maharashtra')

    const posDelhi = resolvePOS('07', null, '27')
    expect(posDelhi.code).toBe('07')
    expect(posDelhi.label).toBe('07-Delhi')

    expect(resolveUQC('pcs')).toBe('PCS-PIECES')
    expect(resolveUQC('kg')).toBe('KGS-KILOGRAMS')
    expect(resolveUQC('mtr')).toBe('MTR-METRES')
    expect(resolveUQC('unknown_unit')).toBe('OTH-OTHERS')
  })
})

describe('gst-return.service — GSTR-1 Computation', () => {
  it('classifies registered customer invoices into Table 4 B2B', () => {
    const b2bInv = makeMockInvoice({
      invoiceNumber: 'INV/26-27/0001',
      customerSnapshot: {
        id: 'cust-1',
        name: 'Alpha Traders',
        phone: null,
        email: null,
        address: null,
        city: null,
        state: 'Maharashtra',
        stateCode: '27',
        pin: null,
        gstin: '27AAECR1234F1Z5',
        pan: null,
      },
    })

    const result = computeGSTR1Data(MOCK_BUSINESS, [b2bInv], [], [])

    expect(result.b2b.length).toBe(1)
    expect(result.b2b[0].receiverGstin).toBe('27AAECR1234F1Z5')
    expect(result.b2b[0].invoiceNumber).toBe('INV/26-27/0001')
    expect(result.b2b[0].taxableValue).toBe(100000)
    expect(result.b2b[0].cgstAmount).toBe(9000)
    expect(result.b2b[0].sgstAmount).toBe(9000)
    expect(result.b2cl.length).toBe(0)
    expect(result.b2cs.length).toBe(0)
  })

  it('classifies unregistered retail sales into Table 7 B2CS', () => {
    const retailInv = makeMockInvoice({
      invoiceNumber: 'INV/26-27/0002',
      customerSnapshot: {
        id: 'cust-2',
        name: 'Walk-in Consumer',
        phone: null,
        email: null,
        address: null,
        city: null,
        state: 'Maharashtra',
        stateCode: '27',
        pin: null,
        gstin: null, // Unregistered
        pan: null,
      },
    })

    const result = computeGSTR1Data(MOCK_BUSINESS, [retailInv], [], [])

    expect(result.b2b.length).toBe(0)
    expect(result.b2cl.length).toBe(0)
    expect(result.b2cs.length).toBe(1)
    expect(result.b2cs[0].supplyType).toBe('INTRA')
    expect(result.b2cs[0].taxableValue).toBe(100000)
    expect(result.b2cs[0].rate).toBe(18)
  })

  it('classifies high-value interstate unregistered sales into Table 5 B2CL', () => {
    // Inter-state > ₹2.5 Lakhs (25,000,000 paise)
    const largeInterstateInv = makeMockInvoice({
      invoiceNumber: 'INV/26-27/0003',
      supplyType: 'INTERSTATE',
      subtotal: 30000000, // ₹3,00,000
      taxableAmount: 30000000,
      igstAmount: 5400000, // 18% = ₹54,000
      cgstAmount: 0,
      sgstAmount: 0,
      totalTax: 5400000,
      totalAmount: 35400000, // ₹3,54,000
      customerSnapshot: {
        id: 'cust-3',
        name: 'Gujarat Consumer',
        phone: null,
        email: null,
        address: null,
        city: 'Ahmedabad',
        state: 'Gujarat',
        stateCode: '24',
        pin: null,
        gstin: null, // Unregistered
        pan: null,
      },
      items: [
        {
          id: 'it-3',
          invoiceId: 'inv-3',
          productId: null,
          productSnapshot: {} as any,
          lineNumber: 1,
          description: 'Industrial Machine Part',
          hsnCode: '8479',
          quantity: 100,
          unit: 'pcs',
          purchasePrice: 20000000,
          unitPrice: 30000000,
          discountPercent: 0,
          discountAmount: 0,
          taxableAmount: 30000000,
          taxRate: 1800,
          cgstRate: 0,
          sgstRate: 0,
          igstRate: 1800,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 5400000,
          totalAmount: 35400000,
          createdAt: '2026-05-15T10:00:00.000Z',
        },
      ],
    })

    const result = computeGSTR1Data(MOCK_BUSINESS, [largeInterstateInv], [], [])

    expect(result.b2b.length).toBe(0)
    expect(result.b2cl.length).toBe(1)
    expect(result.b2cl[0].invoiceNumber).toBe('INV/26-27/0003')
    expect(result.b2cl[0].taxableValue).toBe(30000000)
    expect(result.b2cl[0].igstAmount).toBe(5400000)
  })

  it('aggregates statutory Table 12 HSN Summary properly', () => {
    const inv1 = makeMockInvoice({
      items: [
        {
          id: 'i-1',
          invoiceId: '1',
          productId: null,
          productSnapshot: {} as any,
          lineNumber: 1,
          description: 'Cotton Shirts',
          hsnCode: '6205',
          quantity: 200, // 2 units
          unit: 'pcs',
          purchasePrice: 0,
          unitPrice: 50000,
          discountPercent: 0,
          discountAmount: 0,
          taxableAmount: 100000,
          taxRate: 1800,
          cgstRate: 900,
          sgstRate: 900,
          igstRate: 0,
          cgstAmount: 9000,
          sgstAmount: 9000,
          igstAmount: 0,
          totalAmount: 118000,
          createdAt: '',
        },
      ],
    })

    const inv2 = makeMockInvoice({
      items: [
        {
          id: 'i-2',
          invoiceId: '2',
          productId: null,
          productSnapshot: {} as any,
          lineNumber: 1,
          description: 'Cotton Shirts',
          hsnCode: '6205',
          quantity: 300, // 3 units
          unit: 'pcs',
          purchasePrice: 0,
          unitPrice: 50000,
          discountPercent: 0,
          discountAmount: 0,
          taxableAmount: 150000,
          taxRate: 1800,
          cgstRate: 900,
          sgstRate: 900,
          igstRate: 0,
          cgstAmount: 13500,
          sgstAmount: 13500,
          igstAmount: 0,
          totalAmount: 177000,
          createdAt: '',
        },
      ],
    })

    const result = computeGSTR1Data(MOCK_BUSINESS, [inv1, inv2], [], [])

    expect(result.hsn.length).toBe(1)
    const hsnRow = result.hsn[0]
    expect(hsnRow.hsnCode).toBe('6205')
    expect(hsnRow.totalQuantity).toBe(5) // 2 + 3 units
    expect(hsnRow.taxableValue).toBe(250000)
    expect(hsnRow.cgstAmount).toBe(22500)
    expect(hsnRow.sgstAmount).toBe(22500)
  })

  it('aggregates Table 13 Document Summary serials and cancelled counts', () => {
    const inv1 = makeMockInvoice({ invoiceNumber: 'INV/26-27/0001' })
    const inv2 = makeMockInvoice({ invoiceNumber: 'INV/26-27/0002' })
    const cancelled = [makeMockInvoice({ invoiceNumber: 'INV/26-27/0003', status: 'CANCELLED' })]

    const result = computeGSTR1Data(MOCK_BUSINESS, [inv1, inv2], [], cancelled as Invoice[])

    expect(result.docs.length).toBeGreaterThan(0)
    const invDoc = result.docs[0]
    expect(invDoc.fromSerial).toBe('INV/26-27/0001')
    expect(invDoc.toSerial).toBe('INV/26-27/0003')
    expect(invDoc.totalCount).toBe(3)
    expect(invDoc.cancelledCount).toBe(1)
    expect(invDoc.netCount).toBe(2)
  })
})

describe('gst-return.service — GSTR-3B Computation & ITC Offset', () => {
  it('correctly calculates Table 3.1 liability, Table 4 ITC, and net tax payable', () => {
    const gstr1 = computeGSTR1Data(MOCK_BUSINESS, [makeMockInvoice()], [], [])

    const mockPurchases: Purchase[] = [
      {
        id: 'purch-1',
        businessId: 'biz-1',
        purchaseNumber: 'PO/001',
        supplierId: 'sup-1',
        supplierSnapshot: {
          id: 'sup-1',
          name: 'Fabric Mill',
          phone: null,
          email: null,
          address: null,
          city: null,
          state: 'Maharashtra',
          stateCode: '27',
          pin: null,
          gstin: '27AABCM9999K1ZZ',
          pan: null,
        },
        purchaseDate: '2026-05-10',
        dueDate: null,
        status: 'FINALIZED',
        paymentStatus: 'PAID',
        supplyType: 'INTRASTATE',
        subtotal: 60000,
        discountAmount: 0,
        taxableAmount: 60000, // ₹600.00
        cgstAmount: 5400, // ₹54.00
        sgstAmount: 5400, // ₹54.00
        igstAmount: 0,
        totalTax: 10800,
        roundOff: 0,
        totalAmount: 70800,
        paidAmount: 70800,
        notes: null,
        createdBy: null,
        createdAt: '',
        updatedAt: '',
      },
    ]

    const gstr3b = computeGSTR3BData(MOCK_BUSINESS, gstr1, mockPurchases)

    // Table 3.1 Outward Liability: CGST 9000, SGST 9000 (Total ₹180)
    expect(gstr3b.totalOutwardTax).toBe(18000)

    // Table 4 Eligible ITC from Purchase: CGST 5400, SGST 5400 (Total ₹108)
    expect(gstr3b.totalEligibleITC).toBe(10800)

    // Table 5.1 Net Cash Payable: CGST (9000 - 5400 = 3600), SGST (9000 - 5400 = 3600) -> Total ₹72.00 (7200 paise)
    expect(gstr3b.netCashPayable).toBe(7200)
  })
})

describe('gst-return.service — Portal JSON & CSV Generators', () => {
  it('generates valid GST offline utility JSON schema', () => {
    const gstr1 = computeGSTR1Data(MOCK_BUSINESS, [makeMockInvoice()], [], [])
    const jsonStr = generateGSTR1JSON(MOCK_BUSINESS, gstr1, '052026')

    const parsed = JSON.parse(jsonStr)
    expect(parsed.gstin).toBe('27AABCU9603R1ZM')
    expect(parsed.fp).toBe('052026')
    expect(parsed.version).toBe('GSTR1_V3.0.4')
    expect(Array.isArray(parsed.b2b)).toBe(true)
    expect(parsed.b2b.length).toBe(1)
    expect(parsed.b2b[0].inv[0].inum).toBe('INV/26-27/0001')
    expect(parsed.hsn.data.length).toBe(1)
    expect(parsed.doc_issue.doc_det.length).toBeGreaterThan(0)
  })

  it('generates valid CSV exports for B2B, HSN, and GSTR-3B', () => {
    const gstr1 = computeGSTR1Data(MOCK_BUSINESS, [makeMockInvoice()], [], [])
    const gstr3b = computeGSTR3BData(MOCK_BUSINESS, gstr1, [])

    const b2bCsv = exportGSTR1B2BCSV(gstr1.b2b)
    expect(b2bCsv).toContain('GSTIN/UIN of Recipient')
    expect(b2bCsv).toContain('27AAECR1234F1Z5')
    expect(b2bCsv).toContain('INV/26-27/0001')

    const hsnCsv = exportGSTR1HSNCSV(gstr1.hsn)
    expect(hsnCsv).toContain('HSN')
    expect(hsnCsv).toContain('6205')
    expect(hsnCsv).toContain('PCS-PIECES')

    const gstr3bCsv = exportGSTR3BCSV(gstr3b, 'May 2026')
    expect(gstr3bCsv).toContain('GSTR-3B Summary Report for May 2026')
    expect(gstr3bCsv).toContain('3.1(a)')
    expect(gstr3bCsv).toContain('TOTAL NET CASH PAYABLE')
  })
})
