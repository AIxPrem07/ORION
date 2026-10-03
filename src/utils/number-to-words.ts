/**
 * Indian Number to Words Converter for Invoices
 * e.g., 125000 -> "One Lakh Twenty Five Thousand Rupees Only"
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
]

function convertBelowThousand(n: number): string {
  let str = ''
  if (n >= 100) {
    str += `${ONES[Math.floor(n / 100)]} Hundred `
    n %= 100
  }
  if (n >= 20) {
    str += `${TENS[Math.floor(n / 10)]} `
    n %= 10
  }
  if (n > 0) {
    str += `${ONES[n]} `
  }
  return str.trim()
}

/**
 * Converts a rupee amount (number) into words using Indian numbering system
 * (Crores, Lakhs, Thousands, Hundreds)
 */
export function numberToWordsRupees(rupees: number): string {
  if (rupees === 0) return 'Zero Rupees Only'

  const wholeRupees = Math.floor(rupees)
  const paise = Math.round((rupees - wholeRupees) * 100)

  let n = wholeRupees
  let words = ''

  const crore = Math.floor(n / 1_00_00_000)
  n %= 1_00_00_000

  const lakh = Math.floor(n / 1_00_000)
  n %= 1_00_000

  const thousand = Math.floor(n / 1_000)
  n %= 1_000

  const remainder = n

  if (crore > 0) {
    words += `${convertBelowThousand(crore)} Crore `
  }
  if (lakh > 0) {
    words += `${convertBelowThousand(lakh)} Lakh `
  }
  if (thousand > 0) {
    words += `${convertBelowThousand(thousand)} Thousand `
  }
  if (remainder > 0) {
    words += `${convertBelowThousand(remainder)} `
  }

  words = words.trim()
  if (words) {
    words += ' Rupees'
  }

  if (paise > 0) {
    const paiseWords = convertBelowThousand(paise)
    words += ` and ${paiseWords} Paise`
  }

  return `${words} Only`
}

/**
 * Converts paise (integer) to words
 */
export function paiseToWords(paise: number): string {
  const rupees = paise / 100
  return numberToWordsRupees(rupees)
}
