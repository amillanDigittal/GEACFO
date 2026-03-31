'use client'
import { useHydrated } from '@/hooks/use-hydrated'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmtM, exportCSV } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BarChart3, Droplets, RefreshCw, CreditCard, AlertTriangle, FileDown, Download, GitCompareArrows } from 'lucide-react'
import { exportBoardPackPDF } from '@/lib/export-pdf'
import dynamic from 'next/dynamic'
import { SkeletonBoardPack } from '@/components/ui/skeleton-page'
import { ErrorState } from '@/components/ui/error-state'
import { useTranslations } from 'next-intl'

const ExecutiveSummary = dynamic(() => import('./_components/executive-summary').then(m => ({ default: m.ExecutiveSummary })), { ssr: false })
const LiquiditySection = dynamic(() => import('./_components/liquidity-section').then(m => ({ default: m.LiquiditySection })), { ssr: false })
const WorkingCapitalSection = dynamic(() => import('./_components/working-capital-section').then(m => ({ default: m.WorkingCapitalSection })), { ssr: false })
const DebtCovenantsSection = dynamic(() => import('./_components/debt-covenants-section').then(m => ({ default: m.DebtCovenantsSection })), { ssr: false })
const CustomerRiskSection = dynamic(() => import('./_components/customer-risk-section').then(m => ({ default: m.CustomerRiskSection })), { ssr: false })

export default function BoardPackPage() {
  const t = useTranslations('boardpack')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('summary')
  const [showCompare, setShowCompare] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const sectionNav = [
    { key: 'summary', label: t('navExecutiveSummary'), icon: <BarChart3 size={14} /> },
    { key: 'liquidity', label: t('navLiquidity'), icon: <Droplets size={14} /> },
    { key: 'working', label: t('navWorkingCapital'), icon: <RefreshCw size={14} /> },
    { key: 'debt', label: t('navDebtCovenants'), icon: <CreditCard size={14} /> },
    { key: 'risk', label: t('navCustomerRisk'), icon: <AlertTriangle size={14} /> },
  ]

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

  const hydrated = useHydrated()

  if (!hydrated || loading) return <SkeletonBoardPack />
  if (!data) return <ErrorState title={t('errorLoading')} onRetry={() => fetchData()} />

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
        title={t('title')}
        subtitle={t('subtitle', { date: genDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) })}
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
              {showCompare ? t('compareActive') : t('compareButton')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportBoardPackPDF(data)}><FileDown size={14} className="mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportCSV('board_pack', [t('csvSection'), t('csvMetric'), t('csvValue')], [[t('csvSummary'), t('csvCash'), String(es.cash)], [t('csvSummary'), 'Revenue', String(es.revenue)], [t('csvSummary'), t('csvEbitdaMargin'), `${es.ebitdaMargin}%`], [t('csvSummary'), t('csvAlerts'), String(es.alerts)], [t('csvLiquidity'), t('csvCurrentCash'), String(liq.currentCash)], [t('csvLiquidity'), t('csvForecastedCashS13'), String(liq.forecastedCash * 1000)], [t('csvLiquidity'), t('csvGapWeeks'), String(liq.gapWeeks.length)], ['Working Capital', 'DSO', `${wc.dso}d`], ['Working Capital', 'DPO', `${wc.dpo}d`], ['Working Capital', 'CCC', `${wc.ccc}d`], [t('csvDebt'), t('csvGrossDebt'), String(debt.totalDebt)], [t('csvDebt'), t('csvNetDebt'), String(debt.netDebt)], [t('csvRisk'), t('csvTotalExposure'), String(cr.totalExposure)], [t('csvRisk'), t('csvAvgScore'), String(cr.avgScore)], [t('csvRisk'), t('csvAlertCustomers'), String(cr.alertCustomers.length)]])}><Download size={14} className="mr-1" />CSV</Button>
          </>
        }
      />

      {/* Compare banner */}
      {showCompare && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <GitCompareArrows size={16} className="text-primary flex-shrink-0" />
          <div className="flex-1">
            <span className="text-xs font-medium">{t('comparing')} </span>
            <Badge variant="secondary">Q4 2025</Badge>
            <span className="text-xs text-muted-foreground mx-1">→</span>
            <Badge variant="default">Q1 2026</Badge>
            <span className="text-xs text-muted-foreground ml-2">{t('deltaDescription')}</span>
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
        <ExecutiveSummary es={es} pes={pes} showCompare={showCompare} />
      )}

      {/* 2. Liquidez */}
      {activeSection === 'liquidity' && (
        <LiquiditySection liq={liq} pliq={pliq} showCompare={showCompare} />
      )}

      {/* 3. Working Capital */}
      {activeSection === 'working' && (
        <WorkingCapitalSection wc={wc} pwc={pwc} showCompare={showCompare} />
      )}

      {/* 4. Deuda & Covenants */}
      {activeSection === 'debt' && (
        <DebtCovenantsSection debt={debt} pdebt={pdebt} es={es} pes={pes} showCompare={showCompare} />
      )}

      {/* 5. Riesgo Clientes */}
      {activeSection === 'risk' && (
        <CustomerRiskSection cr={cr} pcr={pcr} showCompare={showCompare} />
      )}
    </div>
  )
}
