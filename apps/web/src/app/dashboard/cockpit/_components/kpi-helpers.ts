import type { CompareMode } from '@/store/app'

// Previous-period values for each KPI and comparison mode
export const PREV: Record<string, Record<CompareMode, { value: number; label: string }>> = {
  caja:      { mom: { value: 1208000, label: 'feb' },  yoy: { value: 980000,  label: 'mar 25' } },
  dso:       { mom: { value: 45,      label: 'feb' },  yoy: { value: 52,      label: 'mar 25' } },
  dpo:       { mom: { value: 65,      label: 'feb' },  yoy: { value: 58,      label: 'mar 25' } },
  ccc:       { mom: { value: 30,      label: 'feb' },  yoy: { value: 38,      label: 'mar 25' } },
  revenue:   { mom: { value: 4290000, label: 'feb' },  yoy: { value: 3950000, label: 'mar 25' } },
  ebitda:    { mom: { value: 1080000, label: 'feb' },  yoy: { value: 870000,  label: 'mar 25' } },
  deudaNeta: { mom: { value: 2210000, label: 'feb' },  yoy: { value: 2650000, label: 'mar 25' } },
  liquidez:  { mom: { value: 1.80,    label: 'feb' },  yoy: { value: 1.52,    label: 'mar 25' } },
}

/** Whether a positive delta is "good" for each KPI (lower is better for debt/days) */
export const POSITIVE_IS_GOOD: Record<string, boolean> = {
  caja: true, dso: false, dpo: true, ccc: false,
  revenue: true, ebitda: true, deudaNeta: false, liquidez: true,
}

export function computeDelta(key: string, current: number, mode: CompareMode) {
  const prev = PREV[key]?.[mode]
  if (!prev) return undefined
  const diff = current - prev.value
  const pct = prev.value !== 0 ? (diff / prev.value) * 100 : 0
  const isPositive = POSITIVE_IS_GOOD[key] ? diff > 0 : diff < 0

  let text: string
  if (key === 'dso' || key === 'dpo' || key === 'ccc') {
    text = `${diff > 0 ? '+' : ''}${diff}d vs ${prev.label}`
  } else if (key === 'liquidez') {
    text = `${diff > 0 ? '+' : ''}${diff.toFixed(2)}x vs ${prev.label}`
  } else {
    text = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% vs ${prev.label}`
  }
  return { text, positive: isPositive }
}

export function formatTrend(key: string, data: any): { trend: string; up: boolean } {
  const raw = data?.[key]
  if (!raw) return { trend: '', up: true }
  const trendVal = raw.trend

  if (key === 'caja') {
    const sp = raw.sparkline
    if (sp && sp.length >= 2) {
      const prev = sp[sp.length - 2]
      const curr = sp[sp.length - 1]
      if (prev !== 0) {
        const pct = ((curr - prev) / Math.abs(prev)) * 100
        return { trend: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, up: pct > 0 }
      }
    }
    return { trend: '', up: true }
  }

  if (key === 'dso' || key === 'dpo' || key === 'ccc') {
    const sp = raw.sparkline
    if (sp && sp.length >= 2) {
      const diff = sp[sp.length - 1] - sp[sp.length - 2]
      const isUp = key === 'dpo' ? diff > 0 : diff < 0
      return { trend: `${diff > 0 ? '+' : ''}${diff}d`, up: isUp }
    }
    return { trend: trendVal === 'up' ? '+' : '-', up: trendVal === 'up' }
  }

  if (key === 'liquidez') {
    if (typeof trendVal === 'number') {
      return { trend: `${trendVal > 0 ? '+' : ''}${trendVal.toFixed(2)}x`, up: trendVal > 0 }
    }
    return { trend: '', up: true }
  }

  if (key === 'ebitda') {
    if (typeof trendVal === 'number') {
      return { trend: `${trendVal > 0 ? '+' : ''}${trendVal.toFixed(1)}pp`, up: trendVal > 0 }
    }
    return { trend: '', up: true }
  }

  if (typeof trendVal === 'number') {
    const isUp = key === 'deudaNeta' ? trendVal < 0 : trendVal > 0
    return { trend: `${trendVal > 0 ? '+' : ''}${trendVal.toFixed(1)}%`, up: isUp }
  }

  return { trend: '', up: true }
}
