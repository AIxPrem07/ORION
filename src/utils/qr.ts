/**
 * ORION QR Code & UPI Payment Generator
 * 
 * Generates dynamic, scannable UPI payment QR codes conforming to NPCI standards.
 * Outputs base64 PNG data URLs that render directly in HTML <img> and @react-pdf/renderer <Image>.
 */
import QRCode from 'qrcode'
import { paiseToRupees } from './decimal'

export interface UPIPaymentOptions {
  upiId: string
  payeeName: string
  amountPaise: number
  invoiceNumber: string
}

/**
 * Builds a standard NPCI UPI payment deep link string
 * Format: upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...
 */
export function buildUPIPaymentURI(options: UPIPaymentOptions): string {
  const { upiId, payeeName, amountPaise, invoiceNumber } = options
  const amountStr = paiseToRupees(amountPaise)
  const cleanUpiId = upiId.trim()
  const cleanPayee = encodeURIComponent(payeeName.trim().slice(0, 50))
  const cleanNote = encodeURIComponent(`Invoice ${invoiceNumber.trim()}`)

  return `upi://pay?pa=${cleanUpiId}&pn=${cleanPayee}&am=${amountStr}&cu=INR&tn=${cleanNote}`
}

/**
 * Generates a high-resolution base64 PNG data URL from any text/URI string.
 */
export async function generateQRCodeDataURL(
  text: string,
  width = 256,
): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width,
      margin: 1,
      color: {
        dark: '#111827', // dark charcoal
        light: '#FFFFFF', // pure white
      },
      errorCorrectionLevel: 'M',
    })
  } catch (err) {
    console.error('[QR] Failed to generate QR code:', err)
    return ''
  }
}

/**
 * Generates a dynamic UPI payment QR code as a base64 PNG data URL.
 */
export async function generateUPIQRCode(options: UPIPaymentOptions): Promise<string> {
  if (!options.upiId || !options.upiId.includes('@')) {
    return ''
  }
  const uri = buildUPIPaymentURI(options)
  return await generateQRCodeDataURL(uri, 256)
}
