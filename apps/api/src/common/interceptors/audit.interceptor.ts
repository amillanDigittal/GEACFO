import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable, tap } from 'rxjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Map route patterns to human-readable actions
const ACTION_MAP: Record<string, { action: string; entity: string }> = {
  // Treasury
  'PATCH /api/v1/treasury/ap/:id/approve': { action: 'APPROVE', entity: 'InvoiceAP' },
  'POST /api/v1/treasury/ap/approve-batch': { action: 'APPROVE_BATCH', entity: 'InvoiceAP' },
  'PATCH /api/v1/treasury/ap/:id/reject': { action: 'REJECT', entity: 'InvoiceAP' },
  'POST /api/v1/treasury/movements/recategorize': { action: 'RECATEGORIZE', entity: 'BankMovement' },
  'PATCH /api/v1/treasury/movements/:id/reconcile': { action: 'RECONCILE', entity: 'BankMovement' },
  'POST /api/v1/treasury/movements/reconcile-batch': { action: 'RECONCILE_BATCH', entity: 'BankMovement' },
  // Users
  'POST /api/v1/users': { action: 'CREATE', entity: 'User' },
  'PATCH /api/v1/users/:id': { action: 'UPDATE', entity: 'User' },
  'DELETE /api/v1/users/:id': { action: 'DELETE', entity: 'User' },
  // Settings
  'PATCH /api/v1/settings/tenant': { action: 'UPDATE', entity: 'Tenant' },
  'PATCH /api/v1/settings/config': { action: 'UPDATE', entity: 'TenantConfig' },
  // Suppliers
  'POST /api/v1/suppliers': { action: 'CREATE', entity: 'Supplier' },
  'PATCH /api/v1/suppliers/:id': { action: 'UPDATE', entity: 'Supplier' },
  'DELETE /api/v1/suppliers/:id': { action: 'DELETE', entity: 'Supplier' },
  'POST /api/v1/suppliers/:id/recalculate': { action: 'RECALCULATE_SCORE', entity: 'Supplier' },
  'POST /api/v1/suppliers/recalculate-all': { action: 'RECALCULATE_ALL', entity: 'Supplier' },
  // Customers
  'POST /api/v1/customers/:id/recalculate-score': { action: 'RECALCULATE_SCORE', entity: 'Customer' },
  // Budget
  'POST /api/v1/budget/lines': { action: 'UPDATE', entity: 'BudgetLine' },
  'POST /api/v1/budget/init': { action: 'INIT', entity: 'BudgetLine' },
  // Provisions
  'POST /api/v1/provisions/snapshot': { action: 'CREATE_SNAPSHOT', entity: 'ProvisionSnapshot' },
  // Reporting
  'POST /api/v1/reporting/schedules': { action: 'CREATE', entity: 'ReportSchedule' },
  'PATCH /api/v1/reporting/schedules/:id': { action: 'UPDATE', entity: 'ReportSchedule' },
  'DELETE /api/v1/reporting/schedules/:id': { action: 'DELETE', entity: 'ReportSchedule' },
  'POST /api/v1/reporting/schedules/:id/send': { action: 'SEND', entity: 'ReportSchedule' },
  // Alerts
  'POST /api/v1/alerts/resolutions': { action: 'RESOLVE', entity: 'AlertResolution' },
  // Auth
  'POST /api/v1/auth/login': { action: 'LOGIN', entity: 'Session' },
  // Import
  'POST /api/v1/import/movements': { action: 'IMPORT', entity: 'BankMovement' },
  'POST /api/v1/import/invoices-ar': { action: 'IMPORT', entity: 'InvoiceAR' },
  'POST /api/v1/import/invoices-ap': { action: 'IMPORT', entity: 'InvoiceAP' },
  'POST /api/v1/import/inventory': { action: 'IMPORT', entity: 'InventoryItem' },
}

function normalizeRoute(method: string, url: string): string {
  // Remove query strings
  const path = url.split('?')[0]
  // Replace cuid-like IDs with :id
  const normalized = path.replace(/\/[a-z0-9]{20,30}/g, '/:id')
  return `${method} ${normalized}`
}

function extractEntityId(url: string): string | undefined {
  const parts = url.split('?')[0].split('/')
  // Look for cuid-like segments
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^[a-z0-9]{20,30}$/.test(parts[i])) return parts[i]
  }
  return undefined
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest()
    const method = req.method
    const url = req.originalUrl || req.url

    // Only audit write operations
    if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
      return next.handle()
    }

    const routeKey = normalizeRoute(method, url)
    const mapping = ACTION_MAP[routeKey]

    // Skip unmapped routes
    if (!mapping) {
      return next.handle()
    }

    const tenantId = req.user?.tenantId
    const userId = req.user?.userId
    const entityId = extractEntityId(url)
    const startBody = req.body ? { ...req.body } : undefined

    // Redact sensitive fields
    if (startBody?.password) startBody.password = '***'

    return next.handle().pipe(
      tap({
        next: (result) => {
          // Fire and forget — don't block the response
          this.log(tenantId, userId, mapping.action, mapping.entity, entityId, startBody, result, req).catch(() => {})
        },
        error: (err) => {
          this.log(tenantId, userId, `${mapping.action}_FAILED`, mapping.entity, entityId, startBody, { error: err.message }, req).catch(() => {})
        },
      }),
    )
  }

  private async log(
    tenantId: string | undefined,
    userId: string | undefined,
    action: string,
    entity: string,
    entityId: string | undefined,
    oldValue: any,
    newValue: any,
    req: any,
  ) {
    if (!tenantId) return
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: userId || null,
          action,
          entity,
          entityId: entityId || (newValue?.id as string) || null,
          oldValue: oldValue || undefined,
          newValue: newValue ? this.sanitize(newValue) : undefined,
          ipAddress: req.headers?.['x-forwarded-for'] || req.ip || null,
          userAgent: req.headers?.['user-agent'] || null,
        },
      })
    } catch {
      // Silent fail — audit should never break the app
    }
  }

  private sanitize(val: any): any {
    if (!val || typeof val !== 'object') return val
    // Truncate large responses to avoid bloating the audit table
    const str = JSON.stringify(val)
    if (str.length > 5000) {
      const { id, email, name, status, count, updated, deleted, initialized } = val
      return { id, email, name, status, count, updated, deleted, initialized, _truncated: true }
    }
    return val
  }
}
