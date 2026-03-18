'use client'

import { ArrowUp, ArrowDown } from 'lucide-react'

function Sparkline({ data, color, width = 80, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <circle
        cx={(data.length - 1) / (data.length - 1) * width}
        cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
        r="2"
        fill={color}
      />
    </svg>
  )
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
}
export function KpiCard({ label, value, icon, sub, trend, up, sparkline, onClick }: KpiCardProps) {
  return (
    <div className="kpi-card group" onClick={onClick}>
      <span className="absolute top-4 right-4 opacity-20">{icon}</span>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      <div className="flex items-center justify-between mt-2.5">
        <div className="flex items-center gap-2">
          {trend && (
            <span className={`flex items-center gap-1 text-xs font-medium ${up ? 'text-success' : 'text-destructive'}`}>
              <span>{up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}</span><span>{trend}</span>
            </span>
          )}
          {sparkline && sparkline.length >= 2 && (
            <Sparkline data={sparkline} color={up ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
          )}
        </div>
      </div>
      <div className="absolute bottom-2.5 right-2.5 text-[10px] font-semibold uppercase tracking-wider bg-muted border border-border text-muted-foreground px-2 py-0.5 rounded group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-colors">Drill-down</div>
    </div>
  )
}
