import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/20 text-primary dark:bg-primary/15',
        success: 'bg-success/20 text-success dark:bg-success/15',
        warning: 'bg-warning/20 text-warning dark:bg-warning/15',
        destructive: 'bg-destructive/20 text-destructive dark:bg-destructive/15',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
function Badge({ className, variant, ...props }: BadgeProps) {
  return <span role="status" className={cn(badgeVariants({ variant }), className)} {...props} />
}
export { Badge, badgeVariants }
