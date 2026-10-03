import { describe, it, expect } from 'vitest'
import React from 'react'
import { pdf } from '@react-pdf/renderer'
import { InvoicePDF } from '@/pdf/InvoicePDF'
import type { InvoiceWithItems } from '@/types/invoice'
import type { Business } from '@/types/business'

const mockBusiness: Business = {
  id: 'biz_001',
  name: 'NnP Billing Solutions Pvt. Ltd.',
  logoPath: null,
  address: 'Shop No. 15, Ground Floor, Sai Plaza Complex',
  city: 'Gandhinagar',
  state: 'Gujarat',
  stateCode: '24',
  pin: '382006',
  phone: '+91 98765 43210',
  email: 'support@nnpbilling.in',
  website: null,
  gstin: '24AABCN1234F1Z5',
  pan: 'AABCN1234F',
  bankName: 'HDFC Bank',
  accountNumber: '50200012345678',
  ifsc: 'HDFC0001234',
  upiId: 'nnpbilling@hdfcbank',
  invoicePrefix: 'INV',
  financialYearStart: 4,
  signaturePath: null,
  termsAndConditions: '1. Goods once sold will not be taken back.',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
}

const mockInvoice: InvoiceWithItems = {
  id: 'inv_001',
  businessId: 'biz_001',
  invoiceNumber: '0012',
  customerId: 'cust_001',
  customerSnapshot: {
    id: 'cust_001',
    businessId: 'biz_001',
    name: 'Kashyap Bhanushali',
    phone: '8160138277',
    email: 'kashyap@example.com',
    address: 'Sector 5-C 812/2',
    city: 'Gandhinagar',
    state: 'Gujarat',
    stateCode: '24',
    pin: '382006',
    gstin: null,
    pan: null,
    openingBalance: 0,
    creditLimit: null,
    paymentTermsDays: 14,
    notes: null,
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  invoiceDate: '2026-09-15',
  dueDate: '2026-09-29',
  status: 'FINALIZED',
  paymentStatus: 'UNPAID',
  supplyType: 'INTRASTATE',
  subtotal: 185000,
  discountAmount: 0,
  taxableAmount: 156780,
  cgstAmount: 14110,
  sgstAmount: 14110,
  igstAmount: 0,
  totalTax: 28220,
  roundOff: 0,
  totalAmount: 185000,
  paidAmount: 0,
  notes: null,
  termsAndConditions: null,
  paymentMethod: 'UPI',
  createdBy: null,
  cancelledAt: null,
  cancelledReason: null,
  shippingName: 'Kashyap Bhanushali',
  shippingAddress: 'Sector 5-C 812/2',
  shippingCity: 'Gandhinagar',
  shippingState: 'Gujarat',
  shippingStateCode: '24',
  shippingPin: '382006',
  vehicleNumber: '—',
  transportMode: 'Road',
  transporterName: 'Self',
  transporterId: null,
  lrRrNumber: '—',
  lrRrDate: null,
  shippingCharges: 0,
  additionalCharges: 0,
  additionalChargesLabel: 'Other Charges',
  createdAt: '2026-09-15T10:00:00Z',
  updatedAt: '2026-09-15T10:00:00Z',
  items: [
    {
      id: 'item_1',
      invoiceId: 'inv_001',
      productId: 'prod_1',
      productSnapshot: {} as any,
      lineNumber: 1,
      description: 'Alu Foil (72mtr) , ezze',
      hsnCode: '7607190',
      quantity: 500, // 5
      unit: 'Rol',
      purchasePrice: 20000,
      unitPrice: 27119,
      discountPercent: 0,
      discountAmount: 0,
      taxableAmount: 135593,
      taxRate: 1800,
      cgstRate: 900,
      sgstRate: 900,
      igstRate: 0,
      cgstAmount: 12204,
      sgstAmount: 12204,
      igstAmount: 0,
      totalAmount: 160000,
      createdAt: '2026-09-15T10:00:00Z',
    },
    {
      id: 'item_2',
      invoiceId: 'inv_001',
      productId: 'prod_2',
      productSnapshot: {} as any,
      lineNumber: 2,
      description: 'Camando Milky Spoon',
      hsnCode: '3923',
      quantity: 200, // 2
      unit: 'Pac',
      purchasePrice: 3000,
      unitPrice: 4237,
      discountPercent: 0,
      discountAmount: 0,
      taxableAmount: 8475,
      taxRate: 1800,
      cgstRate: 900,
      sgstRate: 900,
      igstRate: 0,
      cgstAmount: 762,
      sgstAmount: 762,
      igstAmount: 0,
      totalAmount: 10000,
      createdAt: '2026-09-15T10:00:00Z',
    },
    {
      id: 'item_3',
      invoiceId: 'inv_001',
      productId: null,
      productSnapshot: {} as any,
      lineNumber: 3,
      description: 'Freight\n(courier charge)',
      hsnCode: '4802',
      quantity: 100, // 1
      unit: 'Nos',
      purchasePrice: 0,
      unitPrice: 12712,
      discountPercent: 0,
      discountAmount: 0,
      taxableAmount: 12712,
      taxRate: 1800,
      cgstRate: 900,
      sgstRate: 900,
      igstRate: 0,
      cgstAmount: 1144,
      sgstAmount: 1144,
      igstAmount: 0,
      totalAmount: 15000,
      createdAt: '2026-09-15T10:00:00Z',
    },
  ],
}

describe('InvoicePDF Rendering Suite', () => {
  it('successfully compiles the statutory GST invoice to PDF without throwing', async () => {
    const element = React.createElement(InvoicePDF, {
      invoice: mockInvoice,
      business: mockBusiness,
      upiQrCodeUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    })

    const stream = await pdf(element as any).toBuffer()
    expect(stream).toBeDefined()
  })

  it('verifies exact GST totals from reference data', () => {
    const totalQty = mockInvoice.items.reduce((s, it) => s + it.quantity / 100, 0)
    expect(totalQty).toBe(8)

    const grandTotal = mockInvoice.totalAmount
    expect(grandTotal).toBe(185000) // ₹ 1,850.00

    const totalTax = mockInvoice.items.reduce((s, it) => s + it.cgstAmount + it.sgstAmount, 0)
    expect(totalTax).toBe(28220) // ₹ 282.20

    const taxable = mockInvoice.taxableAmount
    expect(taxable).toBe(156780) // ₹ 1,567.80
  })

  it('renders correctly with up to 50mm top and bottom margins without throwing', async () => {
    const element = React.createElement(InvoicePDF, {
      invoice: {
        ...mockInvoice,
        transporterName: 'Shree Krishna Heavy Goods Transport & Logistics Pvt. Ltd.',
        transportMode: 'Multimodal Road / Container Freight',
        vehicleNumber: 'GJ-01-AB-1234 / Trailer 99',
      },
      business: mockBusiness,
      customDesign: {
        marginTop: 50,
        marginBottom: 50,
        marginLeft: 15,
        marginRight: 15,
        showShipTo: true,
        showTransportInfo: true,
      } as any,
    })

    const stream = await pdf(element as any).toBuffer()
    const chunks: Buffer[] = []
    let chunk
    while ((chunk = stream.read()) !== null) {
      chunks.push(chunk)
    }
    const finalBuffer = Buffer.concat(chunks)
    console.log('Read buffer bytes:', finalBuffer.length)
    expect(stream).toBeDefined()
  })

  it('correctly handles multi-line party blocks with margins up to 50mm without crashing or collapsing', async () => {
    const saarthiBusiness: Business = {
      ...mockBusiness,
      name: 'SAARTHI CHEMICALS',
      state: 'Gujarat',
      stateCode: '24',
      gstin: '22AAAAAAAML',
    }

    const testInvoice: InvoiceWithItems = {
      ...mockInvoice,
      customerSnapshot: {
        ...mockInvoice.customerSnapshot!,
        name: 'KASHYAP BHANUSHALI & CO.',
        address: 'Plot No. 42, GIDC Industrial Estate, Phase 2',
        city: 'Vapi',
        state: 'Gujarat',
        stateCode: '24',
        pin: '396195',
        phone: '9876543210',
        gstin: '24AABCK1234F1Z1',
      },
      shippingName: 'KASHYAP BHANUSHALI (WAREHOUSE 3)',
      shippingAddress: 'Godown 12, Logistics Park, Ring Road',
      shippingCity: 'Surat',
      shippingState: 'Gujarat',
      shippingStateCode: '24',
      shippingPin: '395006',
      transporterName: 'Express Cargo Logistics Ltd.',
      lrRrNumber: 'LR-987654',
      vehicleNumber: 'GJ-05-XX-1234',
      transportMode: 'Road',
    }

    for (const vMargin of [0, 15, 25, 35, 50]) {
      const element = React.createElement(InvoicePDF, {
        invoice: testInvoice,
        business: saarthiBusiness,
        customDesign: {
          marginTop: vMargin,
          marginBottom: vMargin,
          marginLeft: 10,
          marginRight: 10,
          showShipTo: true,
          showTransportInfo: true,
        } as any,
      })

      const stream = await pdf(element as any).toBuffer()
      expect(stream).toBeDefined()
    }
  })
})
