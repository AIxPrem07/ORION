/**
 * ORION WhatsApp Sharing Service
 * 
 * Formats a professional invoice notification message and opens it via
 * WhatsApp Web or the WhatsApp desktop application using tauri-plugin-opener.
 */

import { openUrl } from '@tauri-apps/plugin-opener'
import { formatCurrency } from '@utils/decimal'
import { formatDate } from '@utils/date'
import type { InvoiceWithItems } from '@/types/invoice'
import type { Business } from '@/types/business'

export function formatInvoiceWhatsAppMessage(
  invoice: InvoiceWithItems,
  business: Business,
): string {
  const customerName = invoice.customerSnapshot?.name || 'Valued Customer'
  const dueDateStr = invoice.dueDate ? `\n*Due Date:* ${formatDate(invoice.dueDate)}` : ''
  const upiStr = business.upiId ? `\n*UPI ID:* ${business.upiId}` : ''

  return (
    `*TAX INVOICE — ${business.name}*\n\n` +
    `Dear ${customerName},\n\n` +
    `Here are your invoice details:\n` +
    `*Invoice No:* ${invoice.invoiceNumber}\n` +
    `*Invoice Date:* ${formatDate(invoice.invoiceDate)}` +
    dueDateStr +
    `\n*Total Amount:* ${formatCurrency(invoice.totalAmount)}\n` +
    `*Status:* ${invoice.paymentStatus}\n` +
    upiStr +
    `\n\nThank you for doing business with us!`
  )
}

/**
 * Share invoice via WhatsApp. Formats the phone number and opens the WhatsApp deep link.
 */
export async function shareInvoiceViaWhatsApp(
  invoice: InvoiceWithItems,
  business: Business,
  recipientPhone?: string,
): Promise<void> {
  const phone = recipientPhone || invoice.customerSnapshot?.phone || ''
  const cleanPhone = phone.replace(/[^0-9]/g, '')
  // Normalize Indian mobile numbers: prepend 91 if 10 digits
  const formattedPhone =
    cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone

  const message = formatInvoiceWhatsAppMessage(invoice, business)
  const encodedText = encodeURIComponent(message)

  const url = formattedPhone
    ? `https://wa.me/${formattedPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`

  await openUrl(url)
}
