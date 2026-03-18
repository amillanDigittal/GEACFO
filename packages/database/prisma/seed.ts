import { PrismaClient, UserRole, RiskLevel, CustomerStatus, DebtType, StockStatus, CovenantLimit, DataSourceType } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'grupo-iberico' },
    update: {},
    create: {
      name: 'Grupo Ibérico SA',
      nif: 'B-12345678',
      sector: 'Industria & Distribución',
      slug: 'grupo-iberico',
    },
  })

  // User (CFO)
  const hashedPassword = await bcrypt.hash('geacfo2026', 10)
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'ana.castro@grupoiberico.es' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'ana.castro@grupoiberico.es',
      name: 'Ana Castro',
      role: UserRole.CFO,
      password: hashedPassword,
    },
  })

  // Bank Accounts
  const accounts = [
    { bankName: 'BBVA', iban: 'ES91 0182 0000 0000 1234 1234', alias: 'BBVA Principal', balance: 540000 },
    { bankName: 'Santander', iban: 'ES80 0049 0000 0000 5678 5678', alias: 'Santander Empresas', balance: 380000 },
    { bankName: 'CaixaBank', iban: 'ES76 2100 0000 0000 9012 9012', alias: 'CaixaBank Línea', balance: 245000 },
    { bankName: 'Sabadell', iban: 'ES38 0081 0000 0000 3456 3456', alias: 'Sabadell Leasing', balance: 80000 },
  ]
  for (const acc of accounts) {
    await prisma.bankAccount.create({ data: { tenantId: tenant.id, currency: 'EUR', ...acc } })
  }

  // Customers
  const customers = [
    { code: 'CLI-001', name: 'Industrias Químicas del Norte', creditLimit: 500000, creditScore: 85, riskLevel: RiskLevel.LOW, dso: 38, status: CustomerStatus.ACTIVE },
    { code: 'CLI-002', name: 'Distribuidora Nacional SA', creditLimit: 400000, creditScore: 92, riskLevel: RiskLevel.VERY_LOW, dso: 31, status: CustomerStatus.ACTIVE },
    { code: 'CLI-003', name: 'Tecnología Avanzada SL', creditLimit: 250000, creditScore: 78, riskLevel: RiskLevel.LOW, dso: 45, status: CustomerStatus.ACTIVE },
    { code: 'CLI-004', name: 'Consultores Estratégicos', creditLimit: 150000, creditScore: 55, riskLevel: RiskLevel.HIGH, dso: 62, status: CustomerStatus.ALERT },
    { code: 'CLI-005', name: 'Alimentación Gourmet SA', creditLimit: 200000, creditScore: 65, riskLevel: RiskLevel.MEDIUM, dso: 52, status: CustomerStatus.ACTIVE },
  ]
  const createdCustomers: any[] = []
  for (const c of customers) {
    const cust = await prisma.customer.create({ data: { tenantId: tenant.id, ...c } })
    createdCustomers.push(cust)
  }

  // Suppliers
  const suppliers = [
    { code: 'PRV-001', name: 'Aceros del Norte SL', paymentTerms: 30 },
    { code: 'PRV-002', name: 'Logística Express', paymentTerms: 45 },
    { code: 'PRV-003', name: 'Suministros Industriales', paymentTerms: 30 },
    { code: 'PRV-004', name: 'Energía & Utilities SA', paymentTerms: 30 },
    { code: 'PRV-005', name: 'Consultoría Tech', paymentTerms: 15 },
  ]
  const createdSuppliers: any[] = []
  for (const s of suppliers) {
    const sup = await prisma.supplier.create({ data: { tenantId: tenant.id, ...s } })
    createdSuppliers.push(sup)
  }

  // Invoices AR
  const now = new Date()
  await prisma.invoiceAR.createMany({
    data: [
      { tenantId: tenant.id, customerId: createdCustomers[0].id, number: 'F-2026-0312', issueDate: new Date('2026-02-15'), dueDate: new Date('2026-04-01'), amount: 48500, taxAmount: 10185, totalAmount: 58685, status: 'PENDING' },
      { tenantId: tenant.id, customerId: createdCustomers[1].id, number: 'F-2026-0318', issueDate: new Date('2026-02-20'), dueDate: new Date('2026-03-22'), amount: 32100, taxAmount: 6741, totalAmount: 38841, status: 'OVERDUE' },
      { tenantId: tenant.id, customerId: createdCustomers[2].id, number: 'F-2026-0325', issueDate: new Date('2026-02-28'), dueDate: new Date('2026-03-30'), amount: 18750, taxAmount: 3937.5, totalAmount: 22687.5, status: 'PENDING' },
      { tenantId: tenant.id, customerId: createdCustomers[3].id, number: 'F-2026-0298', issueDate: new Date('2026-01-20'), dueDate: new Date('2026-02-20'), amount: 24300, taxAmount: 5103, totalAmount: 29403, status: 'OVERDUE' },
      { tenantId: tenant.id, customerId: createdCustomers[4].id, number: 'F-2026-0330', issueDate: new Date('2026-03-01'), dueDate: new Date('2026-04-15'), amount: 11200, taxAmount: 2352, totalAmount: 13552, status: 'PENDING' },
    ]
  })

  // Invoices AP
  await prisma.invoiceAP.createMany({
    data: [
      { tenantId: tenant.id, supplierId: createdSuppliers[0].id, number: 'PF-456', issueDate: new Date('2026-02-10'), dueDate: new Date('2026-03-12'), amount: 62400, taxAmount: 13104, totalAmount: 75504, status: 'APPROVED', priority: 'HIGH' },
      { tenantId: tenant.id, supplierId: createdSuppliers[1].id, number: 'PF-891', issueDate: new Date('2026-02-18'), dueDate: new Date('2026-04-02'), amount: 18900, taxAmount: 3969, totalAmount: 22869, status: 'APPROVED', priority: 'NORMAL' },
      { tenantId: tenant.id, supplierId: createdSuppliers[2].id, number: 'PF-334', issueDate: new Date('2026-02-22'), dueDate: new Date('2026-03-25'), amount: 34500, taxAmount: 7245, totalAmount: 41745, status: 'IN_REVIEW', priority: 'HIGH' },
      { tenantId: tenant.id, supplierId: createdSuppliers[3].id, number: 'PF-112', issueDate: new Date('2026-03-01'), dueDate: new Date('2026-04-01'), amount: 8750, taxAmount: 1837.5, totalAmount: 10587.5, status: 'APPROVED', priority: 'NORMAL' },
      { tenantId: tenant.id, supplierId: createdSuppliers[4].id, number: 'PF-789', issueDate: new Date('2026-02-25'), dueDate: new Date('2026-03-28'), amount: 22000, taxAmount: 4620, totalAmount: 26620, status: 'APPROVED', priority: 'LOW' },
    ]
  })

  // Debt Instruments
  const debt1 = await prisma.debtInstrument.create({
    data: {
      tenantId: tenant.id, type: DebtType.SYNDICATED_LOAN, bank: 'BBVA + Santander',
      totalAmount: 2500000, outstanding: 1620000, interestRate: 0.0425,
      maturityDate: new Date('2028-06-30'), amortization: 'Semestral 90.000€'
    }
  })
  await prisma.debtInstrument.create({
    data: {
      tenantId: tenant.id, type: DebtType.CREDIT_LINE, bank: 'CaixaBank',
      totalAmount: 500000, outstanding: 320000, interestRate: 0.038,
      maturityDate: new Date('2026-12-31'), amortization: 'Bullet vencimiento'
    }
  })
  await prisma.debtInstrument.create({
    data: {
      tenantId: tenant.id, type: DebtType.LEASING, bank: 'Sabadell Leasing',
      totalAmount: 400000, outstanding: 240000, interestRate: 0.051,
      maturityDate: new Date('2027-09-30'), amortization: 'Mensual 8.333€'
    }
  })

  // Covenants
  await prisma.covenant.createMany({
    data: [
      { tenantId: tenant.id, debtInstrumentId: debt1.id, name: 'Net Debt / EBITDA', formula: '(TotalDeuda - Caja) / EBITDA', currentValue: 1.8, limitValue: 3.0, limitType: CovenantLimit.MAX, status: 'COMPLIANT', margin: 40, trend: 'IMPROVING' },
      { tenantId: tenant.id, debtInstrumentId: debt1.id, name: 'DSCR', formula: 'EBITDA / ServicioDeuda', currentValue: 1.45, limitValue: 1.2, limitType: CovenantLimit.MIN, status: 'COMPLIANT', margin: 21, trend: 'STABLE' },
      { tenantId: tenant.id, name: "Liquidez Mínima", formula: "Caja + Equivalentes", currentValue: 1245, limitValue: 500, limitType: CovenantLimit.MIN, status: "COMPLIANT", margin: 149, trend: "IMPROVING" },
      { tenantId: tenant.id, name: 'Ratio Cobertura', formula: 'ActivosCorrientes / PasivosCorrientes', currentValue: 2.8, limitValue: 2.0, limitType: CovenantLimit.MIN, status: 'COMPLIANT', margin: 40, trend: 'IMPROVING' },
    ]
  })

  // Inventory
  await prisma.inventoryItem.createMany({
    data: [
      { tenantId: tenant.id, sku: 'SKU-001', description: 'Componente Industrial A-200', stock: 450, unitCost: 85, totalValue: 38250, rotationDays: 42, status: StockStatus.NORMAL },
      { tenantId: tenant.id, sku: 'SKU-002', description: 'Materia Prima B-110', stock: 1200, unitCost: 12, totalValue: 14400, rotationDays: 21, status: StockStatus.NORMAL },
      { tenantId: tenant.id, sku: 'SKU-003', description: 'Producto Terminado C-450', stock: 89, unitCost: 340, totalValue: 30260, rotationDays: 180, status: StockStatus.OBSOLETE },
      { tenantId: tenant.id, sku: 'SKU-004', description: 'Repuesto Maquinaria D-7', stock: 34, unitCost: 560, totalValue: 19040, rotationDays: 15, status: StockStatus.CRITICAL },
      { tenantId: tenant.id, sku: 'SKU-005', description: 'Embalaje Premium E-20', stock: 3400, unitCost: 2.5, totalValue: 8500, rotationDays: 28, status: StockStatus.NORMAL },
    ]
  })

  // Forecast Weeks
  const weekData = [
    { w: 1, cobros: 285, pagos: 210 }, { w: 2, cobros: 310, pagos: 245 },
    { w: 3, cobros: 195, pagos: 220 }, { w: 4, cobros: 340, pagos: 180 },
    { w: 5, cobros: 260, pagos: 290 }, { w: 6, cobros: 320, pagos: 215 },
    { w: 7, cobros: 280, pagos: 260 }, { w: 8, cobros: 189, pagos: 290 },
    { w: 9, cobros: 350, pagos: 195 }, { w: 10, cobros: 290, pagos: 240 },
    { w: 11, cobros: 310, pagos: 225 }, { w: 12, cobros: 275, pagos: 210 },
    { w: 13, cobros: 340, pagos: 230 },
  ]
  let cumBalance = 1245
  for (const wd of weekData) {
    const net = wd.cobros - wd.pagos
    cumBalance += net
    const weekStart = new Date('2026-03-05')
    weekStart.setDate(weekStart.getDate() + (wd.w - 1) * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    await prisma.forecastWeek.create({
      data: {
        tenantId: tenant.id, scenario: 'BASE', weekNumber: wd.w,
        weekStart, weekEnd, inflows: wd.cobros, outflows: wd.pagos,
        netCash: net, cumBalance, confidence: Math.max(68, 96 - wd.w * 2.15),
        isGap: net < 0
      }
    })
  }

  // Forecast Weeks — CONSERVADOR (cobros −15%, pagos +10%)
  let cumBalanceCons = 1245
  for (const wd of weekData) {
    const cobros = Math.round(wd.cobros * 0.85)
    const pagos = Math.round(wd.pagos * 1.10)
    const net = cobros - pagos
    cumBalanceCons += net
    const weekStart = new Date('2026-03-05')
    weekStart.setDate(weekStart.getDate() + (wd.w - 1) * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    await prisma.forecastWeek.create({
      data: {
        tenantId: tenant.id, scenario: 'CONSERVADOR', weekNumber: wd.w,
        weekStart, weekEnd, inflows: cobros, outflows: pagos,
        netCash: net, cumBalance: cumBalanceCons, confidence: Math.max(60, 90 - wd.w * 2.5),
        isGap: net < 0
      }
    })
  }

  // Forecast Weeks — AGRESIVO (cobros +15%, pagos −5%)
  let cumBalanceAgr = 1245
  for (const wd of weekData) {
    const cobros = Math.round(wd.cobros * 1.15)
    const pagos = Math.round(wd.pagos * 0.95)
    const net = cobros - pagos
    cumBalanceAgr += net
    const weekStart = new Date('2026-03-05')
    weekStart.setDate(weekStart.getDate() + (wd.w - 1) * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    await prisma.forecastWeek.create({
      data: {
        tenantId: tenant.id, scenario: 'AGRESIVO', weekNumber: wd.w,
        weekStart, weekEnd, inflows: cobros, outflows: pagos,
        netCash: net, cumBalance: cumBalanceAgr, confidence: Math.max(55, 85 - wd.w * 2.8),
        isGap: net < 0
      }
    })
  }

  // Bank Movements
  const bankAccounts = await prisma.bankAccount.findMany({ where: { tenantId: tenant.id } })
  const accMap: Record<string, string> = {}
  for (const a of bankAccounts) accMap[a.bankName] = a.id

  const movements = [
    // BBVA
    { accKey: 'BBVA', date: '2026-03-11', concept: 'Cobro factura F-2026-0312', amount: 58685, balance: 540000, category: 'COBRO', reference: 'F-2026-0312', counterparty: 'Industrias Químicas del Norte', reconciled: true },
    { accKey: 'BBVA', date: '2026-03-10', concept: 'Pago nóminas marzo', amount: -42300, balance: 481315, category: 'NOMINA', reference: 'NOM-2026-03', counterparty: 'Empleados', reconciled: true },
    { accKey: 'BBVA', date: '2026-03-07', concept: 'Pago factura PF-456 Aceros', amount: -75504, balance: 523615, category: 'PAGO_PROV', reference: 'PF-456', counterparty: 'Aceros del Norte SL', reconciled: true },
    { accKey: 'BBVA', date: '2026-03-06', concept: 'Cobro factura F-2026-0298', amount: 29403, balance: 599119, category: 'COBRO', reference: 'F-2026-0298', counterparty: 'Consultores Estratégicos', reconciled: false },
    { accKey: 'BBVA', date: '2026-03-05', concept: 'Pago seguro RC anual', amount: -8200, balance: 569716, category: 'SEGURO', reference: 'SEG-2026-RC', counterparty: 'Mapfre Empresas', reconciled: true },
    { accKey: 'BBVA', date: '2026-03-04', concept: 'Comisión mantenimiento cuenta', amount: -45, balance: 577916, category: 'COMISION', reference: 'COM-03-2026', counterparty: 'BBVA', reconciled: true },
    { accKey: 'BBVA', date: '2026-03-03', concept: 'Transferencia entre cuentas', amount: -25000, balance: 577961, category: 'TRANSFER', reference: 'TRF-INT-001', counterparty: 'CaixaBank Línea', reconciled: true },
    { accKey: 'BBVA', date: '2026-02-28', concept: 'Cobro factura F-2026-0318', amount: 38841, balance: 602961, category: 'COBRO', reference: 'F-2026-0318', counterparty: 'Distribuidora Nacional SA', reconciled: false },
    { accKey: 'BBVA', date: '2026-02-27', concept: 'Pago leasing maquinaria', amount: -12500, balance: 564120, category: 'LEASING', reference: 'LEA-2026-02', counterparty: 'BBVA Leasing', reconciled: true },
    { accKey: 'BBVA', date: '2026-02-25', concept: 'Cobro factura F-2026-0290', amount: 15200, balance: 576620, category: 'COBRO', reference: 'F-2026-0290', counterparty: 'Alimentación Gourmet SA', reconciled: true },
    // Santander
    { accKey: 'Santander', date: '2026-03-11', concept: 'Pago factura PF-891 Logística', amount: -22869, balance: 380000, category: 'PAGO_PROV', reference: 'PF-891', counterparty: 'Logística Express', reconciled: true },
    { accKey: 'Santander', date: '2026-03-10', concept: 'Cobro cliente varios', amount: 18500, balance: 402869, category: 'COBRO', reference: 'COB-VAR-03', counterparty: 'Varios clientes', reconciled: true },
    { accKey: 'Santander', date: '2026-03-07', concept: 'Pago suministros industriales', amount: -41745, balance: 384369, category: 'PAGO_PROV', reference: 'PF-334', counterparty: 'Suministros Industriales', reconciled: false },
    { accKey: 'Santander', date: '2026-03-05', concept: 'Pago Seguridad Social feb', amount: -28900, balance: 426114, category: 'SS', reference: 'SS-2026-02', counterparty: 'TGSS', reconciled: true },
    { accKey: 'Santander', date: '2026-03-04', concept: 'Cobro factura F-2026-0325', amount: 22687.5, balance: 455014, category: 'COBRO', reference: 'F-2026-0325', counterparty: 'Tecnología Avanzada SL', reconciled: true },
    { accKey: 'Santander', date: '2026-03-03', concept: 'Domiciliación electricidad', amount: -4350, balance: 432326.5, category: 'SUMINISTRO', reference: 'ELE-03-2026', counterparty: 'Iberdrola Empresas', reconciled: true },
    { accKey: 'Santander', date: '2026-02-28', concept: 'Pago IRPF 4T 2025', amount: -15600, balance: 436676.5, category: 'IMPUESTO', reference: 'IRPF-4T-25', counterparty: 'AEAT', reconciled: true },
    { accKey: 'Santander', date: '2026-02-26', concept: 'Cobro factura F-2026-0285', amount: 32400, balance: 452276.5, category: 'COBRO', reference: 'F-2026-0285', counterparty: 'Industrias Químicas del Norte', reconciled: true },
    // CaixaBank
    { accKey: 'CaixaBank', date: '2026-03-10', concept: 'Transferencia recibida BBVA', amount: 25000, balance: 245000, category: 'TRANSFER', reference: 'TRF-INT-001', counterparty: 'BBVA Principal', reconciled: true },
    { accKey: 'CaixaBank', date: '2026-03-07', concept: 'Pago alquiler oficinas', amount: -8500, balance: 220000, category: 'ALQUILER', reference: 'ALQ-03-2026', counterparty: 'Inmobiliaria Centro SA', reconciled: true },
    { accKey: 'CaixaBank', date: '2026-03-05', concept: 'Cobro factura F-2026-0330', amount: 13552, balance: 228500, category: 'COBRO', reference: 'F-2026-0330', counterparty: 'Alimentación Gourmet SA', reconciled: false },
    { accKey: 'CaixaBank', date: '2026-03-03', concept: 'Pago consultoría tech', amount: -26620, balance: 214948, category: 'PAGO_PROV', reference: 'PF-789', counterparty: 'Consultoría Tech', reconciled: true },
    { accKey: 'CaixaBank', date: '2026-02-28', concept: 'Comisión trimestral', amount: -120, balance: 241568, category: 'COMISION', reference: 'COM-1T-2026', counterparty: 'CaixaBank', reconciled: true },
    // Sabadell
    { accKey: 'Sabadell', date: '2026-03-10', concept: 'Pago cuota leasing camión', amount: -3200, balance: 80000, category: 'LEASING', reference: 'LEA-CAM-03', counterparty: 'Sabadell Leasing', reconciled: true },
    { accKey: 'Sabadell', date: '2026-03-05', concept: 'Pago energía & utilities', amount: -10587.5, balance: 83200, category: 'PAGO_PROV', reference: 'PF-112', counterparty: 'Energía & Utilities SA', reconciled: true },
    { accKey: 'Sabadell', date: '2026-03-03', concept: 'Cobro devolución proveedor', amount: 2400, balance: 93787.5, category: 'DEVOLUCION', reference: 'DEV-PRV-001', counterparty: 'Suministros Industriales', reconciled: false },
    { accKey: 'Sabadell', date: '2026-02-27', concept: 'Pago mantenimiento flota', amount: -5800, balance: 91387.5, category: 'MANT', reference: 'MNT-FLT-02', counterparty: 'Talleres Mecánicos SL', reconciled: true },
  ]
  for (const m of movements) {
    await prisma.bankMovement.create({
      data: { bankAccountId: accMap[m.accKey], date: new Date(m.date), concept: m.concept, amount: m.amount, balance: m.balance, category: m.category, reference: m.reference, counterparty: m.counterparty, reconciled: m.reconciled }
    })
  }

  // Update syncedAt
  await prisma.bankAccount.updateMany({ where: { tenantId: tenant.id, bankName: { in: ['BBVA', 'Santander', 'Sabadell'] } }, data: { syncedAt: new Date('2026-03-11T14:30:00') } })
  await prisma.bankAccount.updateMany({ where: { tenantId: tenant.id, bankName: 'CaixaBank' }, data: { syncedAt: new Date('2026-03-10T09:15:00') } })

  // Reconciliations
  const reconData = [
    { accKey: 'BBVA', periodDate: '2026-03-01', bankBalance: 540000, erpBalance: 540000, difference: 0, status: 'COMPLETED', matchedCount: 10, unmatchedCount: 0 },
    { accKey: 'BBVA', periodDate: '2026-02-01', bankBalance: 576620, erpBalance: 576620, difference: 0, status: 'COMPLETED', matchedCount: 8, unmatchedCount: 0 },
    { accKey: 'Santander', periodDate: '2026-03-01', bankBalance: 380000, erpBalance: 381245, difference: -1245, status: 'IN_PROGRESS', matchedCount: 6, unmatchedCount: 2 },
    { accKey: 'Santander', periodDate: '2026-02-01', bankBalance: 452276.5, erpBalance: 452276.5, difference: 0, status: 'COMPLETED', matchedCount: 7, unmatchedCount: 0 },
    { accKey: 'CaixaBank', periodDate: '2026-03-01', bankBalance: 245000, erpBalance: 245000, difference: 0, status: 'COMPLETED', matchedCount: 5, unmatchedCount: 0 },
    { accKey: 'CaixaBank', periodDate: '2026-02-01', bankBalance: 241568, erpBalance: 241900, difference: -332, status: 'REQUIRES_REVIEW', matchedCount: 4, unmatchedCount: 1 },
    { accKey: 'Sabadell', periodDate: '2026-03-01', bankBalance: 80000, erpBalance: 80000, difference: 0, status: 'COMPLETED', matchedCount: 4, unmatchedCount: 0 },
    { accKey: 'Sabadell', periodDate: '2026-02-01', bankBalance: 91387.5, erpBalance: 91387.5, difference: 0, status: 'COMPLETED', matchedCount: 3, unmatchedCount: 0 },
  ]
  for (const r of reconData) {
    await prisma.reconciliation.create({
      data: { bankAccountId: accMap[r.accKey], periodDate: new Date(r.periodDate), bankBalance: r.bankBalance, erpBalance: r.erpBalance, difference: r.difference, status: r.status as any, matchedCount: r.matchedCount, unmatchedCount: r.unmatchedCount }
    })
  }

  // Data Sources
  await prisma.dataSource.createMany({
    data: [
      { tenantId: tenant.id, name: 'SAP Business One', type: DataSourceType.ERP, status: 'SYNCED', recordCount: 28450, lastSync: new Date() },
      { tenantId: tenant.id, name: 'BBVA Net Cash', type: DataSourceType.BANKING, status: 'SYNCED', recordCount: 892, lastSync: new Date() },
      { tenantId: tenant.id, name: 'Santander Empresas', type: DataSourceType.BANKING, status: 'SYNCED', recordCount: 645, lastSync: new Date() },
      { tenantId: tenant.id, name: 'CaixaBank Business', type: DataSourceType.BANKING, status: 'WARNING', recordCount: 318, lastSync: new Date(Date.now() - 47 * 60000) },
      { tenantId: tenant.id, name: 'Salesforce CRM', type: DataSourceType.CRM, status: 'SYNCED', recordCount: 1240, lastSync: new Date() },
      { tenantId: tenant.id, name: 'Holded WMS', type: DataSourceType.WMS, status: 'SYNCED', recordCount: 2890, lastSync: new Date() },
    ]
  })

  console.log('✅ Database seeded successfully')
  console.log('📧 Login: ana.castro@grupoiberico.es')
  console.log('🔑 Password: geacfo2026')
}

main().catch(console.error).finally(() => prisma.$disconnect())
