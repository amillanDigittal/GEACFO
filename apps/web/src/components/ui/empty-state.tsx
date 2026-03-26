'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button, type ButtonProps } from './button'

/* ------------------------------------------------------------------ */
/*  Minimal SVG illustrations for empty states                        */
/*  Each uses currentColor + opacity so they adapt to light/dark mode */
/* ------------------------------------------------------------------ */

function IllustrationInvoices({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {/* Document stack */}
      <rect x="30" y="18" width="60" height="78" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <rect x="34" y="14" width="60" height="78" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <rect x="38" y="10" width="60" height="78" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.4" fill="currentColor" fillOpacity="0.03" />
      {/* Lines on top document */}
      <line x1="48" y1="28" x2="88" y2="28" stroke="currentColor" strokeWidth="1.5" opacity="0.25" strokeLinecap="round" />
      <line x1="48" y1="36" x2="78" y2="36" stroke="currentColor" strokeWidth="1.5" opacity="0.18" strokeLinecap="round" />
      <line x1="48" y1="44" x2="83" y2="44" stroke="currentColor" strokeWidth="1.5" opacity="0.18" strokeLinecap="round" />
      <line x1="48" y1="52" x2="72" y2="52" stroke="currentColor" strokeWidth="1.5" opacity="0.18" strokeLinecap="round" />
      {/* Checkmark circle */}
      <circle cx="82" cy="72" r="14" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <path d="M76 72l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
    </svg>
  )
}

function IllustrationAlerts({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {/* Bell body */}
      <path d="M60 20c-16 0-28 12-28 28v16c0 4-6 8-6 8h68s-6-4-6-8V48c0-16-12-28-28-28z"
        stroke="currentColor" strokeWidth="1.5" opacity="0.35" fill="currentColor" fillOpacity="0.04" />
      {/* Clapper */}
      <path d="M52 72c0 4.4 3.6 8 8 8s8-3.6 8-8" stroke="currentColor" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
      {/* Ring / top */}
      <circle cx="60" cy="20" r="3" fill="currentColor" opacity="0.25" />
      {/* Slash through bell (muted) */}
      <line x1="30" y1="90" x2="90" y2="30" stroke="currentColor" strokeWidth="2" opacity="0.2" strokeLinecap="round" />
      {/* Zen circles (peace) */}
      <circle cx="22" cy="34" r="3" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      <circle cx="98" cy="58" r="2" stroke="currentColor" strokeWidth="1" opacity="0.12" />
      <circle cx="88" cy="88" r="4" stroke="currentColor" strokeWidth="1" opacity="0.1" />
    </svg>
  )
}

function IllustrationSearch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {/* Magnifying glass */}
      <circle cx="52" cy="50" r="24" stroke="currentColor" strokeWidth="1.5" opacity="0.35" fill="currentColor" fillOpacity="0.03" />
      <line x1="69" y1="67" x2="92" y2="90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
      {/* Empty result lines */}
      <line x1="40" y1="44" x2="64" y2="44" stroke="currentColor" strokeWidth="1.5" opacity="0.15" strokeLinecap="round" strokeDasharray="4 3" />
      <line x1="40" y1="52" x2="58" y2="52" stroke="currentColor" strokeWidth="1.5" opacity="0.15" strokeLinecap="round" strokeDasharray="4 3" />
      {/* Question mark */}
      <text x="48" y="60" fontSize="18" fill="currentColor" opacity="0.12" fontFamily="sans-serif" fontWeight="300">?</text>
    </svg>
  )
}

function IllustrationUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {/* Person silhouettes */}
      <circle cx="42" cy="38" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <path d="M22 78c0-12 9-20 20-20s20 8 20 20" stroke="currentColor" strokeWidth="1.5" opacity="0.2" strokeLinecap="round" />
      <circle cx="72" cy="42" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <path d="M56 78c0-10 7-16 16-16s16 6 16 16" stroke="currentColor" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
      {/* Plus symbol */}
      <circle cx="90" cy="30" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.25" fill="currentColor" fillOpacity="0.05" />
      <line x1="90" y1="25" x2="90" y2="35" stroke="currentColor" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
      <line x1="85" y1="30" x2="95" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
    </svg>
  )
}

function IllustrationAudit({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {/* Clipboard */}
      <rect x="32" y="22" width="56" height="72" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.35" fill="currentColor" fillOpacity="0.03" />
      <rect x="48" y="16" width="24" height="12" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.3" fill="currentColor" fillOpacity="0.05" />
      {/* Empty checklist lines */}
      <rect x="42" y="42" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />
      <line x1="56" y1="46" x2="78" y2="46" stroke="currentColor" strokeWidth="1.5" opacity="0.15" strokeLinecap="round" />
      <rect x="42" y="56" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />
      <line x1="56" y1="60" x2="72" y2="60" stroke="currentColor" strokeWidth="1.5" opacity="0.15" strokeLinecap="round" />
      <rect x="42" y="70" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />
      <line x1="56" y1="74" x2="76" y2="74" stroke="currentColor" strokeWidth="1.5" opacity="0.15" strokeLinecap="round" />
    </svg>
  )
}

function IllustrationChart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {/* Axes */}
      <line x1="24" y1="90" x2="96" y2="90" stroke="currentColor" strokeWidth="1.5" opacity="0.25" strokeLinecap="round" />
      <line x1="24" y1="90" x2="24" y2="24" stroke="currentColor" strokeWidth="1.5" opacity="0.25" strokeLinecap="round" />
      {/* Flat line (no data) */}
      <path d="M30 70 Q45 68 60 70 Q75 72 90 70" stroke="currentColor" strokeWidth="1.5" opacity="0.2" strokeLinecap="round" strokeDasharray="4 3" />
      {/* Ghost bars */}
      <rect x="34" y="60" width="10" height="30" rx="2" fill="currentColor" opacity="0.06" />
      <rect x="50" y="50" width="10" height="40" rx="2" fill="currentColor" opacity="0.06" />
      <rect x="66" y="55" width="10" height="35" rx="2" fill="currentColor" opacity="0.06" />
      <rect x="82" y="45" width="10" height="45" rx="2" fill="currentColor" opacity="0.06" />
    </svg>
  )
}

