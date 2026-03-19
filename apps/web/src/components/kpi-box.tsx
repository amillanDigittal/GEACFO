'use client'

import { Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'

interface KpiBoxProps {
  label: string
  value: string | number
  color?: string
  icon?: React.ReactNode
  tooltip?: string
  source?: string
  highlight?: boolean
}

export function KpiBox({ label, value, color, icon, tooltip, source, highlight }: KpiBoxProps) {
  const box = (
    <div className={`border rounded-xl p-3 md:p-4 text-center group relative ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}`}>
      {tooltip && (
        <span className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-40 transition-opacity">
          <Info size={10} />
        </span>
      )}
      <div className="flex items-center justify-center gap-1.5 mb-1 md:mb-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
      </div>
      <div className={`font-mono text-lg md:text-xl font-bold ${color || 'text-foreground'}`}>{value}</div>
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
}
