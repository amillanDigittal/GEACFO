import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

interface ExportXLSXOptions {
  /** Sheet name (default: 'Datos') */
  sheetName?: string
  /** Column indices (0-based) that should be formatted as EUR currency */
  currencyCols?: number[]
  /** Column indices (0-based) that should be formatted as percentage */
  percentCols?: number[]
  /** Column indices (0-based) that should be formatted as date */
  dateCols?: number[]
  /** Whether to add a SUM formula row at the bottom for currency columns */
  addTotals?: boolean
}

/**
 * Export data to a formatted .xlsx file.
 * Same signature as exportCSV for easy drop-in replacement.
 */
export async function exportXLSX(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  options: ExportXLSXOptions = {},
) {
  const {
    sheetName = 'Datos',
    currencyCols = [],
    percentCols = [],
    dateCols = [],
    addTotals = true,
  } = options

  // Auto-detect currency columns from headers if not specified
  const autoCurrencyCols = currencyCols.length > 0 ? currencyCols : headers
    .map((h, i) => /base|total|importe|pagado|saldo|valor|coste|amount|balance/i.test(h) ? i : -1)
    .filter(i => i >= 0)

  const autoPercentCols = percentCols.length > 0 ? percentCols : headers
    .map((h, i) => /%|margen|pct|porcentaje/i.test(h) ? i : -1)
    .filter(i => i >= 0)

  const autoDateCols = dateCols.length > 0 ? dateCols : headers
    .map((h, i) => /fecha|emisi[oó]n|vencimiento|date|periodo/i.test(h) ? i : -1)
    .filter(i => i >= 0)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'GEACFO'
  wb.created = new Date()

  const ws = wb.addWorksheet(sheetName)

  // ── Header row ────────────────────────────────────────────────
  const headerRow = ws.addRow(headers)
  headerRow.eachCell(cell => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF3B82F6' } },
    }
  })
  headerRow.height = 28

  // ── Data rows ─────────────────────────────────────────────────
  const currencySet = new Set(autoCurrencyCols)
  const percentSet = new Set(autoPercentCols)
  const dateSet = new Set(autoDateCols)

  rows.forEach((row, rowIdx) => {
    const excelRow = ws.addRow(row.map((val, colIdx) => {
      if (val == null || val === '') return ''
      if (currencySet.has(colIdx)) return typeof val === 'number' ? val : parseFloat(String(val)) || val
      if (percentSet.has(colIdx)) {
        const str = String(val).replace('%', '').replace(',', '.').trim()
        const num = parseFloat(str)
        return isNaN(num) ? val : num
      }
      return val
    }))

    excelRow.eachCell((cell, colNumber) => {
      const colIdx = colNumber - 1 // exceljs is 1-based
      cell.font = { size: 10 }
      cell.alignment = { vertical: 'middle' }

      if (currencySet.has(colIdx) && typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00 €'
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      }
      if (percentSet.has(colIdx) && typeof cell.value === 'number') {
        cell.numFmt = '0.0"%"'
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      }
      if (dateSet.has(colIdx)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }

      // Zebra striping
      if (rowIdx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
    })
  })

  // ── Totals row ────────────────────────────────────────────────
  if (addTotals && autoCurrencyCols.length > 0 && rows.length > 0) {
    const totalsRow = ws.addRow(headers.map((_, colIdx) => {
      if (colIdx === 0) return 'TOTAL'
      if (currencySet.has(colIdx)) {
        // SUM formula: from row 2 (after header) to last data row
        const col = String.fromCharCode(65 + colIdx) // A, B, C...
        if (colIdx <= 25) return { formula: `SUM(${col}2:${col}${rows.length + 1})` }
      }
      return ''
    }))
    totalsRow.eachCell(cell => {
      cell.font = { bold: true, size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
      cell.border = { top: { style: 'double', color: { argb: 'FF1E3A5F' } } }
    })
    // Apply currency format to total cells
    autoCurrencyCols.forEach(colIdx => {
      const cell = totalsRow.getCell(colIdx + 1)
      cell.numFmt = '#,##0.00 €'
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
    })
  }

  // ── Column widths (auto-fit based on header + sample data) ───
  ws.columns.forEach((col, i) => {
    const headerLen = headers[i]?.length || 8
    const maxDataLen = rows.slice(0, 20).reduce((max, row) => {
      const val = row[i]
      return Math.max(max, val == null ? 0 : String(val).length)
    }, 0)
    col.width = Math.min(Math.max(headerLen, maxDataLen, 8) + 4, 35)
  })

  // ── Auto-filter ───────────────────────────────────────────────
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  }

  // ── Freeze header row ─────────────────────────────────────────
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // ── Download ──────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

/**
 * Export a multi-sheet CFO Pack Excel file with data from multiple modules.
 */
export async function exportCFOPack(data: {
  cockpit?: any
  forecast?: any
  debt?: any
  suppliers?: any
}) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'GEACFO'
  wb.created = new Date()

  const headerStyle = {
    font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E3A5F' } },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    border: { bottom: { style: 'thin' as const, color: { argb: 'FF3B82F6' } } },
  }

  function applyHeaderRow(ws: ExcelJS.Worksheet) {
    const row = ws.getRow(1)
    row.eachCell(cell => {
      cell.font = headerStyle.font as any
      cell.fill = headerStyle.fill as any
      cell.alignment = headerStyle.alignment as any
      cell.border = headerStyle.border as any
    })
    row.height = 28
  }

  // Sheet 1: Treasury Summary
  if (data.cockpit) {
    const c = data.cockpit
    const ws = wb.addWorksheet('Tesorería')
    const rows = [
      ['KPI', 'Valor', 'Tendencia'],
      ['Posición de caja', c.caja?.value ?? '', ''],
      ['DSO (días de cobro)', c.dso?.value ?? '', c.dso?.trend ?? ''],
      ['DPO (días de pago)', c.dpo?.value ?? '', c.dpo?.trend ?? ''],
      ['CCC (ciclo conversión)', c.ccc?.value ?? '', c.ccc?.trend ?? ''],
      ['Revenue YTD', c.revenue?.value ?? '', c.revenue?.trend ?? ''],
      ['EBITDA', c.ebitda?.value ?? '', c.ebitda?.margin ? `Margen: ${c.ebitda.margin}%` : ''],
      ['Deuda neta', c.deudaNeta?.value ?? '', c.deudaNeta?.trend ?? ''],
      ['Ratio liquidez', c.liquidez?.value ?? '', c.liquidez?.trend ?? ''],
      ['', '', ''],
      ['Cuentas por cobrar (AR)', c.workingCapital?.ar ?? '', ''],
      ['Cuentas por pagar (AP)', c.workingCapital?.ap ?? '', ''],
      ['Forecast 13 sem.', c.workingCapital?.forecast ?? '', ''],
    ]
    rows.forEach(r => ws.addRow(r))
    ws.columns = [{ width: 28 }, { width: 18 }, { width: 18 }]
    applyHeaderRow(ws)
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  // Sheet 2: Forecast 13 Weeks
  if (data.forecast?.weeks) {
    const ws = wb.addWorksheet('Forecast 13 Sem.')
    const headerRow = ['Semana', 'Cobros Base', 'Pagos Base', 'Saldo Base', 'Confianza %', 'Cobros Conservador', 'Saldo Conservador', 'Cobros Agresivo', 'Saldo Agresivo']
    ws.addRow(headerRow)
    data.forecast.weeks.forEach((w: any) => {
      ws.addRow([
        `S${w.weekNumber}`,
        w.base?.inflows ?? '',
        w.base?.outflows ?? '',
        w.base?.cumBalance ?? '',
        w.base?.confidence ?? '',
        w.conservador?.inflows ?? '',
        w.conservador?.cumBalance ?? '',
        w.agresivo?.inflows ?? '',
        w.agresivo?.cumBalance ?? '',
      ])
    })
    ws.columns = Array(9).fill(null).map(() => ({ width: 18 }))
    applyHeaderRow(ws)
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  // Sheet 3: Debt Instruments
  if (data.debt) {
    const ws1 = wb.addWorksheet('Deuda')
    ws1.addRow(['Instrumento', 'Banco', 'Tipo', 'Total', 'Pendiente', 'Tasa %', 'Vencimiento', 'Estado'])
    ;(data.debt.instruments || []).forEach((d: any) => {
      ws1.addRow([
        d.type, d.bank, d.type,
        Number(d.totalAmount), Number(d.outstanding),
        (Number(d.interestRate) * 100).toFixed(2) + '%',
        d.maturityDate ? new Date(d.maturityDate).toLocaleDateString('es-ES') : '',
        d.status,
      ])
    })
    ws1.columns = [{ width: 20 }, { width: 22 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 14 }, { width: 10 }]
    applyHeaderRow(ws1)
    ws1.views = [{ state: 'frozen', ySplit: 1 }]

    // Sheet 4: Covenants
    if (data.debt.covenants?.length > 0) {
      const ws2 = wb.addWorksheet('Covenants')
      ws2.addRow(['Covenant', 'Valor Actual', 'Límite', 'Tipo Límite', 'Margen %', 'Estado'])
      data.debt.covenants.forEach((c: any) => {
        ws2.addRow([
          c.name, c.currentValue, c.limitValue, c.limitType,
          c.margin != null ? c.margin + '%' : '',
          c.status,
        ])
      })
      ws2.columns = [{ width: 24 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 12 }]
      applyHeaderRow(ws2)
      ws2.views = [{ state: 'frozen', ySplit: 1 }]
    }
  }

  // Sheet 5: Suppliers
  if (data.suppliers?.length > 0) {
    const ws = wb.addWorksheet('Proveedores')
    ws.addRow(['Proveedor', 'Código', 'Categoría', 'Score', 'Riesgo', 'Volumen', 'Pendiente', 'Estado'])
    data.suppliers.forEach((s: any) => {
      ws.addRow([
        s.name, s.code, s.category || '',
        s.overallScore ?? '', s.riskLevel,
        s.totalVolume || 0, s.pendingAmount || 0,
        s.status,
      ])
    })
    ws.columns = [{ width: 24 }, { width: 12 }, { width: 16 }, { width: 8 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 12 }]
    applyHeaderRow(ws)
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  // Write file
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `cfo_pack_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
