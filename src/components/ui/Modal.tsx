import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

interface ModalProps {
  open?: boolean
  isOpen?: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  footer?: ReactNode
  closeOnBackdrop?: boolean
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-4xl',
}

export function Modal({ open, isOpen, onClose, title, children, size = 'md', footer, closeOnBackdrop = true }: ModalProps) {
  const isVisible = open ?? isOpen ?? false
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isVisible) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isVisible, onClose])

  if (!isVisible) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 animate-fade-in"
      onClick={(e) => { if (closeOnBackdrop && e.target === overlayRef.current) onClose() }}
    >
      <div className={`bg-white rounded-lg shadow-orion-lg w-full ${sizeMap[size]} mx-4 flex flex-col max-h-[90vh]`}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-orion-border flex-shrink-0">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-orion-border flex justify-end gap-2 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
