import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const PRIMARY = [59, 130, 246] as const   // blue
const SUCCESS = [34, 197, 94] as const    // green
const WARNING = [245, 158, 11] as const   // amber
const DESTRUCTIVE = [239, 68, 68] as const // red
const MUTED = [100, 116, 139] as const    // gray
const DARK = [15, 23, 42] as const        // slate-900

function fmtEur(v: number) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) + ' €'
}

function fmtM(v: number) {
  return v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `€${Math.round(v / 1000)}k` : fmtEur(v)
}

export function exportBoardPackPDF(data: any) {
  const { sections, generatedAt } = data
  const { executiveSummary: es, liquidity: liq, workingCapital: wc, debt, customerRisk: cr } = sections

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentW = pageW - margin * 2
  let y = 0

  // ─── COVER ────────────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, 297, 'F')

  doc.setFillColor(...PRIMARY)
  doc.rect(margin, 80, 4, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(36)
  doc.setFont('helvetica', 'bold')
  doc.text('Board Pack', margin + 12, 100)

  doc.setFontSize(16)
  doc.setFont('helvetica', 'normal')
  doc.text('Informe para el Consejo de Administración', margin + 12, 112)

  doc.setFontSize(12)
  doc.setTextColor(148, 163, 184) // slate-400
  doc.text('Grupo Ibérico SA', margin + 12, 130)
  const genDate = new Date(generatedAt)
  doc.text(genDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }), margin + 12, 138)

  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text('Documento confidencial · Generado automáticamente por GEACFO', margin, 280)

  // ─── Helper functions ─────────────────────────────────────────────
  const newPage = () => { doc.addPage(); y = margin; }

  const sectionTitle = (num: string, title: string) => {
    if (y > 240) newPage()
    doc.setFillColor(...PRIMARY)
    doc.rect(margin, y, 3, 8, 'F')
    doc.setTextColor(...DARK)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`${num}. ${title}`, margin + 6, y + 6)
    y += 14
  }

  const subtitle = (text: string) => {
    doc.setTextColor(...MUTED)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(text, margin, y)
    y += 6
  }

  const kpiRow = (items: { label: string; value: string; color?: readonly [number, number, number] }[]) => {
    const boxW = (contentW - (items.length - 1) * 4) / items.length
    items.forEach((item, i) => {
      const x = margin + i * (boxW + 4)
      doc.setFillColor(248, 250, 252) // slate-50
      doc.roundedRect(x, y, boxW, 22, 2, 2, 'F')
      doc.setFontSize(7)
      doc.setTextColor(...MUTED)
      doc.setFont('helvetica', 'normal')
      doc.text(item.label.toUpperCase(), x + boxW / 2, y + 7, { align: 'center' })
      doc.setFontSize(13)
      doc.setTextColor(...(item.color || DARK))
      doc.setFont('helvetica', 'bold')
      doc.text(item.value, x + boxW / 2, y + 17, { align: 'center' })
    })
    y += 28
  }

  // ─── PAGE 2: RESUMEN EJECUTIVO ────────────────────────────────────
  newPage()
  sectionTitle('1', 'Resumen Ejecutivo')
  subtitle('Visión general de la situación financiera para el Consejo de Administración')

  // Status banner
  const hasAlerts = es.alerts > 0
  doc.setFillColor(...(hasAlerts ? WARNING : SUCCESS))
  doc.roundedRect(margin, y, contentW, 12, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(
    hasAlerts
      ? `⚠ ${es.alerts} alerta${es.alerts > 1 ? 's' : ''} activa${es.alerts > 1 ? 's' : ''} — atención requerida`
      : '✓ Situación financiera estable — sin alertas críticas',
    margin + 5, y + 7.5
  )
  y += 18

  kpiRow([
    { label: 'Posición de Caja', value: fmtEur(es.cash) },
    { label: 'Revenue YTD', value: fmtM(es.revenue) },
    { label: 'Margen EBITDA', value: `${es.ebitdaMargin}%` },
    { label: 'Covenants', value: es.covenants ? '4/4 OK' : 'Incumplimiento', color: es.covenants ? SUCCESS : DESTRUCTIVE },
  ])

  // ─── PAGE 3: LIQUIDEZ ─────────────────────────────────────────────
  sectionTitle('2', 'Posición de Liquidez')
  subtitle('Estado actual y proyección de tesorería a 13 semanas')

  kpiRow([
    { label: 'Caja Actual', value: fmtEur(liq.currentCash) },
    { label: 'Caja Proyectada S13', value: fmtEur(liq.forecastedCash * 1000), color: PRIMARY },
    { label: 'Semanas con Gap', value: String(liq.gapWeeks.length), color: liq.gapWeeks.length > 0 ? WARNING : SUCCESS },
  ])

  if (liq.gapWeeks.length > 0) {
    doc.setFillColor(255, 251, 235) // amber-50
    doc.roundedRect(margin, y, contentW, 14, 2, 2, 'F')
    doc.setTextColor(...WARNING)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(`Semanas con déficit: S${liq.gapWeeks.join(', S')}`, margin + 4, y + 5.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    doc.setFontSize(7)
    doc.text('Recomendación: Activar líneas de crédito o acelerar cobros para cubrir gaps.', margin + 4, y + 11)
    y += 20
  }

  // ─── WORKING CAPITAL ──────────────────────────────────────────────
  if (y > 200) newPage()
  sectionTitle('3', 'Working Capital')
  subtitle('Ciclo de conversión de efectivo y métricas de capital circulante')

  kpiRow([
    { label: 'DSO', value: `${wc.dso}d`, color: wc.dso <= wc.dsoTarget ? SUCCESS : WARNING },
    { label: 'DPO', value: `${wc.dpo}d`, color: SUCCESS },
    { label: 'CCC', value: `${wc.ccc}d`, color: wc.ccc < 45 ? SUCCESS : WARNING },
    { label: 'Objetivo DSO', value: `${wc.dsoTarget}d` },
  ])

  // CCC formula
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(margin, y, contentW, 12, 2, 2, 'F')
  doc.setTextColor(...DARK)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`DSO ${wc.dso}d  −  DPO ${wc.dpo}d  =  CCC ${wc.ccc}d`, pageW / 2, y + 8, { align: 'center' })
  y += 18

  // ─── DEUDA & COVENANTS ────────────────────────────────────────────
  if (y > 180) newPage()
  sectionTitle('4', 'Deuda & Covenants')
  subtitle('Posición de endeudamiento y cumplimiento de covenants financieros')

  kpiRow([
    { label: 'Deuda Bruta', value: fmtEur(debt.totalDebt) },
    { label: 'Deuda Neta', value: fmtEur(debt.netDebt), color: PRIMARY },
    { label: 'Apalancamiento', value: `${(debt.netDebt / es.revenue * 100).toFixed(1)}%`, color: SUCCESS },
  ])

  // Covenants table
  if (debt.allCovenants && debt.allCovenants.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [...DARK], fontSize: 7, fontStyle: 'bold', cellPadding: 3 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 45 },
        4: { halign: 'right' },
      },
      head: [['Covenant', 'Actual', 'Límite', 'Tipo', 'Margen', 'Estado']],
      body: debt.allCovenants.map((cov: any) => [
        cov.name,
        String(cov.currentValue),
        String(cov.limitValue),
        cov.limitType === 'MAX' ? 'Máximo' : 'Mínimo',
        `+${cov.margin}%`,
        cov.status === 'COMPLIANT' ? '✓ Cumple' : '✗ Incumple',
      ]),
      didParseCell(data: any) {
        if (data.section === 'body' && data.column.index === 5) {
          data.cell.styles.textColor = data.cell.raw?.toString().includes('✓') ? [...SUCCESS] : [...DESTRUCTIVE]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 10
  }

  // ─── RIESGO CLIENTES ──────────────────────────────────────────────
  if (y > 180) newPage()
  sectionTitle('5', 'Riesgo de Clientes')
  subtitle('Exposición crediticia y clientes en alerta')

  kpiRow([
    { label: 'Exposición Total', value: fmtEur(cr.totalExposure) },
    { label: 'Score Medio', value: String(cr.avgScore), color: cr.avgScore >= 70 ? SUCCESS : cr.avgScore >= 50 ? WARNING : DESTRUCTIVE },
    { label: 'Clientes en Alerta', value: String(cr.alertCustomers.length), color: cr.alertCustomers.length > 0 ? DESTRUCTIVE : SUCCESS },
  ])

  if (cr.alertCustomers.length > 0) {
    const riskLabels: Record<string, string> = { VERY_LOW: 'Muy Bajo', LOW: 'Bajo', MEDIUM: 'Medio', HIGH: 'Alto', CRITICAL: 'Crítico' }
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [...DESTRUCTIVE], fontSize: 7, fontStyle: 'bold', cellPadding: 3 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      head: [['Cliente', 'Código', 'Score', 'DSO', 'Límite Crédito', 'Riesgo']],
      body: cr.alertCustomers.map((c: any) => [
        c.name,
        c.code,
        String(c.creditScore),
        `${c.dso}d`,
        fmtEur(Number(c.creditLimit)),
        riskLabels[c.riskLevel] || c.riskLevel,
      ]),
    })
    y = (doc as any).lastAutoTable.finalY + 6

    doc.setFillColor(254, 242, 242) // red-50
    doc.roundedRect(margin, y, contentW, 10, 2, 2, 'F')
    doc.setTextColor(...MUTED)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Recomendación: Suspender nuevos pedidos, iniciar gestión de cobro activa y revisar provisión por insolvencia.', margin + 4, y + 6.5)
    y += 14
  }

  // ─── FOOTER on all pages ──────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    if (i > 1) {
      doc.text('GEACFO · Board Pack · Grupo Ibérico SA', margin, 290)
      doc.text(`Página ${i - 1} de ${totalPages - 1}`, pageW - margin, 290, { align: 'right' })
    }
  }

  doc.save(`board_pack_${genDate.toISOString().slice(0, 10)}.pdf`)
}
