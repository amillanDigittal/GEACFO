export type TabKey = 'alertas' | 'anomalias' | 'audit'

export interface FraudAlert {
  id: string
  type: 'CUSTOMER_RISK' | 'OVERDUE_CONCENTRATION' | 'CREDIT_EXCEEDED' | 'PAYMENT_ANOMALY' | 'DUPLICATE_INVOICE'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  description: string
  entity: string
  entityId: string
  amount?: number
  detectedAt: string
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE'
}

export interface Anomaly {
  id: string
  type: string
  description: string
  invoiceNumber: string
  entity: string
  amount: number
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  detectedAt: string
  invoiceIds?: string[]
  actionable?: boolean
}

export const severityConfig: Record<string, { label: string; variant: 'destructive' | 'warning' | 'secondary' }> = {
  CRITICAL: { label: 'Crítica', variant: 'destructive' },
  HIGH: { label: 'Alta', variant: 'destructive' },
  MEDIUM: { label: 'Media', variant: 'warning' },
  LOW: { label: 'Baja', variant: 'secondary' },
}

export const alertTypeLabels: Record<string, string> = {
  CUSTOMER_RISK: 'Riesgo Cliente',
  OVERDUE_CONCENTRATION: 'Concentración Impagos',
  CREDIT_EXCEEDED: 'Crédito Excedido',
  PAYMENT_ANOMALY: 'Anomalía Pagos',
  DUPLICATE_INVOICE: 'Factura Duplicada',
}

export function daysDiff(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}
