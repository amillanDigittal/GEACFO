'use client'
import { useState, useMemo } from 'react'
import { useHydrated } from '@/hooks/use-hydrated'
import { useTranslations } from 'next-intl'
import { fmtEur, fmt } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PillTabs } from '@/components/ui/pill-tabs'
import { KpiBox } from '@/components/kpi-box'
import { PageHeader } from '@/components/page-header'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { LazyChart } from '@/components/ui/lazy-chart'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts'
import { useChartColors } from '@/hooks/use-chart-colors'

// Mock FX data
const CURRENCIES = [
  { code: 'USD', name: 'Dólar estadounidense', flag: '🇺🇸', exposure: 2850000, hedged: 1200000, rate: 1.0842, prevRate: 1.0765, volatility: 8.2 },
  { code: 'GBP', name: 'Libra esterlina', flag: '🇬🇧', exposure: 1420000, hedged: 800000, rate: 0.8573, prevRate: 0.8612, volatility: 6.5 },
  { code: 'CHF', name: 'Franco suizo', flag: '🇨🇭', exposure: 680000, hedged: 400000, rate: 0.9387, prevRate: 0.9421, volatility: 4.1 },
  { code: 'JPY', name: 'Yen japonés', flag: '🇯🇵', exposure: 340000, hedged: 0, rate: 163.42, prevRate: 161.85, volatility: 11.3 },
  { code: 'PLN', name: 'Zloty polaco', flag: '🇵🇱', exposure: 195000, hedged: 0, rate: 4.3215, prevRate: 4.2980, volatility: 9.8 },
]

// Mock 12-month rate evolution
function generateRateHistory(baseRate: number, volatility: number) {
  const months = ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar']
  let rate = baseRate * (1 - volatility / 200)
  return months.map(m => {
    rate += (Math.random() - 0.48) * baseRate * volatility / 500
    return { month: m, rate: Math.round(rate * 10000) / 10000 }
  })
}

