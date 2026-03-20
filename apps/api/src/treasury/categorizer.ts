import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Rule-based patterns: keyword → category
const KEYWORD_RULES: { keywords: string[]; category: string }[] = [
  { keywords: ['cobro', 'cobro factura', 'ingreso cliente', 'pago recibido', 'abono'], category: 'COBRO' },
  { keywords: ['nomina', 'nómina', 'salario', 'sueldo', 'paga extra'], category: 'NOMINA' },
  { keywords: ['seguridad social', 'seg. social', 'tgss', 'cotizacion', 'cotización'], category: 'SS' },
  { keywords: ['irpf', 'iva', 'impuesto', 'hacienda', 'aeat', 'modelo 303', 'modelo 111', 'modelo 200', 'tributar'], category: 'IMPUESTO' },
  { keywords: ['seguro', 'póliza', 'poliza', 'mapfre', 'axa', 'allianz', 'zurich', 'prima seguro'], category: 'SEGURO' },
  { keywords: ['comisión', 'comision', 'mantenimiento cuenta', 'gastos bancarios', 'intereses deudores'], category: 'COMISION' },
  { keywords: ['transferencia entre', 'traspaso', 'movimiento interno', 'transfer'], category: 'TRANSFER' },
  { keywords: ['leasing', 'renting', 'cuota leasing', 'arrendamiento financiero'], category: 'LEASING' },
  { keywords: ['alquiler', 'renta local', 'renta oficina', 'arrendamiento'], category: 'ALQUILER' },
  { keywords: ['electricidad', 'gas natural', 'agua', 'suministro', 'iberdrola', 'endesa', 'naturgy', 'utilities', 'energía'], category: 'SUMINISTRO' },
  { keywords: ['devolución', 'devolucion', 'reembolso', 'abono proveedor'], category: 'DEVOLUCION' },
  { keywords: ['mantenimiento', 'reparación', 'reparacion', 'taller', 'flota'], category: 'MANT' },
  { keywords: ['pago factura', 'pago prov', 'pago a proveedor', 'transferencia prov'], category: 'PAGO_PROV' },
]

const CATEGORY_LABELS: Record<string, string> = {
  COBRO: 'Cobro de clientes',
  NOMINA: 'Nóminas',
  SS: 'Seguridad Social',
  IMPUESTO: 'Impuestos',
  SEGURO: 'Seguros',
  COMISION: 'Comisiones bancarias',
  TRANSFER: 'Transferencias internas',
  LEASING: 'Leasing / Renting',
  ALQUILER: 'Alquileres',
  SUMINISTRO: 'Suministros',
  DEVOLUCION: 'Devoluciones',
  MANT: 'Mantenimiento',
  PAGO_PROV: 'Pago a proveedores',
  OTHER: 'Otros',
}

/**
 * Categorize a single movement based on concept + counterparty text.
 * Returns { category, confidence, method }
 */
function categorizeByRules(concept: string, counterparty: string | null, amount: number): { category: string; confidence: number; method: string } {
  const text = `${concept} ${counterparty || ''}`.toLowerCase()

  // 1. Rule-based matching
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        return { category: rule.category, confidence: 85, method: 'keyword' }
      }
    }
  }

  // 2. Amount-based heuristics
  if (amount > 0) {
    return { category: 'COBRO', confidence: 50, method: 'amount_sign' }
  }

  // Negative amounts: default to PAGO_PROV
  return { category: 'PAGO_PROV', confidence: 40, method: 'default' }
}

/**
 * Learn patterns from already-categorized movements in the tenant.
 * Returns a map: normalized_counterparty → most_frequent_category
 */
