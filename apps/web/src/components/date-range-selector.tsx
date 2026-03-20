'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CalendarDays, ChevronDown } from 'lucide-react'

export interface DateRange {
  from: string  // YYYY-MM-DD
  to: string    // YYYY-MM-DD
  label: string
}

function fmt(d: Date) { return d.toISOString().slice(0, 10) }

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }
function startOfQuarter(d: Date) { const q = Math.floor(d.getMonth() / 3) * 3; return new Date(d.getFullYear(), q, 1) }
function endOfQuarter(d: Date) { const q = Math.floor(d.getMonth() / 3) * 3; return new Date(d.getFullYear(), q + 3, 0) }

function getPresets(): { label: string; current: DateRange; previous: DateRange }[] {
  const now = new Date()

  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)
  const prevMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const prevMonthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))

  const thisQStart = startOfQuarter(now)
  const thisQEnd = endOfQuarter(now)
  const prevQStart = startOfQuarter(new Date(now.getFullYear(), now.getMonth() - 3, 1))
  const prevQEnd = endOfQuarter(new Date(now.getFullYear(), now.getMonth() - 3, 1))

  const thisYearStart = new Date(now.getFullYear(), 0, 1)
  const prevYearStart = new Date(now.getFullYear() - 1, 0, 1)
  const prevYearEnd = new Date(now.getFullYear() - 1, 11, 31)

  const last30Start = new Date(now.getTime() - 30 * 86400000)
  const prev30Start = new Date(now.getTime() - 60 * 86400000)
  const prev30End = new Date(now.getTime() - 31 * 86400000)

  const mName = (d: Date) => d.toLocaleDateString('es-ES', { month: 'short' })
  const qName = (d: Date) => `Q${Math.floor(d.getMonth() / 3) + 1}`

  return [
    {
      label: 'Este mes vs anterior',
      current: { from: fmt(thisMonthStart), to: fmt(thisMonthEnd), label: mName(thisMonthStart) + ' ' + now.getFullYear() },
      previous: { from: fmt(prevMonthStart), to: fmt(prevMonthEnd), label: mName(prevMonthStart) + ' ' + prevMonthStart.getFullYear() },
    },
    {
      label: 'Este trimestre vs anterior',
      current: { from: fmt(thisQStart), to: fmt(thisQEnd), label: qName(thisQStart) + ' ' + now.getFullYear() },
      previous: { from: fmt(prevQStart), to: fmt(prevQEnd), label: qName(prevQStart) + ' ' + prevQStart.getFullYear() },
    },
    {
      label: 'YTD vs año anterior',
      current: { from: fmt(thisYearStart), to: fmt(now), label: String(now.getFullYear()) },
      previous: { from: fmt(prevYearStart), to: fmt(prevYearEnd), label: String(now.getFullYear() - 1) },
    },
    {
      label: 'Últimos 30d vs 30d anteriores',
      current: { from: fmt(last30Start), to: fmt(now), label: 'Últimos 30d' },
      previous: { from: fmt(prev30Start), to: fmt(prev30End), label: '30d anteriores' },
    },
  ]
}

interface Props {
  onChange: (current: DateRange, previous: DateRange | null) => void
  compare?: boolean
}

export function DateRangeSelector({ onChange, compare = true }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const presets = getPresets()

  function handlePreset(preset: typeof presets[0]) {
    setSelected(preset.label)
    setOpen(false)
    onChange(preset.current, compare ? preset.previous : null)
  }

  function handleCustom() {
    if (!customFrom || !customTo) return
    setSelected(`${customFrom} → ${customTo}`)
    setOpen(false)
    onChange({ from: customFrom, to: customTo, label: 'Personalizado' }, null)
  }

  function handleReset() {
    setSelected(null)
    setOpen(false)
    onChange({ from: '', to: '', label: 'Todo' }, null)
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)} className="text-xs gap-1.5">
        <CalendarDays size={13} />
        {selected || 'Periodo'}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 w-72 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* Presets */}
            <div className="p-2 space-y-0.5">
              <button onClick={handleReset} className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-muted transition-colors text-muted-foreground">
                Todo el periodo (sin filtro)
              </button>
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${selected === p.label ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
                >
                  <div className="font-medium">{p.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {p.current.label} vs {p.previous.label}
                  </div>
                </button>
              ))}
            </div>

            {/* Custom range */}
            <div className="border-t border-border p-3 space-y-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Rango personalizado</div>
              <div className="flex gap-2">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="flex-1 h-7 rounded border border-border bg-background px-2 text-[11px]" />
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="flex-1 h-7 rounded border border-border bg-background px-2 text-[11px]" />
              </div>
              <Button size="sm" className="w-full h-7 text-xs" onClick={handleCustom} disabled={!customFrom || !customTo}>
                Aplicar
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Helper to format comparison data
export function compareValues(current: number, previous: number): { diff: number; pct: number; positive: boolean } {
  const diff = current - previous
  const pct = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0
  return { diff, pct, positive: diff >= 0 }
}
