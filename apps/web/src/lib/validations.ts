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
