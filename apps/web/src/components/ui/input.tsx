import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, icon, ...props }, ref) => (
  <div className="relative">
    {icon && (
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors duration-200 peer-focus-visible:text-primary">
        {icon}
      </span>
    )}
    <input
      type={type}
      className={cn(
        'peer flex h-9 w-full rounded-lg border border-border bg-muted/50 backdrop-blur-sm px-3 py-1.5 text-sm shadow-sm transition-all duration-200',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.12),0_0_12px_hsl(var(--primary)/0.08)]',
        'hover:border-primary/40 hover:bg-muted/70',
        'disabled:cursor-not-allowed disabled:opacity-50',
        icon && 'pl-9',
        className
      )}
      ref={ref}
      {...props}
    />
  </div>
))
Input.displayName = 'Input'
export { Input }
