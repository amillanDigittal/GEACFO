import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all',
  {
    variants: {
      variant: {
        default: 'bg-gradient-to-b from-primary/20 to-primary/10 text-primary ring-1 ring-primary/20',
        success: 'bg-gradient-to-b from-success/15 to-success/8 text-[hsl(var(--badge-success-text))] ring-1 ring-success/20',
        warning: 'bg-gradient-to-b from-warning/15 to-warning/8 text-[hsl(var(--badge-warning-text))] ring-1 ring-warning/20',
        destructive: 'bg-gradient-to-b from-destructive/15 to-destructive/8 text-[hsl(var(--badge-destructive-text))] ring-1 ring-destructive/20',
        secondary: 'bg-gradient-to-b from-secondary to-secondary/80 text-secondary-foreground ring-1 ring-border',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

/* Micro-icons per variant */
function BadgeIcon({ variant }: { variant: string | null | undefined }) {
  switch (variant) {
    case 'success':
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
          <circle cx="5" cy="5" r="4.5" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <path d="M3 5.2l1.4 1.3L7 3.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'warning':
      return (
        <span className="relative flex shrink-0 h-[10px] w-[10px] items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-20" />
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
            <circle cx="5" cy="5" r="1.5" fill="currentColor" opacity="0.7" />
          </svg>
        </span>
      )
    case 'destructive':
      return (
        <span className="relative flex shrink-0 h-[10px] w-[10px] items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-25" />
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="3.5" fill="currentColor" opacity="0.35" />
            <circle cx="5" cy="5" r="1.5" fill="currentColor" />
          </svg>
        </span>
      )
    case 'default':
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
          <circle cx="5" cy="5" r="3" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        </svg>
      )
    default:
      return null
  }
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Set false to hide the micro-icon (defaults to true) */
  icon?: boolean
}
const Badge = React.memo(function Badge({ className, variant, icon = true, children, ...props }: BadgeProps) {
  return (
    <span role="status" className={cn(badgeVariants({ variant }), className)} {...props}>
      {icon && <BadgeIcon variant={variant} />}
      {children}
    </span>
  )
})
export { Badge, badgeVariants }
