'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useHydrated } from '@/hooks/use-hydrated'
import { useAccounts, useReconciliation, useAutoMatch } from '@/hooks/use-api'
import { fmtEur, fmt, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Download, ClipboardList, Link2, CheckCircle2, Search, X, Zap, ArrowDownToLine, ArrowUpFromLine, Check, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { ScrollableTable, Th } from '@/components/ui/scrollable-table'
import { VirtualTableBody } from '@/components/ui/virtual-table'
import { exportXLSX } from '@/lib/export-xlsx'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonConciliacion } from '@/components/ui/skeleton-page'
import { KpiBox } from '@/components/kpi-box'

const bankColors: Record<string, string> = {
  BBVA: 'hsl(var(--bank-bbva))',
  Santander: 'hsl(var(--bank-santander))',
  CaixaBank: 'hsl(var(--bank-caixabank))',
  Sabadell: 'hsl(var(--bank-sabadell))',
}

export default function ConciliacionPage() {
  const t = useTranslations('conciliacion')
  const { data: accounts = [], isLoading: accountsLoading, mutate: mutateAccounts } = useAccounts()
  const { data: reconciliations = [], isLoading: reconciliationsLoading, mutate: mutateReconciliation } = useReconciliation()
  const { data: autoMatches, isLoading: matchLoading, mutate: mutateAutoMatch } = useAutoMatch()
  const loading = accountsLoading || reconciliationsLoading
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reconciling, setReconciling] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchCounterparty, setSearchCounterparty] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [acceptedMatches, setAcceptedMatches] = useState<Set<string>>(new Set())
  const [dismissedMatches, setDismissedMatches] = useState<Set<string>>(new Set())
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  async function refresh() {
    try {
      await Promise.all([mutateAccounts(), mutateReconciliation()])
    } catch (err) { console.error(err) }
    finally { setLastUpdated(new Date()) }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = (movements: any[]) => {
    const unreconciled = movements.filter((m: any) => !m.reconciled)
    if (unreconciled.every((m: any) => selected.has(m.id))) {
      setSelected(new Set())
    } else {
      setSelected(new Set(unreconciled.map((m: any) => m.id)))
    }
  }

  const handleReconcile = async (ids: string[]) => {
    setReconciling(true)
    try {
      if (ids.length === 1) {
        await api.treasury.reconcileMovement(ids[0])
      } else {
        await api.treasury.reconcileBatch(ids)
      }
      toast({ title: t('toastReconciliationUpdated'), description: t('toastMovementsUpdated', { count: ids.length }) })
      setFlashIds(new Set(ids)); setTimeout(() => setFlashIds(new Set()), 1000)
      setSelected(new Set())
      await Promise.all([mutateAccounts(), mutateReconciliation()])
    } catch (err: any) {
      toast({ title: t('toastError'), description: err.message, variant: 'destructive' })
    } finally {
      setReconciling(false)
    }
  }

  useKeyboardShortcuts([
    { key: 'm', label: t('shortcutAutoMatch'), action: () => { mutateAutoMatch() } },
    { key: 'r', label: t('shortcutRefresh'), action: refresh },
  ])

  const hydrated = useHydrated()

  if (!hydrated || loading) return <SkeletonConciliacion />

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const totalMovements = accounts.reduce((s, a) => s + (a.movements?.length || 0), 0)
  const reconciledCount = reconciliations.filter(r => r.status === 'COMPLETED').length
  const pendingRecon = reconciliations.filter(r => r.status === 'PENDING' || r.status === 'IN_PROGRESS')
  const allMovements = accounts.flatMap((a: any) =>
    (a.movements || []).map((m: any) => ({ ...m, accountAlias: a.alias, bankName: a.bankName }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const filteredMovements = allMovements.filter((m: any) => {
    if (dateFrom && new Date(m.date) < new Date(dateFrom)) return false
    if (dateTo && new Date(m.date) > new Date(dateTo + 'T23:59:59')) return false
    if (searchCounterparty) {
      const q = searchCounterparty.toLowerCase()
      const matchesCounterparty = (m.counterparty || '').toLowerCase().includes(q)
      const matchesConcept = (m.concept || '').toLowerCase().includes(q)
      if (!matchesCounterparty && !matchesConcept) return false
    }
    return true
  })

  const hasActiveFilters = dateFrom || dateTo || searchCounterparty
  const clearFilters = () => { setDateFrom(''); setDateTo(''); setSearchCounterparty('');  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: accounts.length })}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportCSV('conciliacion_movimientos', [t('thDate'), t('thAccount'), t('thConcept'), t('thCounterparty'), t('thAmount'), t('thBalance'), t('thReconciled')], allMovements.map((m: any) => [m.date?.slice(0, 10), m.accountAlias, m.concept, m.counterparty || '', Number(m.amount), Number(m.balance), m.reconciled ? t('yes') : t('no')]))}><Download size={14} className="mr-1" />CSV</Button>
            <Button variant="outline" size="sm" onClick={() => exportXLSX('conciliacion_movimientos', [t('thDate'), t('thAccount'), t('thConcept'), t('thCounterparty'), t('thAmount'), t('thBalance'), t('thReconciled')], allMovements.map((m: any) => [m.date?.slice(0, 10), m.accountAlias, m.concept, m.counterparty || '', Number(m.amount), Number(m.balance), m.reconciled ? t('yes') : t('no')]))}><Download size={14} className="mr-1" />Excel</Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('kpiTotalBalance'), value: fmtEur(totalBalance), color: 'text-foreground' },
          { label: t('kpiActiveAccounts'), value: `${accounts.length}`, color: 'text-foreground' },
          { label: t('kpiMovements'), value: totalMovements > 0 ? `${totalMovements}` : t('noData'), color: totalMovements > 0 ? 'text-foreground' : 'text-muted-foreground' },
          { label: t('kpiReconciliations'), value: reconciliations.length > 0 ? `${reconciledCount}/${reconciliations.length}` : t('noData'), color: reconciliations.length > 0 ? 'text-success' : 'text-muted-foreground' },
        ].map((m, i) => (
          <KpiBox key={m.label} index={i} label={m.label} value={m.value} color={m.color} />
        ))}
      </div>

      {/* Bank accounts cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc: any) => {
          const pct = totalBalance > 0 ? (Number(acc.balance) / totalBalance) * 100 : 0
          const color = bankColors[acc.bankName] || 'hsl(var(--primary))'
          return (
            <Card key={acc.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: color }}>
                      {acc.bankName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{acc.alias}</div>
                      <div className="text-xs text-muted-foreground">{acc.bankName}</div>
                    </div>
                  </div>
                  <Badge variant="success">{t('badgeActive')}</Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{t('labelBalance')}</div>
                    <div className="font-mono text-2xl font-bold">{fmtEur(Number(acc.balance))}</div>
                    <div className="text-xs text-muted-foreground">{t('ofTotal', { pct: pct.toFixed(1) })}</div>
                  </div>

                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">IBAN</div>
                      <div className="font-mono text-[11px] text-foreground">{acc.iban}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">{t('labelCurrency')}</div>
                      <div className="text-xs font-medium">{acc.currency}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="text-xs text-muted-foreground">
                      {t('movementsCount', { count: acc.movements?.length || 0 })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {acc.syncedAt ? t('syncDate', { date: fmtDate(acc.syncedAt) }) : t('notSynced')}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Distribución */}
      <Card>
        <CardHeader><CardTitle>{t('balanceDistribution')}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {accounts
              .sort((a, b) => Number(b.balance) - Number(a.balance))
              .map((acc: any) => {
                const pct = totalBalance > 0 ? (Number(acc.balance) / totalBalance) * 100 : 0
                const color = bankColors[acc.bankName] || 'hsl(var(--primary))'
                return (
                  <div key={acc.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{acc.alias}</span>
                      <span className="text-muted-foreground">{fmtEur(Number(acc.balance))} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
            <span className="text-sm font-semibold">{t('totalConsolidated')}</span>
            <span className="font-mono text-lg font-bold">{fmtEur(totalBalance)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Auto-matching suggestions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-primary" />
              <CardTitle>{t('autoReconciliation')}</CardTitle>
              {autoMatches && <Badge variant="secondary">{t('suggestionsCount', { count: autoMatches.matches?.filter((m: any) => !dismissedMatches.has(m.movementId)).length || 0 })}</Badge>}
            </div>
            <Button variant="outline" size="sm" onClick={() => mutateAutoMatch()} disabled={matchLoading}>
              <Zap size={14} className={`mr-1 ${matchLoading ? 'animate-pulse' : ''}`} />
              {matchLoading ? t('analyzing') : t('findMatches')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!autoMatches ? (
            <EmptyState variant="reconciliation" title={t('findMatchesPrompt')} compact />
          ) : autoMatches.matches?.filter((m: any) => !dismissedMatches.has(m.movementId) && !acceptedMatches.has(m.movementId)).length === 0 ? (
            <EmptyState
              variant="reconciliation"
              title={
                (acceptedMatches.size > 0 ? t('matchesAccepted', { count: acceptedMatches.size }) + ' ' : '') +
                (autoMatches.unmatched > 0 ? t('unmatchedMovements', { count: autoMatches.unmatched }) : t('allMovementsMatched'))
              }
              compact
            />
          ) : (
            <div className="space-y-3">
              {autoMatches.matches
                .filter((m: any) => !dismissedMatches.has(m.movementId) && !acceptedMatches.has(m.movementId))
                .map((match: any) => (
                <div key={match.movementId} className="p-4 rounded-lg border border-border bg-muted/30 hover:border-primary/30 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Confidence indicator */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${match.confidence >= 80 ? 'bg-success' : match.confidence >= 60 ? 'bg-warning' : 'bg-muted-foreground'}`}>
                      {match.confidence}%
                    </div>

                    {/* Match details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant={match.invoiceType === 'AR' ? 'success' : 'destructive'} className="gap-1">
                          {match.invoiceType === 'AR' ? <ArrowDownToLine size={10} /> : <ArrowUpFromLine size={10} />}
                          {match.invoiceType === 'AR' ? t('collection') : t('payment')}
                        </Badge>
                        <span className="font-mono text-xs font-semibold">{match.invoiceNumber}</span>
                        <span className="text-xs text-muted-foreground">{'\u2192'}</span>
                        <span className="text-xs">{match.counterparty}</span>
                      </div>

                      {/* Side by side: movement vs invoice */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2 rounded bg-card border border-border">
                          <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">{t('bankMovement')}</div>
                          <div className="font-mono font-semibold">{match.movement.amount >= 0 ? '+' : ''}{fmtEur(match.movement.amount)}</div>
                          <div className="text-muted-foreground truncate">{match.movement.concept}</div>
                          <div className="text-muted-foreground">{match.movement.account} · {fmtDate(match.movement.date)}</div>
                        </div>
                        <div className="p-2 rounded bg-card border border-border">
                          <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">{t('invoice', { type: match.invoiceType })}</div>
                          <div className="font-mono font-semibold">{fmtEur(match.invoiceAmount)}</div>
                          <div className="text-muted-foreground">{match.invoiceNumber}</div>
                          <div className="text-muted-foreground">{match.counterparty}</div>
                        </div>
                      </div>

                      {/* Match reasons */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {match.matchReasons.map((r: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{r}</Badge>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={async () => {
                          try {
                            await api.treasury.reconcileMovement(match.movementId)
                            setAcceptedMatches(prev => new Set(prev).add(match.movementId))
                            setFlashIds(new Set([match.movementId])); setTimeout(() => setFlashIds(new Set()), 1000)
                            toast({ title: t('toastReconciled'), description: `${match.invoiceNumber} \u2194 ${match.movement.concept}` })
                            await Promise.all([mutateAccounts(), mutateReconciliation()])
                          } catch (err: any) { toast({ title: t('toastError'), description: err.message, variant: 'destructive' }) }
                        }}
                      >
                        <Check size={12} />{t('accept')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs gap-1 text-muted-foreground"
                        onClick={() => setDismissedMatches(prev => new Set(prev).add(match.movementId))}
                      >
                        <XCircle size={12} />{t('dismiss')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {autoMatches.unmatched > 0 && (
                <div className="text-xs text-muted-foreground text-center pt-2">
                  {t('pendingWithoutAutoMatch', { count: autoMatches.unmatched })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movimientos recientes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>{t('recentMovements')}</CardTitle>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <Button size="sm" className="animate-scale-pop" onClick={() => handleReconcile([...selected])} loading={reconciling}>
                  {!reconciling && <CheckCircle2 size={14} className="mr-1" />}
                  {reconciling ? t('processing') : t('reconcileSelected', { count: selected.size })}
                </Button>
              )}
              {allMovements.length > 0 && (
                <Badge variant="secondary">
                  {hasActiveFilters ? t('filteredMovements', { filtered: filteredMovements.length, total: allMovements.length }) : t('movementsCount', { count: allMovements.length })}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          {allMovements.length > 0 && (
            <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b border-border">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5 block">{t('searchCounterpartyConcept')}</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('searchPlaceholder')}
                    value={searchCounterparty}
                    onChange={e => { setSearchCounterparty(e.target.value);  }}
                    className="pl-9 h-9 text-sm bg-muted border-border"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5 block">{t('filterFrom')}</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value);  }}
                  className="h-9 text-sm bg-muted border-border w-[150px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5 block">{t('filterTo')}</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value);  }}
                  className="h-9 text-sm bg-muted border-border w-[150px]"
                />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-muted-foreground">
                  <X size={14} className="mr-1" />{t('clearFilters')}
                </Button>
              )}
            </div>
          )}

          {allMovements.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-3 opacity-30"><ClipboardList size={28} className="mx-auto text-muted-foreground" /></div>
              <div className="text-sm text-muted-foreground">{t('noMovements')}</div>
              <div className="text-xs text-muted-foreground mt-1">{t('noMovementsHint')}</div>
            </div>
          ) : (
            <>
            <ScrollableTable label={t('bankMovementsLabel')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="p-3 w-8">
                      <input
                        type="checkbox"
                        aria-label={t('selectAllUnreconciled')}
                        className="rounded border-border"
                        checked={filteredMovements.filter((m: any) => !m.reconciled).length > 0 && filteredMovements.filter((m: any) => !m.reconciled).every((m: any) => selected.has(m.id))}
                        onChange={() => toggleSelectAll(filteredMovements)}
                      />
                    </th>
                    {[t('thDate'), t('thAccount'), t('thConcept'), t('thCounterparty'), t('thAmount'), t('thBalance'), t('thStatus')].map(h => (
                      <Th key={h}>{h}</Th>
                    ))}
                    <th scope="col" className="p-3"><span className="sr-only">{t('thActions')}</span></th>
                  </tr>
                </thead>
              </table>
            </ScrollableTable>
            <VirtualTableBody
              data={filteredMovements}
              getKey={(m: any) => m.id}
              rowClassName={(m: any) => `${selected.has(m.id) ? 'bg-primary/5' : ''} ${flashIds.has(m.id) ? 'animate-flash-success' : ''}`.trim()}
              renderRow={(m: any) => (
                <>
                  <td className="p-3">
                    {!m.reconciled && (
                      <input type="checkbox" aria-label={t('selectMovement', { concept: m.concept })} className="rounded border-border" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} />
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{fmtDate(m.date)}</td>
                  <td className="p-3 text-xs">{m.accountAlias}</td>
                  <td className="p-3 text-xs">{m.concept}</td>
                  <td className="p-3 text-xs text-muted-foreground">{m.counterparty || '\u2014'}</td>
                  <td className={`p-3 font-mono text-xs font-semibold ${Number(m.amount) >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {Number(m.amount) >= 0 ? '+' : ''}{fmtEur(Number(m.amount))}
                  </td>
                  <td className="p-3 font-mono text-xs">{fmtEur(Number(m.balance))}</td>
                  <td className="p-3">
                    <Badge variant={m.reconciled ? 'success' : 'warning'}>{m.reconciled ? t('statusReconciled') : t('statusPending')}</Badge>
                  </td>
                  <td className="p-3">
                    <Button variant={m.reconciled ? 'outline' : 'default'} size="sm" className="h-7 text-xs" onClick={() => handleReconcile([m.id])} disabled={reconciling}>
                      {m.reconciled ? t('undo') : t('reconcile')}
                    </Button>
                  </td>
                </>
              )}
            />
            {hasActiveFilters && filteredMovements.length === 0 && (
              <div className="text-center py-8">
                <div className="text-sm text-muted-foreground">{t('noMatchingMovements')}</div>
                <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2 text-xs">{t('clearFilters')}</Button>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Reconciliation history */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>{t('reconciliationHistory')}</CardTitle>
            {pendingRecon.length > 0 && (
              <Badge variant="warning">{t('pendingCount', { count: pendingRecon.length })}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {reconciliations.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-3 opacity-30"><Link2 size={28} className="mx-auto text-muted-foreground" /></div>
              <div className="text-sm text-muted-foreground">{t('noReconciliations')}</div>
              <div className="text-xs text-muted-foreground mt-1">{t('noReconciliationsHint')}</div>
            </div>
          ) : (
            <>
            <ScrollableTable label={t('reconciliationHistoryLabel')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[t('thPeriod'), t('thAccount'), t('thBankBalance'), t('thErpBalance'), t('thDifference'), t('thMatched'), t('thUnmatched'), t('thStatus')].map(h => (
                      <Th key={h}>{h}</Th>
                    ))}
                  </tr>
                </thead>
              </table>
            </ScrollableTable>
            <VirtualTableBody
              data={reconciliations}
              getKey={(r: any) => r.id}
              renderRow={(r: any) => {
                const diff = Number(r.difference)
                return (
                  <>
                    <td className="p-3 text-xs">{fmtDate(r.periodDate)}</td>
                    <td className="p-3 text-xs">{r.bankAccount?.alias || '\u2014'}</td>
                    <td className="p-3 font-mono text-xs">{fmtEur(Number(r.bankBalance))}</td>
                    <td className="p-3 font-mono text-xs">{fmtEur(Number(r.erpBalance))}</td>
                    <td className={`p-3 font-mono text-xs font-semibold ${diff === 0 ? 'text-success' : 'text-destructive'}`}>{diff === 0 ? '0 \u20AC' : fmtEur(diff)}</td>
                    <td className="p-3 font-mono text-xs text-success">{r.matchedCount}</td>
                    <td className="p-3 font-mono text-xs text-warning">{r.unmatchedCount}</td>
                    <td className="p-3">
                      <Badge variant={r.status === 'COMPLETED' ? 'success' : r.status === 'IN_PROGRESS' ? 'warning' : 'secondary'}>
                        {r.status === 'COMPLETED' ? t('statusCompleted') : r.status === 'IN_PROGRESS' ? t('statusInProgress') : t('statusPending')}
                      </Badge>
                    </td>
                  </>
                )
              }}
            />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
