'use client'
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'
import { useToast } from './use-toast'

const variantStyles = {
  default: {
    container: 'border-primary/20 toast-glass',
    icon: <Info size={18} className="text-primary flex-shrink-0 mt-0.5" />,
  },
  success: {
    container: 'border-success/30 toast-glass-success',
    icon: <CheckCircle2 size={18} className="text-success flex-shrink-0 mt-0.5" />,
  },
  destructive: {
    container: 'border-destructive/30 toast-glass-destructive',
    icon: <XCircle size={18} className="text-destructive flex-shrink-0 mt-0.5" />,
  },
  warning: {
    container: 'border-warning/30 toast-glass-warning',
    icon: <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />,
  },
}

export function Toaster() {
  const { toasts } = useToast()
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(({ id, title, description, variant = 'default' }) => {
        const style = variantStyles[variant as keyof typeof variantStyles] || variantStyles.default
        return (
          <div
            key={id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl animate-in slide-in-from-right-full duration-300 ${style.container}`}
          >
            {style.icon}
            <div className="flex-1 min-w-0">
              {title && <div className="text-sm font-semibold text-foreground">{title}</div>}
              {description && <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
