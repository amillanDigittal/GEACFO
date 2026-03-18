'use client'
import { useToast } from './use-toast'
export function Toaster() {
  const { toasts } = useToast()
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(({ id, title, description, variant }) => (
        <div key={id} className={`pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-4 shadow-xl animate-in slide-in-from-right-full ${variant === 'destructive' ? 'border-destructive' : 'border-border'}`}>
          <div className="flex-1 min-w-0">
            {title && <div className="text-sm font-semibold text-foreground">{title}</div>}
            {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
