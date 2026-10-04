/**
 * ORION PDF Generation & Printing Service
 * 
 * Uses @react-pdf/renderer to create professional GST invoices in PDF format.
 * Saves the generated PDF blob to the local filesystem and provides helpers to
 * open, download, and print via native Tauri commands.
 */

import React from 'react'
import { pdf } from '@react-pdf/renderer'
import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { openPath } from '@tauri-apps/plugin-opener'
import { invoke } from '@tauri-apps/api/core'
import { InvoicePDF } from '@/pdf/InvoicePDF'
import { ChallanPDF } from '@/pdf/ChallanPDF'
import { generateUPIQRCode, generateQRCodeDataURL } from '@utils/qr'
import { paiseToRupees } from '@utils/decimal'
import { getAppSetting } from '@services/business.service'
import type { InvoiceWithItems } from '@/types/invoice'
import type { ChallanWithItems } from '@/types/challan'
import type { Business, InvoicePaperSize, InvoiceTheme } from '@/types/business'
import type { InvoiceCustomDesign } from '@/types/invoice-design'
import { getInvoiceDesignConfig } from './invoice-design.service'

export interface InvoicePDFOptions {
  paperSize?: InvoicePaperSize
  theme?: InvoiceTheme
  customDesign?: InvoiceCustomDesign
}

/**
 * Generates the PDF blob for an invoice
 */
export async function generateInvoicePDFBlob(
  invoice: InvoiceWithItems,
  business: Business,
  options?: InvoicePDFOptions,
): Promise<Blob> {
  let paperSize = options?.paperSize
  let theme = options?.theme
  let customDesign = options?.customDesign

  if (!customDesign) {
    customDesign = await getInvoiceDesignConfig()
  }

  if (!paperSize) {
    const savedSize = await getAppSetting('invoice_paper_size')
    if (savedSize === 'A4' || savedSize === 'A5' || savedSize === 'THERMAL') {
      paperSize = savedSize
    } else {
      paperSize = 'A4'
    }
  }

  if (!theme) {
    const savedTheme = await getAppSetting('invoice_theme')
    if (savedTheme === 'SLATE_BLUE' || savedTheme === 'CLASSIC_NAVY' || savedTheme === 'MONOCHROME' || savedTheme === 'EMERALD') {
      theme = savedTheme
    } else {
      theme = 'SLATE_BLUE'
    }
  }

  let upiQrCodeUrl: string | undefined
  if (customDesign.showQrCode) {
    try {
      if (customDesign.customQrUrl) {
        upiQrCodeUrl = customDesign.customQrUrl
      } else if (business.upiId && invoice.totalAmount > 0) {
        upiQrCodeUrl = await generateUPIQRCode({
          upiId: business.upiId,
          payeeName: business.name,
          amountPaise: invoice.totalAmount,
          invoiceNumber: invoice.invoiceNumber,
        })
      }
    } catch (err) {
      console.warn('[PDF] Failed to generate dynamic QR code:', err)
    }
  }

  const element = React.createElement(InvoicePDF, { invoice, business, upiQrCodeUrl, paperSize, theme, customDesign })
  const instance = pdf(element as any)
  return await instance.toBlob()
}

/**
 * Creates an in-memory Object URL for PDF preview in an iframe or modal
 */
export async function getInvoicePDFBlobUrl(
  invoice: InvoiceWithItems,
  business: Business,
  options?: InvoicePDFOptions,
): Promise<string> {
  const blob = await generateInvoicePDFBlob(invoice, business, options)
  return URL.createObjectURL(blob)
}

/**
 * Generates and saves an invoice PDF file to disk in the app data directory
 * Returns the absolute path to the saved PDF file.
 */
