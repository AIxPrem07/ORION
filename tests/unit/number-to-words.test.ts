import { describe, it, expect } from 'vitest'
import { numberToWordsRupees, paiseToWords } from '@/utils/number-to-words'

describe('Indian Currency Number to Words', () => {
  it('converts basic amounts', () => {
    expect(numberToWordsRupees(0)).toBe('Zero Rupees Only')
    expect(numberToWordsRupees(1)).toBe('One Rupees Only')
    expect(numberToWordsRupees(15)).toBe('Fifteen Rupees Only')
    expect(numberToWordsRupees(100)).toBe('One Hundred Rupees Only')
    expect(numberToWordsRupees(105)).toBe('One Hundred Five Rupees Only')
  })

  it('converts thousands, lakhs, and crores', () => {
    expect(numberToWordsRupees(1000)).toBe('One Thousand Rupees Only')
    expect(numberToWordsRupees(25000)).toBe('Twenty Five Thousand Rupees Only')
    expect(numberToWordsRupees(100000)).toBe('One Lakh Rupees Only')
    expect(numberToWordsRupees(125000)).toBe('One Lakh Twenty Five Thousand Rupees Only')
    expect(numberToWordsRupees(10000000)).toBe('One Crore Rupees Only')
    expect(numberToWordsRupees(12345678)).toBe(
      'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees Only',
    )
  })

  it('handles rupees with paise', () => {
    expect(numberToWordsRupees(100.5)).toBe('One Hundred Rupees and Fifty Paise Only')
    expect(numberToWordsRupees(1234.25)).toBe(
      'One Thousand Two Hundred Thirty Four Rupees and Twenty Five Paise Only',
    )
  })

  it('handles paise input directly', () => {
    expect(paiseToWords(10000)).toBe('One Hundred Rupees Only')
    expect(paiseToWords(10050)).toBe('One Hundred Rupees and Fifty Paise Only')
    expect(paiseToWords(5000000)).toBe('Fifty Thousand Rupees Only')
  })
})
