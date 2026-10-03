import { getAppSetting, setAppSetting } from './business.service'
import {
  type InvoiceCustomDesign,
  DEFAULT_INVOICE_DESIGN,
} from '@/types/invoice-design'

const STORAGE_KEY = 'invoice_design_config'

/**
 * Retrieves the customized invoice layout configuration.
 * Returns default statutory configuration if not set or corrupted.
 */
export async function getInvoiceDesignConfig(): Promise<InvoiceCustomDesign> {
  try {
    const raw = await getAppSetting(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_INVOICE_DESIGN }
    const parsed = JSON.parse(raw) as Partial<InvoiceCustomDesign>
    return {
      ...DEFAULT_INVOICE_DESIGN,
      ...parsed,
      marginTop: typeof parsed.marginTop === 'number' ? parsed.marginTop : DEFAULT_INVOICE_DESIGN.marginTop,
      marginBottom: typeof parsed.marginBottom === 'number' ? parsed.marginBottom : DEFAULT_INVOICE_DESIGN.marginBottom,
      marginLeft: typeof parsed.marginLeft === 'number' ? parsed.marginLeft : DEFAULT_INVOICE_DESIGN.marginLeft,
      marginRight: typeof parsed.marginRight === 'number' ? parsed.marginRight : DEFAULT_INVOICE_DESIGN.marginRight,
      unifiedGrid: typeof parsed.unifiedGrid === 'boolean' ? parsed.unifiedGrid : true,
      brandFontSize: typeof parsed.brandFontSize === 'number' && parsed.brandFontSize >= 14 ? parsed.brandFontSize : DEFAULT_INVOICE_DESIGN.brandFontSize,
      columnsVisibility: {
        ...DEFAULT_INVOICE_DESIGN.columnsVisibility,
        ...(parsed.columnsVisibility || {}),
      },
    }
  } catch (err) {
    console.error('[invoice-design.service] Error parsing custom design config:', err)
    return { ...DEFAULT_INVOICE_DESIGN }
  }
}

/**
 * Persists the customized invoice layout configuration to app_settings.
 */
export async function saveInvoiceDesignConfig(
  design: InvoiceCustomDesign,
): Promise<void> {
  await setAppSetting(STORAGE_KEY, JSON.stringify(design))
}

/**
 * Resets invoice layout configuration to default statutory standard.
 */
export async function resetInvoiceDesignConfig(): Promise<InvoiceCustomDesign> {
  await setAppSetting(STORAGE_KEY, JSON.stringify(DEFAULT_INVOICE_DESIGN))
  return { ...DEFAULT_INVOICE_DESIGN }
}
