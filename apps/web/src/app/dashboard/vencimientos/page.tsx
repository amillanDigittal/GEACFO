'use client'
import { useHydrated } from '@/hooks/use-hydrated'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmt } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { KpiBox } from '@/components/kpi-box'
import { ChevronLeft, ChevronRight, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface DayData {
  date: string
  cobros: number
  pagos: number
  net: number
  cobroCount: number
  pagoCount: number
  invoices: { type: 'AR' | 'AP'; number: string; counterparty: string; amount: number; status: string }[]
}

function getMonthDays(year: number, month: number): (DayData | null)[] {
  const firstDay = new Date(year, month, 1)
  let startPad = firstDay.getDay() - 1
  if (startPad < 0) startPad = 6 // Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (DayData | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ date: dateStr, cobros: 0, pagos: 0, net: 0, cobroCount: 0, pagoCount: 0, invoices: [] })
  }
  return cells
}

function heatColor(value: number, max: number, type: 'cobro' | 'pago' | 'net'): string {
  if (value === 0) return ''
  const intensity = Math.min(value / (max || 1), 1)
  if (type === 'cobro') {
    const alpha = 0.15 + intensity * 0.55
    return `hsl(var(--success) / ${alpha})`
  }
  if (type === 'pago') {
    const alpha = 0.15 + intensity * 0.55
    return `hsl(var(--destructive) / ${alpha})`
  }
  // net
  if (value > 0) {
    const alpha = 0.15 + intensity * 0.55
    return `hsl(var(--success) / ${alpha})`
  }
  const alpha = 0.15 + Math.min(Math.abs(value) / (max || 1), 1) * 0.55
  return `hsl(var(--destructive) / ${alpha})`
}

