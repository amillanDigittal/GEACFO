import * as React from 'react'
import { cn } from '@/lib/utils'
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('card-base card-glass rounded-xl border border-border/60 text-card-foreground', className)} {...props} />
)
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5 border-b border-border/40 gradient-sep', className)} {...props} />
)
const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <h3 ref={ref} className={cn('text-sm font-semibold leading-none text-foreground', className)} {...props} />
)
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-5', className)} {...props} />
)
Card.displayName = 'Card'
CardHeader.displayName = 'CardHeader'
CardTitle.displayName = 'CardTitle'
CardContent.displayName = 'CardContent'
export { Card, CardHeader, CardTitle, CardContent }
