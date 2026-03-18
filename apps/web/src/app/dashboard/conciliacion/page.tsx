'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmt, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, ClipboardList, Link2, CheckCircle2, Search, X } from 'lucide-react'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonConciliacion } from '@/components/ui/skeleton-page'

const bankColors: Record<string, string> = {
  BBVA: 'hsl(210 80% 50%)',
  Santander: 'hsl(0 70% 50%)',
  CaixaBank: 'hsl(200 60% 45%)',
  Sabadell: 'hsl(220 50% 55%)',
}

export default function ConciliacionPage() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [reconciliations, setReconciliations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reconciling, setReconciling] = useState(false)
  const [movPage, setMovPage] = useState(0)
  const [recPage, setRecPage] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchCounterparty, setSearchCounterparty] = useState('')
  const PAGE_SIZE = 10
  const { toast } = useToast()

  const loadData = () => {
    Promise.all([
      api.treasury.accounts(),
      api.treasury.reconciliation(),
    ])
      .then(([acc, rec]) => { setAccounts(acc); setReconciliations(rec) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

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
      toast({ title: 'Conciliación actualizada', description: `${ids.length} movimiento${ids.length > 1 ? 's' : ''} actualizado${ids.length > 1 ? 's' : ''}` })
      setSelected(new Set())
      setLoading(true)
      loadData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setReconciling(false)
    }
  }

  if (loading) return <SkeletonConciliacion />

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
  const clearFilters = () => { setDateFrom(''); setDateTo(''); setSearchCounterparty(''); setMovPage(0) }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Conciliación Bancaria</h1>
          <p className="page-subtitle">Grupo Ibérico SA · {accounts.length} cuentas · Marzo 2026</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportCSV('conciliacion_movimientos', ['Fecha', 'Cuenta', 'Concepto', 'Contraparte', 'Importe', 'Saldo', 'Conciliado'], allMovements.map((m: any) => [m.date?.slice(0, 10), m.accountAlias, m.concept, m.counterparty || '', Number(m.amount), Number(m.balance), m.reconciled ? 'Sí' : 'No']))}><Download size={14} className="mr-1" />Exportar</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Saldo Total', value: fmtEur(totalBalance), color: 'text-foreground' },
          { label: 'Cuentas Activas', value: `${accounts.length}`, color: 'text-foreground' },
          { label: 'Movimientos', value: totalMovements > 0 ? `${totalMovements}` : 'Sin datos', color: totalMovements > 0 ? 'text-foreground' : 'text-muted-foreground' },
          { label: 'Conciliaciones', value: reconciliations.length > 0 ? `${reconciledCount}/${reconciliations.length}` : 'Sin datos', color: reconciliations.length > 0 ? 'text-success' : 'text-muted-foreground' },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
            <div className={`font-mono text-xl font-bold ${m.color}`}>{m.value}</div>
          </div>
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
                  <Badge variant="success">Activa</Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Saldo</div>
                    <div className="font-mono text-2xl font-bold">{fmtEur(Number(acc.balance))}</div>
                    <div className="text-xs text-muted-foreground">{pct.toFixed(1)}% del total</div>
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
                      <div className="text-[10px] text-muted-foreground uppercase">Moneda</div>
                      <div className="text-xs font-medium">{acc.currency}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="text-xs text-muted-foreground">
                      {acc.movements?.length || 0} movimientos
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {acc.syncedAt ? `Sync: ${fmtDate(acc.syncedAt)}` : 'Sin sincronizar'}
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
        <CardHeader><CardTitle>Distribución de Saldos</CardTitle></CardHeader>
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
            <span className="text-sm font-semibold">Total Consolidado</span>
            <span className="font-mono text-lg font-bold">{fmtEur(totalBalance)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Movimientos recientes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>Movimientos Recientes</CardTitle>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <Button size="sm" onClick={() => handleReconcile([...selected])} disabled={reconciling}>
                  <CheckCircle2 size={14} className="mr-1" />
                  {reconciling ? 'Procesando...' : `Conciliar (${selected.size})`}
                </Button>
              )}
              {allMovements.length > 0 && (
                <Badge variant="secondary">
                  {hasActiveFilters ? `${filteredMovements.length} de ${allMovements.length}` : allMovements.length} movimientos
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
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5 block">Buscar contraparte / concepto</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Ej: Aceros, nómina, transferencia..."
                    value={searchCounterparty}
                    onChange={e => { setSearchCounterparty(e.target.value); setMovPage(0) }}
                    className="pl-9 h-9 text-sm bg-muted border-border"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5 block">Desde</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setMovPage(0) }}
                  className="h-9 text-sm bg-muted border-border w-[150px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5 block">Hasta</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setMovPage(0) }}
                  className="h-9 text-sm bg-muted border-border w-[150px]"
                />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-muted-foreground">
                  <X size={14} className="mr-1" />Limpiar
                </Button>
              )}
            </div>
          )}

          {allMovements.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-3 opacity-30"><ClipboardList size={28} className="mx-auto text-muted-foreground" /></div>
              <div className="text-sm text-muted-foreground">No hay movimientos bancarios registrados</div>
              <div className="text-xs text-muted-foreground mt-1">Los movimientos aparecerán aquí cuando se sincronicen las cuentas bancarias</div>
            </div>
          ) : (
            <>
            <ScrollableTable>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-3 w-8">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={filteredMovements.filter((m: any) => !m.reconciled).length > 0 && filteredMovements.filter((m: any) => !m.reconciled).every((m: any) => selected.has(m.id))}
                        onChange={() => toggleSelectAll(filteredMovements)}
                      />
                    </th>
                    {['Fecha', 'Cuenta', 'Concepto', 'Contraparte', 'Importe', 'Saldo', 'Estado', ''].map(h => (
                      <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.slice(movPage * PAGE_SIZE, (movPage + 1) * PAGE_SIZE).map((m: any) => (
                    <tr key={m.id} className={`border-b border-border hover:bg-muted/50 transition-colors ${selected.has(m.id) ? 'bg-primary/5' : ''}`}>
                      <td className="p-3">
                        {!m.reconciled && (
                          <input
                            type="checkbox"
                            className="rounded border-border"
                            checked={selected.has(m.id)}
                            onChange={() => toggleSelect(m.id)}
                          />
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{fmtDate(m.date)}</td>
                      <td className="p-3 text-xs">{m.accountAlias}</td>
                      <td className="p-3 text-xs">{m.concept}</td>
                      <td className="p-3 text-xs text-muted-foreground">{m.counterparty || '—'}</td>
                      <td className={`p-3 font-mono text-xs font-semibold ${Number(m.amount) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {Number(m.amount) >= 0 ? '+' : ''}{fmtEur(Number(m.amount))}
                      </td>
                      <td className="p-3 font-mono text-xs">{fmtEur(Number(m.balance))}</td>
                      <td className="p-3">
                        <Badge variant={m.reconciled ? 'success' : 'warning'}>
                          {m.reconciled ? 'Conciliado' : 'Pendiente'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button
                          variant={m.reconciled ? 'outline' : 'default'}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleReconcile([m.id])}
                          disabled={reconciling}
                        >
                          {m.reconciled ? 'Deshacer' : 'Conciliar'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
            {filteredMovements.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                <span className="text-xs text-muted-foreground">
                  {movPage * PAGE_SIZE + 1}–{Math.min((movPage + 1) * PAGE_SIZE, filteredMovements.length)} de {filteredMovements.length}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={movPage === 0} onClick={() => setMovPage(p => p - 1)}>Anterior</Button>
                  <Button variant="outline" size="sm" disabled={(movPage + 1) * PAGE_SIZE >= filteredMovements.length} onClick={() => setMovPage(p => p + 1)}>Siguiente</Button>
                </div>
              </div>
            )}
            {hasActiveFilters && filteredMovements.length === 0 && (
              <div className="text-center py-8">
                <div className="text-sm text-muted-foreground">No hay movimientos que coincidan con los filtros</div>
                <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2 text-xs">Limpiar filtros</Button>
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
            <CardTitle>Historial de Conciliaciones</CardTitle>
            {pendingRecon.length > 0 && (
              <Badge variant="warning">{pendingRecon.length} pendiente{pendingRecon.length > 1 ? 's' : ''}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {reconciliations.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-3 opacity-30"><Link2 size={28} className="mx-auto text-muted-foreground" /></div>
              <div className="text-sm text-muted-foreground">No hay conciliaciones registradas</div>
              <div className="text-xs text-muted-foreground mt-1">Las conciliaciones automáticas se generarán al sincronizar movimientos bancarios con el ERP</div>
            </div>
          ) : (
            <>
            <ScrollableTable>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Período', 'Cuenta', 'Saldo Banco', 'Saldo ERP', 'Diferencia', 'Coincidentes', 'Sin Match', 'Estado'].map(h => (
                      <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reconciliations.slice(recPage * PAGE_SIZE, (recPage + 1) * PAGE_SIZE).map((r: any) => {
                    const diff = Number(r.difference)
                    return (
                      <tr key={r.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="p-3 text-xs">{fmtDate(r.periodDate)}</td>
                        <td className="p-3 text-xs">{r.bankAccount?.alias || '—'}</td>
                        <td className="p-3 font-mono text-xs">{fmtEur(Number(r.bankBalance))}</td>
                        <td className="p-3 font-mono text-xs">{fmtEur(Number(r.erpBalance))}</td>
                        <td className={`p-3 font-mono text-xs font-semibold ${diff === 0 ? 'text-success' : 'text-destructive'}`}>
                          {diff === 0 ? '0 €' : fmtEur(diff)}
                        </td>
                        <td className="p-3 font-mono text-xs text-success">{r.matchedCount}</td>
                        <td className="p-3 font-mono text-xs text-warning">{r.unmatchedCount}</td>
                        <td className="p-3">
                          <Badge variant={r.status === 'COMPLETED' ? 'success' : r.status === 'IN_PROGRESS' ? 'warning' : 'secondary'}>
                            {r.status === 'COMPLETED' ? 'Completada' : r.status === 'IN_PROGRESS' ? 'En curso' : 'Pendiente'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollableTable>
            {reconciliations.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                <span className="text-xs text-muted-foreground">
                  {recPage * PAGE_SIZE + 1}–{Math.min((recPage + 1) * PAGE_SIZE, reconciliations.length)} de {reconciliations.length}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={recPage === 0} onClick={() => setRecPage(p => p - 1)}>Anterior</Button>
                  <Button variant="outline" size="sm" disabled={(recPage + 1) * PAGE_SIZE >= reconciliations.length} onClick={() => setRecPage(p => p + 1)}>Siguiente</Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
