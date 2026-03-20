import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { autoCategorize } from '../treasury/categorizer'
const prisma = new PrismaClient()

function parseDecimal(v: any): number {
  if (v == null || v === '') return 0
  const s = String(v).replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.round(n * 100) / 100
}

function parseDate(v: any): Date {
  if (!v) return new Date()
  const s = String(v).trim()
  // Try DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`)
  // Try YYYY-MM-DD or ISO
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  return new Date()
}

@Injectable()
export class ImportService {
  async importBankMovements(tenantId: string, data: { accountAlias: string; rows: any[] }) {
    const account = await prisma.bankAccount.findFirst({
      where: { tenantId, alias: { contains: data.accountAlias, mode: 'insensitive' } },
    })
    if (!account) {
      // List available accounts for error message
      const accounts = await prisma.bankAccount.findMany({ where: { tenantId }, select: { alias: true } })
      throw new BadRequestException(`Cuenta "${data.accountAlias}" no encontrada. Disponibles: ${accounts.map(a => a.alias).join(', ')}`)
    }

    const movements = data.rows.map(r => ({
      bankAccountId: account.id,
      date: parseDate(r.fecha || r.date),
      concept: String(r.concepto || r.concept || r.descripcion || r.description || ''),
      amount: parseDecimal(r.importe || r.amount || r.monto),
      balance: parseDecimal(r.saldo || r.balance || 0),
      category: r.categoria || r.category || null,
      reference: r.referencia || r.reference || null,
      counterparty: r.contraparte || r.counterparty || r.beneficiario || null,
    }))

    const valid = movements.filter(m => m.concept && m.amount !== 0)
    if (valid.length === 0) throw new BadRequestException('No se encontraron movimientos válidos. Columnas requeridas: fecha, concepto, importe')

    // Auto-categorize movements that don't have a category
    const categorized = await autoCategorize(
      tenantId,
      valid.map(m => ({ concept: m.concept, counterparty: m.counterparty, amount: m.amount, category: m.category })),
    )
    const enriched = valid.map((m, i) => ({ ...m, category: m.category || categorized[i].category }))

    const result = await prisma.bankMovement.createMany({ data: enriched })
    const autoCategorizedCount = valid.filter((m, i) => !m.category && categorized[i].category).length
    return { imported: result.count, skipped: movements.length - valid.length, total: data.rows.length, autoCategorized: autoCategorizedCount }
  }

  async importInvoicesAR(tenantId: string, rows: any[]) {
    const customers = await prisma.customer.findMany({ where: { tenantId } })
    const custMap = new Map(customers.map(c => [c.code.toUpperCase(), c.id]))
    const custNameMap = new Map(customers.map(c => [c.name.toUpperCase(), c.id]))

    const results = { imported: 0, skipped: 0, errors: [] as string[] }

    for (const r of rows) {
      try {
        const custKey = String(r.cliente || r.customer || r.codigo_cliente || r.customer_code || '').toUpperCase()
        const customerId = custMap.get(custKey) || custNameMap.get(custKey)
        if (!customerId) { results.errors.push(`Cliente "${custKey}" no encontrado`); results.skipped++; continue }

        const number = String(r.numero || r.number || r.factura || '')
        if (!number) { results.skipped++; continue }

        const amount = parseDecimal(r.base || r.amount || r.importe)
        const taxAmount = parseDecimal(r.iva || r.tax || r.impuesto || amount * 0.21)
        const totalAmount = parseDecimal(r.total || r.totalAmount || amount + taxAmount)
        const paidAmount = parseDecimal(r.pagado || r.paid || r.paidAmount || 0)

        await prisma.invoiceAR.create({
          data: {
            tenantId, customerId, number,
            issueDate: parseDate(r.fecha || r.fecha_emision || r.issueDate || r.date),
            dueDate: parseDate(r.vencimiento || r.fecha_vencimiento || r.dueDate),
            amount, taxAmount, totalAmount, paidAmount,
            status: paidAmount >= totalAmount ? 'PAID' : new Date(parseDate(r.vencimiento || r.dueDate)) < new Date() ? 'OVERDUE' : 'PENDING',
          },
        })
        results.imported++
      } catch (e: any) {
        if (e.code === 'P2002') results.errors.push(`Factura duplicada: ${r.numero || r.number}`)
        else results.errors.push(e.message?.slice(0, 100))
        results.skipped++
      }
    }
    return results
  }

