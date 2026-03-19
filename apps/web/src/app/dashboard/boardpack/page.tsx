'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmtM, fmt, fmtPct, riskLabel, riskVariant, exportCSV } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BarChart3, Droplets, RefreshCw, CreditCard, AlertTriangle, FileDown, Download, Siren, TrendingUp, TrendingDown, ArrowRight, CheckCircle2, GitCompareArrows } from 'lucide-react'
import { exportBoardPackPDF } from '@/lib/export-pdf'
import { SkeletonBoardPack } from '@/components/ui/skeleton-page'

const sectionNav = [
  { key: 'summary', label: '1. Resumen Ejecutivo', icon: <BarChart3 size={14} /> },
  { key: 'liquidity', label: '2. Liquidez', icon: <Droplets size={14} /> },
  { key: 'working', label: '3. Working Capital', icon: <RefreshCw size={14} /> },
  { key: 'debt', label: '4. Deuda & Covenants', icon: <CreditCard size={14} /> },
  { key: 'risk', label: '5. Riesgo Clientes', icon: <AlertTriangle size={14} /> },
]

function Delta({ current, previous, suffix = '', invert = false, format }: { current: number; previous: number; suffix?: string; invert?: boolean; format?: (v: number) => string }) {
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

function CompareKPI({ label, current, previous, showCompare, suffix, format, good, invert }: {
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

function CompareMetric({ label, currentVal, prevVal, showCompare, suffix, invert, format }: {
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

export default function BoardPackPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('summary')
  const [showCompare, setShowCompare] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  function fetchData() {
    return api.board.pack()
      .then(d => { setData(d); setLastUpdated(new Date()) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  async function handleRefresh() {
    await fetchData()
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) return <SkeletonBoardPack />
  if (!data) return <div className="text-center text-muted-foreground py-20">Error cargando Board Pack</div>

  const { sections, generatedAt } = data
  const prev = data.previous?.sections
  const { executiveSummary: es, liquidity: liq, workingCapital: wc, debt, customerRisk: cr } = sections
  const pes = prev?.executiveSummary
  const pliq = prev?.liquidity
  const pwc = prev?.workingCapital
  const pdebt = prev?.debt
  const pcr = prev?.customerRisk
  const genDate = new Date(generatedAt)

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Board Pack"
        subtitle={`Informe para el Consejo · Grupo Ibérico SA · Generado ${genDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        actions={
          <>
            <Button
              variant={showCompare ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowCompare(!showCompare)}
            >
              <GitCompareArrows size={14} className="mr-1" />
              {showCompare ? 'Q4 2025 vs Q1 2026' : 'Comparar con Q4'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportBoardPackPDF(data)}><FileDown size={14} className="mr-1" />Exportar PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportCSV('board_pack', ['Sección', 'Métrica', 'Valor'], [['Resumen', 'Caja', String(es.cash)], ['Resumen', 'Revenue', String(es.revenue)], ['Resumen', 'EBITDA Margen', `${es.ebitdaMargin}%`], ['Resumen', 'Alertas', String(es.alerts)], ['Liquidez', 'Caja Actual', String(liq.currentCash)], ['Liquidez', 'Caja Proyectada S13', String(liq.forecastedCash * 1000)], ['Liquidez', 'Semanas Gap', String(liq.gapWeeks.length)], ['Working Capital', 'DSO', `${wc.dso}d`], ['Working Capital', 'DPO', `${wc.dpo}d`], ['Working Capital', 'CCC', `${wc.ccc}d`], ['Deuda', 'Deuda Bruta', String(debt.totalDebt)], ['Deuda', 'Deuda Neta', String(debt.netDebt)], ['Riesgo', 'Exposición Total', String(cr.totalExposure)], ['Riesgo', 'Score Medio', String(cr.avgScore)], ['Riesgo', 'Clientes Alerta', String(cr.alertCustomers.length)]])}><Download size={14} className="mr-1" />CSV</Button>
          </>
        }
      />

      {/* Compare banner */}
      {showCompare && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <GitCompareArrows size={16} className="text-primary flex-shrink-0" />
          <div className="flex-1">
            <span className="text-xs font-medium">Comparando </span>
            <Badge variant="secondary">Q4 2025</Badge>
            <span className="text-xs text-muted-foreground mx-1">→</span>
            <Badge variant="default">Q1 2026</Badge>
            <span className="text-xs text-muted-foreground ml-2">Los deltas muestran la variación trimestral</span>
          </div>
        </div>
      )}

      {/* Section nav */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {sectionNav.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeSection === s.key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      {/* 1. Resumen Ejecutivo */}
      {activeSection === 'summary' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span><BarChart3 size={18} /></span>
                <CardTitle>1. Resumen Ejecutivo</CardTitle>
                {showCompare && <Badge variant="secondary">Q4→Q1</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">Visión general de la situación financiera para el Consejo de Administración</p>
            </CardHeader>
            <CardContent>
              {/* Status banner */}
              <div className={`flex items-center gap-3 p-4 rounded-lg mb-6 ${es.alerts > 0 ? 'bg-warning/10 border border-warning/30' : 'bg-success/10 border border-success/30'}`}>
                <span className="flex-shrink-0">{es.alerts > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}</span>
                <div>
                  <div className={`font-semibold text-sm ${es.alerts > 0 ? 'text-warning' : 'text-success'}`}>
                    {es.alerts > 0 ? `${es.alerts} alerta${es.alerts > 1 ? 's' : ''} activa${es.alerts > 1 ? 's' : ''} — atención requerida` : 'Situación financiera estable — sin alertas críticas'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Covenants: {es.covenants ? 'Todos cumplidos' : 'Incumplimiento detectado'} · EBITDA Margen: {es.ebitdaMargin}%
                  </div>
                </div>
              </div>

              {/* KPI grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Posición de Caja</div>
                  <div className="font-mono text-xl font-bold">{fmtEur(es.cash)}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">4 cuentas bancarias</div>
                  {showCompare && pes && <div className="mt-1"><Delta current={es.cash} previous={pes.cash} format={fmtEur} /></div>}
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Revenue YTD</div>
                  <div className="font-mono text-xl font-bold">{fmtM(es.revenue)}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Q1 2026</div>
                  {showCompare && pes && <div className="mt-1"><Delta current={es.revenue} previous={pes.revenue} format={fmtM} /></div>}
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Margen EBITDA</div>
                  <div className="font-mono text-xl font-bold">{es.ebitdaMargin}%</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Operativo</div>
                  {showCompare && pes && <div className="mt-1"><Delta current={es.ebitdaMargin} previous={pes.ebitdaMargin} suffix="pp" /></div>}
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Covenants</div>
                  <div className={`font-mono text-xl font-bold ${es.covenants ? 'text-success' : 'text-destructive'}`}>{es.covenants ? '4/4 OK' : 'Incumplimiento'}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{es.covenants ? 'Todos cumplidos' : 'Revisar deuda'}</div>
                  {showCompare && pes && <div className="text-[10px] text-muted-foreground mt-1">Q4: {pes.covenants ? '4/4 OK' : 'Incumplimiento'}</div>}
                </div>
              </div>

              {/* Comparison summary table */}
              {showCompare && pes && (
                <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resumen Comparativo Q4 2025 → Q1 2026</div>
                  <div className="space-y-2">
                    {[
                      { label: 'Posición de Caja', q4: fmtEur(pes.cash), q1: fmtEur(es.cash), curr: es.cash, prev: pes.cash },
                      { label: 'Revenue', q4: fmtM(pes.revenue), q1: fmtM(es.revenue), curr: es.revenue, prev: pes.revenue },
                      { label: 'Margen EBITDA', q4: `${pes.ebitdaMargin}%`, q1: `${es.ebitdaMargin}%`, curr: es.ebitdaMargin, prev: pes.ebitdaMargin },
                      { label: 'Alertas Activas', q4: String(pes.alerts), q1: String(es.alerts), curr: es.alerts, prev: pes.alerts, invert: true },
                    ].map(r => (
                      <div key={r.label} className="flex items-center text-xs py-1.5 border-b border-border last:border-0">
                        <span className="flex-1 text-muted-foreground">{r.label}</span>
                        <span className="w-24 text-right font-mono text-muted-foreground">{r.q4}</span>
                        <span className="w-6 text-center text-muted-foreground">→</span>
                        <span className="w-24 text-right font-mono font-semibold">{r.q1}</span>
                        <span className="w-32 text-right"><Delta current={r.curr} previous={r.prev} invert={r.invert} /></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. Liquidez */}
      {activeSection === 'liquidity' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span><Droplets size={18} /></span>
                <CardTitle>2. Posición de Liquidez</CardTitle>
                {showCompare && <Badge variant="secondary">Q4→Q1</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">Estado actual y proyección de tesorería a 13 semanas</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Caja Actual</div>
                  <div className="font-mono text-2xl font-bold">{fmtEur(liq.currentCash)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Posición consolidada</div>
                  {showCompare && pliq && <div className="mt-1"><Delta current={liq.currentCash} previous={pliq.currentCash} format={fmtEur} /></div>}
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Caja Proyectada (S13)</div>
                  <div className="font-mono text-2xl font-bold text-primary">{fmtEur(liq.forecastedCash * 1000)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Fin del horizonte forecast</div>
                  {showCompare && pliq && <div className="mt-1"><Delta current={liq.forecastedCash * 1000} previous={pliq.forecastedCash * 1000} format={fmtEur} /></div>}
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Semanas con Gap</div>
                  <div className={`font-mono text-2xl font-bold ${liq.gapWeeks.length > 0 ? 'text-warning' : 'text-success'}`}>{liq.gapWeeks.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {liq.gapWeeks.length > 0 ? `S${liq.gapWeeks.join(', S')}` : 'Sin gaps detectados'}
                  </div>
                  {showCompare && pliq && <div className="mt-1"><Delta current={liq.gapWeeks.length} previous={pliq.gapWeeks.length} invert /></div>}
                </div>
              </div>

              {showCompare && pliq && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Evolución de Liquidez Q4 → Q1</div>
                  <div className="space-y-2">
                    {[
                      { label: 'Caja', q4: fmtEur(pliq.currentCash), q1: fmtEur(liq.currentCash), curr: liq.currentCash, prev: pliq.currentCash },
                      { label: 'Forecast S13', q4: fmtEur(pliq.forecastedCash * 1000), q1: fmtEur(liq.forecastedCash * 1000), curr: liq.forecastedCash * 1000, prev: pliq.forecastedCash * 1000 },
                      { label: 'Semanas Gap', q4: String(pliq.gapWeeks.length), q1: String(liq.gapWeeks.length), curr: liq.gapWeeks.length, prev: pliq.gapWeeks.length, invert: true },
                    ].map(r => (
                      <div key={r.label} className="flex items-center text-xs py-1.5 border-b border-border last:border-0">
                        <span className="flex-1 text-muted-foreground">{r.label}</span>
                        <span className="w-28 text-right font-mono text-muted-foreground">{r.q4}</span>
                        <span className="w-6 text-center text-muted-foreground">→</span>
                        <span className="w-28 text-right font-mono font-semibold">{r.q1}</span>
                        <span className="w-32 text-right"><Delta current={r.curr} previous={r.prev} invert={r.invert} /></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {liq.gapWeeks.length > 0 && (
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                  <div className="font-semibold text-sm text-warning mb-2">Semanas con déficit de caja</div>
                  <div className="grid grid-cols-3 gap-3">
                    {liq.gapWeeks.map((w: number) => (
                      <div key={w} className="bg-card rounded-lg p-3 border border-border text-center">
                        <div className="font-mono text-lg font-bold text-warning">S{w}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Pagos &gt; Cobros</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-3">
                    Recomendación: Activar líneas de crédito disponibles o acelerar cobros para cubrir gaps en semanas {liq.gapWeeks.join(', ')}.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. Working Capital */}
      {activeSection === 'working' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span><RefreshCw size={18} /></span>
                <CardTitle>3. Working Capital</CardTitle>
                {showCompare && <Badge variant="secondary">Q4→Q1</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">Ciclo de conversión de efectivo y métricas de capital circulante</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'DSO', value: `${wc.dso}d`, target: `Obj: ${wc.dsoTarget}d`, good: wc.dso <= wc.dsoTarget, curr: wc.dso, prev: pwc?.dso, invert: true },
                  { label: 'DPO', value: `${wc.dpo}d`, target: 'Días pago medio', good: true, curr: wc.dpo, prev: pwc?.dpo },
                  { label: 'CCC', value: `${wc.ccc}d`, target: 'DSO − DPO + DIO', good: wc.ccc < 45, curr: wc.ccc, prev: pwc?.ccc, invert: true },
                  { label: 'DSO vs Objetivo', value: wc.dso <= wc.dsoTarget ? 'Cumple' : `+${wc.dso - wc.dsoTarget}d`, target: `${wc.dsoTarget}d objetivo`, good: wc.dso <= wc.dsoTarget },
                ].map(m => (
                  <div key={m.label} className="bg-muted/50 border border-border rounded-xl p-4 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
                    <div className={`font-mono text-xl font-bold ${m.good ? 'text-success' : 'text-warning'}`}>{m.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{m.target}</div>
                    {showCompare && m.prev !== undefined && m.curr !== undefined && (
                      <div className="mt-1"><Delta current={m.curr} previous={m.prev} suffix="d" invert={m.invert} /></div>
                    )}
                  </div>
                ))}
              </div>

              {/* CCC Visual */}
              <div className="p-5 rounded-lg bg-muted/30 border border-border">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Ciclo de Conversión de Efectivo</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg p-3 text-center" style={{ background: 'hsl(var(--primary) / 0.1)' }}>
                    <div className="text-[10px] text-muted-foreground">DSO (Cobro)</div>
                    <div className="font-mono text-lg font-bold text-primary">{wc.dso}d</div>
                    {showCompare && pwc && <div className="text-[10px] text-muted-foreground">Q4: {pwc.dso}d</div>}
                  </div>
                  <span className="text-muted-foreground text-lg">−</span>
                  <div className="flex-1 rounded-lg p-3 text-center" style={{ background: 'hsl(var(--success) / 0.1)' }}>
                    <div className="text-[10px] text-muted-foreground">DPO (Pago)</div>
                    <div className="font-mono text-lg font-bold text-success">{wc.dpo}d</div>
                    {showCompare && pwc && <div className="text-[10px] text-muted-foreground">Q4: {pwc.dpo}d</div>}
                  </div>
                  <span className="text-muted-foreground text-lg">=</span>
                  <div className="flex-1 rounded-lg p-3 text-center border-2 border-primary">
                    <div className="text-[10px] text-muted-foreground">CCC</div>
                    <div className="font-mono text-lg font-bold">{wc.ccc}d</div>
                    {showCompare && pwc && <div className="text-[10px] text-muted-foreground">Q4: {pwc.ccc}d</div>}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-3 text-center">
                  {wc.ccc < 0 ? 'CCC negativo: la empresa cobra antes de pagar — posición favorable.' : `${wc.ccc} días de financiación de circulante necesarios.`}
                  {showCompare && pwc && ` (Q4: ${pwc.ccc}d → Q1: ${wc.ccc}d, mejora de ${pwc.ccc - wc.ccc}d)`}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. Deuda & Covenants */}
      {activeSection === 'debt' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span><CreditCard size={18} /></span>
                  <CardTitle>4. Deuda & Covenants</CardTitle>
                  {showCompare && <Badge variant="secondary">Q4→Q1</Badge>}
                </div>
                <Badge variant="success">4/4 Cumplidos</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Posición de endeudamiento y cumplimiento de covenants financieros</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Deuda Bruta</div>
                  <div className="font-mono text-2xl font-bold">{fmtEur(debt.totalDebt)}</div>
                  {showCompare && pdebt && <div className="mt-1"><Delta current={debt.totalDebt} previous={pdebt.totalDebt} format={fmtEur} invert /></div>}
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Deuda Neta</div>
                  <div className="font-mono text-2xl font-bold text-primary">{fmtEur(debt.netDebt)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Deuda − Caja</div>
                  {showCompare && pdebt && <div className="mt-1"><Delta current={debt.netDebt} previous={pdebt.netDebt} format={fmtEur} invert /></div>}
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Apalancamiento</div>
                  <div className="font-mono text-2xl font-bold text-success">{(debt.netDebt / es.revenue * 100).toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Deuda Neta / Revenue</div>
                  {showCompare && pdebt && pes && (
                    <div className="mt-1"><Delta current={debt.netDebt / es.revenue * 100} previous={pdebt.netDebt / pes.revenue * 100} suffix="pp" invert /></div>
                  )}
                </div>
              </div>

              {/* Covenants table */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Covenants Financieros</div>
                <div className="space-y-3">
                  {debt.allCovenants.map((cov: any, idx: number) => {
                    const margin = Number(cov.margin)
                    const prevCov = showCompare && pdebt?.allCovenants?.[idx]
                    const prevMargin = prevCov ? Number(prevCov.margin) : null
                    const trendIcon = cov.trend === 'IMPROVING' ? <TrendingUp size={14} /> : cov.trend === 'DETERIORATING' ? <TrendingDown size={14} /> : <ArrowRight size={14} />
                    const trendLabel = cov.trend === 'IMPROVING' ? 'Mejorando' : cov.trend === 'DETERIORATING' ? 'Deteriorando' : 'Estable'
                    return (
                      <div key={cov.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{cov.name}</span>
                            <Badge variant={cov.status === 'COMPLIANT' ? 'success' : 'destructive'}>
                              {cov.status === 'COMPLIANT' ? 'Cumple' : 'Incumple'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{trendIcon} {trendLabel}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">{cov.formula}</div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, cov.limitType === 'MAX' ? (Number(cov.currentValue) / Number(cov.limitValue)) * 100 : Math.min(100, (Number(cov.currentValue) / Number(cov.limitValue)) * 50))}%`,
                                background: margin > 30 ? 'hsl(var(--success))' : margin > 10 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-mono text-sm font-bold">{cov.currentValue}</div>
                          <div className="text-[10px] text-muted-foreground">{cov.limitType === 'MAX' ? 'Máx' : 'Mín'}: {cov.limitValue}</div>
                          <div className={`font-mono text-xs font-semibold mt-0.5 ${margin > 30 ? 'text-success' : margin > 10 ? 'text-warning' : 'text-destructive'}`}>
                            +{margin}% margen
                          </div>
                          {showCompare && prevMargin !== null && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">Q4: +{prevMargin}%</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 5. Riesgo Clientes */}
      {activeSection === 'risk' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span><AlertTriangle size={18} /></span>
                <CardTitle>5. Riesgo de Clientes</CardTitle>
                {showCompare && <Badge variant="secondary">Q4→Q1</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">Exposición crediticia y clientes en alerta</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Exposición Total</div>
                  <div className="font-mono text-2xl font-bold">{fmtEur(cr.totalExposure)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Cuentas por cobrar</div>
                  {showCompare && pcr && <div className="mt-1"><Delta current={cr.totalExposure} previous={pcr.totalExposure} format={fmtEur} invert /></div>}
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Score Medio</div>
                  <div className={`font-mono text-2xl font-bold ${cr.avgScore >= 70 ? 'text-success' : cr.avgScore >= 50 ? 'text-warning' : 'text-destructive'}`}>{cr.avgScore}</div>
                  <div className="text-xs text-muted-foreground mt-1">Modelo ML crediticio</div>
                  {showCompare && pcr && <div className="mt-1"><Delta current={cr.avgScore} previous={pcr.avgScore} /></div>}
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Clientes en Alerta</div>
                  <div className={`font-mono text-2xl font-bold ${cr.alertCustomers.length > 0 ? 'text-destructive' : 'text-success'}`}>{cr.alertCustomers.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Gestión urgente</div>
                  {showCompare && pcr && <div className="mt-1"><Delta current={cr.alertCustomers.length} previous={pcr.alertCustomers.length} invert /></div>}
                </div>
              </div>

              {showCompare && pcr && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Variación Riesgo Q4 → Q1</div>
                  <div className="space-y-2">
                    {[
                      { label: 'Exposición Total', q4: fmtEur(pcr.totalExposure), q1: fmtEur(cr.totalExposure), curr: cr.totalExposure, prev: pcr.totalExposure, invert: true },
                      { label: 'Score Medio', q4: String(pcr.avgScore), q1: String(cr.avgScore), curr: cr.avgScore, prev: pcr.avgScore },
                      { label: 'Clientes en Alerta', q4: String(pcr.alertCustomers.length), q1: String(cr.alertCustomers.length), curr: cr.alertCustomers.length, prev: pcr.alertCustomers.length, invert: true },
                    ].map(r => (
                      <div key={r.label} className="flex items-center text-xs py-1.5 border-b border-border last:border-0">
                        <span className="flex-1 text-muted-foreground">{r.label}</span>
                        <span className="w-28 text-right font-mono text-muted-foreground">{r.q4}</span>
                        <span className="w-6 text-center text-muted-foreground">→</span>
                        <span className="w-28 text-right font-mono font-semibold">{r.q1}</span>
                        <span className="w-32 text-right"><Delta current={r.curr} previous={r.prev} invert={r.invert} /></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cr.alertCustomers.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Clientes en Alerta</div>
                  {cr.alertCustomers.map((c: any) => (
                    <div key={c.id} className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Siren size={18} />
                          <span className="font-semibold">{c.name}</span>
                          <Badge variant="secondary">{c.code}</Badge>
                          <Badge variant="destructive">{riskLabel(c.riskLevel)}</Badge>
                        </div>
                        <Badge variant={c.status === 'ALERT' ? 'destructive' : 'success'}>
                          {c.status === 'ALERT' ? 'Alerta Activa' : 'Activo'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-card rounded-lg p-3 border border-border">
                          <div className="text-[10px] text-muted-foreground uppercase">Score IA</div>
                          <div className="font-mono text-lg font-bold text-destructive">{c.creditScore}</div>
                        </div>
                        <div className="bg-card rounded-lg p-3 border border-border">
                          <div className="text-[10px] text-muted-foreground uppercase">DSO</div>
                          <div className="font-mono text-lg font-bold text-destructive">{c.dso}d</div>
                        </div>
                        <div className="bg-card rounded-lg p-3 border border-border">
                          <div className="text-[10px] text-muted-foreground uppercase">Límite Crédito</div>
                          <div className="font-mono text-lg font-bold">{fmtEur(Number(c.creditLimit))}</div>
                        </div>
                        <div className="bg-card rounded-lg p-3 border border-border">
                          <div className="text-[10px] text-muted-foreground uppercase">Riesgo</div>
                          <div className="font-mono text-lg font-bold text-destructive">{riskLabel(c.riskLevel)}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Recomendación: Suspender nuevos pedidos, iniciar proceso de gestión de cobro activa y revisar provisión por insolvencia.
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
