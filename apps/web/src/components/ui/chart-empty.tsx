'use client'

import { cn } from '@/lib/utils'

interface ChartEmptyProps {
  message?: string
  height?: number
  className?: string
}

export function ChartEmpty({ message = 'Sin datos para este periodo', height = 200, className }: ChartEmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', className)} style={{ height }}>
      <svg viewBox="0 0 120 120" fill="none" className="w-16 h-16 text-muted-foreground mb-3" aria-hidden>
        {/* Axes */}
        <line x1="24" y1="90" x2="96" y2="90" stroke="currentColor" strokeWidth="1.5" opacity="0.25" strokeLinecap="round" />
        <line x1="24" y1="90" x2="24" y2="24" stroke="currentColor" strokeWidth="1.5" opacity="0.25" strokeLinecap="round" />
        {/* Flat dashed line */}
        <path d="M30 70 Q45 68 60 70 Q75 72 90 70" stroke="currentColor" strokeWidth="1.5" opacity="0.2" strokeLinecap="round" strokeDasharray="4 3" />
        {/* Ghost bars */}
        <rect x="34" y="60" width="10" height="30" rx="2" fill="currentColor" opacity="0.06" />
        <rect x="50" y="50" width="10" height="40" rx="2" fill="currentColor" opacity="0.06" />
        <rect x="66" y="55" width="10" height="35" rx="2" fill="currentColor" opacity="0.06" />
        <rect x="82" y="45" width="10" height="45" rx="2" fill="currentColor" opacity="0.06" />
      </svg>
      <p className="text-xs text-muted-foreground/60">{message}</p>
    </div>
  )
}
