'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { fmtEur, fmtM } from '@/lib/utils'
import {
  Landmark, TrendingUp, CreditCard, AlertTriangle, ChevronRight,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, RefreshCw,
  Calendar,
} from 'lucide-react'

function timeGreeting() {
  const h = new Date().getHours()
  if (h < 7) return 'Buenas noches'
  if (h < 13) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function fmtDate() {
  return new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

const TASK_TYPE_STYLES = {
  critical: { bg: 'bg-destructive/10', border: 'border-destructive/30', dot: 'bg-destructive' },
  warning: { bg: 'bg-warning/10', border: 'border-warning/30', dot: 'bg-warning' },
  info: { bg: 'bg-primary/10', border: 'border-primary/30', dot: 'bg-primary' },
}

export default function ResumenPage() {
  const [data, setData] = useState<any>(null)
  const [alerts, setAlerts] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  async function loadAll() {
    try {
      const [cockpit, alertData] = await Promise.all([
        api.treasury.cockpit(),
        api.alerts.notifications().catch(() => []),
      ])
      setData(cockpit)
      setAlerts(alertData)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadAll() }, [])

  async function refresh() {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto space-y-4 animate-pulse">
        <div className="h-16 bg-muted rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}
        </div>
        <div className="h-48 bg-muted rounded-xl" />
        <div className="h-32 bg-muted rounded-xl" />
      </div>
    )
  }

  if (!data) return <div className="text-center text-muted-foreground py-20">Error cargando datos</div>

  const caja = data.caja?.value || 0
  const ebitda = data.ebitda?.value || 0
  const ebitdaMargin = data.ebitda?.margin || 0
  const deuda = data.deudaNeta?.value || 0
  const dso = data.dso?.value || 0
  const tasks = data.tasks || []
  const urgentAlerts = Array.isArray(alerts) ? alerts.filter((a: any) => a.severity === 'critical' || a.severity === 'high').slice(0, 3) : []

  const kpis = [
    {
      label: 'Caja',
      value: fmtM(caja),
      icon: <Landmark size={18} />,
      trend: '+3.2%',
      up: true,
      color: 'from-blue-500/20 to-blue-600/5',
      iconColor: 'text-blue-400',
      href: '/dashboard/conciliacion',
    },
    {
      label: 'EBITDA',
      value: fmtM(ebitda),
      icon: <TrendingUp size={18} />,
      trend: `${ebitdaMargin}%`,
      up: true,
      color: 'from-emerald-500/20 to-emerald-600/5',
      iconColor: 'text-emerald-400',
      href: '/dashboard/variance',
    },
    {
      label: 'Deuda Neta',
      value: fmtM(deuda),
      icon: <CreditCard size={18} />,
      trend: '−1.2%',
      up: true,
      color: 'from-orange-500/20 to-orange-600/5',
      iconColor: 'text-orange-400',
      href: '/dashboard/deuda',
    },
    {
      label: 'DSO',
      value: `${dso}d`,
      icon: <Calendar size={18} />,
      trend: 'obj. 45d',
      up: dso <= 45,
      color: 'from-violet-500/20 to-violet-600/5',
      iconColor: 'text-violet-400',
      href: '/dashboard/cobros',
    },
  ]

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">{timeGreeting()}, Ana</h1>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">{fmtDate()}</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
        >
          <RefreshCw size={16} className={`text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 4 KPIs grid */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(k => (
          <button
            key={k.label}
            onClick={() => router.push(k.href)}
            className={`relative overflow-hidden rounded-xl border border-border p-4 text-left bg-gradient-to-br ${k.color} hover:scale-[1.02] active:scale-[0.98] transition-transform`}
          >
            <div className={`mb-2 ${k.iconColor}`}>{k.icon}</div>
            <div className="font-mono text-xl font-bold text-foreground leading-none">{k.value}</div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</span>
              <span className={`flex items-center gap-0.5 text-[10px] font-mono font-semibold ${k.up ? 'text-success' : 'text-destructive'}`}>
                {k.up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {k.trend}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Urgent alerts */}
      {urgentAlerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            <AlertTriangle size={12} />
            Alertas Urgentes
          </div>
          {urgentAlerts.map((a: any, i: number) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertTriangle size={14} className="text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground leading-tight">{a.title || a.message}</div>
                {a.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{a.description}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tasks / Actions */}
      {tasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            <Clock size={12} />
            Acciones Pendientes
          </div>
          <div className="space-y-2">
            {tasks.map((t: any, i: number) => {
              const styles = TASK_TYPE_STYLES[t.type as keyof typeof TASK_TYPE_STYLES] || TASK_TYPE_STYLES.info
              return (
                <button
                  key={i}
                  onClick={() => router.push(t.page)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl ${styles.bg} border ${styles.border} text-left hover:scale-[1.01] active:scale-[0.99] transition-transform`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground leading-tight">{t.task}</div>
                    <div className={`text-xs font-mono mt-0.5 ${t.positive ? 'text-success' : 'text-destructive'}`}>{t.impact}</div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick cash summary */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          <Landmark size={12} />
          Posición de Caja
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          {(data.caja?.accounts || []).map((acc: any) => {
            const pct = caja > 0 ? (acc.balance / caja) * 100 : 0
            return (
              <div key={acc.name} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground truncate">{acc.name}</span>
                    <span className="font-mono text-xs font-semibold">{fmtEur(acc.balance)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs font-semibold text-muted-foreground">Total</span>
            <span className="font-mono text-sm font-bold text-primary">{fmtEur(caja)}</span>
          </div>
        </div>
      </div>

      {/* Working capital */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          <TrendingUp size={12} />
          Capital Circulante
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Por Cobrar', value: fmtM(data.workingCapital?.ar || 0), color: 'text-success' },
            { label: 'Por Pagar', value: fmtM(data.workingCapital?.ap || 0), color: 'text-destructive' },
            { label: 'Forecast', value: fmtM(data.workingCapital?.forecast || 0), color: 'text-primary' },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-border bg-card p-3 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</div>
              <div className={`font-mono text-sm font-bold mt-1 ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick nav */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Accesos Rápidos</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Cockpit CFO', href: '/dashboard/cockpit', icon: '📊' },
            { label: 'Forecast', href: '/dashboard/forecast', icon: '📈' },
            { label: 'Scoring', href: '/dashboard/scoring', icon: '🎯' },
            { label: 'Bot CFO', href: '/dashboard/bot', icon: '🤖' },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-medium text-foreground">{item.label}</span>
              <ChevronRight size={14} className="text-muted-foreground ml-auto" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
