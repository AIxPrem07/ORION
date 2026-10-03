import { describe, it, expect } from 'vitest'
import { buildUPIPaymentURI, generateQRCodeDataURL, generateUPIQRCode } from '@/utils/qr'

describe('QR Code & UPI Generator', () => {
  it('builds standard NPCI-compliant UPI payment URI', () => {
    const uri = buildUPIPaymentURI({
      upiId: 'business@icici',
      payeeName: 'Orion Supermarket',
      amountPaise: 11800,
      invoiceNumber: 'INV-2026-0001',
    })

    expect(uri).toContain('upi://pay?')
    expect(uri).toContain('pa=business@icici')
    expect(uri).toContain('pn=Orion%20Supermarket')
    expect(uri).toContain('am=118.00')
    expect(uri).toContain('cu=INR')
    expect(uri).toContain('tn=Invoice%20INV-2026-0001')
  })

  it('generates base64 PNG data URL for generic text', async () => {
    const dataUrl = await generateQRCodeDataURL('https://orion.app')
    expect(dataUrl).toMatch(/^data:image\/png;base64,/)
  })

  it('generates base64 PNG QR code for UPI payment', async () => {
    const dataUrl = await generateUPIQRCode({
      upiId: 'merchant@upi',
      payeeName: 'Merchant Store',
      amountPaise: 250000,
      invoiceNumber: 'INV-101',
    })
    expect(dataUrl).toMatch(/^data:image\/png;base64,/)
  })
})
