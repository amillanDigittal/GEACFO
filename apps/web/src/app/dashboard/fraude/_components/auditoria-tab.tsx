'use client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClipboardList } from 'lucide-react'
import { ScrollableTable } from '@/components/ui/scrollable-table'

interface AuditoriaTabProps {
  auditLog: any[]
  auditPage: number
  setAuditPage: React.Dispatch<React.SetStateAction<number>>
  fmtDateTime: (d: string) => string
}

export function AuditoriaTab({
  auditLog,
  auditPage,
  setAuditPage,
  fmtDateTime,
}: AuditoriaTabProps) {
  if (auditLog.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mb-3 opacity-30"><ClipboardList size={28} className="mx-auto text-muted-foreground" /></div>
        <div className="text-sm text-muted-foreground">No hay registros de auditoría</div>
        <div className="text-xs text-muted-foreground mt-1">Las acciones del sistema se registrarán aquí automáticamente</div>
      </div>
    )
  }

  return (
    <>
      <ScrollableTable>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Fecha', 'Usuario', 'Acción', 'Entidad', 'IP', 'Detalles'].map(h => (
                <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {auditLog.slice(auditPage * 10, (auditPage + 1) * 10).map((log: any) => (
              <tr key={log.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                <td className="p-3 text-xs text-muted-foreground">{fmtDateTime(log.createdAt)}</td>
                <td className="p-3 text-xs">{log.user?.email || '\u2014'}</td>
                <td className="p-3">
                  <Badge variant={log.action?.includes('DELETE') ? 'destructive' : log.action?.includes('CREATE') ? 'success' : 'secondary'}>
                    {log.action}
                  </Badge>
                </td>
                <td className="p-3 text-xs">{log.entity} {log.entityId ? `(${log.entityId.slice(0, 8)}...)` : ''}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{log.ipAddress || '\u2014'}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {log.oldValue || log.newValue ? 'Ver cambios' : '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>
      {auditLog.length > 10 && (
        <div className="flex items-center justify-center gap-2 p-3">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={auditPage === 0} onClick={() => setAuditPage(p => p - 1)}>←</Button>
          {Array.from({ length: Math.ceil(auditLog.length / 10) }, (_, i) => (
            <button key={i} onClick={() => setAuditPage(i)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${auditPage === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{i + 1}</button>
          ))}
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={auditPage >= Math.ceil(auditLog.length / 10) - 1} onClick={() => setAuditPage(p => p + 1)}>→</Button>
          <span className="text-xs text-muted-foreground ml-2">{auditPage * 10 + 1}–{Math.min((auditPage + 1) * 10, auditLog.length)} de {auditLog.length}</span>
        </div>
      )}
    </>
  )
}
