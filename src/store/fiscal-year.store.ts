/**
 * ORION Fiscal Year Store
 * 
 * Provides global active financial year state.
 * Allows filtering invoices, challans, analytics, and reports across FYs.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { currentFinancialYear, getRecentFinancialYears } from '@utils/date'

interface FiscalYearState {
  selectedFY: string // e.g. "26-27" or "ALL"
  setSelectedFY: (fy: string) => void
  availableFYs: string[]
  resetToCurrentFY: () => void
}

export const useFiscalYearStore = create<FiscalYearState>()(
  persist(
    (set) => ({
      selectedFY: currentFinancialYear(),
      availableFYs: getRecentFinancialYears(),
      setSelectedFY: (fy: string) => set({ selectedFY: fy }),
      resetToCurrentFY: () => set({ selectedFY: currentFinancialYear() }),
    }),
    {
      name: 'orion-fiscal-year',
    },
  ),
)
