type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 border-gray-200',
  primary: 'bg-orion-primary text-green-800 border-green-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  muted: 'bg-gray-50 text-gray-500 border-gray-200',
}

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}

// Invoice status badge
import type { InvoiceStatus, PaymentStatus } from '@/types/invoice'

const STATUS_MAP: Record<InvoiceStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Draft', variant: 'muted' },
  FINALIZED: { label: 'Finalized', variant: 'info' },
  PAID: { label: 'Paid', variant: 'primary' },
  PARTIALLY_PAID: { label: 'Partial', variant: 'warning' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  RETURNED: { label: 'Returned', variant: 'default' },
}

const PAYMENT_MAP: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  UNPAID: { label: 'Unpaid', variant: 'danger' },
  PARTIALLY_PAID: { label: 'Partial', variant: 'warning' },
  PAID: { label: 'Paid', variant: 'primary' },
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, variant } = STATUS_MAP[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { label, variant } = PAYMENT_MAP[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}