export default function VencimientosPage() {
  const t = useTranslations('vencimientos')
  const [arData, setArData] = useState<any[]>([])
  const [apData, setApData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)) // March 2026
  const [viewMode, setViewMode] = useState<'net' | 'cobros' | 'pagos'>('net')
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const WEEKDAYS = [t('weekMon'), t('weekTue'), t('weekWed'), t('weekThu'), t('weekFri'), t('weekSat'), t('weekSun')]

  function fetchData() {
    return Promise.all([api.treasury.ar(), api.treasury.ap()])
      .then(([ar, ap]) => { setArData(ar); setApData(ap); setLastUpdated(new Date()) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  async function handleRefresh() {
    await fetchData()
  }

  useEffect(() => {
    fetchData()
  }, [])

  const hydrated = useHydrated()

  if (!hydrated || loading) return <SkeletonKPIsAndTable cols={7} rows={6} />

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthLabel = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  // Build calendar data
  const cells = getMonthDays(year, month)
  const dayMap = new Map<string, DayData>()
  cells.forEach(c => { if (c) dayMap.set(c.date, c) })

  // Fill AR data
  arData.forEach((inv: any) => {
    if (inv.status === 'PAID') return
    const dateStr = String(inv.dueDate).slice(0, 10)
    const day = dayMap.get(dateStr)
    if (!day) return
    const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount)
    day.cobros += outstanding
    day.cobroCount++
    day.net += outstanding
    day.invoices.push({ type: 'AR', number: inv.number, counterparty: inv.customer?.name || '', amount: outstanding, status: inv.status })
  })

  // Fill AP data
  apData.forEach((inv: any) => {
    if (inv.status === 'PAID' || inv.status === 'REJECTED') return
    const dateStr = String(inv.dueDate).slice(0, 10)
    const day = dayMap.get(dateStr)
    if (!day) return
    const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount)
    day.pagos += outstanding
    day.pagoCount++
    day.net -= outstanding
    day.invoices.push({ type: 'AP', number: inv.number, counterparty: inv.supplier?.name || '', amount: outstanding, status: inv.status })
  })

  // Stats for the month
  const activeDays = cells.filter(c => c && (c.cobros > 0 || c.pagos > 0)) as DayData[]
  const maxCobro = Math.max(...activeDays.map(d => d.cobros), 1)
  const maxPago = Math.max(...activeDays.map(d => d.pagos), 1)
  const maxNet = Math.max(...activeDays.map(d => Math.abs(d.net)), 1)
  const totalCobros = activeDays.reduce((s, d) => s + d.cobros, 0)
  const totalPagos = activeDays.reduce((s, d) => s + d.pagos, 0)
  const peakDay = activeDays.reduce((best, d) => (d.cobros + d.pagos) > (best.cobros + best.pagos) ? d : best, activeDays[0] || { date: '', cobros: 0, pagos: 0, net: 0, cobroCount: 0, pagoCount: 0, invoices: [] })
  const tensionDays = activeDays.filter(d => d.net < -10000)
  const today = new Date().toISOString().slice(0, 10)

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null) }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null) }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        actions={
          <div className="flex gap-1">
            {(['net', 'cobros', 'pagos'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === m ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                {m === 'net' ? t('viewNet') : m === 'cobros' ? t('viewCollections') : t('viewPayments')}
              </button>
            ))}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiBox index={0} label={t('kpiMonthlyCollections')} value={`+${fmtEur(Math.round(totalCobros))}`} icon={<ArrowDownToLine size={16} />} color="text-success" />
        <KpiBox index={1} label={t('kpiMonthlyPayments')} value={`\u2212${fmtEur(Math.round(totalPagos))}`} icon={<ArrowUpFromLine size={16} />} color="text-destructive" />
        <KpiBox index={2} label={t('kpiPeakDay')} value={peakDay?.date ? String(new Date(peakDay.date).getDate()) : '—'} icon={<Zap size={16} />} />
        <KpiBox index={3} label={t('kpiTensionDays')} value={String(tensionDays.length)} icon={<AlertTriangle size={16} />} color={tensionDays.length > 0 ? 'text-destructive' : 'text-success'} />
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft size={16} /></Button>
            <CardTitle className="capitalize">{monthLabel}</CardTitle>
            <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight size={16} /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[10px] text-muted-foreground font-semibold uppercase py-1">{d}</div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell) return <div key={`empty-${i}`} className="aspect-square" />
              const dayNum = parseInt(cell.date.slice(-2))
              const isToday = cell.date === today
              const isSelected = selectedDay?.date === cell.date
              const hasData = cell.cobros > 0 || cell.pagos > 0

              let bg = ''
              if (viewMode === 'cobros' && cell.cobros > 0) bg = heatColor(cell.cobros, maxCobro, 'cobro')
              else if (viewMode === 'pagos' && cell.pagos > 0) bg = heatColor(cell.pagos, maxPago, 'pago')
              else if (viewMode === 'net' && (cell.cobros > 0 || cell.pagos > 0)) bg = heatColor(cell.net, maxNet, 'net')

              return (
                <div
                  key={cell.date}
                  onClick={() => hasData ? setSelectedDay(isSelected ? null : cell) : setSelectedDay(null)}
                  className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-center transition-all text-center relative
                    ${hasData ? 'cursor-pointer hover:ring-2 hover:ring-primary/50' : ''}
                    ${isSelected ? 'ring-2 ring-primary' : ''}
                    ${isToday ? 'ring-1 ring-foreground/30' : ''}
                    ${!hasData ? 'bg-muted/30' : ''}
                  `}
                  style={{ background: bg || undefined }}
                >
                  <span className={`text-xs font-medium ${isToday ? 'font-bold' : ''} ${hasData ? '' : 'text-muted-foreground'}`}>{dayNum}</span>
                  {hasData && (
                    <div className="flex flex-col items-center gap-0 mt-0.5">
                      {cell.cobros > 0 && <span className="text-[8px] font-mono font-semibold text-success leading-tight">+{cell.cobros >= 1000 ? `${Math.round(cell.cobros / 1000)}k` : Math.round(cell.cobros)}</span>}
                      {cell.pagos > 0 && <span className="text-[8px] font-mono font-semibold text-destructive leading-tight">{'\u2212'}{cell.pagos >= 1000 ? `${Math.round(cell.pagos / 1000)}k` : Math.round(cell.pagos)}</span>}
                    </div>
                  )}
                  {/* Tension indicator */}
                  {cell.net < -10000 && (
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-destructive" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div className="w-3 h-3 rounded" style={{ background: 'hsl(var(--success) / 0.4)' }} />
              <span>{t('legendCollections')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div className="w-3 h-3 rounded" style={{ background: 'hsl(var(--destructive) / 0.4)' }} />
              <span>{t('legendPayments')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              <span>{t('legendTensionDay')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day detail */}
      {selectedDay && selectedDay.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle>
                {t('detail')} — {new Date(selectedDay.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </CardTitle>
              <div className="flex items-center gap-3">
                {selectedDay.cobros > 0 && <Badge variant="success">{t('badgeCollections')}: +{fmtEur(Math.round(selectedDay.cobros))}</Badge>}
                {selectedDay.pagos > 0 && <Badge variant="destructive">{t('badgePayments')}: {'\u2212'}{fmtEur(Math.round(selectedDay.pagos))}</Badge>}
                <Badge variant={selectedDay.net >= 0 ? 'success' : 'destructive'}>
                  {t('badgeNet')}: {selectedDay.net >= 0 ? '+' : ''}{fmtEur(Math.round(selectedDay.net))}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {selectedDay.invoices
              .sort((a, b) => b.amount - a.amount)
              .map((inv, idx) => (
                <div key={idx} className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-0 hover:bg-muted/50">
                  <span className={`flex-shrink-0 ${inv.type === 'AR' ? 'text-success' : 'text-destructive'}`}>
                    {inv.type === 'AR' ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
                  </span>
                  <Badge variant={inv.type === 'AR' ? 'success' : 'destructive'} className="text-[10px] flex-shrink-0">
                    {inv.type === 'AR' ? t('collection') : t('payment')}
                  </Badge>
                  <span className="font-mono text-xs font-semibold flex-shrink-0">{inv.number}</span>
                  <span className="text-sm flex-1 truncate">{inv.counterparty}</span>
                  <Badge variant="secondary" className="text-[10px]">{inv.status}</Badge>
                  <span className={`font-mono text-sm font-semibold flex-shrink-0 ${inv.type === 'AR' ? 'text-success' : 'text-destructive'}`}>
                    {inv.type === 'AR' ? '+' : '\u2212'}{fmtEur(Math.round(inv.amount))}
                  </span>
                </div>
              ))
            }
          </CardContent>
        </Card>
      )}

      {/* Monthly tension summary */}
      {tensionDays.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-destructive" />
              <CardTitle>{t('tensionTitle')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {tensionDays
                .sort((a, b) => a.net - b.net)
                .map(d => (
                  <div
                    key={d.date}
                    className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 cursor-pointer hover:bg-destructive/10 transition-colors"
                    onClick={() => setSelectedDay(d)}
                  >
                    <div className="text-xs font-medium">{new Date(d.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                    <div className="font-mono text-lg font-bold text-destructive">{fmtEur(Math.round(d.net))}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {t('tensionDetail', { cobros: d.cobroCount, pagos: d.pagoCount })}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
