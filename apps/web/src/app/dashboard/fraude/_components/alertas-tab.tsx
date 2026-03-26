'use client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, ShieldCheck, ShieldX } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { FraudAlert, severityConfig, alertTypeLabels } from './types'

interface AlertasTabProps {
  alerts: FraudAlert[]
  resolutions: Record<string, any>
  alertPage: number
  setAlertPage: React.Dispatch<React.SetStateAction<number>>
  actionAlert: string | null
  setActionAlert: React.Dispatch<React.SetStateAction<string | null>>
  actionNotes: string
  setActionNotes: React.Dispatch<React.SetStateAction<string>>
  saving: boolean
  handleResolve: (alertId: string, status: string) => void
  fmtDate: (d: string) => string
  fmtDateTime: (d: string) => string
  fmtEur: (n: number) => string
}

export function AlertasTab({
  alerts,
  resolutions,
  alertPage,
  setAlertPage,
  actionAlert,
  setActionAlert,
  actionNotes,
  setActionNotes,
  saving,
  handleResolve,
  fmtDate,
  fmtDateTime,
  fmtEur,
}: AlertasTabProps) {
  if (alerts.length === 0) {
    return (
      <EmptyState
        variant="alerts"
        title="No se han detectado alertas de fraude"
        description="El sistema analiza clientes, facturas y pagos en busca de anomalías"
      />
    )
  }

  return (
    <div className="space-y-3">
      {alerts.slice(alertPage * 10, (alertPage + 1) * 10).map(a => {
        const sev = severityConfig[a.severity] || severityConfig.LOW
        const res = resolutions[a.id]
        const isResolved = a.status === 'RESOLVED' || a.status === 'FALSE_POSITIVE'
        const isShowingAction = actionAlert === a.id
        return (
          <div key={a.id} className={`p-4 rounded-lg border ${isResolved ? 'border-border bg-card opacity-60' : a.severity === 'CRITICAL' ? 'border-destructive/30 bg-destructive/5' : a.severity === 'HIGH' ? 'border-destructive/20 bg-destructive/5' : 'border-border bg-card'}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={sev.variant}>{sev.label}</Badge>
                <Badge variant="secondary">{alertTypeLabels[a.type] || a.type}</Badge>
              </div>
              <Badge variant={a.status === 'OPEN' ? 'destructive' : a.status === 'INVESTIGATING' ? 'warning' : 'success'}>
                {a.status === 'OPEN' ? 'Abierta' : a.status === 'INVESTIGATING' ? 'Investigando' : a.status === 'FALSE_POSITIVE' ? 'Falso positivo' : 'Resuelta'}
              </Badge>
            </div>
            <div className="font-semibold text-sm mb-1">{a.title}</div>
            <div className="text-xs text-muted-foreground mb-2">{a.description}</div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {a.amount !== undefined && a.amount > 0 && (
                  <span>Importe: <span className="font-mono font-semibold text-foreground">{fmtEur(a.amount)}</span></span>
                )}
                <span>Detectada: {fmtDate(a.detectedAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {!isResolved && (
                  <>
                    {a.status !== 'INVESTIGATING' && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleResolve(a.id, 'INVESTIGATING')} disabled={saving}>
                        <Eye size={12} className="mr-1" />Investigar
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setActionAlert(isShowingAction ? null : a.id)} disabled={saving}>
                      <ShieldCheck size={12} className="mr-1" />Resolver
                    </Button>
                  </>
                )}
                {isResolved && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleResolve(a.id, 'OPEN')} disabled={saving}>
                    Reabrir
                  </Button>
                )}
              </div>
            </div>
            {/* Resolution panel */}
            {isShowingAction && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <Input
                  placeholder="Notas de resolución (opcional)..."
                  value={actionNotes}
                  onChange={e => setActionNotes(e.target.value)}
                  className="h-8 text-xs bg-muted border-border"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleResolve(a.id, 'RESOLVED')} disabled={saving}>
                    <ShieldCheck size={12} className="mr-1" />{saving ? 'Guardando...' : 'Marcar como resuelta'}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleResolve(a.id, 'FALSE_POSITIVE')} disabled={saving}>
                    <ShieldX size={12} className="mr-1" />Falso positivo
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setActionAlert(null); setActionNotes('') }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
            {/* Resolution info */}
            {res && isResolved && (
              <div className="mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                {a.status === 'FALSE_POSITIVE' ? 'Falso positivo' : 'Resuelta'} por <span className="font-medium text-foreground">{res.resolvedBy}</span> el {fmtDateTime(res.resolvedAt)}
                {res.notes && <span> — {res.notes}</span>}
              </div>
            )}
            {res && a.status === 'INVESTIGATING' && (
              <div className="mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                En investigación desde {fmtDateTime(res.updatedAt)}
                {res.notes && <span> — {res.notes}</span>}
              </div>
            )}
          </div>
        )
      })}
      {alerts.length > 10 && (
        <div className="flex items-center justify-center gap-2 pt-3">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={alertPage === 0} onClick={() => setAlertPage(p => p - 1)}>←</Button>
          {Array.from({ length: Math.ceil(alerts.length / 10) }, (_, i) => (
            <button key={i} onClick={() => setAlertPage(i)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${alertPage === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{i + 1}</button>
          ))}
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={alertPage >= Math.ceil(alerts.length / 10) - 1} onClick={() => setAlertPage(p => p + 1)}>→</Button>
          <span className="text-xs text-muted-foreground ml-2">{alertPage * 10 + 1}–{Math.min((alertPage + 1) * 10, alerts.length)} de {alerts.length}</span>
        </div>
      )}
    </div>
  )
}
