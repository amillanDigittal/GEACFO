'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmtM, fmt, fmtPct, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { KpiCard } from '@/components/kpi-card'
import { PageHeader } from '@/components/page-header'
import { useRouter } from 'next/navigation'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Landmark, Calendar, CalendarDays, RefreshCw, BarChart3, TrendingUp, CreditCard, Scale, Download, FileText, AlertTriangle, AlertCircle, CircleDot, ExternalLink, ArrowRight, Bot, Sparkles } from 'lucide-react'
import { SkeletonCockpit } from '@/components/ui/skeleton-page'

function DrilldownRow({ label, value, highlight, pct }: { label: string; value: string; highlight?: boolean; pct?: number }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        {pct !== undefined && (
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        )}
        <span className={`font-mono text-sm font-semibold ${highlight ? 'text-primary' : ''}`}>{value}</span>
      </div>
    </div>
  )
}

function SparklineChart({ data, label }: { data: number[]; label: string }) {
  if (!data || data.length < 2) return null
  const chartData = data.map((v, i) => ({ i: i + 1, value: v }))
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id="drillGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Tooltip
          formatter={(v: any) => [label.includes('días') || label.includes('x') ? v : fmtEur(Number(v)), label]}
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
        />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#drillGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default function CockpitPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drilldown, setDrilldown] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [recsLoading, setRecsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    api.treasury.cockpit()
      .then(setData)
      .catch((err: any) => {
        console.error('Cockpit error:', err)
        setError(err?.message || String(err))
      })
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
    // Load recommendations in parallel (non-blocking)
    setRecsLoading(true)
    api.bot.recommendations()
      .then(r => setRecommendations(r.recommendations || []))
      .catch(() => {})
      .finally(() => setRecsLoading(false))
  }, [])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const result = await api.treasury.cockpit()
      setData(result)
    } catch (err: any) {
      console.error('Cockpit error:', err)
      setError(err?.message || String(err))
    } finally {
      setLoading(false)
      setLastUpdated(new Date())
    }
  }

  if (loading) return <SkeletonCockpit />
  if (!data) return <div className="text-center text-muted-foreground py-20">Error cargando datos{error && <p className="mt-2 text-xs text-destructive">{error}</p>}</div>

  const kpis = [
    { key: 'caja', label: 'Caja Hoy', value: fmtEur(data.caja?.value || 1245000), icon: <Landmark size={20} />, sub: `${data.caja?.accounts?.length || 4} cuentas bancarias`, trend: '+3.2%', up: true, page: '/dashboard/conciliacion', sparkline: data.caja?.sparkline, tooltip: 'Saldo consolidado de todas las cuentas bancarias del grupo en tiempo real.', source: 'Cuentas bancarias (BBVA, Santander, CaixaBank, Sabadell)' },
    { key: 'dso', label: 'DSO', value: `${data.dso?.value || 42} días`, icon: <Calendar size={20} />, sub: 'vs objetivo 45d', trend: '−3d', up: true, page: '/dashboard/cobros', sparkline: data.dso?.sparkline, tooltip: 'Days Sales Outstanding — plazo medio de cobro a clientes. Cuanto menor, mejor eficiencia de cobro.', source: 'Facturas AR (cuentas por cobrar)' },
    { key: 'dpo', label: 'DPO', value: `${data.dpo?.value || 67} días`, icon: <CalendarDays size={20} />, sub: 'Días pago medio', trend: '+2d', up: true, page: '/dashboard/pagos', sparkline: data.dpo?.sparkline, tooltip: 'Days Payable Outstanding — plazo medio de pago a proveedores. Mayor DPO mejora la posición de caja.', source: 'Facturas AP (cuentas por pagar)' },
    { key: 'ccc', label: 'Cash Conv. Cycle', value: `${data.ccc?.value || 28} días`, icon: <RefreshCw size={20} />, sub: 'DSO - DPO + DIO', trend: '−2d', up: true, page: '/dashboard/forecast', sparkline: data.ccc?.sparkline, tooltip: 'Ciclo de conversión de efectivo. Días que tarda la empresa en convertir inversión en inventario en cobros. CCC = DSO + DIO − DPO.', source: 'Cálculo: DSO + DIO − DPO' },
    { key: 'revenue', label: 'Revenue YTD', value: fmtM(data.revenue?.value || 4820000), icon: <BarChart3 size={20} />, sub: 'Enero – Marzo 2026', trend: '+12.3%', up: true, page: '/dashboard/variance', sparkline: data.revenue?.sparkline, tooltip: 'Ingresos acumulados en el año fiscal actual (Year To Date). Incluye facturación neta de todas las líneas de negocio.', source: 'Facturación consolidada Q1 2026' },
    { key: 'ebitda', label: 'EBITDA', value: fmtM(data.ebitda?.value || 1150000), icon: <TrendingUp size={20} />, sub: `Margen ${data.ebitda?.margin || 23.9}%`, trend: '+0.8pp', up: true, page: '/dashboard/variance', sparkline: data.ebitda?.sparkline, tooltip: 'Resultado operativo antes de intereses, impuestos, depreciación y amortización. Mide la rentabilidad operativa pura.', source: 'P&L consolidada' },
    { key: 'deudaNeta', label: 'Deuda Neta', value: fmtM(data.deudaNeta?.value || 2180000), icon: <CreditCard size={20} />, sub: 'Deuda total − caja', trend: '−1.2%', up: true, page: '/dashboard/deuda', sparkline: data.deudaNeta?.sparkline, tooltip: 'Deuda financiera total menos la posición de caja disponible. Indicador clave de apalancamiento real.', source: 'Instrumentos de deuda − Saldo cuentas bancarias' },
    { key: 'liquidez', label: 'Ratio Liquidez', value: `${data.liquidez?.value || 1.85}x`, icon: <Scale size={20} />, sub: 'Activo / Pasivo corr.', trend: '+0.05x', up: true, page: '/dashboard/deuda', sparkline: data.liquidez?.sparkline, tooltip: 'Ratio corriente: capacidad de cubrir obligaciones a corto plazo. Por encima de 1.2x se considera saludable.', source: 'Balance: Activo corriente / Pasivo corriente' },
  ]

  const activeKpi = kpis.find(k => k.key === drilldown)

  const cashEvolution = (data.cashEvolution || []).map((d: any) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
  }))

  // Drill-down content for each KPI
  function renderDrilldown() {
    if (!drilldown || !activeKpi) return null

    const totalCash = data.caja?.value || 1245000
    const ar = data.workingCapital?.ar || 964850
    const ap = data.workingCapital?.ap || 146550
    const dsoVal = data.dso?.value || 42
    const dpoVal = data.dpo?.value || 67
    const cccVal = data.ccc?.value || 28
    const revenueVal = data.revenue?.value || 4820000
    const ebitdaVal = data.ebitda?.value || 1150000
    const deudaVal = data.deudaNeta?.value || 2180000
    const liquidezVal = data.liquidez?.value || 1.85

    switch (drilldown) {
      case 'caja': {
        const accounts = data.caja?.accounts || []
        return (
          <>
            <DialogDescription>Desglose por cuenta bancaria</DialogDescription>
            <div className="space-y-1 mt-2">
              {accounts.map((a: any) => (
                <DrilldownRow
                  key={a.name}
                  label={a.name}
                  value={fmtEur(a.balance)}
                  pct={totalCash > 0 ? (a.balance / totalCash) * 100 : 0}
                />
              ))}
              <DrilldownRow label="Total Caja" value={fmtEur(totalCash)} highlight />
            </div>
            <SparklineChart data={activeKpi.sparkline} label="Saldo" />
          </>
        )
      }
      case 'dso': {
        const months = ['Enero', 'Febrero', 'Marzo']
        const dsoTrend = data.dso?.sparkline?.slice(-3) || [45, 43, dsoVal]
        return (
          <>
            <DialogDescription>Days Sales Outstanding — plazo medio de cobro</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label="DSO Actual" value={`${dsoVal} días`} highlight />
              <DrilldownRow label="Objetivo" value="45 días" />
              <DrilldownRow label="Diferencia vs objetivo" value={`${dsoVal - 45 > 0 ? '+' : ''}${dsoVal - 45}d`} />
              <DrilldownRow label="Cuentas por Cobrar (AR)" value={fmtEur(ar)} />
            </div>
            <div className="mt-3 text-xs text-muted-foreground font-medium mb-1">Evolución mensual</div>
            <div className="grid grid-cols-3 gap-2">
              {months.map((m, i) => (
                <div key={m} className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-muted-foreground">{m}</div>
                  <div className="font-mono text-sm font-bold">{dsoTrend[i]}d</div>
                </div>
              ))}
            </div>
            <SparklineChart data={activeKpi.sparkline} label="días" />
          </>
        )
      }
      case 'dpo': {
        const months = ['Enero', 'Febrero', 'Marzo']
        const dpoTrend = data.dpo?.sparkline?.slice(-3) || [64, 66, dpoVal]
        return (
          <>
            <DialogDescription>Days Payable Outstanding — plazo medio de pago</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label="DPO Actual" value={`${dpoVal} días`} highlight />
              <DrilldownRow label="Cuentas por Pagar (AP)" value={fmtEur(ap)} />
              <DrilldownRow label="Tendencia" value="+2d vs mes anterior" />
            </div>
            <div className="mt-3 text-xs text-muted-foreground font-medium mb-1">Evolución mensual</div>
            <div className="grid grid-cols-3 gap-2">
              {months.map((m, i) => (
                <div key={m} className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-muted-foreground">{m}</div>
                  <div className="font-mono text-sm font-bold">{dpoTrend[i]}d</div>
                </div>
              ))}
            </div>
            <SparklineChart data={activeKpi.sparkline} label="días" />
          </>
        )
      }
      case 'ccc': {
        const dio = cccVal - dsoVal + dpoVal
        return (
          <>
            <DialogDescription>Ciclo de conversión de efectivo</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label="DSO (cobro)" value={`${dsoVal} días`} />
              <DrilldownRow label="DIO (inventario)" value={`${dio} días`} />
              <DrilldownRow label="DPO (pago)" value={`−${dpoVal} días`} />
              <div className="border-t border-border mt-1 pt-1">
                <DrilldownRow label="CCC = DSO + DIO − DPO" value={`${cccVal} días`} highlight />
              </div>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20 text-xs text-success">
              El ciclo se ha reducido 2 días vs mes anterior. Menor CCC = menor necesidad de financiación del circulante.
            </div>
            <SparklineChart data={activeKpi.sparkline} label="días" />
          </>
        )
      }
      case 'revenue': {
        const monthly = [
          { month: 'Ene', value: 1540000 },
          { month: 'Feb', value: 1620000 },
          { month: 'Mar', value: 1660000 },
        ]
        return (
          <>
            <DialogDescription>Ingresos acumulados Enero – Marzo 2026</DialogDescription>
            <div className="space-y-1 mt-2">
              {monthly.map(m => (
                <DrilldownRow
                  key={m.month}
                  label={m.month}
                  value={fmtEur(m.value)}
                  pct={(m.value / revenueVal) * 100}
                />
              ))}
              <DrilldownRow label="Total YTD" value={fmtEur(revenueVal)} highlight />
              <DrilldownRow label="Crecimiento vs año ant." value="+12,3%" />
            </div>
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={monthly} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: any) => [fmtEur(Number(v)), 'Revenue']}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )
      }
      case 'ebitda': {
        const margin = data.ebitda?.margin || 23.9
        return (
          <>
            <DialogDescription>Resultado operativo antes de amortizaciones</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label="Revenue YTD" value={fmtEur(revenueVal)} />
              <DrilldownRow label="EBITDA" value={fmtEur(ebitdaVal)} highlight />
              <DrilldownRow label="Margen EBITDA" value={fmtPct(margin)} pct={margin} />
              <DrilldownRow label="Variación margen" value="+0,8pp vs mes ant." />
            </div>
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <div className="flex justify-between mb-1"><span>Gastos operativos</span><span className="font-mono font-semibold">{fmtEur(revenueVal - ebitdaVal)}</span></div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${margin}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px]"><span>EBITDA {fmtPct(margin)}</span><span>OpEx {fmtPct(100 - margin)}</span></div>
            </div>
            <SparklineChart data={activeKpi.sparkline} label="EBITDA" />
          </>
        )
      }
      case 'deudaNeta': {
        const deudaBruta = deudaVal + totalCash
        return (
          <>
            <DialogDescription>Deuda financiera neta de posición de caja</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label="Deuda Bruta" value={fmtEur(deudaBruta)} />
              <DrilldownRow label="(−) Caja disponible" value={`−${fmtEur(totalCash)}`} />
              <DrilldownRow label="Deuda Neta" value={fmtEur(deudaVal)} highlight />
              <DrilldownRow label="Deuda Neta / EBITDA" value={`${fmt(deudaVal / ebitdaVal, 1)}x`} />
              <DrilldownRow label="Tendencia" value="−1,2% vs mes anterior" />
            </div>
            <SparklineChart data={activeKpi.sparkline} label="Deuda Neta" />
          </>
        )
      }
      case 'liquidez': {
        const activoCorr = ap * liquidezVal + totalCash
        const pasivoCorr = ap + totalCash * 0.1
        return (
          <>
            <DialogDescription>Capacidad de cubrir pasivos corrientes con activos corrientes</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label="Ratio actual" value={`${liquidezVal}x`} highlight />
              <DrilldownRow label="Objetivo mínimo" value="1,20x" />
              <DrilldownRow label="Margen sobre mínimo" value={`+${fmt((liquidezVal - 1.2) / 1.2 * 100, 0)}%`} />
              <DrilldownRow label="Tendencia" value="+0,05x vs mes anterior" />
            </div>
            <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20 text-xs text-success">
              Ratio muy por encima del mínimo (1,20x). Holgura suficiente para cubrir obligaciones a corto plazo.
            </div>
            <SparklineChart data={activeKpi.sparkline} label="x" />
          </>
        )
      }
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Cockpit CFO"
        subtitle="Grupo Ibérico SA · Marzo 2026"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportCSV('cockpit_kpis', ['KPI', 'Valor', 'Tendencia'], kpis.map(k => [k.label, k.value, k.trend]))}><Download size={14} className="mr-1" />Exportar</Button>
            <Button size="sm" onClick={() => router.push('/dashboard/boardpack')}><FileText size={14} className="mr-1" />Board Pack</Button>
          </>
        }
      />

      {/* Alert */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning">
        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-semibold text-sm">Gap de tesorería detectado — Semana 8</div>
          <div className="text-xs opacity-80 mt-0.5">Pagos superan cobros en −101.000 €. Semana del 17–23 de abril. <span className="underline cursor-pointer" onClick={() => router.push('/dashboard/forecast')}>Ver forecast →</span></div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} onClick={() => setDrilldown(k.key)} />)}
      </div>

      {/* Drill-down Modal */}
      <Dialog open={!!drilldown} onOpenChange={(open) => { if (!open) setDrilldown(null) }}>
        <DialogContent className="max-w-md">
          {activeKpi && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="text-primary">{activeKpi.icon}</span>
                  <DialogTitle>{activeKpi.label}: {activeKpi.value}</DialogTitle>
                </div>
              </DialogHeader>
              {renderDrilldown()}
              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => { setDrilldown(null); router.push(activeKpi.page) }}
                >
                  Ir a {activeKpi.label} <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cash Evolution Chart + Working Capital */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <CardTitle>Evolución de Caja</CardTitle>
                {cashEvolution.length > 0 && (
                  <Badge variant="secondary">{cashEvolution.length} días</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {cashEvolution.length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={cashEvolution} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                    <Tooltip
                      formatter={(v: any) => [fmtEur(Number(v)), 'Saldo']}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#cashGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-10 text-sm text-muted-foreground">Sin datos de movimientos para mostrar evolución</div>
              )}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Covenants</CardTitle><Badge variant="success">4/4 OK</Badge></CardHeader>
          <CardContent className="space-y-3">
            {['Net Debt/EBITDA','DSCR','Liquidez Mín.','Ratio Cobert.'].map((name, i) => {
              const margins = ['40%','21%','149%','40%']
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{name}</span><span className="text-success font-semibold">+{margins[i]}</span></div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-success rounded-full" style={{ width: `${[60,79,40,72][i]}%` }} /></div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Working Capital */}
      <Card>
        <CardHeader><CardTitle>Working Capital</CardTitle></CardHeader>
        <CardContent>
          {[
            { label: 'Clientes (AR)', value: fmtEur(data.workingCapital?.ar || 964850) },
            { label: 'Proveedores (AP)', value: `−${fmtEur(data.workingCapital?.ap || 146550)}` },
            { label: 'Inventario', value: fmtEur(110450) },
            { label: 'NOF Total', value: fmtEur((data.workingCapital?.ar || 964850) - (data.workingCapital?.ap || 146550) + 110450), highlight: true },
          ].map(r => (
            <div key={r.label} className="stat-row">
              <span className="stat-label">{r.label}</span>
              <span className={`stat-value ${r.highlight ? 'text-primary' : ''}`}>{r.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bot CFO Recommendations */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles size={16} className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">El Bot CFO recomienda</CardTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">Sugerencias basadas en tus datos actuales</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => router.push('/dashboard/bot')}>
              <Bot size={14} /> Abrir Bot
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {recsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-2">
              {recommendations.map((rec: any, i: number) => {
                const priorityStyles = {
                  critical: { border: 'border-destructive/30', bg: 'bg-destructive/5', dot: 'bg-destructive', badge: 'destructive' as const },
                  warning: { border: 'border-warning/30', bg: 'bg-warning/5', dot: 'bg-warning', badge: 'warning' as const },
                  info: { border: 'border-primary/30', bg: 'bg-primary/5', dot: 'bg-primary', badge: 'secondary' as const },
                }
                const style = priorityStyles[rec.priority as keyof typeof priorityStyles] || priorityStyles.info
                return (
                  <div key={i} className={`flex items-start gap-3 p-3.5 rounded-lg border ${style.border} ${style.bg}`}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{rec.title}</span>
                        {rec.metric && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{rec.metric}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{rec.action}</p>
                      {rec.impact && (
                        <span className="inline-block mt-1 text-[10px] font-mono font-semibold text-primary">{rec.impact}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-muted-foreground">Sin recomendaciones en este momento</div>
          )}
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>Tareas con impacto en caja</CardTitle>
            {data.tasks && <Badge variant="secondary">{data.tasks.length} activas</Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(data.tasks && data.tasks.length > 0) ? data.tasks.map((t: any) => {
            const icon = t.type === 'critical'
              ? <AlertCircle size={16} className="text-destructive" />
              : t.type === 'warning'
              ? <CircleDot size={16} className="text-warning" />
              : <CircleDot size={16} className="text-success" />
            return (
              <div key={t.task} className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(t.page)}>
                <span>{icon}</span>
                <span className="flex-1 text-sm text-foreground">{t.task}</span>
                <span className={`font-mono text-xs font-semibold ${t.positive ? 'text-success' : 'text-destructive'}`}>{t.impact}</span>
              </div>
            )
          }) : (
            <div className="px-5 py-4 text-sm text-muted-foreground text-center">Sin tareas pendientes</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
