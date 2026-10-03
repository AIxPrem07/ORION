/**
 * Indian GST State Codes
 * Used to determine CGST+SGST (intrastate) vs IGST (interstate)
 */
export interface GSTState {
  code: string   // 2-digit GST state code
  name: string
  abbreviation: string
}

export const GST_STATES: GSTState[] = [
  { code: '01', name: 'Jammu & Kashmir', abbreviation: 'JK' },
  { code: '02', name: 'Himachal Pradesh', abbreviation: 'HP' },
  { code: '03', name: 'Punjab', abbreviation: 'PB' },
  { code: '04', name: 'Chandigarh', abbreviation: 'CH' },
  { code: '05', name: 'Uttarakhand', abbreviation: 'UA' },
  { code: '06', name: 'Haryana', abbreviation: 'HR' },
  { code: '07', name: 'Delhi', abbreviation: 'DL' },
  { code: '08', name: 'Rajasthan', abbreviation: 'RJ' },
  { code: '09', name: 'Uttar Pradesh', abbreviation: 'UP' },
  { code: '10', name: 'Bihar', abbreviation: 'BR' },
  { code: '11', name: 'Sikkim', abbreviation: 'SK' },
  { code: '12', name: 'Arunachal Pradesh', abbreviation: 'AR' },
  { code: '13', name: 'Nagaland', abbreviation: 'NL' },
  { code: '14', name: 'Manipur', abbreviation: 'MN' },
  { code: '15', name: 'Mizoram', abbreviation: 'MZ' },
  { code: '16', name: 'Tripura', abbreviation: 'TR' },
  { code: '17', name: 'Meghalaya', abbreviation: 'ML' },
  { code: '18', name: 'Assam', abbreviation: 'AS' },
  { code: '19', name: 'West Bengal', abbreviation: 'WB' },
  { code: '20', name: 'Jharkhand', abbreviation: 'JH' },
  { code: '21', name: 'Odisha', abbreviation: 'OD' },
  { code: '22', name: 'Chhattisgarh', abbreviation: 'CG' },
  { code: '23', name: 'Madhya Pradesh', abbreviation: 'MP' },
  { code: '24', name: 'Gujarat', abbreviation: 'GJ' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu', abbreviation: 'DD' },
  { code: '27', name: 'Maharashtra', abbreviation: 'MH' },
  { code: '28', name: 'Andhra Pradesh (Old)', abbreviation: 'AP' },
  { code: '29', name: 'Karnataka', abbreviation: 'KA' },
  { code: '30', name: 'Goa', abbreviation: 'GA' },
  { code: '31', name: 'Lakshadweep', abbreviation: 'LD' },
  { code: '32', name: 'Kerala', abbreviation: 'KL' },
  { code: '33', name: 'Tamil Nadu', abbreviation: 'TN' },
  { code: '34', name: 'Puducherry', abbreviation: 'PY' },
  { code: '35', name: 'Andaman and Nicobar Islands', abbreviation: 'AN' },
  { code: '36', name: 'Telangana', abbreviation: 'TS' },
  { code: '37', name: 'Andhra Pradesh', abbreviation: 'AP' },
  { code: '38', name: 'Ladakh', abbreviation: 'LA' },
  { code: '97', name: 'Other Territory', abbreviation: 'OT' },
  { code: '99', name: 'Centre Jurisdiction', abbreviation: 'CJ' },
]

export const GST_STATES_MAP: Record<string, GSTState> = Object.fromEntries(
  GST_STATES.map((s) => [s.code, s])
)

/** Extract state code from GSTIN (first 2 characters) */
export function stateCodeFromGSTIN(gstin: string): string | null {
  if (!gstin || gstin.length < 2) return null
  const code = gstin.slice(0, 2)
  return GST_STATES_MAP[code] ? code : null
}

/** Get state name from state code */
export function stateNameFromCode(code: string): string {
  return GST_STATES_MAP[code]?.name ?? code
}

/** Determine if supply is interstate */
export function isInterstate(businessStateCode: string, customerStateCode: string): boolean {
  return businessStateCode !== customerStateCode
}
