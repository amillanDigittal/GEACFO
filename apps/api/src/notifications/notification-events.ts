export interface NotificationEvent {
  tenantId: string
  type: 'invoice_created' | 'payment_approved' | 'payment_rejected' | 'covenant_risk' | 'alert_resolved'
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  link: string
  data?: Record<string, any>
  timestamp: string
}

export const NOTIFICATION_EVENTS = {
  INVOICE_CREATED: 'notification.invoice_created',
  PAYMENT_APPROVED: 'notification.payment_approved',
  PAYMENT_REJECTED: 'notification.payment_rejected',
  COVENANT_RISK: 'notification.covenant_risk',
  ALERT_RESOLVED: 'notification.alert_resolved',
} as const
