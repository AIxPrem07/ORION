/**
 * ORION Import / Export Service
 * 
 * Complies with RFC-4180 CSV standard.
 * Supports:
 * - Robust CSV parsing with quotes, commas, escapes, and multi-line content
 * - Data validation & deduplication for Customer and Product bulk imports
 * - Opening balance and opening stock movement auto-creation
 * - CSV export for Invoices, Purchases, Inventory, Customers, and Suppliers
 */
import { dbSelect, dbExecute } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'
import { recordStockMovement } from './inventory.service'
import { recordAuditEvent } from './audit.service'
import { formatCurrency, paiseToRupees } from '@utils/decimal'

// ============================================================================
// RFC-4180 CSV PARSER & GENERATOR
// ============================================================================

/**
 * Parses raw CSV string into a 2D array of string cells.
 * Correctly handles quotes, commas inside quotes, escaped double quotes (""), and CR/LF.
 */
export function parseCSVToRows(csvText: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  let i = 0

  while (i < text.length) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped quote: "" -> "
          currentCell += '"'
          i += 2
          continue
        } else {
          // Closing quote
          inQuotes = false
          i++
          continue
        }
      } else {
        currentCell += char
        i++
        continue
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
        continue
      } else if (char === ',') {
        currentRow.push(currentCell.trim())
        currentCell = ''
        i++
        continue
      } else if (char === '\n') {
        currentRow.push(currentCell.trim())
        // Only push non-empty rows
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow)
        }
        currentRow = []
        currentCell = ''
        i++
        continue
      } else {
        currentCell += char
        i++
        continue
      }
    }
  }

  // Push remaining cell/row if present
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow)
    }
  }

  return rows
}

/**
 * Converts array of objects or rows into RFC-4180 CSV text.
 */
export function generateCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headerLine = headers.map(escapeCell).join(',')
  const dataLines = rows.map((r) => r.map(escapeCell).join(','))
  return [headerLine, ...dataLines].join('\r\n')
}

/**
 * Browser-compatible CSV file trigger.
 */