  async importInvoicesAP(tenantId: string, rows: any[]) {
    const suppliers = await prisma.supplier.findMany({ where: { tenantId } })
    const suppMap = new Map(suppliers.map(s => [s.code.toUpperCase(), s.id]))
    const suppNameMap = new Map(suppliers.map(s => [s.name.toUpperCase(), s.id]))

    const results = { imported: 0, skipped: 0, errors: [] as string[] }

    for (const r of rows) {
      try {
        const suppKey = String(r.proveedor || r.supplier || r.codigo_proveedor || r.supplier_code || '').toUpperCase()
        const supplierId = suppMap.get(suppKey) || suppNameMap.get(suppKey)
        if (!supplierId) { results.errors.push(`Proveedor "${suppKey}" no encontrado`); results.skipped++; continue }

        const number = String(r.numero || r.number || r.factura || '')
        if (!number) { results.skipped++; continue }

        const amount = parseDecimal(r.base || r.amount || r.importe)
        const taxAmount = parseDecimal(r.iva || r.tax || r.impuesto || amount * 0.21)
        const totalAmount = parseDecimal(r.total || r.totalAmount || amount + taxAmount)

        await prisma.invoiceAP.create({
          data: {
            tenantId, supplierId, number,
            issueDate: parseDate(r.fecha || r.fecha_emision || r.issueDate || r.date),
            dueDate: parseDate(r.vencimiento || r.fecha_vencimiento || r.dueDate),
            amount, taxAmount, totalAmount,
            status: 'PENDING_APPROVAL',
          },
        })
        results.imported++
      } catch (e: any) {
        if (e.code === 'P2002') results.errors.push(`Factura duplicada: ${r.numero || r.number}`)
        else results.errors.push(e.message?.slice(0, 100))
        results.skipped++
      }
    }
    return results
  }

  async importInventory(tenantId: string, rows: any[]) {
    const results = { imported: 0, updated: 0, skipped: 0, errors: [] as string[] }

    for (const r of rows) {
      try {
        const sku = String(r.sku || r.codigo || r.code || '').trim()
        if (!sku) { results.skipped++; continue }

        const stock = parseDecimal(r.stock || r.cantidad || r.quantity)
        const unitCost = parseDecimal(r.coste || r.coste_unitario || r.unitCost || r.cost)
        const totalValue = parseDecimal(r.valor || r.totalValue || stock * unitCost)

        const existing = await prisma.inventoryItem.findUnique({
          where: { tenantId_sku: { tenantId, sku } },
        })

        if (existing) {
          await prisma.inventoryItem.update({
            where: { id: existing.id },
            data: {
              description: r.descripcion || r.description || existing.description,
              stock, unitCost, totalValue,
              rotationDays: r.rotacion || r.rotationDays ? parseInt(r.rotacion || r.rotationDays) : existing.rotationDays,
              warehouse: r.almacen || r.warehouse || existing.warehouse,
            },
          })
          results.updated++
        } else {
          await prisma.inventoryItem.create({
            data: {
              tenantId, sku,
              description: String(r.descripcion || r.description || r.nombre || sku),
              stock, unitCost, totalValue,
              rotationDays: r.rotacion || r.rotationDays ? parseInt(r.rotacion || r.rotationDays) : null,
              warehouse: r.almacen || r.warehouse || null,
            },
          })
          results.imported++
        }
      } catch (e: any) {
        results.errors.push(e.message?.slice(0, 100))
        results.skipped++
      }
    }
    return results
  }

  async getTemplates() {
    return {
      movimientos: {
        columns: ['fecha', 'concepto', 'importe', 'saldo', 'referencia', 'contraparte', 'categoria'],
        example: [{ fecha: '15/03/2026', concepto: 'Cobro factura F-001', importe: 15000, saldo: 555000, referencia: 'F-001', contraparte: 'Cliente SA', categoria: 'COBRO' }],
      },
      facturas_cobrar: {
        columns: ['numero', 'cliente', 'fecha', 'vencimiento', 'base', 'iva', 'total', 'pagado'],
        example: [{ numero: 'F-2026-0500', cliente: 'CLI-001', fecha: '01/03/2026', vencimiento: '01/04/2026', base: 10000, iva: 2100, total: 12100, pagado: 0 }],
      },
      facturas_pagar: {
        columns: ['numero', 'proveedor', 'fecha', 'vencimiento', 'base', 'iva', 'total'],
        example: [{ numero: 'PF-100', proveedor: 'PRV-001', fecha: '01/03/2026', vencimiento: '01/04/2026', base: 5000, iva: 1050, total: 6050 }],
      },
      inventario: {
        columns: ['sku', 'descripcion', 'stock', 'coste_unitario', 'valor', 'rotacion', 'almacen'],
        example: [{ sku: 'SKU-100', descripcion: 'Componente X', stock: 500, coste_unitario: 25, valor: 12500, rotacion: 30, almacen: 'Madrid' }],
      },
    }
  }
}
