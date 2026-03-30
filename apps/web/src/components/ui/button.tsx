import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_3px_rgba(0,0,0,0.2)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_12px_hsl(var(--primary)/0.4)] hover:-translate-y-0.5',
        destructive:
          'bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_3px_rgba(0,0,0,0.2)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_12px_hsl(var(--destructive)/0.4)] hover:-translate-y-0.5',
        outline:
          'bg-primary/15 text-primary border border-primary/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_hsl(var(--primary)/0.1)] hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_12px_hsl(var(--primary)/0.4)] hover:-translate-y-0.5',
        secondary:
          'bg-muted text-secondary-foreground border border-border/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.06)] hover:bg-muted/80 hover:shadow-md hover:-translate-y-0.5',
        ghost:
          'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
        link:
          'text-primary underline-offset-4 hover:underline',
        success:
          'bg-success text-success-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_3px_rgba(0,0,0,0.2)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_12px_hsl(var(--success)/0.4)] hover:-translate-y-0.5',
        warning:
          'bg-warning text-warning-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_3px_rgba(0,0,0,0.2)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_12px_hsl(var(--warning)/0.4)] hover:-translate-y-0.5',
        gold:
          'bg-[hsl(var(--gold))] text-black font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_3px_rgba(0,0,0,0.2)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_12px_hsl(var(--gold)/0.4)] hover:-translate-y-0.5',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-lg px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
)
Button.displayName = 'Button'
export { Button, buttonVariants }
