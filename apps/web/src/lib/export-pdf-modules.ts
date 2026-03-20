import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const PRIMARY = [59, 130, 246] as const
const SUCCESS = [34, 197, 94] as const
const WARNING = [245, 158, 11] as const
const DESTRUCTIVE = [239, 68, 68] as const
const MUTED = [100, 116, 139] as const
const DARK = [15, 23, 42] as const

function fmtEur(v: number) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) + ' €'
}

function fmtPct(v: number) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v) + '%'
}

function createDoc(title: string, subtitle: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentW = pageW - margin * 2

  // Cover
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, 50, 'F')
  doc.setFillColor(...PRIMARY)
  doc.rect(margin, 15, 3, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(title, margin + 8, 28)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(subtitle, margin + 8, 38)

  // Date
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`Grupo Ibérico SA · ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`, pageW - margin, 43, { align: 'right' })

  let y = 60

  const helpers = {
    margin,
    contentW,
    pageW,
    y: () => y,
    setY: (v: number) => { y = v },
    newPage: () => { doc.addPage(); y = margin },
    checkPage: (need: number) => { if (y > 270 - need) { doc.addPage(); y = margin } },

    sectionTitle: (text: string) => {
      if (y > 250) { doc.addPage(); y = margin }
      doc.setFillColor(...PRIMARY)
      doc.rect(margin, y, 3, 7, 'F')
      doc.setTextColor(...DARK)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(text, margin + 6, y + 5.5)
      y += 12
    },

    kpiRow: (items: { label: string; value: string; color?: readonly [number, number, number] }[]) => {
      const boxW = (contentW - (items.length - 1) * 3) / items.length
      items.forEach((item, i) => {
        const x = margin + i * (boxW + 3)
        doc.setFillColor(248, 250, 252)
        doc.roundedRect(x, y, boxW, 20, 2, 2, 'F')
        doc.setFontSize(6.5)
        doc.setTextColor(...MUTED)
        doc.setFont('helvetica', 'normal')
        doc.text(item.label.toUpperCase(), x + boxW / 2, y + 6, { align: 'center' })
        doc.setFontSize(11)
        doc.setTextColor(...(item.color || DARK))
        doc.setFont('helvetica', 'bold')
        doc.text(item.value, x + boxW / 2, y + 15, { align: 'center' })
      })
      y += 25
    },

    table: (headers: string[], rows: string[][], options?: { columnStyles?: any }) => {
      autoTable(doc, {
        startY: y,
        head: [headers],
        body: rows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7.5, cellPadding: 2.5, textColor: DARK as any, lineColor: [226, 232, 240] },
        headStyles: { fillColor: [241, 245, 249], textColor: DARK as any, fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        ...options,
      })
      y = (doc as any).lastAutoTable.finalY + 8
    },

    footer: () => {
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(...MUTED)
        doc.text('GEACFO · Documento generado automáticamente', margin, 290)
        doc.text(`${i} / ${totalPages}`, pageW - margin, 290, { align: 'right' })
      }
    },
  }

  return { doc, helpers }
}