export function triggerCSVDownload(filename: string, csvContent: string): void {
  // Prepend UTF-8 BOM (\uFEFF) so Excel, Numbers, and Google Sheets open Indian Rupee symbols (₹) and characters without corrupting encoding
  const contentWithBOM = csvContent.startsWith('\uFEFF') ? csvContent : '\uFEFF' + csvContent
  const blob = new Blob([contentWithBOM], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ============================================================================
// CUSTOMER IMPORT & EXPORT
// ============================================================================

export interface ImportResult {
  totalRows: number
  imported: number
  skipped: number
  errors: string[]
}

/**
 * Parse and import customers from CSV content.
 */
export async function importCustomersFromCSV(
  csvContent: string,
  businessId: string,
): Promise<ImportResult> {
  const rows = parseCSVToRows(csvContent)
  if (rows.length < 2) {
    throw new Error('CSV file must contain a header row and at least one data row.')
  }

  const rawHeaders = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const dataRows = rows.slice(1)

  // Map column indices
  const nameIdx = rawHeaders.findIndex((h) => h === 'name' || h === 'customername')
  const phoneIdx = rawHeaders.findIndex((h) => h === 'phone' || h === 'mobile' || h === 'contact')
  const emailIdx = rawHeaders.findIndex((h) => h === 'email')
  const gstinIdx = rawHeaders.findIndex((h) => h === 'gstin' || h === 'gst')
  const panIdx = rawHeaders.findIndex((h) => h === 'pan')
  const addressIdx = rawHeaders.findIndex((h) => h === 'address')
  const cityIdx = rawHeaders.findIndex((h) => h === 'city')
  const stateIdx = rawHeaders.findIndex((h) => h === 'state')
  const stateCodeIdx = rawHeaders.findIndex((h) => h === 'statecode')
  const pinIdx = rawHeaders.findIndex((h) => h === 'pin' || h === 'pincode' || h === 'zip')
  const balanceIdx = rawHeaders.findIndex((h) => h.includes('balance') || h.includes('opening'))

  if (nameIdx === -1) {
    throw new Error('CSV is missing required column: "Name" or "Customer Name".')
  }

  // Pre-fetch existing customer names & GSTINs for deduplication
  const existing = await dbSelect<{ name: string; phone: string | null; gstin: string | null }>(
    `SELECT LOWER(name) as name, phone, gstin FROM customers WHERE business_id = ?`,
    [businessId],
  )
  const existingNames = new Set(existing.map((e) => e.name.toLowerCase().trim()))
  const existingPhones = new Set(existing.filter((e) => e.phone).map((e) => e.phone!.trim()))
  const existingGSTINs = new Set(existing.filter((e) => e.gstin).map((e) => e.gstin!.toUpperCase().trim()))

  let imported = 0
  let skipped = 0
  const errors: string[] = []
  const now = nowISO()

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNum = i + 2 // 1-indexed, accounting for header
    const name = row[nameIdx]?.trim()

    if (!name) {
      errors.push(`Row ${rowNum}: Customer Name is required.`)
      skipped++
      continue
    }

    const phone = phoneIdx !== -1 ? row[phoneIdx]?.trim() || null : null
    const email = emailIdx !== -1 ? row[emailIdx]?.trim() || null : null
    const gstin = gstinIdx !== -1 ? row[gstinIdx]?.trim().toUpperCase() || null : null
    const pan = panIdx !== -1 ? row[panIdx]?.trim().toUpperCase() || null : null
    const address = addressIdx !== -1 ? row[addressIdx]?.trim() || null : null
    const city = cityIdx !== -1 ? row[cityIdx]?.trim() || null : null
    const state = stateIdx !== -1 ? row[stateIdx]?.trim() || null : null
    const stateCode = stateCodeIdx !== -1 ? row[stateCodeIdx]?.trim() || null : null
    const pin = pinIdx !== -1 ? row[pinIdx]?.trim() || null : null

    // Deduplication check
    if (existingNames.has(name.toLowerCase())) {
      errors.push(`Row ${rowNum}: Customer "${name}" already exists — skipped duplicate.`)
      skipped++
      continue
    }
    if (phone && existingPhones.has(phone)) {
      errors.push(`Row ${rowNum}: Customer with phone "${phone}" already exists — skipped.`)
      skipped++
      continue
    }
    if (gstin && existingGSTINs.has(gstin)) {
      errors.push(`Row ${rowNum}: Customer with GSTIN "${gstin}" already exists — skipped.`)
      skipped++
      continue
    }

    // Opening balance in paise (e.g. ₹150.50 -> 15050 paise)
    let openingBalance = 0
    if (balanceIdx !== -1 && row[balanceIdx]) {
      const parsed = parseFloat(row[balanceIdx].replace(/[^0-9.-]/g, ''))
      if (!isNaN(parsed)) {
        openingBalance = Math.round(parsed * 100)
      }
    }

    const id = generateId()
    await dbExecute(
      `INSERT INTO customers
       (id, business_id, name, phone, email, address, city, state, state_code, pin, gstin, pan, opening_balance, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        businessId,
        name,
        phone,
        email,
        address,
        city,
        state,
        stateCode,
        pin,
        gstin,
        pan,
        openingBalance,
        now,
        now,
      ],
    )

    existingNames.add(name.toLowerCase())
    if (phone) existingPhones.add(phone)
    if (gstin) existingGSTINs.add(gstin)
    imported++
  }

  await recordAuditEvent({
    businessId,
    action: 'CREATED',
    entityType: 'CUSTOMER',
    entityId: businessId,
    newValues: { bulkImported: imported, skipped, total: dataRows.length },
  })

  return { totalRows: dataRows.length, imported, skipped, errors }
}

/**
 * Export all active customers to CSV.
 */
export async function exportCustomersToCSV(businessId: string): Promise<string> {
  const rows = await dbSelect<any>(
    `SELECT name, phone, email, gstin, pan, address, city, state, state_code, pin, opening_balance
     FROM customers
     WHERE business_id = ?
     ORDER BY name ASC`,
    [businessId],
  )

  const headers = [
    'Customer Name',
    'Phone',
    'Email',
    'GSTIN',
    'PAN',
    'Address',
    'City',
    'State',
    'State Code',
    'PIN',
    'Opening Balance (₹)',
  ]

  const data = rows.map((r: any) => [
    r.name,
    r.phone ?? '',
    r.email ?? '',
    r.gstin ?? '',
    r.pan ?? '',
    r.address ?? '',
    r.city ?? '',
    r.state ?? '',
    r.state_code ?? '',
    r.pin ?? '',
    paiseToRupees(r.opening_balance),
  ])

  return generateCSV(headers, data)
}

// ============================================================================
// PRODUCT IMPORT & EXPORT
// ============================================================================

/**
 * Parse and import products from CSV content.
 */
export async function importProductsFromCSV(
  csvContent: string,
  businessId: string,
): Promise<ImportResult> {
  const rows = parseCSVToRows(csvContent)
  if (rows.length < 2) {
    throw new Error('CSV file must contain a header row and at least one data row.')
  }

  const rawHeaders = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const dataRows = rows.slice(1)

  const nameIdx = rawHeaders.findIndex((h) => h === 'name' || h === 'productname' || h === 'itemname')
  const skuIdx = rawHeaders.findIndex((h) => h === 'sku' || h === 'itemcode' || h === 'code')
  const hsnIdx = rawHeaders.findIndex((h) => h === 'hsn' || h === 'hsncode')
  const sellPriceIdx = rawHeaders.findIndex((h) => h === 'sellingprice' || h === 'price' || h === 'sale')
  const costPriceIdx = rawHeaders.findIndex((h) => h === 'purchaseprice' || h === 'cost' || h === 'costprice')
  const mrpIdx = rawHeaders.findIndex((h) => h === 'mrp')
  const taxRateIdx = rawHeaders.findIndex((h) => h === 'taxrate' || h === 'gst' || h === 'tax' || h === 'gstpercent')
  const stockIdx = rawHeaders.findIndex((h) => h.includes('stock') || h.includes('quantity'))

  if (nameIdx === -1) {
    throw new Error('CSV is missing required column: "Name" or "Product Name".')
  }

  // Pre-fetch tax rates and units
  const taxRates = await dbSelect<{ id: string; rate: number }>(
    `SELECT id, rate FROM tax_rates WHERE business_id = ?`,
    [businessId],
  )
  const defaultTaxRate = taxRates.find((t) => t.rate === 1800) ?? taxRates[0]

  const units = await dbSelect<{ id: string; abbreviation: string }>(
    `SELECT id, abbreviation FROM units WHERE business_id = ?`,
    [businessId],
  )
  const defaultUnit = units.find((u) => u.abbreviation.toLowerCase() === 'pcs') ?? units[0]

  // Existing products for deduplication
  const existing = await dbSelect<{ name: string; sku: string | null }>(
    `SELECT LOWER(name) as name, sku FROM products WHERE business_id = ?`,
    [businessId],
  )
  const existingNames = new Set(existing.map((e) => e.name.toLowerCase().trim()))
  const existingSkus = new Set(existing.filter((e) => e.sku).map((e) => e.sku!.toLowerCase().trim()))

  let imported = 0
  let skipped = 0
  const errors: string[] = []
  const now = nowISO()

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNum = i + 2
    const name = row[nameIdx]?.trim()

    if (!name) {
      errors.push(`Row ${rowNum}: Product Name is required.`)
      skipped++
      continue
    }

    const sku = skuIdx !== -1 ? row[skuIdx]?.trim() || null : null
    const hsn = hsnIdx !== -1 ? row[hsnIdx]?.trim() || null : null

    // Deduplication check
    if (existingNames.has(name.toLowerCase())) {
      errors.push(`Row ${rowNum}: Product "${name}" already exists — skipped duplicate.`)
      skipped++
      continue
    }
    if (sku && existingSkus.has(sku.toLowerCase())) {
      errors.push(`Row ${rowNum}: Product with SKU "${sku}" already exists — skipped.`)
      skipped++
      continue
    }

    // Parse prices into paise
    let sellingPrice = 0
    if (sellPriceIdx !== -1 && row[sellPriceIdx]) {
      const parsed = parseFloat(row[sellPriceIdx].replace(/[^0-9.-]/g, ''))
      if (!isNaN(parsed)) sellingPrice = Math.max(0, Math.round(parsed * 100))
    }

    let purchasePrice = 0
    if (costPriceIdx !== -1 && row[costPriceIdx]) {
      const parsed = parseFloat(row[costPriceIdx].replace(/[^0-9.-]/g, ''))
      if (!isNaN(parsed)) purchasePrice = Math.max(0, Math.round(parsed * 100))
    }

    let mrp = sellingPrice
    if (mrpIdx !== -1 && row[mrpIdx]) {
      const parsed = parseFloat(row[mrpIdx].replace(/[^0-9.-]/g, ''))
      if (!isNaN(parsed)) mrp = Math.max(0, Math.round(parsed * 100))
    }

    // Match tax rate basis points (e.g. 18% -> 1800)
    let taxRateId = defaultTaxRate?.id ?? null
    if (taxRateIdx !== -1 && row[taxRateIdx]) {
      const rawRate = parseFloat(row[taxRateIdx].replace(/[^0-9.]/g, ''))
      if (!isNaN(rawRate)) {
        const bp = Math.round(rawRate * 100)
        const matched = taxRates.find((t) => Math.abs(t.rate - bp) <= 10)
        if (matched) taxRateId = matched.id
      }
    }

    // Parse opening stock (scaled x100)
    let openingStock = 0
    if (stockIdx !== -1 && row[stockIdx]) {
      const parsed = parseFloat(row[stockIdx].replace(/[^0-9.-]/g, ''))
      if (!isNaN(parsed)) openingStock = Math.max(0, Math.round(parsed * 100))
    }

    const id = generateId()
    await dbExecute(
      `INSERT INTO products
       (id, business_id, name, sku, hsn_code, unit_id, purchase_price, selling_price, mrp, tax_rate_id, opening_stock, minimum_stock, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`,
      [
        id,
        businessId,
        name,
        sku,
        hsn,
        defaultUnit?.id ?? null,
        purchasePrice,
        sellingPrice,
        mrp,
        taxRateId,
        openingStock,
        now,
        now,
      ],
    )

    // Seed stock movement for opening stock if present
    if (openingStock > 0) {
      await recordStockMovement({
        businessId,
        productId: id,
        movementType: 'OPENING',
        quantity: openingStock,
        notes: 'Initial stock from CSV import',
      })
    }

    existingNames.add(name.toLowerCase())
    if (sku) existingSkus.add(sku.toLowerCase())
    imported++
  }

  await recordAuditEvent({
    businessId,
    action: 'CREATED',
    entityType: 'PRODUCT',
    entityId: businessId,
    newValues: { bulkImported: imported, skipped, total: dataRows.length },
  })

  return { totalRows: dataRows.length, imported, skipped, errors }
}

/**
 * Export all products with stock to CSV.
 */
export async function exportProductsToCSV(businessId: string): Promise<string> {
  const rows = await dbSelect<any>(
    `SELECT p.name, p.sku, p.hsn_code, u.abbreviation as unit,
            p.selling_price, p.purchase_price, p.mrp,
            t.rate as tax_rate,
            COALESCE(SUM(sm.quantity), 0) as current_stock
     FROM products p
     LEFT JOIN units u ON p.unit_id = u.id
     LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
     LEFT JOIN stock_movements sm ON p.id = sm.product_id
     WHERE p.business_id = ?
     GROUP BY p.id
     ORDER BY p.name ASC`,
    [businessId],
  )

  const headers = [
    'Product Name',
    'SKU',
    'HSN Code',
    'Unit',
    'Selling Price (₹)',
    'Cost Price (₹)',
    'MRP (₹)',
    'GST Rate (%)',
    'Current Stock',
  ]

  const data = rows.map((r: any) => [
    r.name,
    r.sku ?? '',
    r.hsn_code ?? '',
    r.unit ?? 'pcs',
    paiseToRupees(r.selling_price),
    paiseToRupees(r.purchase_price),
    paiseToRupees(r.mrp),
    r.tax_rate ? (r.tax_rate / 100).toFixed(0) : '0',
    (r.current_stock / 100).toFixed(2),
  ])

  return generateCSV(headers, data)
}

// ============================================================================
// TRANSACTION EXPORTS (INVOICES, PURCHASES, STOCK MOVEMENTS)
// ============================================================================

export async function exportInvoicesToCSV(businessId: string): Promise<string> {
  const rows = await dbSelect<any>(
    `SELECT inv.invoice_number, inv.invoice_date, inv.due_date,
            COALESCE(c.name, json_extract(inv.customer_snapshot, '$.name'), 'Walk-in') as customer_name,
            COALESCE(c.gstin, json_extract(inv.customer_snapshot, '$.gstin'), '') as customer_gstin,
            inv.supply_type, inv.payment_method,
            inv.taxable_amount, inv.cgst_amount, inv.sgst_amount, inv.igst_amount,
            inv.total_tax, inv.round_off, inv.total_amount, inv.paid_amount,
            inv.status, inv.payment_status
     FROM invoices inv
     LEFT JOIN customers c ON inv.customer_id = c.id
     WHERE inv.business_id = ?
     ORDER BY inv.invoice_date DESC, inv.created_at DESC`,
    [businessId],
  )

  const headers = [
    'Invoice Number',
    'Date',
    'Due Date',
    'Customer',
    'Customer GSTIN',
    'Supply Type',
    'Taxable Amount (₹)',
    'CGST (₹)',
    'SGST (₹)',
    'IGST (₹)',
    'Total Tax (₹)',
    'Round Off (₹)',
    'Grand Total (₹)',
    'Paid Amount (₹)',
    'Balance Due (₹)',
    'Status',
    'Payment Status',
    'Payment Method',
  ]

  const data = rows.map((r: any) => [
    r.invoice_number,
    r.invoice_date,
    r.due_date ?? '',
    r.customer_name ?? 'Walk-in',
    r.customer_gstin ?? '',
    r.supply_type ?? 'INTRASTATE',
    paiseToRupees(r.taxable_amount),
    paiseToRupees(r.cgst_amount),
    paiseToRupees(r.sgst_amount),
    paiseToRupees(r.igst_amount),
    paiseToRupees(r.total_tax),
    paiseToRupees(r.round_off),
    paiseToRupees(r.total_amount),
    paiseToRupees(r.paid_amount),
    paiseToRupees(Math.max(0, (r.total_amount || 0) - (r.paid_amount || 0))),
    r.status,
    r.payment_status,
    r.payment_method ?? '—',
  ])

  return generateCSV(headers, data)
}

/**
 * Export detailed party or general ledger entries to CSV.
 */
export async function exportLedgerToCSV(
  businessId: string,
  filter: {
    partyType?: 'CUSTOMER' | 'SUPPLIER'
    partyId?: string
    partyName?: string
    fromDate?: string
    toDate?: string
  } = {},
): Promise<string> {
  const conditions: string[] = ['le.business_id = ?']
  const params: unknown[] = [businessId]

  if (filter.partyType) { conditions.push('le.party_type = ?'); params.push(filter.partyType) }
  if (filter.partyId) { conditions.push('le.party_id = ?'); params.push(filter.partyId) }
  if (filter.fromDate) { conditions.push('le.entry_date >= ?'); params.push(filter.fromDate) }
  if (filter.toDate) { conditions.push('le.entry_date <= ?'); params.push(filter.toDate) }

  const whereClause = conditions.join(' AND ')

  const rows = await dbSelect<any>(
    `SELECT le.entry_date, le.party_type, le.reference_type, le.description,
            le.debit, le.credit, le.balance, le.created_at,
            CASE
              WHEN le.party_type = 'CUSTOMER' THEN COALESCE(c.name, 'Customer')
              WHEN le.party_type = 'SUPPLIER' THEN COALESCE(s.name, 'Supplier')
              ELSE 'General'
            END as party_name
     FROM ledger_entries le
     LEFT JOIN customers c ON le.party_id = c.id AND le.party_type = 'CUSTOMER'
     LEFT JOIN suppliers s ON le.party_id = s.id AND le.party_type = 'SUPPLIER'
     WHERE ${whereClause}
     ORDER BY le.entry_date ASC, le.created_at ASC`,
    params,
  )

  let openingBalance = 0
  if (filter.partyId && filter.fromDate) {
    const opRows = await dbSelect<{ balance: number }>(
      `SELECT balance FROM ledger_entries
       WHERE business_id = ? AND party_type = ? AND party_id = ? AND entry_date < ?
       ORDER BY entry_date DESC, created_at DESC
       LIMIT 1`,
      [businessId, filter.partyType, filter.partyId, filter.fromDate],
    )
    openingBalance = opRows[0]?.balance ?? 0
  }

  const headers = [
    'Date',
    'Party Type',
    'Party Name',
    'Reference Type',
    'Description',
    'Debit (₹)',
    'Credit (₹)',
    'Running Balance (₹)',
  ]

  const dataRows: (string | number | null | undefined)[][] = []

  if (filter.fromDate) {
    dataRows.push([
      filter.fromDate,
      filter.partyType ?? '',
      filter.partyName ?? 'Party',
      'OPENING',
      'Opening Balance brought forward',
      openingBalance > 0 ? paiseToRupees(openingBalance) : '0.00',
      openingBalance < 0 ? paiseToRupees(Math.abs(openingBalance)) : '0.00',
      paiseToRupees(openingBalance),
    ])
  }

  let totalDebit = 0
  let totalCredit = 0

  for (const r of rows) {
    totalDebit += r.debit || 0
    totalCredit += r.credit || 0
    dataRows.push([
      r.entry_date,
      r.party_type ?? '',
      r.party_name ?? filter.partyName ?? '',
      r.reference_type,
      r.description,
      r.debit > 0 ? paiseToRupees(r.debit) : '0.00',
      r.credit > 0 ? paiseToRupees(r.credit) : '0.00',
      paiseToRupees(r.balance),
    ])
  }

  // Summary row
  dataRows.push([
    'TOTAL / CLOSING',
    '',
    filter.partyName ?? '',
    'SUMMARY',
    `Closing Balance: ${paiseToRupees(openingBalance + totalDebit - totalCredit)}`,
    paiseToRupees(totalDebit),
    paiseToRupees(totalCredit),
    paiseToRupees(openingBalance + totalDebit - totalCredit),
  ])

  return generateCSV(headers, dataRows)
}

export async function exportPurchasesToCSV(businessId: string): Promise<string> {
  const rows = await dbSelect<any>(
    `SELECT p.purchase_number, p.purchase_date, s.name as supplier_name,
            p.taxable_amount, p.total_tax, p.total_amount, p.paid_amount,
            p.status, p.payment_status
     FROM purchases p
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     WHERE p.business_id = ?
     ORDER BY p.purchase_date DESC, p.created_at DESC`,
    [businessId],
  )

  const headers = [
    'Purchase Number',
    'Date',
    'Supplier',
    'Taxable Amount (₹)',
    'Total Tax (₹)',
    'Grand Total (₹)',
    'Paid Amount (₹)',
    'Status',
    'Payment Status',
  ]

  const data = rows.map((r: any) => [
    r.purchase_number ?? '—',
    r.purchase_date,
    r.supplier_name ?? '—',
    paiseToRupees(r.taxable_amount),
    paiseToRupees(r.total_tax),
    paiseToRupees(r.total_amount),
    paiseToRupees(r.paid_amount),
    r.status,
    r.payment_status,
  ])

  return generateCSV(headers, data)
}

export async function exportStockMovementsToCSV(businessId: string): Promise<string> {
  const rows = await dbSelect<any>(
    `SELECT sm.created_at, p.name as product_name, p.sku,
            sm.movement_type, sm.quantity, sm.quantity_before, sm.quantity_after,
            sm.reference_type, sm.notes
     FROM stock_movements sm
     JOIN products p ON sm.product_id = p.id
     WHERE sm.business_id = ?
     ORDER BY sm.created_at DESC`,
    [businessId],
  )

  const headers = [
    'Timestamp',
    'Product Name',
    'SKU',
    'Movement Type',
    'Quantity Changed',
    'Stock Before',
    'Stock After',
    'Reference Type',
    'Notes',
  ]

  const data = rows.map((r: any) => [
    r.created_at,
    r.product_name,
    r.sku ?? '',
    r.movement_type,
    (r.quantity / 100).toFixed(2),
    (r.quantity_before / 100).toFixed(2),
    (r.quantity_after / 100).toFixed(2),
    r.reference_type ?? '',
    r.notes ?? '',
  ])

  return generateCSV(headers, data)
}
