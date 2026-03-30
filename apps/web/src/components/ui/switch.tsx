'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onChange, disabled, className }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'bg-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_8px_hsl(var(--primary)/0.3)]'
          : 'bg-muted shadow-inner',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] ring-0 transition-all duration-300',
          checked ? 'translate-x-5 scale-100' : 'translate-x-0 scale-90'
        )}
      >
        {/* Inner check/cross indicator */}
        <span className={cn(
          'absolute inset-0 flex items-center justify-center transition-opacity duration-200',
          checked ? 'opacity-100' : 'opacity-0'
        )}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2.5 5L4.5 7L7.5 3" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    </button>
  )
)
Switch.displayName = 'Switch'
export { Switch }
