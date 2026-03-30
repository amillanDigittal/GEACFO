'use client'
import { useState } from 'react'
import { useDebtSummary, useAmortization } from '@/hooks/use-api'
import { useHydrated } from '@/hooks/use-hydrated'
import { fmtEur, fmt, fmtPct } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CheckCircle2, AlertTriangle, Clock, Calculator, TrendingDown, TrendingUp, ArrowRight, RotateCcw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { PageHeader } from '@/components/page-header'
import { KpiBox } from '@/components/kpi-box'
import { SkeletonDeuda } from '@/components/ui/skeleton-page'
import { useTranslations } from 'next-intl'

const DEBT_TYPES = ['SYNDICATED_LOAN', 'CREDIT_LINE', 'LEASING', 'BOND', 'FACTORING', 'OTHER']

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  'hsl(var(--destructive))',
  'hsl(var(--chart-blue))',
  'hsl(var(--chart-purple))',
]

export default function DeudaPage() {
  const t = useTranslations('deuda')

  const DEBT_LABELS: Record<string, string> = {
    SYNDICATED_LOAN: t('typeSyndicatedLoan'),
    CREDIT_LINE: t('typeCreditLine'),
    LEASING: t('typeLeasing'),
    BOND: t('typeBond'),
    FACTORING: t('typeFactoring'),
    OTHER: t('typeOther'),
  }

  const { data, isLoading: summaryLoading, mutate: mutateSummary } = useDebtSummary()
  const { data: amort, isLoading: amortLoading, mutate: mutateAmort } = useAmortization()
  const [simOpen, setSimOpen] = useState(false)
  const [simInst, setSimInst] = useState<any>(null)
  const [simRate, setSimRate] = useState(0)
  const [simMonths, setSimMonths] = useState(0)
  const [simType, setSimType] = useState('')
  const [lastUpdated] = useState<Date | null>(() => new Date())

  const loading = summaryLoading || amortLoading

  function refresh() {
    mutateSummary()
    mutateAmort()
  }

  const hydrated = useHydrated()

  if (!hydrated || loading || !data) return <SkeletonDeuda />

  const instruments = data?.instruments || []
  const covenants = data?.covenants || []

  function openSimulator(inst: any) {
    const rate = Number(inst.interestRate) * 100
    const matDate = new Date(inst.maturityDate)
    const months = Math.max(1, Math.round((matDate.getTime() - Date.now()) / (30.44 * 24 * 60 * 60 * 1000)))
    setSimInst(inst)
    setSimRate(parseFloat(rate.toFixed(2)))
    setSimMonths(months)
    setSimType(inst.type)
    setSimOpen(true)
  }

  function calcSimulation() {
    if (!simInst) return null
    const outstanding = Number(simInst.outstanding)
    const origRate = Number(simInst.interestRate) * 100
    const origMatDate = new Date(simInst.maturityDate)
    const origMonths = Math.max(1, Math.round((origMatDate.getTime() - Date.now()) / (30.44 * 24 * 60 * 60 * 1000)))

    const newRate = simRate
    const newMonths = simMonths

    // Annual interest cost
    const origInterestAnnual = outstanding * (origRate / 100)
    const newInterestAnnual = outstanding * (newRate / 100)
    const interestSaving = origInterestAnnual - newInterestAnnual

    // Total interest over life
    const origTotalInterest = origInterestAnnual * (origMonths / 12)
    const newTotalInterest = newInterestAnnual * (newMonths / 12)
    const totalSaving = origTotalInterest - newTotalInterest

    // Monthly payment (principal only, linear amortization)
    const origMonthlyPrincipal = outstanding / origMonths
    const newMonthlyPrincipal = outstanding / newMonths
    const origMonthlyInterest = outstanding * (origRate / 100) / 12
    const newMonthlyInterest = outstanding * (newRate / 100) / 12
    const origMonthlyTotal = origMonthlyPrincipal + origMonthlyInterest
    const newMonthlyTotal = newMonthlyPrincipal + newMonthlyInterest

    // Weighted avg rate impact on portfolio
    const totalDebt = instruments.reduce((s: number, i: any) => s + Number(i.outstanding), 0)
    const origWeightedRate = instruments.reduce((s: number, i: any) => s + Number(i.outstanding) * Number(i.interestRate), 0) / totalDebt
    const newWeightedRate = instruments.reduce((s: number, i: any) => {
      if (i.id === simInst.id) return s + Number(i.outstanding) * (newRate / 100)
      return s + Number(i.outstanding) * Number(i.interestRate)
    }, 0) / totalDebt

    // New maturity date
    const newMatDate = new Date(Date.now() + newMonths * 30.44 * 24 * 60 * 60 * 1000)

    // Amortization comparison (first 12 months)
    const schedule = []
    for (let m = 1; m <= Math.max(origMonths, newMonths, 12); m++) {
      const origPrinc = m <= origMonths ? origMonthlyPrincipal : 0
      const origInt = m <= origMonths ? (outstanding - origMonthlyPrincipal * (m - 1)) * (origRate / 100) / 12 : 0
      const newPrinc = m <= newMonths ? newMonthlyPrincipal : 0
      const newInt = m <= newMonths ? (outstanding - newMonthlyPrincipal * (m - 1)) * (newRate / 100) / 12 : 0
      const d = new Date(Date.now() + m * 30.44 * 24 * 60 * 60 * 1000)
      schedule.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        original: Math.round(origPrinc + origInt),
        refinanciado: Math.round(newPrinc + newInt),
      })
      if (m >= 24) break
    }

    return {
      outstanding,
      origRate,
      newRate,
      origMonths,
      newMonths,
      interestSaving,
      totalSaving,
      origMonthlyTotal,
      newMonthlyTotal,
      origWeightedRate: origWeightedRate * 100,
      newWeightedRate: newWeightedRate * 100,
      origTotalInterest,
      newTotalInterest,
      origMatDate,
      newMatDate,
      schedule,
    }
  }

  const sim = simOpen ? calcSimulation() : null

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiBox index={0} label={t('kpiTotalDebt')} value={fmtEur(data?.totalDebt || 0)} tooltip={t('kpiTotalDebtTooltip')} source={t('kpiTotalDebtSource')} />
        <KpiBox index={1} label={t('kpiNetDebt')} value={fmtEur(data?.netDebt || 0)} tooltip={t('kpiNetDebtTooltip')} source={t('kpiNetDebtSource')} />
        <KpiBox index={2} label={t('kpiAvgCost')} value={`${fmt((data?.avgRate || 0) * 100, 2)}%`} color="text-warning" tooltip={t('kpiAvgCostTooltip')} source={t('kpiAvgCostSource')} />
        <KpiBox index={3} label={t('kpiCovenantsOk')} value={`${covenants.filter((c: any) => c.status === 'COMPLIANT').length}/${covenants.length}`} color="text-success" tooltip={t('kpiCovenantsOkTooltip')} source={t('kpiCovenantsOkSource')} />
      </div>

      {/* Amortization Chart + Maturity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>{t('amortizationTitle')}</CardTitle></CardHeader>
          <CardContent>
            {amort?.schedule ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={amort.schedule.filter((_: any, i: number) => i % 2 === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                  <Tooltip
                       
                    formatter={(value: number, name: string) => {
                      const inst = amort.instruments?.find((i: any) => i.id === name)
                      const label = inst ? `${DEBT_LABELS[inst.type] || inst.type} (${inst.bank})` : name
                      return [fmtEur(value), label]
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const inst = amort.instruments?.find((i: any) => i.id === value)
                      return inst ? `${DEBT_LABELS[inst.type] || inst.type}` : value
                    }}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  {amort.instruments?.map((inst: any, idx: number) => (
                    <Bar key={inst.id} dataKey={inst.id} stackId="amort" fill={COLORS[idx % COLORS.length]} radius={idx === amort.instruments.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">{t('loading')}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('maturityTimelineTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(amort?.instruments || []).map((inst: any, idx: number) => {
              const matDate = new Date(inst.maturityDate)
              const totalMonths = inst.monthsRemaining
              const isUrgent = totalMonths <= 6
              const isWarning = totalMonths <= 12 && !isUrgent
              const pctElapsed = inst.totalAmount > 0 ? Math.round(((inst.totalAmount - inst.outstanding) / inst.totalAmount) * 100) : 0
              // Find full instrument data for simulator
              const fullInst = instruments.find((i: any) => i.id === inst.id) || inst

              return (
                <div key={inst.id} className="bg-muted rounded-lg p-4 border border-border">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold text-sm">{DEBT_LABELS[inst.type] || inst.type}</div>
                      <div className="text-xs text-muted-foreground">{inst.bank}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => openSimulator(fullInst)}>
                        <Calculator size={10} className="mr-1" />{t('simulate')}
                      </Button>
                      <Badge variant={isUrgent ? 'destructive' : isWarning ? 'warning' : 'secondary'}>
                        {isUrgent ? <AlertTriangle size={12} className="mr-1" /> : <Clock size={12} className="mr-1" />}
                        {t('months', { count: totalMonths })}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div>
                      <span className="text-muted-foreground">{t('outstandingBalance')}</span>
                      <div className="font-mono font-semibold">{fmtEur(inst.outstanding)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('rateLabel')}</span>
                      <div className="font-mono font-semibold text-warning">{fmt(inst.interestRate * 100, 2)}%</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('maturityLabel')}</span>
                      <div className="font-mono font-semibold">{matDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{t('amortized')}: {pctElapsed}%</span>
                      <span>{fmtEur(inst.totalAmount - inst.outstanding)} / {fmtEur(inst.totalAmount)}</span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pctElapsed}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
            {!amort?.instruments?.length && (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">{t('loading')}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instruments Table + Covenants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>{t('instrumentsTitle')}</CardTitle></CardHeader>
          <ScrollableTable>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">{[t('thInstrument'), t('thEntity'), t('thOutstanding'), t('thRate'), t('thMaturity'), ''].map(h => <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody>
                {instruments.map((d: any) => (
                  <tr key={d.id} className="border-b border-border hover:bg-muted/50">
                    <td className="p-3 font-medium">{DEBT_LABELS[d.type] || d.type}</td>
                    <td className="p-3 text-xs text-muted-foreground">{d.bank}</td>
                    <td className="p-3 font-mono text-xs">{fmtEur(Number(d.outstanding))}</td>
                    <td className="p-3 font-mono text-xs text-warning">{fmt(Number(d.interestRate) * 100, 2)}%</td>
                    <td className="p-3 font-mono text-xs">{String(d.maturityDate).slice(0,7)}</td>
                    <td className="p-3">
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => openSimulator(d)}>
                        <RotateCcw size={10} className="mr-1" />{t('refinance')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('covenantsTitle')}</CardTitle>
            {data?.allCompliant && <Badge variant="success"><CheckCircle2 size={12} className="mr-1" />{t('covenantsAllOk')}</Badge>}
          </CardHeader>
          <CardContent className="space-y-4">
            {covenants.map((cv: any) => (
              <div key={cv.name} className="bg-muted rounded-lg p-3 border border-border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold">{cv.name}</span>
                  <Badge variant={cv.status === 'COMPLIANT' ? 'success' : cv.status === 'WARNING' ? 'warning' : 'destructive'}>
                    {cv.status === 'COMPLIANT' ? <CheckCircle2 size={12} className="mr-1" /> : <AlertTriangle size={12} className="mr-1" />}
                    {cv.status === 'COMPLIANT' ? 'OK' : cv.status}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>{t('covenantCurrent')}: <strong className="text-foreground">{typeof cv.currentValue === 'number' && cv.currentValue > 1000 ? fmtEur(cv.currentValue) : `${Number(cv.currentValue)}x`}</strong></span>
                  <span>{t('covenantLimit')}: {typeof cv.limitValue === 'number' && cv.limitValue > 1000 ? fmtEur(cv.limitValue) : `${Number(cv.limitValue)}x`}</span>
                </div>
                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${Math.min(90, 100 - Number(cv.margin))}%` }} />
                </div>
                <div className="text-xs text-success mt-1.5 font-medium">{t('covenantMargin')}: +{Number(cv.margin)}%</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Refinancing Simulator Modal */}
      <Dialog open={simOpen} onOpenChange={setSimOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {simInst && sim && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <RotateCcw size={18} className="text-primary" />
                  <DialogTitle>{t('simTitle')}</DialogTitle>
                </div>
                <DialogDescription>
                  {DEBT_LABELS[simInst.type] || simInst.type} — {simInst.bank} · {t('outstandingBalance')}: {fmtEur(Number(simInst.outstanding))}
                </DialogDescription>
              </DialogHeader>

              {/* Parameters */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('simNewRate')}</label>
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    step={0.05}
                    value={simRate}
                    onChange={e => setSimRate(parseFloat(e.target.value) || 0)}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('simNewTerm')}</label>
                  <Input
                    type="number"
                    min={1}
                    max={360}
                    step={1}
                    value={simMonths}
                    onChange={e => setSimMonths(parseInt(e.target.value) || 1)}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('simInstrumentType')}</label>
                  <Select
                    value={simType}
                    onChange={e => setSimType(e.target.value)}
                    className="w-full h-9 text-sm font-medium"
                  >
                    {DEBT_TYPES.map(t_ => <option key={t_} value={t_}>{DEBT_LABELS[t_]}</option>)}
                  </Select>
                </div>
              </div>

              {/* Results: Before vs After */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{t('simCurrentConditions')}</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('rateLabel')}</span><span className="font-mono font-semibold">{fmt(sim.origRate, 2)}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('simRemainingTerm')}</span><span className="font-mono font-semibold">{t('months', { count: sim.origMonths })}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('simMonthlyPayment')}</span><span className="font-mono font-semibold">{fmtEur(Math.round(sim.origMonthlyTotal))}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('simTotalInterest')}</span><span className="font-mono font-semibold">{fmtEur(Math.round(sim.origTotalInterest))}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('maturityLabel')}</span><span className="font-mono font-semibold">{sim.origMatDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}</span></div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="text-[10px] text-primary uppercase tracking-widest mb-2">{t('simRefinanced')}</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('rateLabel')}</span><span className="font-mono font-semibold">{fmt(sim.newRate, 2)}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('simTerm')}</span><span className="font-mono font-semibold">{t('months', { count: sim.newMonths })}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('simMonthlyPayment')}</span><span className="font-mono font-semibold">{fmtEur(Math.round(sim.newMonthlyTotal))}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('simTotalInterest')}</span><span className="font-mono font-semibold">{fmtEur(Math.round(sim.newTotalInterest))}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('maturityLabel')}</span><span className="font-mono font-semibold">{sim.newMatDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}</span></div>
                  </div>
                </div>
              </div>

              {/* Impact Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className={`p-3 rounded-lg border text-center ${sim.interestSaving > 0 ? 'bg-success/10 border-success/20' : sim.interestSaving < 0 ? 'bg-destructive/10 border-destructive/20' : 'bg-muted/50 border-border'}`}>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{t('simAnnualSaving')}</div>
                  <div className={`font-mono text-lg font-bold ${sim.interestSaving > 0 ? 'text-success' : sim.interestSaving < 0 ? 'text-destructive' : ''}`}>
                    {sim.interestSaving >= 0 ? '+' : ''}{fmtEur(Math.round(sim.interestSaving))}
                  </div>
                </div>
                <div className={`p-3 rounded-lg border text-center ${sim.totalSaving > 0 ? 'bg-success/10 border-success/20' : sim.totalSaving < 0 ? 'bg-destructive/10 border-destructive/20' : 'bg-muted/50 border-border'}`}>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{t('simTotalSaving')}</div>
                  <div className={`font-mono text-lg font-bold ${sim.totalSaving > 0 ? 'text-success' : sim.totalSaving < 0 ? 'text-destructive' : ''}`}>
                    {sim.totalSaving >= 0 ? '+' : ''}{fmtEur(Math.round(sim.totalSaving))}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{t('simPortfolioCost')}</div>
                  <div className="font-mono text-lg font-bold">
                    {fmt(sim.origWeightedRate, 2)}%
                    <span className="text-sm text-muted-foreground mx-1">→</span>
                    <span className={sim.newWeightedRate < sim.origWeightedRate ? 'text-success' : sim.newWeightedRate > sim.origWeightedRate ? 'text-destructive' : ''}>{fmt(sim.newWeightedRate, 2)}%</span>
                  </div>
                </div>
              </div>

              {/* Monthly payment comparison */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('simMonthlyChange')}</div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-center">
                    <div className="text-[10px] text-muted-foreground">{t('simCurrent')}</div>
                    <div className="font-mono text-sm font-bold">{fmtEur(Math.round(sim.origMonthlyTotal))}</div>
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground" />
                  <div className="flex-1 text-center">
                    <div className="text-[10px] text-muted-foreground">{t('simRefinanced')}</div>
                    <div className="font-mono text-sm font-bold">{fmtEur(Math.round(sim.newMonthlyTotal))}</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="text-[10px] text-muted-foreground">{t('simDifference')}</div>
                    <div className={`font-mono text-sm font-bold ${sim.newMonthlyTotal < sim.origMonthlyTotal ? 'text-success' : sim.newMonthlyTotal > sim.origMonthlyTotal ? 'text-destructive' : ''}`}>
                      {sim.newMonthlyTotal <= sim.origMonthlyTotal ? '' : '+'}{fmtEur(Math.round(sim.newMonthlyTotal - sim.origMonthlyTotal))}/{t('simPerMonth')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Amortization comparison chart */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('simPaymentComparison')}</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={sim.schedule.slice(0, 24)} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} interval={3} />
                    <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                    <Tooltip
                       
                      formatter={(v: number, name: string) => [fmtEur(v), name === 'original' ? t('simCurrent') : t('simRefinanced')]}
                    />
                    <Bar dataKey="original" fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[2, 2, 0, 0]} name="original" />
                    <Bar dataKey="refinanciado" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} name="refinanciado" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Insight */}
              {sim.interestSaving !== 0 && (
                <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${sim.interestSaving > 0 ? 'bg-success/10 border border-success/20 text-success' : 'bg-warning/10 border border-warning/20 text-warning'}`}>
                  {sim.interestSaving > 0 ? <TrendingDown size={14} className="mt-0.5 flex-shrink-0" /> : <TrendingUp size={14} className="mt-0.5 flex-shrink-0" />}
                  <span>
                    {sim.interestSaving > 0
                      ? t('simInsightPositive', { rate: fmt(sim.newRate, 2), annualSaving: fmtEur(Math.round(sim.interestSaving)), totalSaving: fmtEur(Math.round(sim.totalSaving)), origRate: fmt(sim.origWeightedRate, 2), newRate: fmt(sim.newWeightedRate, 2) })
                      : t('simInsightNegative', { annualCost: fmtEur(Math.round(Math.abs(sim.interestSaving))), longerTerm: sim.newMonths > sim.origMonths ? t('simInsightLongerTerm', { newMonths: sim.newMonths, origMonths: sim.origMonths }) : '' })
                    }
                  </span>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
