import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const fmt = (v: number, dec = 0) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v)

export const fmtEur = (v: number, dec = 0) => `${fmt(v, dec)} €`
export const fmtPct = (v: number, dec = 1) => `${fmt(v, dec)}%`
export const fmtM = (v: number) => v >= 1000000 ? `€${fmt(v / 1000000, 2)}M` : v >= 1000 ? `€${fmt(v / 1000, 0)}k` : fmtEur(v)

export function scoreColor(score: number) {
  if (score >= 80) return 'text-success'
  if (score >= 60) return 'text-warning'
  return 'text-destructive'
}

export function riskLabel(risk: string) {
  const map: Record<string, string> = { VERY_LOW: 'Muy Bajo', LOW: 'Bajo', MEDIUM: 'Medio', HIGH: 'Alto', CRITICAL: 'Crítico' }
  return map[risk] || risk
}

export function riskVariant(risk: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  const map: Record<string, any> = { VERY_LOW: 'success', LOW: 'success', MEDIUM: 'warning', HIGH: 'destructive', CRITICAL: 'destructive' }
  return map[risk] || 'secondary'
}

export function exportCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const sep = ';'
  const escape = (v: any) => {
    const s = v == null ? '' : String(v)
    return s.includes(sep) || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [`sep=${sep}`, headers.map(escape).join(sep), ...rows.map(r => r.map(escape).join(sep))].join('\n')
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
