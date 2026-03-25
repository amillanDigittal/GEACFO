'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'

export function Delta({ current, previous, suffix = '', invert = false, format }: { current: number; previous: number; suffix?: string; invert?: boolean; format?: (v: number) => string }) {
  const diff = current - previous
  if (diff === 0) return null
  const pct = previous !== 0 ? (diff / Math.abs(previous)) * 100 : 0
  const isPositive = invert ? diff < 0 : diff > 0
  const formatted = format ? format(Math.abs(diff)) : `${Math.abs(diff).toLocaleString('es-ES')}${suffix}`
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${isPositive ? 'text-success' : 'text-destructive'}`}>
      {diff > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {diff > 0 ? '+' : '−'}{formatted}
      <span className="opacity-60">({diff > 0 ? '+' : '−'}{Math.abs(pct).toFixed(1)}%)</span>
    </span>
  )
}

export function CompareKPI({ label, current, previous, showCompare, suffix, format, good, invert }: {
  label: string; current: string; previous?: string; showCompare: boolean; suffix?: string; format?: (v: number) => string; good?: boolean; invert?: boolean
}) {
  return (
    <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{label}</div>
      <div className={`font-mono text-xl font-bold ${good === false ? 'text-destructive' : good === true ? 'text-success' : 'text-foreground'}`}>{current}</div>
      {showCompare && previous !== undefined && (
        <div className="text-[10px] text-muted-foreground mt-1">Q4: {previous}</div>
      )}
    </div>
  )
}

export function CompareMetric({ label, currentVal, prevVal, showCompare, suffix, invert, format }: {
  label: string; currentVal: number; prevVal: number; showCompare: boolean; suffix?: string; invert?: boolean; format?: (v: number) => string
}) {
  return (
    <div className="bg-muted/50 border border-border rounded-xl p-5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
      <div className="font-mono text-2xl font-bold">{format ? format(currentVal) : `${currentVal.toLocaleString('es-ES')}${suffix || ''}`}</div>
      {showCompare && (
        <div className="mt-1">
          <Delta current={currentVal} previous={prevVal} suffix={suffix} invert={invert} format={format} />
        </div>
      )}
    </div>
  )
}
