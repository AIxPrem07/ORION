import { describe, it, expect } from 'vitest'
import { parseCSVToRows, generateCSV } from '@services/import-export.service'

describe('import-export.service — RFC-4180 CSV Engine', () => {
  it('parses standard flat CSV rows', () => {
    const csv = `Name,Phone,City\nAlice,9876543210,Mumbai\nBob,9123456789,Pune`
    const rows = parseCSVToRows(csv)
    expect(rows).toEqual([
      ['Name', 'Phone', 'City'],
      ['Alice', '9876543210', 'Mumbai'],
      ['Bob', '9123456789', 'Pune'],
    ])
  })

  it('correctly handles quoted fields containing commas', () => {
    const csv = `Product,Price,Description\n"Widget, Standard",150,"High quality, durable widget"\n"Bolt, Hex",25,"M8 steel"`
    const rows = parseCSVToRows(csv)
    expect(rows.length).toBe(3)
    expect(rows[1][0]).toBe('Widget, Standard')
    expect(rows[1][1]).toBe('150')
    expect(rows[1][2]).toBe('High quality, durable widget')
    expect(rows[2][0]).toBe('Bolt, Hex')
  })

  it('correctly unescapes double quotes inside quoted fields', () => {
    const csv = `Title,Note\n"Quote","He said ""Hello World"" clearly"`
    const rows = parseCSVToRows(csv)
    expect(rows[1][1]).toBe('He said "Hello World" clearly')
  })

  it('handles CRLF line breaks and whitespace around cells', () => {
    const csv = "Col A , Col B \r\n Val 1 , Val 2 \r\n Val 3 , Val 4 "
    const rows = parseCSVToRows(csv)
    expect(rows).toEqual([
      ['Col A', 'Col B'],
      ['Val 1', 'Val 2'],
      ['Val 3', 'Val 4'],
    ])
  })

  it('generates compliant RFC-4180 CSV with quotes where necessary', () => {
    const headers = ['Name', 'Address', 'Amount']
    const data = [
      ['Acme Corp', '123 Main St, Suite 4', 1500],
      ['John "The Boss" Doe', 'Normal Street', 200],
    ]
    const csv = generateCSV(headers, data)
    expect(csv).toContain('"123 Main St, Suite 4"')
    expect(csv).toContain('"John ""The Boss"" Doe"')
    expect(csv).toContain('Normal Street')
  })
})