export async function saveInvoicePDFToDisk(
  invoice: InvoiceWithItems,
  business: Business,
  options?: InvoicePDFOptions,
): Promise<string> {
  const blob = await generateInvoicePDFBlob(invoice, business, options)
  const arrayBuffer = await blob.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  const dir = await appDataDir()
  const sanitizedInvoiceNum = invoice.invoiceNumber.replace(/[\/\\]/g, '_')
  const fileName = `invoice_${sanitizedInvoiceNum}.pdf`
  const filePath = await join(dir, fileName)

  try {
    await writeFile(fileName, uint8Array, { baseDir: BaseDirectory.AppData })
  } catch (fsErr) {
    console.warn('[PDF] BaseDirectory write failed, trying absolute path:', fsErr)
    await writeFile(filePath, uint8Array)
  }

  return filePath
}

/**
 * Triggers browser/system file download of the invoice PDF
 */
export async function downloadInvoicePDF(
  invoice: InvoiceWithItems,
  business: Business,
  options?: InvoicePDFOptions,
): Promise<void> {
  const blob = await generateInvoicePDFBlob(invoice, business, options)
  const url = URL.createObjectURL(blob)
  const sanitizedInvoiceNum = invoice.invoiceNumber.replace(/[\/\\]/g, '_')
  const a = document.createElement('a')
  a.href = url
  a.download = `Invoice_${sanitizedInvoiceNum}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 15000)
}

/**
 * Opens the invoice PDF in the system default PDF viewer (e.g. Preview on macOS)
 */
export async function openInvoicePDF(
  invoice: InvoiceWithItems,
  business: Business,
  options?: InvoicePDFOptions,
): Promise<string> {
  const filePath = await saveInvoicePDFToDisk(invoice, business, options)
  try {
    await openPath(filePath)
  } catch (openErr) {
    console.warn('[PDF] openPath failed, falling back to open_pdf command:', openErr)
    await invoke('open_pdf', { filePath })
  }
  return filePath
}

/**
 * Triggers the system print dialog for the invoice PDF
 */
export async function printInvoicePDF(
  invoice: InvoiceWithItems,
  business: Business,
  options?: InvoicePDFOptions,
): Promise<void> {
  const filePath = await saveInvoicePDFToDisk(invoice, business, options)
  try {
    await invoke('print_pdf', { filePath })
  } catch (err) {
    console.warn('[PDF] Native print_pdf failed, opening system viewer for printing:', err)
    await openPath(filePath).catch(() => invoke('open_pdf', { filePath }))
  }
}

/**
 * Generates the PDF blob for a Delivery Challan
 */
export async function generateChallanPDFBlob(
  challan: ChallanWithItems,
  business: Business,
): Promise<Blob> {
  const doc = React.createElement(ChallanPDF, { challan, business })
  return await pdf(doc as React.ReactElement).toBlob()
}

/**
 * Triggers a browser/system download for a Delivery Challan PDF
 */
export async function downloadChallanPDF(
  challan: ChallanWithItems,
  business: Business,
): Promise<void> {
  const blob = await generateChallanPDFBlob(challan, business)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const sanitizedNum = (challan.challanNumber || 'Challan').replace(/[^a-zA-Z0-9_-]/g, '_')
  a.download = `Challan_${sanitizedNum}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 15000)
}

/**
 * Saves and triggers system printing for Delivery Challan PDF
 */
export async function printChallanPDF(
  challan: ChallanWithItems,
  business: Business,
): Promise<void> {
  const blob = await generateChallanPDFBlob(challan, business)
  const arrayBuffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  const sanitizedNum = (challan.challanNumber || 'Challan').replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `Challan_${sanitizedNum}.pdf`

  await writeFile(fileName, bytes, { baseDir: BaseDirectory.AppData })
  const baseDir = await appDataDir()
  const filePath = await join(baseDir, fileName)

  try {
    await invoke('print_pdf', { filePath })
  } catch (err) {
    console.warn('[PDF] Native print_pdf failed for challan, opening system viewer:', err)
    await openPath(filePath).catch(() => invoke('open_pdf', { filePath }))
  }
}
