import { z } from 'zod'

// ── Login ───────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es obligatorio')
    .email('Formato de email inválido'),
  password: z
    .string()
    .min(1, 'La contraseña es obligatoria'),
})

export type LoginForm = z.infer<typeof loginSchema>

// ── Create user ─────────────────────────────────────────────────────
export const createUserSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  email: z
    .string()
    .min(1, 'El email es obligatorio')
    .email('Formato de email inválido'),
  role: z.enum(['ADMIN', 'CFO', 'CONTROLLER', 'ANALYST', 'VIEWER']),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
})

export type CreateUserForm = z.infer<typeof createUserSchema>

// ── Edit user (password optional) ───────────────────────────────────
export const editUserSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  email: z
    .string()
    .min(1, 'El email es obligatorio')
    .email('Formato de email inválido'),
  role: z.enum(['ADMIN', 'CFO', 'CONTROLLER', 'ANALYST', 'VIEWER']),
  password: z
    .string()
    .refine(val => val === '' || val.length >= 6, 'La contraseña debe tener al menos 6 caracteres')
    .refine(val => val === '' || /[A-Z]/.test(val), 'Debe contener al menos una mayúscula')
    .refine(val => val === '' || /[0-9]/.test(val), 'Debe contener al menos un número'),
})

export type EditUserForm = z.infer<typeof editUserSchema>

// ── Tenant settings ─────────────────────────────────────────────────
export const tenantSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'Máximo 100 caracteres'),
  nif: z.string().min(1, 'El NIF/CIF es obligatorio'),
  sector: z.string().optional(),
  currency: z.enum(['EUR', 'USD', 'GBP']),
  locale: z.enum(['es-ES', 'en-US', 'pt-BR']),
})

export type TenantForm = z.infer<typeof tenantSchema>

// ── Platform config ─────────────────────────────────────────────────
export const configSchema = z.object({
  kpiTargets: z.object({
    dsoTarget: z.number().min(1).max(120),
    dpoTarget: z.number().min(1).max(180),
    cccTarget: z.number().min(-30).max(120),
    ebitdaMarginTarget: z.number().min(0).max(100),
    liquidezMinima: z.number().min(0.1).max(5),
  }),
  covenantAlerts: z.object({
    warningThreshold: z.number().min(1).max(50),
    criticalThreshold: z.number().min(1).max(50),
  }),
  forecast: z.object({
    horizonWeeks: z.number().min(4).max(52),
    gapAlertEnabled: z.boolean(),
    scenarioDefault: z.enum(['BASE', 'CONSERVADOR', 'AGRESIVO']),
  }),
  scoring: z.object({
    alertScoreThreshold: z.number().min(0).max(100),
    riskAutoSuspend: z.boolean(),
  }),
  notifications: z.object({
    emailEnabled: z.boolean(),
    overdueAlertDays: z.number().min(1).max(90),
    apDueSoonDays: z.number().min(1).max(30),
  }),
})

export type ConfigForm = z.infer<typeof configSchema>

// ── CSV import ──────────────────────────────────────────────────────
const EXPECTED_HEADERS: Record<string, string[]> = {
  movimientos: ['fecha', 'concepto', 'importe', 'date', 'concept', 'amount'],
  facturas_cobrar: ['numero', 'cliente', 'fecha', 'vencimiento', 'total', 'number', 'customer', 'date', 'due_date', 'amount'],
  facturas_pagar: ['numero', 'proveedor', 'fecha', 'vencimiento', 'total', 'number', 'supplier', 'date', 'due_date', 'amount'],
  inventario: ['sku', 'nombre', 'stock', 'coste', 'name', 'quantity', 'cost'],
}

export function validateCSVHeaders(type: string, headers: string[]): { valid: boolean; missing: string[]; message?: string } {
  const expected = EXPECTED_HEADERS[type]
  if (!expected) return { valid: true, missing: [] }

  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/\s+/g, '_'))
  const hasAtLeastOne = expected.some(e => normalizedHeaders.includes(e))

  if (!hasAtLeastOne) {
    return {
      valid: false,
      missing: expected,
      message: `El CSV no contiene ninguna columna reconocida. Se esperan columnas como: ${expected.slice(0, 4).join(', ')}`,
    }
  }

  return { valid: true, missing: [] }
}
