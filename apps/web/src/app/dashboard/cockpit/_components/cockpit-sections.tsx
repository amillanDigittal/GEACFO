'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { fmtEur } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, CircleDot, Bot, Sparkles } from 'lucide-react'
import { LazyChart } from '@/components/ui/lazy-chart'
import { LazySection } from '@/components/ui/lazy-section'
import { ChartExportButton } from '@/components/ui/chart-export'
import { ChartEmpty } from '@/components/ui/chart-empty'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface CashCovenantsSectionProps {
  data: any
  cashEvolution: any[]
  cashChartRef: React.RefObject<HTMLDivElement>
  cc: { primary: string; border: string; mutedForeground: string }
}

export function CashCovenantsSection({ data, cashEvolution, cashChartRef, cc }: CashCovenantsSectionProps) {
  const t = useTranslations('cockpit')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <Card data-accent="primary" className="group">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle>{t('cashEvolutionTitle')}</CardTitle>
              <div className="flex items-center gap-2">
                <ChartExportButton chartRef={cashChartRef} filename="evolucion_caja" />
                {cashEvolution.length > 0 && (
                  <Badge variant="secondary">{t('cashEvolutionDays', { count: cashEvolution.length })}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cashEvolution.length > 1 ? (
              <div ref={cashChartRef}>
              <LazyChart height={220}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={cashEvolution} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={cc.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={cc.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: cc.mutedForeground }} />
                    <YAxis tick={{ fontSize: 10, fill: cc.mutedForeground }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: any) => [fmtEur(Number(v)), t('tooltipBalance')]} />
                    <Area type="monotone" dataKey="balance" stroke={cc.primary} strokeWidth={2} fill="url(#cashGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </LazyChart>
              </div>
            ) : (
              <ChartEmpty message={t('cashEvolutionNoData')} height={220} />
            )}
          </CardContent>
        </Card>
      </div>
      <Card data-glow="success" data-accent="success">
        <CardHeader><CardTitle>{t('covenantsTitle')}</CardTitle><Badge variant="success">{t('covenantsOk')}</Badge></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {['Net Debt/EBITDA','DSCR',t('covenantMinLiquidity'),t('covenantCoverageRatio')].map((name, i) => {
              const margins = ['40%','21%','149%','40%']
              const values = [2.1, 1.45, 3.73, 2.1]
              const limits = [3.5, 1.2, 1.5, 1.5]
              const pcts = [60, 79, 40, 72]
              const pct = pcts[i]
              const R = 36, CX = 44, CY = 44, SW = 6
              const halfCirc = Math.PI * R
              const filled = halfCirc * (pct / 100)
              const gap = halfCirc - filled
              return (
                <div key={name} className="flex flex-col items-center text-center">
                  <svg width={88} height={52} viewBox="0 0 88 52" className="overflow-visible">
                    <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="hsl(var(--muted))" strokeWidth={SW} strokeLinecap="round" />
                    <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke={pct >= 80 ? 'hsl(var(--destructive))' : pct >= 60 ? 'hsl(var(--warning))' : 'hsl(var(--success))'} strokeWidth={SW} strokeLinecap="round" strokeDasharray={`${filled} ${gap}`} className="covenant-ring" style={{ '--ring-fill': `${filled}` } as React.CSSProperties} />
                    <text x={CX} y={CY - 6} textAnchor="middle" className="fill-foreground text-[13px] font-mono font-bold">{values[i]}</text>
                    <text x={CX} y={CY + 6} textAnchor="middle" className="fill-muted-foreground text-[8px]">lím {limits[i]}</text>
                  </svg>
                  <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">{name}</span>
                  <span className="text-[10px] font-semibold text-success">+{margins[i]}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface WorkingCapitalSectionProps {
  data: any
}

export function WorkingCapitalSection({ data }: WorkingCapitalSectionProps) {
  const t = useTranslations('cockpit')
  const arVal = data.workingCapital?.ar || 964850
  const apVal = data.workingCapital?.ap || 146550
  const invVal = 110450
  const nofVal = arVal - apVal + invVal
  const maxVal = Math.max(arVal, apVal, invVal, nofVal)
  const rows = [
    { label: t('wcClients'), value: fmtEur(arVal), raw: arVal },
    { label: t('wcSuppliers'), value: `-${fmtEur(apVal)}`, raw: apVal },
    { label: t('wcInventory'), value: fmtEur(invVal), raw: invVal },
    { label: t('wcNofTotal'), value: fmtEur(nofVal), raw: nofVal, highlight: true },
  ]

  return (
    <LazySection>
    <Card>
      <CardHeader><CardTitle>{t('workingCapitalTitle')}</CardTitle></CardHeader>
      <CardContent>
        {rows.map(r => (
          <div key={r.label} className="stat-row relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.07] rounded" style={{ width: `${(r.raw / maxVal) * 100}%`, background: r.highlight ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }} />
            <span className="stat-label relative z-[1]">{r.label}</span>
            <span className={`stat-value relative z-[1] ${r.highlight ? 'text-primary' : ''}`}>{r.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
    </LazySection>
  )
}

interface BotRecommendationsSectionProps {
  recommendations: any[]
  recsLoading: boolean
}

export function BotRecommendationsSection({ recommendations, recsLoading }: BotRecommendationsSectionProps) {
  const t = useTranslations('cockpit')
  const router = useRouter()

  return (
    <LazySection>
    <Card data-glow="primary" className="bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles size={16} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">{t('botRecommendsTitle')}</CardTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t('botRecommendsSub')}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => router.push('/dashboard/bot')}>
            <Bot size={14} /> {t('botOpen')}
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
          <div className="text-center py-4 text-xs text-muted-foreground">{t('botNoRecommendations')}</div>
        )}
      </CardContent>
    </Card>
    </LazySection>
  )
}

interface TasksSectionProps {
  data: any
}

export function TasksSection({ data }: TasksSectionProps) {
  const t = useTranslations('cockpit')
  const router = useRouter()

  return (
    <LazySection>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <CardTitle>{t('tasksTitle')}</CardTitle>
          {data.tasks && <Badge variant="secondary">{t('tasksActive', { count: data.tasks.length })}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {(data.tasks && data.tasks.length > 0) ? data.tasks.map((t_: any) => {
          const icon = t_.type === 'critical'
            ? <AlertCircle size={16} className="text-destructive" />
            : t_.type === 'warning'
            ? <CircleDot size={16} className="text-warning" />
            : <CircleDot size={16} className="text-success" />
          return (
            <div key={t_.task} className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(t_.page)}>
              <span>{icon}</span>
              <span className="flex-1 text-sm text-foreground">{t_.task}</span>
              <span className={`font-mono text-xs font-semibold ${t_.positive ? 'text-success' : 'text-destructive'}`}>{t_.impact}</span>
            </div>
          )
        }) : (
          <div className="px-5 py-4 text-sm text-muted-foreground text-center">{t('tasksNone')}</div>
        )}
      </CardContent>
    </Card>
    </LazySection>
  )
}
