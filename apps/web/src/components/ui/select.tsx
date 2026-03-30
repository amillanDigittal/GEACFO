import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'flex h-9 w-full appearance-none rounded-lg border border-border bg-muted/50 backdrop-blur-sm pl-3 pr-9 py-1.5 text-sm shadow-sm transition-all duration-200',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.12),0_0_12px_hsl(var(--primary)/0.08)]',
          'hover:border-primary/40 hover:bg-muted/70',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform duration-200"
      />
    </div>
  )
)
Select.displayName = 'Select'
export { Select }
