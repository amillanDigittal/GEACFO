'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmtM, fmt, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/kpi-card'
import { useRouter } from 'next/navigation'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Landmark, Calendar, CalendarDays, RefreshCw, BarChart3, TrendingUp, CreditCard, Scale, Download, FileText, AlertTriangle, AlertCircle, CircleDot } from 'lucide-react'
import { SkeletonCockpit } from '@/components/ui/skeleton-page'

export default function CockpitPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    api.treasury.cockpit()
      .then(setData)
      .catch((err: any) => {
        console.error('Cockpit error:', err)
        setError(err?.message || String(err))
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonCockpit />
  if (!data) return <div className="text-center text-muted-foreground py-20">Error cargando datos{error && <p className="mt-2 text-xs text-destructive">{error}</p>}</div>

  const kpis = [
    { label: 'Caja Hoy', value: fmtEur(data.caja?.value || 1245000), icon: <Landmark size={20} />, sub: '4 cuentas bancarias', trend: '+3.2%', up: true, page: '/dashboard/conciliacion', sparkline: data.caja?.sparkline },
    { label: 'DSO', value: `${data.dso?.value || 42} días`, icon: <Calendar size={20} />, sub: 'vs objetivo 45d', trend: '−3d', up: true, page: '/dashboard/cobros', sparkline: data.dso?.sparkline },
    { label: 'DPO', value: `${data.dpo?.value || 67} días`, icon: <CalendarDays size={20} />, sub: 'Días pago medio', trend: '+2d', up: true, page: '/dashboard/pagos', sparkline: data.dpo?.sparkline },
    { label: 'Cash Conv. Cycle', value: `${data.ccc?.value || 28} días`, icon: <RefreshCw size={20} />, sub: 'DSO - DPO + DIO', trend: '−2d', up: true, page: '/dashboard/forecast', sparkline: data.ccc?.sparkline },
    { label: 'Revenue YTD', value: fmtM(data.revenue?.value || 4820000), icon: <BarChart3 size={20} />, sub: 'Enero – Marzo 2026', trend: '+12.3%', up: true, page: '/dashboard/variance', sparkline: data.revenue?.sparkline },
    { label: 'EBITDA', value: fmtM(data.ebitda?.value || 1150000), icon: <TrendingUp size={20} />, sub: 'Margen 23.9%', trend: '+0.8pp', up: true, page: '/dashboard/variance', sparkline: data.ebitda?.sparkline },
    { label: 'Deuda Neta', value: fmtM(data.deudaNeta?.value || 2180000), icon: <CreditCard size={20} />, sub: 'Deuda total − caja', trend: '−1.2%', up: true, page: '/dashboard/deuda', sparkline: data.deudaNeta?.sparkline },
    { label: 'Ratio Liquidez', value: `${data.liquidez?.value || 1.85}x`, icon: <Scale size={20} />, sub: 'Activo / Pasivo corr.', trend: '+0.05x', up: true, page: '/dashboard/deuda', sparkline: data.liquidez?.sparkline },
  ]

  const cashEvolution = (data.cashEvolution || []).map((d: any) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Cockpit CFO</h1>
          <p className="page-subtitle">Grupo Ibérico SA · Marzo 2026 · Actualizado hace 12 min</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV('cockpit_kpis', ['KPI', 'Valor', 'Tendencia'], kpis.map(k => [k.label, k.value, k.trend]))}><Download size={14} className="mr-1" />Exportar</Button>
          <Button size="sm" onClick={() => router.push('/dashboard/boardpack')}><FileText size={14} className="mr-1" />Board Pack</Button>
        </div>
      </div>

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
        {kpis.map((k) => <KpiCard key={k.label} {...k} onClick={() => router.push(k.page)} />)}
      </div>

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

      {/* Tasks */}
      <Card>
        <CardHeader><CardTitle>Tareas con impacto en caja</CardTitle></CardHeader>
        <CardContent className="p-0">
          {[
            { emoji: <AlertCircle size={16} className="text-destructive" />, task:'Cobrar Consultores Estratégicos (62d vencida)', impact:'+24.300 €', page:'/dashboard/scoring' },
            { emoji: <CircleDot size={16} className="text-warning" />, task:'Negociar extensión línea CaixaBank', impact:'+320.000 €', page:'/dashboard/deuda' },
            { emoji: <CircleDot size={16} className="text-warning" />, task:'Revisar gap Semana 8 — mitigación urgente', impact:'+101.000 €', page:'/dashboard/forecast' },
            { emoji: <CircleDot size={16} className="text-success" />, task:'Aprobar pago Aceros del Norte (PF-456)', impact:'−62.400 €', page:'/dashboard/pagos' },
          ].map(t => (
            <div key={t.task} className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(t.page)}>
              <span>{t.emoji}</span>
              <span className="flex-1 text-sm text-foreground">{t.task}</span>
              <span className={`font-mono text-xs font-semibold ${t.impact.startsWith('+') ? 'text-success' : 'text-destructive'}`}>{t.impact}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