// ─── COBROS (AR) ──────────────────────────────────────────────────────────
export function exportCobrosPDF(invoices: any[]) {
  const { doc, helpers: h } = createDoc('Cuentas por Cobrar', 'Informe de Facturas AR')

  const total = invoices.reduce((s: number, i: any) => s + Number(i.totalAmount), 0)
  const pending = invoices.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
  const overdue = invoices.filter((i: any) => i.status === 'OVERDUE')
  const overdueAmt = overdue.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)

  h.kpiRow([
    { label: 'Total Facturado', value: fmtEur(total) },
    { label: 'Pendiente Cobro', value: fmtEur(pending), color: WARNING },
    { label: 'Vencido', value: fmtEur(overdueAmt), color: DESTRUCTIVE },
    { label: 'Facturas Vencidas', value: String(overdue.length), color: overdue.length > 0 ? DESTRUCTIVE : SUCCESS },
  ])

  h.sectionTitle('Detalle de Facturas')

  const rows = invoices.map((i: any) => [
    i.number,
    i.customer?.name || '',
    new Date(i.issueDate).toLocaleDateString('es-ES'),
    new Date(i.dueDate).toLocaleDateString('es-ES'),
    fmtEur(Number(i.totalAmount)),
    fmtEur(Number(i.totalAmount) - Number(i.paidAmount)),
    i.status === 'PAID' ? 'Pagada' : i.status === 'OVERDUE' ? 'Vencida' : i.status === 'PARTIAL' ? 'Parcial' : 'Pendiente',
  ])

  h.table(
    ['Nº Factura', 'Cliente', 'Emisión', 'Vencimiento', 'Total', 'Pendiente', 'Estado'],
    rows,
  )

  if (overdue.length > 0) {
    h.sectionTitle('Facturas Vencidas — Detalle')
    const overdueRows = overdue.map((i: any) => {
      const days = Math.floor((Date.now() - new Date(i.dueDate).getTime()) / 86400000)
      return [i.number, i.customer?.name || '', `${days} días`, fmtEur(Number(i.totalAmount) - Number(i.paidAmount))]
    })
    h.table(['Nº Factura', 'Cliente', 'Días Vencida', 'Pendiente'], overdueRows)
  }

  h.footer()
  doc.save(`cobros_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── PAGOS (AP) ───────────────────────────────────────────────────────────
export function exportPagosPDF(invoices: any[]) {
  const { doc, helpers: h } = createDoc('Cuentas por Pagar', 'Informe de Facturas AP')

  const total = invoices.reduce((s: number, i: any) => s + Number(i.totalAmount), 0)
  const pending = invoices.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
  const approved = invoices.filter((i: any) => i.status === 'APPROVED').length
  const inReview = invoices.filter((i: any) => i.status === 'IN_REVIEW' || i.status === 'PENDING_APPROVAL').length

  h.kpiRow([
    { label: 'Total Facturas', value: fmtEur(total) },
    { label: 'Pendiente Pago', value: fmtEur(pending), color: WARNING },
    { label: 'Aprobadas', value: String(approved), color: SUCCESS },
    { label: 'Sin Aprobar', value: String(inReview), color: inReview > 0 ? WARNING : SUCCESS },
  ])

  h.sectionTitle('Detalle de Facturas')

  const statusLabels: Record<string, string> = {
    PENDING_APPROVAL: 'Pte. Aprobación', APPROVED: 'Aprobada', IN_REVIEW: 'En Revisión', REJECTED: 'Rechazada', PAID: 'Pagada',
  }

  h.table(
    ['Nº Factura', 'Proveedor', 'Emisión', 'Vencimiento', 'Total', 'Pendiente', 'Estado', 'Prioridad'],
    invoices.map((i: any) => [
      i.number, i.supplier?.name || '',
      new Date(i.issueDate).toLocaleDateString('es-ES'),
      new Date(i.dueDate).toLocaleDateString('es-ES'),
      fmtEur(Number(i.totalAmount)),
      fmtEur(Number(i.totalAmount) - Number(i.paidAmount)),
      statusLabels[i.status] || i.status,
      i.priority === 'HIGH' ? 'Alta' : i.priority === 'LOW' ? 'Baja' : 'Normal',
    ]),
  )

  h.footer()
  doc.save(`pagos_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── SCORING ──────────────────────────────────────────────────────────────
export function exportScoringPDF(customers: any[]) {
  const { doc, helpers: h } = createDoc('Scoring de Clientes', 'Informe de Riesgo Crediticio')

  const avgScore = customers.filter(c => c.creditScore).length > 0
    ? Math.round(customers.filter(c => c.creditScore).reduce((s: number, c: any) => s + c.creditScore, 0) / customers.filter(c => c.creditScore).length)
    : 0
  const highRisk = customers.filter(c => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL').length
  const totalExposure = customers.reduce((s: number, c: any) => s + (c.invoices?.reduce((si: number, i: any) => si + Number(i.totalAmount) - Number(i.paidAmount), 0) || 0), 0)

  h.kpiRow([
    { label: 'Clientes', value: String(customers.length) },
    { label: 'Score Medio', value: String(avgScore), color: avgScore >= 70 ? SUCCESS : avgScore >= 50 ? WARNING : DESTRUCTIVE },
    { label: 'Alto Riesgo', value: String(highRisk), color: highRisk > 0 ? DESTRUCTIVE : SUCCESS },
    { label: 'Exposición Total', value: fmtEur(totalExposure) },
  ])

  h.sectionTitle('Cartera de Clientes')

  const riskLabels: Record<string, string> = { VERY_LOW: 'Muy Bajo', LOW: 'Bajo', MEDIUM: 'Medio', HIGH: 'Alto', CRITICAL: 'Crítico' }

  h.table(
    ['Cliente', 'Código', 'Score', 'Riesgo', 'DSO', 'Exposición', 'Límite Crédito', 'Estado'],
    customers.map((c: any) => {
      const exposure = c.invoices?.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0) || 0
      return [
        c.name, c.code, String(c.creditScore || '—'),
        riskLabels[c.riskLevel] || c.riskLevel,
        `${c.dso || 0}d`, fmtEur(exposure),
        fmtEur(Number(c.creditLimit)),
        c.status === 'ALERT' ? 'Alerta' : 'Activo',
      ]
    }),
  )

  // Risk distribution
  h.sectionTitle('Distribución por Riesgo')
  const riskGroups = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
  h.table(
    ['Nivel de Riesgo', 'Clientes', '% del Total'],
    riskGroups.map(r => {
      const count = customers.filter(c => c.riskLevel === r).length
      return [riskLabels[r], String(count), fmtPct(customers.length > 0 ? (count / customers.length) * 100 : 0)]
    }),
  )

  h.footer()
  doc.save(`scoring_clientes_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── CASH FLOW ────────────────────────────────────────────────────────────
export function exportCashFlowPDF(data: any) {
  const { doc, helpers: h } = createDoc('Estado de Flujos de Efectivo', 'Cash Flow Statement')

  const { months, categoryBreakdown, totals } = data

  h.kpiRow([
    { label: 'Flujo Operativo', value: fmtEur(Math.round(totals.operating)), color: totals.operating >= 0 ? SUCCESS : DESTRUCTIVE },
    { label: 'Flujo Inversión', value: fmtEur(Math.round(totals.investing)), color: WARNING },
    { label: 'Flujo Financiación', value: fmtEur(Math.round(totals.financing)), color: PRIMARY },
    { label: 'Flujo Neto', value: fmtEur(Math.round(totals.net)), color: totals.net >= 0 ? SUCCESS : DESTRUCTIVE },
  ])

  h.sectionTitle('Flujo Mensual')

  const CATEGORY_LABELS: Record<string, string> = {
    COBRO: 'Cobros', PAGO_PROV: 'Pagos proveedores', NOMINA: 'Nóminas', SS: 'Seg. Social',
    IMPUESTO: 'Impuestos', SUMINISTRO: 'Suministros', ALQUILER: 'Alquileres', SEGURO: 'Seguros',
    COMISION: 'Comisiones', DEVOLUCION: 'Devoluciones', MANT: 'Mantenimiento', LEASING: 'Leasing',
    TRANSFER: 'Transferencias', OTHER: 'Otros',
  }

  if (months && months.length > 0) {
    h.table(
      ['Mes', 'Operativo', 'Inversión', 'Financiación', 'Neto'],
      months.map((m: any) => [
        m.month,
        fmtEur(Math.round(m.operating)),
        fmtEur(Math.round(m.investing)),
        fmtEur(Math.round(m.financing)),
        fmtEur(Math.round(m.operating + m.investing + m.financing)),
      ]),
    )
  }

  h.sectionTitle('Desglose por Categoría')

  const categories = Object.entries(categoryBreakdown as Record<string, { amount: number; count: number; type: string }>)
    .sort((a, b) => Math.abs(b[1].amount) - Math.abs(a[1].amount))

  h.table(
    ['Categoría', 'Tipo', 'Importe', 'Movimientos'],
    categories.map(([cat, v]) => [
      CATEGORY_LABELS[cat] || cat,
      v.type === 'operating' ? 'Operativo' : v.type === 'investing' ? 'Inversión' : 'Financiación',
      fmtEur(Math.round(v.amount)),
      String(v.count),
    ]),
  )

  // Recent movements
  if (data.recentMovements && data.recentMovements.length > 0) {
    h.sectionTitle('Últimos Movimientos')
    h.table(
      ['Fecha', 'Concepto', 'Contraparte', 'Importe', 'Categoría'],
      data.recentMovements.slice(0, 20).map((m: any) => [
        new Date(m.date).toLocaleDateString('es-ES'),
        m.concept?.slice(0, 35) || '',
        m.counterparty?.slice(0, 20) || '',
        fmtEur(m.amount),
        CATEGORY_LABELS[m.category] || m.category || '—',
      ]),
    )
  }

  h.footer()
  doc.save(`cash_flow_${new Date().toISOString().slice(0, 10)}.pdf`)
}
