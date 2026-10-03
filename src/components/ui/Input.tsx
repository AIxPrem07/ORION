import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftAddon?: React.ReactNode
  rightAddon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>((
  { label, error, hint, leftAddon, rightAddon, className = '', id, ...props },
  ref,
) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {leftAddon && (
          <div className="absolute left-2.5 text-orion-secondary pointer-events-none">{leftAddon}</div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`h-8 w-full rounded border text-sm bg-white px-3 py-1.5 text-gray-900 placeholder:text-gray-400 transition-colors
            focus:outline-none focus:ring-2 focus:ring-orion-primary focus:border-transparent
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${error ? 'border-red-400 focus:ring-red-300' : 'border-orion-border'}
            ${leftAddon ? 'pl-8' : ''}
            ${rightAddon ? 'pr-8' : ''}
            ${className}`}
          {...props}
        />
        {rightAddon && (
          <div className="absolute right-2.5 text-orion-secondary">{rightAddon}</div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-orion-secondary">{hint}</p>}
    </div>
  )
})
Input.displayName = 'Input'
