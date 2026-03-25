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
