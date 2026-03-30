'use client'

import { memo } from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { AnimatedValue } from '@/components/animated-value'

interface KpiBoxProps {
  label: string
  value: string | number
  color?: string
  icon?: React.ReactNode
  tooltip?: string
  source?: string
  highlight?: boolean
  /** Position index for staggered entrance animation (0-based) */
  index?: number
}

export const KpiBox = memo(function KpiBox({ label, value, color, icon, tooltip, source, highlight, index = 0 }: KpiBoxProps) {
  const box = (
    <div
      className="kpi-card group"
      data-trend="neutral"
      style={{ '--stagger': `${index * 60}ms` } as React.CSSProperties}
    >
      {/* Top notch — uses highlight color or neutral */}
      <div className={`absolute top-0 left-3 right-3 h-[3px] rounded-b ${
        highlight ? 'bg-primary' : 'bg-border'
      }`} />

      {/* Icon (top-right, faded) */}
      {icon && <span className="absolute top-4 right-4 opacity-20">{icon}</span>}

      {/* Tooltip hint */}
      {tooltip && (
        <span className="absolute top-2 left-2 opacity-0 group-hover:opacity-40 transition-opacity">
          <Info size={12} />
        </span>
      )}

      <div className="kpi-label flex items-center gap-1.5">
        {label}
      </div>
      <div className={`kpi-value ${color || ''}`}>
        <AnimatedValue value={String(value)} delay={index * 60 + 150} />
      </div>
    </div>
  )

  if (!tooltip) return box

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{box}</TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="space-y-1">
            <div className="font-semibold">{label}</div>
            <div className="text-muted-foreground">{tooltip}</div>
            {source && <div className="text-[10px] text-muted-foreground border-t border-border pt-1 mt-1">Fuente: {source}</div>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})
