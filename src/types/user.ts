/**
 * ORION User and Authentication Types
 */
import type { Business } from './business'

export type UserRole = 'admin' | 'owner' | 'staff'

export interface User {
  id: string
  businessId: string
  name: string
  email: string | null // Login ID / username / email
  role: UserRole
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BusinessWithOwner {
  id: string
  name: string
  invoicePrefix: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  stateCode: string | null
  pin: string | null
  gstin: string | null
  pan: string | null
  bankName: string | null
  accountNumber: string | null
  ifsc: string | null
  upiId: string | null
  termsAndConditions: string | null
  createdAt: string
  updatedAt: string
  // Owner user details
  userId: string | null
  ownerName: string | null
  ownerLoginId: string | null
  userActive: boolean
  ownerLastLogin: string | null
  invoiceCount: number
  totalRevenue: number // in paise
}

export interface AuthSession {
  user: User
  business: Business
  impersonating?: boolean
}
