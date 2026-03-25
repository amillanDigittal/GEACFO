'use client'
import { useState } from 'react'
import { fmtEur, fmt, fmtPct } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollableTable, Th } from '@/components/ui/scrollable-table'
import { Calculator, Clock, TrendingUp } from 'lucide-react'

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

interface DiscountCalculatorProps {
  invoices: any[]
}

export function DiscountCalculator({ invoices }: DiscountCalculatorProps) {
  const [discountRate, setDiscountRate] = useState(2)
  const [discountDays, setDiscountDays] = useState(10)

  const unpaid = invoices.filter(i => i.status !== 'PAID' && i.status !== 'REJECTED')
  const eligible = unpaid
    .map(inv => {
      const days = daysUntil(inv.dueDate)
      const remaining = Number(inv.totalAmount) - Number(inv.paidAmount)
      const termsD = inv.supplier.paymentTerms || 30
      const daysEarly = days - discountDays
      if (remaining <= 0 || days < 0 || daysEarly < 0) return null
      const saving = remaining * (discountRate / 100)
      const netPayment = remaining - saving
      // Coste anualizado de NO aprovechar el descuento: (descuento / neto) * (365 / días_que_adelantas)
      const annualizedRate = daysEarly > 0 ? (saving / netPayment) * (365 / daysEarly) * 100 : 0
      return { ...inv, remaining, saving, netPayment, daysEarly, annualizedRate, termsD }
    })
    .filter(Boolean) as any[]
  const totalSaving = eligible.reduce((s, e) => s + e.saving, 0)
  const totalRemaining = eligible.reduce((s, e) => s + e.remaining, 0)
  const topOpportunities = [...eligible].sort((a, b) => b.saving - a.saving).slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between w-full flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-primary" />
            <CardTitle>Descuento por Pronto Pago</CardTitle>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Descuento %</label>
              <Input
                type="number"
                min={0.1}
                max={20}
                step={0.1}
                value={discountRate}
                onChange={e => setDiscountRate(parseFloat(e.target.value) || 0)}
                className="w-20 h-8 text-xs font-mono"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Si pago en</label>
              <Input
                type="number"
                min={1}
                max={90}
                step={1}
                value={discountDays}
                onChange={e => setDiscountDays(parseInt(e.target.value) || 0)}
                className="w-16 h-8 text-xs font-mono"
              />
              <span className="text-xs text-muted-foreground">días</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Facturas Elegibles</div>
            <div className="font-mono text-lg font-bold">{eligible.length}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Importe Total</div>
            <div className="font-mono text-lg font-bold">{fmtEur(totalRemaining)}</div>
          </div>
          <div className="bg-success/10 rounded-lg p-3 text-center border border-success/20">
            <div className="text-[10px] text-success uppercase tracking-widest mb-1">Ahorro Potencial</div>
            <div className="font-mono text-lg font-bold text-success">{fmtEur(totalSaving)}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Términos</div>
            <div className="font-mono text-lg font-bold">{fmt(discountRate, 1)}/<span className="text-sm">{discountDays}d</span></div>
          </div>
        </div>

        {/* Top oportunidades */}
        {topOpportunities.length > 0 ? (
          <ScrollableTable label="Oportunidades de pronto pago">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Factura', 'Proveedor', 'Vencimiento', 'Importe', 'Ahorro', 'Pago Neto', 'Días Adelanto', 'Tasa Anualizada'].map(h => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topOpportunities.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="p-3 font-mono text-xs font-semibold">{inv.number}</td>
                    <td className="p-3 text-sm">{inv.supplier.name}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{fmtDate(inv.dueDate)}</td>
                    <td className="p-3 font-mono text-xs">{fmtEur(inv.remaining)}</td>
                    <td className="p-3 font-mono text-xs font-semibold text-success">{fmtEur(inv.saving)}</td>
                    <td className="p-3 font-mono text-xs">{fmtEur(inv.netPayment)}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 font-mono text-xs">
                        <Clock size={12} className="text-muted-foreground" />
                        {inv.daysEarly}d
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${inv.annualizedRate > 20 ? 'text-success' : inv.annualizedRate > 10 ? 'text-warning' : 'text-muted-foreground'}`}>
                        <TrendingUp size={12} />
                        {fmtPct(inv.annualizedRate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No hay facturas elegibles para descuento con los términos actuales
          </div>
        )}

        {eligible.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
            <TrendingUp size={14} className="text-primary mt-0.5 flex-shrink-0" />
            <span>
              Pagando {eligible.length} factura{eligible.length > 1 ? 's' : ''} con términos <strong>{fmt(discountRate, 1)}/{discountDays}</strong> (neto {eligible[0]?.termsD || 30}),
              el ahorro de <strong className="text-success">{fmtEur(totalSaving)}</strong> equivale a una rentabilidad anualizada media
              del <strong>{fmtPct(eligible.length > 0 ? eligible.reduce((s, e) => s + e.annualizedRate, 0) / eligible.length : 0)}</strong>.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
