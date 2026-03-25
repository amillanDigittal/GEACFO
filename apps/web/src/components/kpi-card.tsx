'use client'

import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { ArrowUp, ArrowDown, Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { AnimatedValue } from '@/components/animated-value'

const Sparkline = memo(function Sparkline({ data, color, width = 80, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  const lineRef = useCallback((el: SVGPolylineElement | null) => {
    if (!el) return
    const len = el.getTotalLength()
    el.style.setProperty('--spark-len', `${len}`)
  }, [])

  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2
  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * (height - pad * 2) - pad,
  }))
  const linePoints = coords.map(p => `${p.x},${p.y}`).join(' ')
  const fillPoints = `0,${height} ${linePoints} ${width},${height}`
  const last = coords[coords.length - 1]
  const uid = `sp-${data.length}-${Math.round(data[0])}`

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`${uid}-grad`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Gradient fill area */}
      <polygon points={fillPoints} fill={`url(#${uid}-grad)`} className="sparkline-fill" />
      {/* Animated drawn line */}
      <polyline
        ref={lineRef}
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sparkline-line"
      />
      {/* Pulse dot on last point */}
      <circle cx={last.x} cy={last.y} r="4" fill={color} opacity={0.15} className="sparkline-pulse" />
      <circle cx={last.x} cy={last.y} r="2.5" fill={color} />
    </svg>
  )
})

/** Renders Sparkline only after client mount to avoid SSR hydration mismatch */
function ClientOnlySparkline(props: { data: number[]; color: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return <Sparkline {...props} />
}

interface KpiCardProps {
  label: string
  value: string
  icon: React.ReactNode
  sub?: string
  trend?: string
  up?: boolean
  sparkline?: number[]
  onClick?: () => void
  tooltip?: string
  source?: string
  /** Optional comparison delta line, e.g. "+3.1% vs feb" */
  delta?: { text: string; positive: boolean }
  /** Position index for staggered entrance animation (0-based) */
  index?: number
}
export const KpiCard = memo(function KpiCard({ label, value, icon, sub, trend, up, sparkline, onClick, tooltip, source, delta, index = 0 }: KpiCardProps) {
  const card = (
    <div className="kpi-card group" onClick={onClick} style={{ '--stagger': `${index * 60}ms` } as React.CSSProperties}>
      <span className="absolute top-4 right-4 opacity-20">{icon}</span>
      {tooltip && (
        <span className="absolute top-2 left-2 opacity-0 group-hover:opacity-40 transition-opacity">
          <Info size={12} />
        </span>
      )}
      <div className="kpi-label">{label}</div>
      <div className="kpi-value"><AnimatedValue value={value} delay={index * 60 + 150} /></div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      <div className="flex items-center justify-between mt-2.5">
        <div className="flex items-center gap-2">
          {trend && (
            <span className={`flex items-center gap-1 text-xs font-medium ${up ? 'text-success' : 'text-destructive'}`}>
              <span>{up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}</span><span>{trend}</span>
            </span>
          )}
          {sparkline && sparkline.length >= 2 && (
            <ClientOnlySparkline data={sparkline} color={up ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
          )}
        </div>
      </div>
      {delta && (
        <div className={`mt-1.5 text-[10px] font-mono font-semibold ${delta.positive ? 'text-success' : 'text-destructive'}`}>
          {delta.text}
        </div>
      )}
      <div className="absolute bottom-2.5 right-2.5 text-[10px] font-semibold uppercase tracking-wider bg-muted border border-border text-muted-foreground px-2 py-0.5 rounded group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-colors">Drill-down</div>
    </div>
  )

  if (!tooltip) return card

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
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
