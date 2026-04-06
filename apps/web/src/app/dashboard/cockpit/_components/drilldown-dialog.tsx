'use client'

import { memo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { fmtEur, fmtM, fmt, fmtPct } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/hooks/use-chart-colors'

const DrilldownRow = memo(function DrilldownRow({ label, value, highlight, pct }: { label: string; value: string; highlight?: boolean; pct?: number }) {
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
})

const SparklineChart = memo(function SparklineChart({ data, label }: { data: number[]; label: string }) {
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
        <Tooltip formatter={(v: any) => [label.includes('d') || label.includes('x') ? v : fmtEur(Number(v)), label]} />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#drillGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  )
})

interface DrilldownDialogProps {
  drilldown: string | null
  kpis: any[]
  data: any
  onClose: () => void
  onNavigate: (path: string) => void
}

export function DrilldownDialog({ drilldown, kpis, data, onClose, onNavigate }: DrilldownDialogProps) {
  const t = useTranslations('cockpit')
  const cc = useChartColors()

  const activeKpi = kpis.find((k: any) => k.key === drilldown)

  const renderContent = useCallback(() => {
    if (!data || !drilldown || !activeKpi) return null

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
            <DialogDescription>{t('drillCashDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              {accounts.map((a: any) => (
                <DrilldownRow key={a.name} label={a.name} value={fmtEur(a.balance)} pct={totalCash > 0 ? (a.balance / totalCash) * 100 : 0} />
              ))}
              <DrilldownRow label={t('drillCashTotal')} value={fmtEur(totalCash)} highlight />
            </div>
            <SparklineChart data={activeKpi.sparkline} label={t('drillCashSparkLabel')} />
          </>
        )
      }
      case 'dso': {
        const months = [t('monthJan'), t('monthFeb'), t('monthMar')]
        const dsoTrend = data.dso?.sparkline?.slice(-3) || [45, 43, dsoVal]
        return (
          <>
            <DialogDescription>{t('drillDsoDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label={t('drillDsoCurrent')} value={`${dsoVal} ${t('days')}`} highlight />
              <DrilldownRow label={t('drillDsoTarget')} value={`45 ${t('days')}`} />
              <DrilldownRow label={t('drillDsoDiffTarget')} value={`${dsoVal - 45 > 0 ? '+' : ''}${dsoVal - 45}d`} />
              <DrilldownRow label={t('drillDsoAR')} value={fmtEur(ar)} />
            </div>
            <div className="mt-3 text-xs text-muted-foreground font-medium mb-1">{t('drillMonthlyEvolution')}</div>
            <div className="grid grid-cols-3 gap-2">
              {months.map((m, i) => (
                <div key={m} className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-muted-foreground">{m}</div>
                  <div className="font-mono text-sm font-bold">{dsoTrend[i]}d</div>
                </div>
              ))}
            </div>
            <SparklineChart data={activeKpi.sparkline} label={t('days')} />
          </>
        )
      }
      case 'dpo': {
        const months = [t('monthJan'), t('monthFeb'), t('monthMar')]
        const dpoTrend = data.dpo?.sparkline?.slice(-3) || [64, 66, dpoVal]
        return (
          <>
            <DialogDescription>{t('drillDpoDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label={t('drillDpoCurrent')} value={`${dpoVal} ${t('days')}`} highlight />
              <DrilldownRow label={t('drillDpoAP')} value={fmtEur(ap)} />
              <DrilldownRow label={t('drillDpoTrend')} value={t('drillDpoTrendValue')} />
            </div>
            <div className="mt-3 text-xs text-muted-foreground font-medium mb-1">{t('drillMonthlyEvolution')}</div>
            <div className="grid grid-cols-3 gap-2">
              {months.map((m, i) => (
                <div key={m} className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-muted-foreground">{m}</div>
                  <div className="font-mono text-sm font-bold">{dpoTrend[i]}d</div>
                </div>
              ))}
            </div>
            <SparklineChart data={activeKpi.sparkline} label={t('days')} />
          </>
        )
      }
      case 'ccc': {
        const dio = cccVal - dsoVal + dpoVal
        return (
          <>
            <DialogDescription>{t('drillCccDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label={t('drillCccDso')} value={`${dsoVal} ${t('days')}`} />
              <DrilldownRow label={t('drillCccDio')} value={`${dio} ${t('days')}`} />
              <DrilldownRow label={t('drillCccDpo')} value={`-${dpoVal} ${t('days')}`} />
              <div className="border-t border-border mt-1 pt-1">
                <DrilldownRow label="CCC = DSO + DIO - DPO" value={`${cccVal} ${t('days')}`} highlight />
              </div>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20 text-xs text-success">
              {t('drillCccInsight')}
            </div>
            <SparklineChart data={activeKpi.sparkline} label={t('days')} />
          </>
        )
      }
      case 'revenue': {
        const monthly = [
          { month: t('monthJanShort'), value: 1540000 },
          { month: t('monthFebShort'), value: 1620000 },
          { month: t('monthMarShort'), value: 1660000 },
        ]
        return (
          <>
            <DialogDescription>{t('drillRevenueDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              {monthly.map(m => (
                <DrilldownRow key={m.month} label={m.month} value={fmtEur(m.value)} pct={(m.value / revenueVal) * 100} />
              ))}
              <DrilldownRow label={t('drillRevenueTotalYtd')} value={fmtEur(revenueVal)} highlight />
              <DrilldownRow label={t('drillRevenueGrowth')} value="+12,3%" />
            </div>
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={monthly} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <YAxis hide />
                  <Tooltip formatter={(v: any) => [fmtEur(Number(v)), 'Revenue']} />
                  <Bar dataKey="value" fill={cc.primary} radius={[4, 4, 0, 0]} />
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
            <DialogDescription>{t('drillEbitdaDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label="Revenue YTD" value={fmtEur(revenueVal)} />
              <DrilldownRow label="EBITDA" value={fmtEur(ebitdaVal)} highlight />
              <DrilldownRow label={t('drillEbitdaMargin')} value={fmtPct(margin)} pct={margin} />
              <DrilldownRow label={t('drillEbitdaMarginChange')} value={t('drillEbitdaMarginChangeValue')} />
            </div>
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <div className="flex justify-between mb-1"><span>{t('drillEbitdaOpex')}</span><span className="font-mono font-semibold">{fmtEur(revenueVal - ebitdaVal)}</span></div>
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
            <DialogDescription>{t('drillNetDebtDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label={t('drillNetDebtGross')} value={fmtEur(deudaBruta)} />
              <DrilldownRow label={t('drillNetDebtCash')} value={`-${fmtEur(totalCash)}`} />
              <DrilldownRow label={t('kpiNetDebt')} value={fmtEur(deudaVal)} highlight />
              <DrilldownRow label={t('drillNetDebtEbitdaRatio')} value={`${fmt(deudaVal / ebitdaVal, 1)}x`} />
              <DrilldownRow label={t('drillNetDebtTrend')} value={t('drillNetDebtTrendValue')} />
            </div>
            <SparklineChart data={activeKpi.sparkline} label={t('kpiNetDebt')} />
          </>
        )
      }
      case 'liquidez': {
        const liquidezValNum = liquidezVal
        return (
          <>
            <DialogDescription>{t('drillLiquidityDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label={t('drillLiquidityCurrent')} value={`${liquidezValNum}x`} highlight />
              <DrilldownRow label={t('drillLiquidityMinTarget')} value="1,20x" />
              <DrilldownRow label={t('drillLiquidityMargin')} value={`+${fmt((liquidezValNum - 1.2) / 1.2 * 100, 0)}%`} />
              <DrilldownRow label={t('drillLiquidityTrend')} value={t('drillLiquidityTrendValue')} />
            </div>
            <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20 text-xs text-success">
              {t('drillLiquidityInsight')}
            </div>
            <SparklineChart data={activeKpi.sparkline} label="x" />
          </>
        )
      }
      default:
        return null
    }
  }, [drilldown, activeKpi, data, cc, t])

  return (
    <Dialog open={!!drilldown} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        {activeKpi && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="text-primary">{activeKpi.icon}</span>
                <DialogTitle>{activeKpi.label}: {activeKpi.value}</DialogTitle>
              </div>
            </DialogHeader>
            {renderContent()}
            <div className="pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onNavigate(activeKpi.page)}
              >
                {t('goTo', { label: activeKpi.label })} <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
