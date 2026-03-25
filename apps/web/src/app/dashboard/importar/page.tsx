'use client'
import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { validateCSVHeaders } from '@/lib/validations'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, X, Landmark, FileText, Package, ArrowUpFromLine } from 'lucide-react'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { PageHeader } from '@/components/page-header'
import { useTranslations } from 'next-intl'

type ImportType = 'movimientos' | 'facturas_cobrar' | 'facturas_pagar' | 'inventario'

function parseCSV(text: string): any[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  // Detect separator
  const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map(line => {
    const values = line.split(sep).map(v => v.trim().replace(/^["']|["']$/g, ''))
    const row: any = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  }).filter(r => Object.values(r).some(v => v !== ''))
}

export default function ImportarPage() {
  const t = useTranslations('importar')
  const [templates, setTemplates] = useState<any>(null)
  const [selectedType, setSelectedType] = useState<ImportType | null>(null)
  const [parsedRows, setParsedRows] = useState<any[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [accountAlias, setAccountAlias] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const IMPORT_TYPES: { key: ImportType; label: string; icon: React.ReactNode; description: string; color: string }[] = [
    { key: 'movimientos', label: t('typeBankMovements'), icon: <Landmark size={24} />, description: t('typeBankMovementsDesc'), color: 'from-blue-500/20 to-blue-600/5' },
    { key: 'facturas_cobrar', label: t('typeInvoicesAR'), icon: <ArrowUpFromLine size={24} />, description: t('typeInvoicesARDesc'), color: 'from-emerald-500/20 to-emerald-600/5' },
    { key: 'facturas_pagar', label: t('typeInvoicesAP'), icon: <FileText size={24} />, description: t('typeInvoicesAPDesc'), color: 'from-orange-500/20 to-orange-600/5' },
    { key: 'inventario', label: t('typeInventory'), icon: <Package size={24} />, description: t('typeInventoryDesc'), color: 'from-violet-500/20 to-violet-600/5' },
  ]

  useEffect(() => {
    api.import.templates().then(setTemplates).catch(console.error).finally(() => setLastUpdated(new Date()))
  }, [])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setCsvError(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)

      if (rows.length === 0) {
        setCsvError(t('errorEmptyFile'))
        setParsedRows([])
        return
      }

      // Validate headers match expected columns for this import type
      if (selectedType) {
        const headers = Object.keys(rows[0])
        const validation = validateCSVHeaders(selectedType, headers)
        if (!validation.valid) {
          setCsvError(validation.message || t('errorUnrecognizedColumns'))
          setParsedRows([])
          return
        }
      }

      setParsedRows(rows)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function reset() {
    setSelectedType(null)
    setParsedRows([])
    setFileName('')
    setResult(null)
    setCsvError(null)
    setAccountAlias('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function doImport() {
    if (!selectedType || parsedRows.length === 0) return
    if (selectedType === 'movimientos' && !accountAlias.trim()) {
      setResult({ error: t('errorMustIndicateAccount') })
      return
    }
    setImporting(true)
    setResult(null)
    try {
      let res: any
      switch (selectedType) {
        case 'movimientos':
          if (!accountAlias) { setResult({ error: t('errorSelectAccount') }); setImporting(false); return }
          res = await api.import.movements(accountAlias, parsedRows)
          break
        case 'facturas_cobrar':
          res = await api.import.invoicesAR(parsedRows)
          break
        case 'facturas_pagar':
          res = await api.import.invoicesAP(parsedRows)
          break
        case 'inventario':
          res = await api.import.inventory(parsedRows)
          break
      }
      setResult(res)
    } catch (e: any) {
      setResult({ error: e.message || t('errorImport') })
    } finally { setImporting(false) }
  }

  function downloadTemplate(type: ImportType) {
    if (!templates?.[type]) return
    const t = templates[type]
    const sep = ';'
    const header = t.columns.join(sep)
    const exampleRow = t.columns.map((c: string) => t.example[0]?.[c] ?? '').join(sep)
    const csv = `sep=${sep}\n${header}\n${exampleRow}`
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `plantilla_${type}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const previewHeaders = parsedRows.length > 0 ? Object.keys(parsedRows[0]) : []
  const previewData = parsedRows.slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        lastUpdated={lastUpdated}
        onRefresh={async () => { reset() }}
      />

      {/* Step 1: Select type */}
      {!selectedType && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {IMPORT_TYPES.map(tp => (
            <button
              key={tp.key}
              onClick={() => { setSelectedType(tp.key); setResult(null); setParsedRows([]) }}
              className={`text-left p-5 rounded-xl border border-border bg-gradient-to-br ${tp.color} hover:scale-[1.01] active:scale-[0.99] transition-transform`}
            >
              <div className="mb-3 text-foreground">{tp.icon}</div>
              <div className="font-semibold text-foreground">{tp.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{tp.description}</div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Upload & preview */}
      {selectedType && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {IMPORT_TYPES.find(tp => tp.key === selectedType)?.label}
            </Badge>
            <Button variant="ghost" size="sm" onClick={reset}><X size={14} className="mr-1" /> {t('changeType')}</Button>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate(selectedType)}>
              <Download size={14} className="mr-1" /> {t('downloadTemplate')}
            </Button>
          </div>

          {/* Account selector for movements */}
          {selectedType === 'movimientos' && (
            <Card>
              <CardContent className="py-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-2">{t('destinationAccount')}</label>
                <input
                  type="text"
                  value={accountAlias}
                  onChange={e => setAccountAlias(e.target.value)}
                  placeholder={t('accountPlaceholder')}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="text-[10px] text-muted-foreground mt-1">{t('accountHelp')}</div>
              </CardContent>
            </Card>
          )}

          {/* File upload */}
          <Card>
            <CardContent className="py-6">
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileSelect} className="hidden" />
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                {fileName ? (
                  <div>
                    <FileSpreadsheet size={32} className="mx-auto mb-2 text-success" />
                    <div className="font-medium text-foreground">{fileName}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t('rowsDetected', { count: parsedRows.length })}</div>
                    <div className="text-xs text-primary mt-2 underline">{t('changeFile')}</div>
                  </div>
                ) : (
                  <div>
                    <Upload size={32} className="mx-auto mb-2 text-muted-foreground" />
                    <div className="font-medium text-foreground">{t('dragOrClick')}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t('supportedFormats')}</div>
                  </div>
                )}
              </div>
              {csvError && (
                <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle size={14} className="text-destructive mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-destructive">{csvError}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          {parsedRows.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('preview', { count: parsedRows.length })}</CardTitle>
                  <Button onClick={doImport} disabled={importing}>
                    <Upload size={14} className="mr-1" />
                    {importing ? t('importing') : t('importCount', { count: parsedRows.length })}
                  </Button>
                </div>
              </CardHeader>
              <ScrollableTable>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">#</th>
                      {previewHeaders.map(h => (
                        <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="p-3 text-xs text-muted-foreground">{i + 1}</td>
                        {previewHeaders.map(h => (
                          <td key={h} className="p-3 text-xs font-mono truncate max-w-[200px]">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                    {parsedRows.length > 5 && (
                      <tr><td colSpan={previewHeaders.length + 1} className="p-3 text-xs text-center text-muted-foreground">{t('andMoreRows', { count: parsedRows.length - 5 })}</td></tr>
                    )}
                  </tbody>
                </table>
              </ScrollableTable>
            </Card>
          )}

          {/* Result */}
          {result && (
            <Card>
              <CardContent className="py-5">
                {result.error ? (
                  <div className="flex items-start gap-3 text-destructive">
                    <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-sm">{t('errorImport')}</div>
                      <div className="text-xs mt-1">{result.error}</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 text-success">
                      <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">{t('importCompleted')}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {result.imported > 0 && <span className="text-success font-semibold">{t('importedCount', { count: result.imported })}</span>}
                          {result.updated > 0 && <span className="text-warning font-semibold ml-2">{t('updatedCount', { count: result.updated })}</span>}
                          {result.skipped > 0 && <span className="text-muted-foreground ml-2">{t('skippedCount', { count: result.skipped })}</span>}
                        </div>
                      </div>
                    </div>
                    {result.errors?.length > 0 && (
                      <div className="bg-destructive/10 rounded-lg p-3 space-y-1">
                        <div className="text-xs font-semibold text-destructive">{t('errorsCount', { count: result.errors.length })}</div>
                        {result.errors.slice(0, 5).map((e: string, i: number) => (
                          <div key={i} className="text-xs text-destructive/80">• {e}</div>
                        ))}
                        {result.errors.length > 5 && <div className="text-xs text-muted-foreground">{t('andMoreErrors', { count: result.errors.length - 5 })}</div>}
                      </div>
                    )}
                    <Button variant="outline" size="sm" onClick={reset}>{t('importMoreData')}</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Column mapping help */}
          {selectedType && templates?.[selectedType] && !parsedRows.length && (
            <Card>
              <CardHeader><CardTitle>{t('expectedColumns')}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {templates[selectedType].columns.map((c: string) => (
                    <Badge key={c} variant="secondary" className="font-mono text-xs">{c}</Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-3">
                  {t('columnVariationsHelp')}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