export default function FxPage() {
  const t = useTranslations('fx')
  const cc = useChartColors()
  const hydrated = useHydrated()
  const [tab, setTab] = useState<'exposure' | 'rates' | 'impact'>('exposure')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD')

  const totalExposure = CURRENCIES.reduce((s, c) => s + c.exposure, 0)
  const totalHedged = CURRENCIES.reduce((s, c) => s + c.hedged, 0)
  const hedgeRatio = totalExposure > 0 ? (totalHedged / totalExposure) * 100 : 0
  const avgVolatility = CURRENCIES.reduce((s, c) => s + c.volatility, 0) / CURRENCIES.length

  // P&L impact from rate changes
  const fxImpact = CURRENCIES.map(c => {
    const rateChange = c.code === 'JPY' ? (c.rate - c.prevRate) / c.prevRate : (c.rate - c.prevRate) / c.prevRate
    const unhedged = c.exposure - c.hedged
    const impact = unhedged * rateChange
    return { ...c, rateChange: rateChange * 100, unhedged, impact }
  })
  const totalImpact = fxImpact.reduce((s, c) => s + c.impact, 0)

  const rateHistory = useMemo(() => generateRateHistory(
    CURRENCIES.find(c => c.code === selectedCurrency)?.rate || 1,
    CURRENCIES.find(c => c.code === selectedCurrency)?.volatility || 5
  ), [selectedCurrency])

  const pieData = CURRENCIES.map(c => ({
    name: c.code,
    value: c.exposure,
    fill: c.code === 'USD' ? cc.primary : c.code === 'GBP' ? cc.success : c.code === 'CHF' ? cc.warning : c.code === 'JPY' ? cc.destructive : cc.chartPurple || cc.mutedForeground,
  }))

  if (!hydrated) return <SkeletonKPIsAndTable cols={5} rows={4} />

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiBox index={0} label={t('kpiTotalExposure')} value={fmtEur(totalExposure)} />
        <KpiBox index={1} label={t('kpiHedgeRatio')} value={`${hedgeRatio.toFixed(1)}%`} color={hedgeRatio >= 60 ? 'text-success' : hedgeRatio >= 40 ? 'text-warning' : 'text-destructive'} />
        <KpiBox index={2} label={t('kpiFxImpact')} value={fmtEur(Math.round(totalImpact))} color={totalImpact >= 0 ? 'text-success' : 'text-destructive'} />
        <KpiBox index={3} label={t('kpiAvgVolatility')} value={`${avgVolatility.toFixed(1)}%`} color={avgVolatility < 7 ? 'text-success' : avgVolatility < 10 ? 'text-warning' : 'text-destructive'} />
      </div>

      <PillTabs
        tabs={[
          { key: 'exposure', label: t('tabExposure') },
          { key: 'rates', label: t('tabRates') },
          { key: 'impact', label: t('tabImpact') },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'exposure' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Exposure pie */}
            <Card>
              <CardHeader><CardTitle>{t('exposureDistribution')}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [fmtEur(Number(v)), '']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Currency table */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>{t('exposureByurrency')}</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2.5 text-muted-foreground text-[10px] uppercase font-semibold">{t('thCurrency')}</th>
                      <th className="text-right p-2.5 text-muted-foreground text-[10px] uppercase font-semibold">{t('thExposure')}</th>
                      <th className="text-right p-2.5 text-muted-foreground text-[10px] uppercase font-semibold">{t('thHedged')}</th>
                      <th className="text-right p-2.5 text-muted-foreground text-[10px] uppercase font-semibold">{t('thUnhedged')}</th>
                      <th className="text-right p-2.5 text-muted-foreground text-[10px] uppercase font-semibold">{t('thRate')}</th>
                      <th className="text-center p-2.5 text-muted-foreground text-[10px] uppercase font-semibold">{t('thVolatility')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CURRENCIES.map(c => {
                      const hedgePct = c.exposure > 0 ? (c.hedged / c.exposure) * 100 : 0
                      return (
                        <tr key={c.code} className="border-b border-border hover:bg-muted/50">
                          <td className="p-2.5"><span className="mr-2">{c.flag}</span><span className="font-semibold">{c.code}</span> <span className="text-xs text-muted-foreground">{c.name}</span></td>
                          <td className="p-2.5 font-mono text-right">{fmtEur(c.exposure)}</td>
                          <td className="p-2.5 font-mono text-right text-success">{fmtEur(c.hedged)}</td>
                          <td className="p-2.5 font-mono text-right text-warning">{fmtEur(c.exposure - c.hedged)}</td>
                          <td className="p-2.5 font-mono text-right">{c.rate}</td>
                          <td className="p-2.5 text-center"><Badge variant={c.volatility < 7 ? 'success' : c.volatility < 10 ? 'warning' : 'destructive'}>{c.volatility}%</Badge></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Hedge coverage bar */}
          <Card>
            <CardHeader><CardTitle>{t('hedgeCoverage')}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {CURRENCIES.map(c => {
                  const pct = c.exposure > 0 ? (c.hedged / c.exposure) * 100 : 0
                  return (
                    <div key={c.code} className="flex items-center gap-3">
                      <span className="text-sm font-semibold w-12">{c.flag} {c.code}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct >= 60 ? cc.success : pct >= 30 ? cc.warning : cc.destructive }} />
                      </div>
                      <span className="font-mono text-xs w-12 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'rates' && (
        <>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">{t('selectCurrency')}:</span>
            {CURRENCIES.map(c => (
              <button key={c.code} onClick={() => setSelectedCurrency(c.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedCurrency === c.code ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {c.flag} {c.code}
              </button>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle>EUR/{selectedCurrency} — {t('rateEvolution')}</CardTitle></CardHeader>
            <CardContent>
              <LazyChart height={300}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={rateHistory} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={cc.primary} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={cc.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: cc.mutedForeground }} />
                    <YAxis tick={{ fontSize: 10, fill: cc.mutedForeground }} domain={['auto', 'auto']} />
                    <Tooltip formatter={(v: any) => [Number(v).toFixed(4), `EUR/${selectedCurrency}`]} />
                    <Area type="monotone" dataKey="rate" stroke={cc.primary} strokeWidth={2} fill="url(#rateGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </LazyChart>
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'impact' && (
        <>
          <Card>
            <CardHeader><CardTitle>{t('fxPnlImpact')}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={fxImpact} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
                  <XAxis dataKey="code" tick={{ fontSize: 11, fill: cc.mutedForeground }} />
                  <YAxis tick={{ fontSize: 10, fill: cc.mutedForeground }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: any) => [fmtEur(Number(v)), '']} />
                  <Bar dataKey="impact" radius={[4, 4, 0, 0]}>
                    {fxImpact.map((entry, idx) => (
                      <Cell key={idx} fill={entry.impact >= 0 ? cc.success : cc.destructive} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Impact detail table */}
          <Card>
            <CardHeader><CardTitle>{t('impactDetail')}</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2.5 text-muted-foreground text-[10px] uppercase font-semibold">{t('thCurrency')}</th>
                    <th className="text-right p-2.5 text-muted-foreground text-[10px] uppercase font-semibold">{t('thRateChange')}</th>
                    <th className="text-right p-2.5 text-muted-foreground text-[10px] uppercase font-semibold">{t('thUnhedged')}</th>
                    <th className="text-right p-2.5 text-muted-foreground text-[10px] uppercase font-semibold">{t('thPnlImpact')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fxImpact.map(c => (
                    <tr key={c.code} className="border-b border-border hover:bg-muted/50">
                      <td className="p-2.5"><span className="mr-2">{c.flag}</span><span className="font-semibold">{c.code}</span></td>
                      <td className={`p-2.5 font-mono text-right ${c.rateChange >= 0 ? 'text-success' : 'text-destructive'}`}>{c.rateChange > 0 ? '+' : ''}{c.rateChange.toFixed(2)}%</td>
                      <td className="p-2.5 font-mono text-right">{fmtEur(c.unhedged)}</td>
                      <td className={`p-2.5 font-mono text-right font-bold ${c.impact >= 0 ? 'text-success' : 'text-destructive'}`}>{c.impact > 0 ? '+' : ''}{fmtEur(Math.round(c.impact))}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="p-2.5 font-bold" colSpan={3}>{t('totalImpact')}</td>
                    <td className={`p-2.5 font-mono text-right font-bold text-lg ${totalImpact >= 0 ? 'text-success' : 'text-destructive'}`}>{totalImpact > 0 ? '+' : ''}{fmtEur(Math.round(totalImpact))}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
