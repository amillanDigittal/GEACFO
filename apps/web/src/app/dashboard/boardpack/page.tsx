'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmtM, fmt, fmtPct, riskLabel, riskVariant, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BarChart3, Droplets, RefreshCw, CreditCard, AlertTriangle, FileDown, Download, Siren, TrendingUp, TrendingDown, ArrowRight, CheckCircle2 } from 'lucide-react'
import { exportBoardPackPDF } from '@/lib/export-pdf'
import { SkeletonBoardPack } from '@/components/ui/skeleton-page'

const sectionNav = [
  { key: 'summary', label: '1. Resumen Ejecutivo', icon: <BarChart3 size={14} /> },
  { key: 'liquidity', label: '2. Liquidez', icon: <Droplets size={14} /> },
  { key: 'working', label: '3. Working Capital', icon: <RefreshCw size={14} /> },
  { key: 'debt', label: '4. Deuda & Covenants', icon: <CreditCard size={14} /> },
  { key: 'risk', label: '5. Riesgo Clientes', icon: <AlertTriangle size={14} /> },
]

export default function BoardPackPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('summary')

  useEffect(() => {
    api.board.pack()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonBoardPack />
  if (!data) return <div className="text-center text-muted-foreground py-20">Error cargando Board Pack</div>

  const { sections, generatedAt } = data
  const { executiveSummary: es, liquidity: liq, workingCapital: wc, debt, customerRisk: cr } = sections
  const genDate = new Date(generatedAt)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Board Pack</h1>
          <p className="page-subtitle">
            Informe para el Consejo · Grupo Ibérico SA · Generado {genDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportBoardPackPDF(data)}><FileDown size={14} className="mr-1" />Exportar PDF</Button>
          <Button variant="outline" size="sm" onClick={() => exportCSV('board_pack', ['Sección', 'Métrica', 'Valor'], [['Resumen', 'Caja', String(es.cash)], ['Resumen', 'Revenue', String(es.revenue)], ['Resumen', 'EBITDA Margen', `${es.ebitdaMargin}%`], ['Resumen', 'Alertas', String(es.alerts)], ['Liquidez', 'Caja Actual', String(liq.currentCash)], ['Liquidez', 'Caja Proyectada S13', String(liq.forecastedCash * 1000)], ['Liquidez', 'Semanas Gap', String(liq.gapWeeks.length)], ['Working Capital', 'DSO', `${wc.dso}d`], ['Working Capital', 'DPO', `${wc.dpo}d`], ['Working Capital', 'CCC', `${wc.ccc}d`], ['Deuda', 'Deuda Bruta', String(debt.totalDebt)], ['Deuda', 'Deuda Neta', String(debt.netDebt)], ['Riesgo', 'Exposición Total', String(cr.totalExposure)], ['Riesgo', 'Score Medio', String(cr.avgScore)], ['Riesgo', 'Clientes Alerta', String(cr.alertCustomers.length)]])}><Download size={14} className="mr-1" />CSV</Button>
        </div>
      </div>

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
                {[
                  { label: 'Posición de Caja', value: fmtEur(es.cash), sub: '4 cuentas bancarias' },
                  { label: 'Revenue YTD', value: fmtM(es.revenue), sub: 'Q1 2026' },
                  { label: 'Margen EBITDA', value: `${es.ebitdaMargin}%`, sub: 'Operativo' },
                  { label: 'Covenants', value: es.covenants ? '4/4 OK' : 'Incumplimiento', sub: es.covenants ? 'Todos cumplidos' : 'Revisar deuda', good: es.covenants },
                ].map(m => (
                  <div key={m.label} className="bg-muted/50 border border-border rounded-xl p-4 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
                    <div className={`font-mono text-xl font-bold ${m.good === false ? 'text-destructive' : m.good === true ? 'text-success' : 'text-foreground'}`}>{m.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{m.sub}</div>
                  </div>
                ))}
              </div>
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
              </div>
              <p className="text-xs text-muted-foreground">Estado actual y proyección de tesorería a 13 semanas</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Caja Actual</div>
                  <div className="font-mono text-2xl font-bold">{fmtEur(liq.currentCash)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Posición consolidada</div>
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Caja Proyectada (S13)</div>
                  <div className="font-mono text-2xl font-bold text-primary">{fmtEur(liq.forecastedCash * 1000)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Fin del horizonte forecast</div>
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Semanas con Gap</div>
                  <div className={`font-mono text-2xl font-bold ${liq.gapWeeks.length > 0 ? 'text-warning' : 'text-success'}`}>{liq.gapWeeks.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {liq.gapWeeks.length > 0 ? `S${liq.gapWeeks.join(', S')}` : 'Sin gaps detectados'}
                  </div>
                </div>
              </div>

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
              </div>
              <p className="text-xs text-muted-foreground">Ciclo de conversión de efectivo y métricas de capital circulante</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'DSO', value: `${wc.dso}d`, target: `Obj: ${wc.dsoTarget}d`, good: wc.dso <= wc.dsoTarget },
                  { label: 'DPO', value: `${wc.dpo}d`, target: 'Días pago medio', good: true },
                  { label: 'CCC', value: `${wc.ccc}d`, target: 'DSO − DPO + DIO', good: wc.ccc < 45 },
                  { label: 'DSO vs Objetivo', value: wc.dso <= wc.dsoTarget ? 'Cumple' : `+${wc.dso - wc.dsoTarget}d`, target: `${wc.dsoTarget}d objetivo`, good: wc.dso <= wc.dsoTarget },
                ].map(m => (
                  <div key={m.label} className="bg-muted/50 border border-border rounded-xl p-4 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
                    <div className={`font-mono text-xl font-bold ${m.good ? 'text-success' : 'text-warning'}`}>{m.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{m.target}</div>
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
                  </div>
                  <span className="text-muted-foreground text-lg">−</span>
                  <div className="flex-1 rounded-lg p-3 text-center" style={{ background: 'hsl(var(--success) / 0.1)' }}>
                    <div className="text-[10px] text-muted-foreground">DPO (Pago)</div>
                    <div className="font-mono text-lg font-bold text-success">{wc.dpo}d</div>
                  </div>
                  <span className="text-muted-foreground text-lg">=</span>
                  <div className="flex-1 rounded-lg p-3 text-center border-2 border-primary">
                    <div className="text-[10px] text-muted-foreground">CCC</div>
                    <div className="font-mono text-lg font-bold">{wc.ccc}d</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-3 text-center">
                  {wc.ccc < 0 ? 'CCC negativo: la empresa cobra antes de pagar — posición favorable.' : `${wc.ccc} días de financiación de circulante necesarios.`}
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
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Deuda Neta</div>
                  <div className="font-mono text-2xl font-bold text-primary">{fmtEur(debt.netDebt)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Deuda − Caja</div>
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Apalancamiento</div>
                  <div className="font-mono text-2xl font-bold text-success">{(debt.netDebt / es.revenue * 100).toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Deuda Neta / Revenue</div>
                </div>
              </div>

              {/* Covenants table */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Covenants Financieros</div>
                <div className="space-y-3">
                  {debt.allCovenants.map((cov: any) => {
                    const margin = Number(cov.margin)
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
              </div>
              <p className="text-xs text-muted-foreground">Exposición crediticia y clientes en alerta</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Exposición Total</div>
                  <div className="font-mono text-2xl font-bold">{fmtEur(cr.totalExposure)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Cuentas por cobrar</div>
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Score Medio</div>
                  <div className={`font-mono text-2xl font-bold ${cr.avgScore >= 70 ? 'text-success' : cr.avgScore >= 50 ? 'text-warning' : 'text-destructive'}`}>{cr.avgScore}</div>
                  <div className="text-xs text-muted-foreground mt-1">Modelo ML crediticio</div>
                </div>
                <div className="bg-muted/50 border border-border rounded-xl p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Clientes en Alerta</div>
                  <div className={`font-mono text-2xl font-bold ${cr.alertCustomers.length > 0 ? 'text-destructive' : 'text-success'}`}>{cr.alertCustomers.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Gestión urgente</div>
                </div>
              </div>

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
