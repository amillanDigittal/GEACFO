'use client'
import { useEffect, useState, useMemo, useCallback, memo } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { fmtEur, fmtM } from '@/lib/utils'
import {
  Landmark, TrendingUp, CreditCard, AlertTriangle, ChevronRight,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, RefreshCw,
  Calendar,
} from 'lucide-react'
import { ErrorState } from '@/components/ui/error-state'

function fmtDate() {
  return new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

const TASK_TYPE_STYLES = {
  critical: { bg: 'bg-destructive/10', border: 'border-destructive/30', dot: 'bg-destructive' },
  warning: { bg: 'bg-warning/10', border: 'border-warning/30', dot: 'bg-warning' },
  info: { bg: 'bg-primary/10', border: 'border-primary/30', dot: 'bg-primary' },
}

/* ─── Memoized sub-components ─── */

interface KpiItem {
  label: string
  value: string
  icon: React.ReactNode
  trend: string
  up: boolean
  color: string
  iconColor: string
  href: string
}

const KpiSection = memo(function KpiSection({ kpis, onNavigate }: { kpis: KpiItem[]; onNavigate: (path: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {kpis.map(k => (
        <button
          key={k.label}
          onClick={() => onNavigate(k.href)}
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
  )
})

const AlertsSection = memo(function AlertsSection({ urgentAlerts, title }: { urgentAlerts: any[]; title: string }) {
  if (urgentAlerts.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        <AlertTriangle size={12} />
        {title}
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
  )
})

const TasksSection = memo(function TasksSection({ tasks, title, onNavigate }: { tasks: any[]; title: string; onNavigate: (path: string) => void }) {
  if (tasks.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        <Clock size={12} />
        {title}
      </div>
      <div className="space-y-2">
        {tasks.map((t: any, i: number) => {
          const styles = TASK_TYPE_STYLES[t.type as keyof typeof TASK_TYPE_STYLES] || TASK_TYPE_STYLES.info
          return (
            <button
              key={i}
              onClick={() => onNavigate(t.page)}
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
  )
})

/* ─── Main component ─── */

export default function ResumenPage() {
  const t = useTranslations('resumen')
  const { data: session } = useSession()
  const [data, setData] = useState<any>(null)
  const [alerts, setAlerts] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  const timeGreeting = useCallback(() => {
    const h = new Date().getHours()
    if (h < 7) return t('greetingNight')
    if (h < 13) return t('greetingMorning')
    if (h < 20) return t('greetingAfternoon')
    return t('greetingNight')
  }, [t])

  const loadAll = useCallback(async () => {
    try {
      const [cockpit, alertData] = await Promise.all([
        api.treasury.cockpit(),
        api.alerts.notifications().catch(() => []),
      ])
      setData(cockpit)
      setAlerts(alertData)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }, [loadAll])

  const handleNavigate = useCallback((path: string) => {
    router.push(path)
  }, [router])

  // Memoize derived data (hooks must be before early returns)
  const caja = useMemo(() => data?.caja?.value || 0, [data])
  const ebitda = useMemo(() => data?.ebitda?.value || 0, [data])
  const ebitdaMargin = useMemo(() => data?.ebitda?.margin || 0, [data])
  const deuda = useMemo(() => data?.deudaNeta?.value || 0, [data])
  const dso = useMemo(() => data?.dso?.value || 0, [data])
  const tasks = useMemo(() => data?.tasks || [], [data])

  const urgentAlerts = useMemo(
    () => Array.isArray(alerts) ? alerts.filter((a: any) => a.severity === 'critical' || a.severity === 'high').slice(0, 3) : [],
    [alerts]
  )

  const cashTrend = useMemo(() => {
    const sp = data?.caja?.sparkline
    if (sp && sp.length >= 2) {
      const prev = sp[sp.length - 2]
      const curr = sp[sp.length - 1]
      if (prev !== 0) {
        const pct = ((curr - prev) / Math.abs(prev)) * 100
        return { text: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, up: pct > 0 }
      }
    }
    return { text: '', up: true }
  }, [data])

  const deudaTrend = useMemo(() => {
    const tv = data?.deudaNeta?.trend
    if (typeof tv === 'number') return { text: `${tv > 0 ? '+' : ''}${tv.toFixed(1)}%`, up: tv < 0 }
    return { text: '', up: true }
  }, [data])

  const kpis = useMemo<KpiItem[]>(() => [
    {
      label: t('kpiCash'),
      value: fmtM(caja),
      icon: <Landmark size={18} />,
      trend: cashTrend.text,
      up: cashTrend.up,
      color: 'from-blue-500/20 to-blue-600/5',
      iconColor: 'text-blue-400',
      href: '/dashboard/conciliacion',
    },
    {
      label: t('kpiEbitda'),
      value: fmtM(ebitda),
      icon: <TrendingUp size={18} />,
      trend: `${ebitdaMargin}%`,
      up: true,
      color: 'from-emerald-500/20 to-emerald-600/5',
      iconColor: 'text-emerald-400',
      href: '/dashboard/variance',
    },
    {
      label: t('kpiNetDebt'),
      value: fmtM(deuda),
      icon: <CreditCard size={18} />,
      trend: deudaTrend.text,
      up: deudaTrend.up,
      color: 'from-orange-500/20 to-orange-600/5',
      iconColor: 'text-orange-400',
      href: '/dashboard/deuda',
    },
    {
      label: t('kpiDso'),
      value: `${dso}d`,
      icon: <Calendar size={18} />,
      trend: t('dsoTarget'),
      up: dso <= 45,
      color: 'from-violet-500/20 to-violet-600/5',
      iconColor: 'text-violet-400',
      href: '/dashboard/cobros',
    },
  ], [t, caja, ebitda, ebitdaMargin, deuda, dso, cashTrend, deudaTrend])

  const accountsWithPct = useMemo(() => {
    const accounts = data?.caja?.accounts || []
    return accounts.map((acc: any) => ({
      ...acc,
      pct: caja > 0 ? (acc.balance / caja) * 100 : 0,
    }))
  }, [data, caja])

  const workingCapitalItems = useMemo(() => [
    { label: t('receivables'), value: fmtM(data?.workingCapital?.ar || 0), color: 'text-success' },
    { label: t('payables'), value: fmtM(data?.workingCapital?.ap || 0), color: 'text-destructive' },
    { label: t('forecast'), value: fmtM(data?.workingCapital?.forecast || 0), color: 'text-primary' },
  ], [t, data])

  const quickNavItems = useMemo(() => [
    { label: t('navCockpit'), href: '/dashboard/cockpit', icon: '📊' },
    { label: t('navForecast'), href: '/dashboard/forecast', icon: '📈' },
    { label: t('navScoring'), href: '/dashboard/scoring', icon: '🎯' },
    { label: t('navBotCfo'), href: '/dashboard/bot', icon: '🤖' },
  ], [t])

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

  if (!data) return <ErrorState title={t('errorLoading')} onRetry={loadAll} />

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">{t('greeting', { greeting: timeGreeting(), name: session?.user?.name?.split(' ')[0] || '—' })}</h1>
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
      <KpiSection kpis={kpis} onNavigate={handleNavigate} />

      {/* Urgent alerts */}
      <AlertsSection urgentAlerts={urgentAlerts} title={t('urgentAlerts')} />

      {/* Tasks / Actions */}
      <TasksSection tasks={tasks} title={t('pendingActions')} onNavigate={handleNavigate} />

      {/* Quick cash summary */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          <Landmark size={12} />
          {t('cashPosition')}
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          {accountsWithPct.map((acc: any) => (
            <div key={acc.name} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground truncate">{acc.name}</span>
                  <span className="font-mono text-xs font-semibold">{fmtEur(acc.balance)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${acc.pct}%` }} />
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs font-semibold text-muted-foreground">{t('total')}</span>
            <span className="font-mono text-sm font-bold text-primary">{fmtEur(caja)}</span>
          </div>
        </div>
      </div>

      {/* Working capital */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          <TrendingUp size={12} />
          {t('workingCapital')}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {workingCapitalItems.map(item => (
            <div key={item.label} className="rounded-xl border border-border bg-card p-3 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</div>
              <div className={`font-mono text-sm font-bold mt-1 ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick nav */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{t('quickAccess')}</div>
        <div className="grid grid-cols-2 gap-2">
          {quickNavItems.map(item => (
            <button
              key={item.label}
              onClick={() => handleNavigate(item.href)}
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