function IllustrationReconciliation({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {/* Two documents connecting */}
      <rect x="14" y="30" width="40" height="54" rx="5" stroke="currentColor" strokeWidth="1.5" opacity="0.3" fill="currentColor" fillOpacity="0.03" />
      <rect x="66" y="30" width="40" height="54" rx="5" stroke="currentColor" strokeWidth="1.5" opacity="0.3" fill="currentColor" fillOpacity="0.03" />
      {/* Lines on left doc */}
      <line x1="22" y1="44" x2="46" y2="44" stroke="currentColor" strokeWidth="1.2" opacity="0.18" strokeLinecap="round" />
      <line x1="22" y1="52" x2="40" y2="52" stroke="currentColor" strokeWidth="1.2" opacity="0.18" strokeLinecap="round" />
      {/* Lines on right doc */}
      <line x1="74" y1="44" x2="98" y2="44" stroke="currentColor" strokeWidth="1.2" opacity="0.18" strokeLinecap="round" />
      <line x1="74" y1="52" x2="92" y2="52" stroke="currentColor" strokeWidth="1.2" opacity="0.18" strokeLinecap="round" />
      {/* Connecting arrows */}
      <path d="M54 52 L66 52" stroke="currentColor" strokeWidth="1.5" opacity="0.25" strokeLinecap="round" markerEnd="url(#arrowR)" />
      {/* Checkmark */}
      <circle cx="60" cy="74" r="12" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <path d="M54 74l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
    </svg>
  )
}

function IllustrationSchedule({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {/* Calendar */}
      <rect x="24" y="28" width="72" height="64" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.35" fill="currentColor" fillOpacity="0.03" />
      <line x1="24" y1="44" x2="96" y2="44" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      {/* Calendar handles */}
      <line x1="42" y1="22" x2="42" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      <line x1="78" y1="22" x2="78" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      {/* Grid dots */}
      <circle cx="40" cy="56" r="2" fill="currentColor" opacity="0.12" />
      <circle cx="56" cy="56" r="2" fill="currentColor" opacity="0.12" />
      <circle cx="72" cy="56" r="2" fill="currentColor" opacity="0.12" />
      <circle cx="40" cy="70" r="2" fill="currentColor" opacity="0.12" />
      <circle cx="56" cy="70" r="2" fill="currentColor" opacity="0.12" />
      <circle cx="72" cy="70" r="2" fill="currentColor" opacity="0.12" />
      <circle cx="40" cy="82" r="2" fill="currentColor" opacity="0.12" />
      {/* Clock overlay */}
      <circle cx="86" cy="78" r="14" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="86" y1="72" x2="86" y2="78" stroke="currentColor" strokeWidth="1.5" opacity="0.35" strokeLinecap="round" />
      <line x1="86" y1="78" x2="92" y2="80" stroke="currentColor" strokeWidth="1.5" opacity="0.35" strokeLinecap="round" />
    </svg>
  )
}

function IllustrationSuppliers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {/* Building */}
      <rect x="36" y="30" width="48" height="58" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.35" fill="currentColor" fillOpacity="0.03" />
      {/* Windows */}
      <rect x="44" y="40" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />
      <rect x="56" y="40" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />
      <rect x="68" y="40" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />
      <rect x="44" y="54" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />
      <rect x="56" y="54" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />
      <rect x="68" y="54" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />
      {/* Door */}
      <rect x="54" y="72" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.2" opacity="0.25" />
      {/* Roof line */}
      <line x1="30" y1="30" x2="90" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.15" strokeLinecap="round" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Illustration map                                                   */
/* ------------------------------------------------------------------ */

const illustrations = {
  invoices: IllustrationInvoices,
  alerts: IllustrationAlerts,
  search: IllustrationSearch,
  users: IllustrationUsers,
  audit: IllustrationAudit,
  chart: IllustrationChart,
  reconciliation: IllustrationReconciliation,
  schedule: IllustrationSchedule,
  suppliers: IllustrationSuppliers,
} as const

export type EmptyStateVariant = keyof typeof illustrations

/* ------------------------------------------------------------------ */
/*  EmptyState component                                               */
/* ------------------------------------------------------------------ */

interface EmptyStateProps {
  variant: EmptyStateVariant
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: ButtonProps['variant']
  }
  className?: string
  compact?: boolean
}

export function EmptyState({ variant, title, description, action, className, compact }: EmptyStateProps) {
  const Illustration = illustrations[variant]
  const iconSize = compact ? 'w-16 h-16' : 'w-24 h-24'

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-8' : 'py-12',
      'text-muted-foreground',
      'animate-in fade-in duration-300',
      className,
    )}>
      <Illustration className={cn(iconSize, 'mb-4 text-muted-foreground')} />
      <p className={cn('font-medium', compact ? 'text-xs' : 'text-sm')}>{title}</p>
      {description && (
        <p className={cn('mt-1 max-w-[280px]', compact ? 'text-[10px]' : 'text-xs', 'text-muted-foreground/70')}>{description}</p>
      )}
      {action && (
        <Button
          size="sm"
          variant={action.variant ?? 'default'}
          className="mt-4"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