async function learnPatterns(tenantId: string): Promise<Map<string, { category: string; count: number }>> {
  const categorized = await prisma.bankMovement.findMany({
    where: {
      bankAccount: { tenantId },
      category: { not: null },
      counterparty: { not: null },
    },
    select: { counterparty: true, category: true, concept: true },
  })

  // Build frequency map: counterparty → category → count
  const freqMap = new Map<string, Map<string, number>>()
  for (const m of categorized) {
    if (!m.counterparty || !m.category) continue
    const key = m.counterparty.toLowerCase().trim()
    if (!freqMap.has(key)) freqMap.set(key, new Map())
    const catMap = freqMap.get(key)!
    catMap.set(m.category, (catMap.get(m.category) || 0) + 1)
  }

  // Pick the most frequent category per counterparty
  const patterns = new Map<string, { category: string; count: number }>()
  for (const [key, catMap] of freqMap) {
    let bestCat = ''
    let bestCount = 0
    for (const [cat, count] of catMap) {
      if (count > bestCount) { bestCat = cat; bestCount = count }
    }
    if (bestCat) patterns.set(key, { category: bestCat, count: bestCount })
  }

  return patterns
}

/**
 * Categorize a movement using learned patterns + rules.
 */
function categorizeWithPatterns(
  concept: string,
  counterparty: string | null,
  amount: number,
  patterns: Map<string, { category: string; count: number }>,
): { category: string; confidence: number; method: string } {
  // 1. Check learned patterns first (highest confidence)
  if (counterparty) {
    const key = counterparty.toLowerCase().trim()
    const match = patterns.get(key)
    if (match) {
      return { category: match.category, confidence: Math.min(95, 70 + match.count * 5), method: 'learned' }
    }
    // Partial match: check if any pattern key is a substring
    for (const [patKey, patVal] of patterns) {
      if (key.includes(patKey) || patKey.includes(key)) {
        return { category: patVal.category, confidence: Math.min(85, 60 + patVal.count * 3), method: 'partial_match' }
      }
    }
  }

  // 2. Fall back to rule-based
  return categorizeByRules(concept, counterparty, amount)
}

/**
 * Auto-categorize a list of movements. Main entry point.
 */
export async function autoCategorize(
  tenantId: string,
  movements: { concept: string; counterparty: string | null; amount: number; category: string | null }[],
): Promise<{ concept: string; category: string; confidence: number; method: string }[]> {
  const patterns = await learnPatterns(tenantId)
  return movements.map(m => {
    // If already has a category, keep it
    if (m.category) {
      return { concept: m.concept, category: m.category, confidence: 100, method: 'user_provided' }
    }
    return {
      concept: m.concept,
      ...categorizeWithPatterns(m.concept, m.counterparty, m.amount, patterns),
    }
  })
}

/**
 * Re-categorize all uncategorized movements for a tenant.
 */
export async function recategorizeUncategorized(tenantId: string): Promise<{ updated: number; total: number }> {
  const uncategorized = await prisma.bankMovement.findMany({
    where: { bankAccount: { tenantId }, category: null },
    select: { id: true, concept: true, counterparty: true, amount: true },
  })

  if (uncategorized.length === 0) return { updated: 0, total: 0 }

  const patterns = await learnPatterns(tenantId)
  let updated = 0

  for (const m of uncategorized) {
    const result = categorizeWithPatterns(m.concept, m.counterparty, Number(m.amount), patterns)
    if (result.confidence >= 50) {
      await prisma.bankMovement.update({
        where: { id: m.id },
        data: { category: result.category },
      })
      updated++
    }
  }

  return { updated, total: uncategorized.length }
}

/**
 * Get category distribution stats.
 */
export async function getCategoryStats(tenantId: string) {
  const movements = await prisma.bankMovement.findMany({
    where: { bankAccount: { tenantId } },
    select: { category: true, amount: true },
  })

  const stats: Record<string, { count: number; totalAmount: number; label: string }> = {}
  let uncategorized = 0

  for (const m of movements) {
    const cat = m.category || 'OTHER'
    if (!m.category) uncategorized++
    if (!stats[cat]) stats[cat] = { count: 0, totalAmount: 0, label: CATEGORY_LABELS[cat] || cat }
    stats[cat].count++
    stats[cat].totalAmount += Number(m.amount)
  }

  return {
    categories: Object.entries(stats).map(([key, val]) => ({ category: key, ...val })).sort((a, b) => b.count - a.count),
    total: movements.length,
    uncategorized,
    labels: CATEGORY_LABELS,
  }
}
