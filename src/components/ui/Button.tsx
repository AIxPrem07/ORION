import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-orion-primary text-gray-800 hover:bg-green-200 border border-green-200 font-medium',
  secondary: 'bg-white text-gray-700 hover:bg-gray-50 border border-orion-border font-medium',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 font-medium',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-medium',
  outline: 'bg-transparent text-gray-700 hover:bg-gray-50 border border-orion-border font-medium',
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-xs gap-1',
  sm: 'h-7 px-3 text-xs gap-1.5',
  md: 'h-8 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>((
  { variant = 'secondary', size = 'md', isLoading, leftIcon, rightIcon, fullWidth, className = '', children, disabled, ...props },
  ref,
) => {
  const base = 'inline-flex items-center justify-center rounded transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-orion-primary disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap select-none'
  return (
    <button
      ref={ref}
      className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="animate-spin" size={14} /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  )
})
Button.displayName = 'Button'
