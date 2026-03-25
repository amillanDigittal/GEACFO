import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/15 text-primary',
        success: 'bg-success/10 text-[hsl(var(--badge-success-text))]',
        warning: 'bg-warning/10 text-[hsl(var(--badge-warning-text))]',
        destructive: 'bg-destructive/10 text-[hsl(var(--badge-destructive-text))]',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
const Badge = React.memo(function Badge({ className, variant, ...props }: BadgeProps) {
  return <span role="status" className={cn(badgeVariants({ variant }), className)} {...props} />
})
export { Badge, badgeVariants }
