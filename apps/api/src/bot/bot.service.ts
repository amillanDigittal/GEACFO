import { Injectable } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

@Injectable()
export class BotService {
  private anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  async chat(tenantId: string, userId: string, sessionId: string, message: string, context: string = 'tesoreria') {
    // Save user message
    await prisma.botMessage.create({ data: { tenantId, sessionId, role: 'USER', content: message, context } })

    // Get financial context from DB
    const [accounts, forecast, covenants, customers] = await Promise.all([
      prisma.bankAccount.findMany({ where: { tenantId } }),
      prisma.forecastWeek.findMany({ where: { tenantId, scenario: 'BASE' }, orderBy: { weekNumber: 'asc' } }),
      prisma.covenant.findMany({ where: { tenantId } }),
      prisma.customer.findMany({ where: { tenantId } }),
    ])

    const totalCash = accounts.reduce((s, a) => s + Number(a.balance), 0)
    const gapWeeks = forecast.filter(w => w.isGap)
    const alertCustomers = customers.filter(c => c.status === 'ALERT')

    const systemPrompt = `Eres el Bot CFO de GEACFO, asistente financiero inteligente para el CFO de Grupo Ibérico SA.
    
DATOS ACTUALES (${new Date().toLocaleDateString('es-ES')}):
- Caja consolidada: ${totalCash.toLocaleString('es-ES')} €
- Cuentas: ${accounts.map(a => `${a.alias}: ${Number(a.balance).toLocaleString('es-ES')} €`).join(', ')}
- Forecast 13S: ${forecast.length} semanas analizadas. Saldo final proyectado: ${forecast.length ? Number(forecast[forecast.length-1].cumBalance).toLocaleString('es-ES') : 'N/A'} €
- Gaps detectados: ${gapWeeks.length} semanas (${gapWeeks.map(w => 'S' + w.weekNumber).join(', ')})
- Covenants: ${covenants.length} - ${covenants.filter(c => c.status === 'COMPLIANT').length} en cumplimiento
- Clientes en alerta: ${alertCustomers.length} (${alertCustomers.map(c => c.name).join(', ')})
- Contexto activo: ${context}

INSTRUCCIONES:
- Responde SIEMPRE en español
- Sé conciso y directo, usa formato estructurado
- Incluye siempre: respuesta directa + bullets con datos + próximo paso recomendado + fuente de datos
- Usa € para importes, formato europeo (puntos de miles, coma decimal)
- Cita siempre la fuente de cada dato`

    const history = await prisma.botMessage.findMany({
      where: { tenantId, sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })

    const messages = history.slice(0, -1).map(m => ({
      role: m.role === 'USER' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }))
    messages.push({ role: 'user', content: message })

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const assistantMessage = response.content[0].type === 'text' ? response.content[0].text : ''
    await prisma.botMessage.create({ data: { tenantId, sessionId, role: 'ASSISTANT', content: assistantMessage, context } })

    return { message: assistantMessage, sessionId }
  }

  async getRecommendations(tenantId: string) {
    const [accounts, forecast, covenants, customers, invoicesAR, invoicesAP] = await Promise.all([
      prisma.bankAccount.findMany({ where: { tenantId } }),
      prisma.forecastWeek.findMany({ where: { tenantId, scenario: 'BASE' }, orderBy: { weekNumber: 'asc' } }),
      prisma.covenant.findMany({ where: { tenantId } }),
      prisma.customer.findMany({ where: { tenantId }, include: { invoices: { where: { status: { not: 'PAID' } } } } }),
      prisma.invoiceAR.findMany({ where: { tenantId, status: 'OVERDUE' }, include: { customer: true } }),
      prisma.invoiceAP.findMany({ where: { tenantId, status: { in: ['IN_REVIEW', 'PENDING_APPROVAL'] } }, include: { supplier: true } }),
    ])

    const totalCash = accounts.reduce((s, a) => s + Number(a.balance), 0)
    const gapWeeks = forecast.filter(w => w.isGap)
    const alertCustomers = customers.filter(c => c.status === 'ALERT' || c.riskLevel === 'CRITICAL')
    const overdueTotal = invoicesAR.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
    const pendingAPTotal = invoicesAP.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
    const atRiskCovenants = covenants.filter(c => Number(c.margin) < 20)

    const dataContext = `DATOS ACTUALES (${new Date().toLocaleDateString('es-ES')}):
- Caja: ${totalCash.toLocaleString('es-ES')} € en ${accounts.length} cuentas
- Forecast: ${gapWeeks.length} semanas con gap de tesorería${gapWeeks.length > 0 ? ` (${gapWeeks.map(w => 'S' + w.weekNumber).join(', ')})` : ''}
- Facturas vencidas (AR): ${invoicesAR.length} por ${overdueTotal.toLocaleString('es-ES')} €${invoicesAR.length > 0 ? `. Clientes: ${invoicesAR.map(i => (i as any).customer?.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}` : ''}
- Pagos pendientes de aprobación (AP): ${invoicesAP.length} por ${pendingAPTotal.toLocaleString('es-ES')} €
- Clientes en alerta/riesgo crítico: ${alertCustomers.length}${alertCustomers.length > 0 ? ` (${alertCustomers.map(c => `${c.name} — score ${c.creditScore}`).join(', ')})` : ''}
- Covenants en riesgo (margen<20%): ${atRiskCovenants.length}${atRiskCovenants.length > 0 ? ` (${atRiskCovenants.map(c => `${c.name}: margen ${c.margin}%`).join(', ')})` : ''}`

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: `Eres el Bot CFO de GEACFO. Genera exactamente 3 recomendaciones estratégicas concisas para el CFO basándote en los datos reales proporcionados.

FORMATO OBLIGATORIO — responde SOLO con JSON válido, sin markdown ni texto adicional:
[
  {"priority":"critical|warning|info","title":"Título corto (máx 60 chars)","action":"Acción concreta recomendada (máx 120 chars)","impact":"Impacto estimado en € o %","metric":"KPI afectado"}
]

REGLAS:
- Prioriza lo que tiene mayor impacto financiero inmediato
- Sé específico: usa nombres de clientes, importes exactos, semanas concretas
- Cada recomendación debe ser accionable (algo que el CFO puede hacer HOY)
- En español, formato europeo (puntos de miles, coma decimal)`,
        messages: [{ role: 'user', content: dataContext }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
      // Extract JSON array from response
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const recommendations = JSON.parse(jsonMatch[0])
        return { recommendations, generatedAt: new Date().toISOString() }
      }
      return { recommendations: [], generatedAt: new Date().toISOString() }
    } catch (e: any) {
      // Fallback: generate rule-based recommendations if API fails
      const recommendations: any[] = []

      if (gapWeeks.length > 0) {
        const firstGap = gapWeeks[0]
        recommendations.push({
          priority: 'critical',
          title: `Cubrir gap de tesorería Semana ${firstGap.weekNumber}`,
          action: `Negociar anticipo de cobros o línea de crédito para cubrir déficit de ${Math.abs(Number(firstGap.netCash)).toLocaleString('es-ES')} €`,
          impact: `+${Math.abs(Number(firstGap.netCash)).toLocaleString('es-ES')} €`,
          metric: 'Caja',
        })
      }

      if (invoicesAR.length > 0) {
        recommendations.push({
          priority: 'warning',
          title: `Acelerar cobro de ${invoicesAR.length} facturas vencidas`,
          action: `Contactar clientes morosos. Mayor exposición: ${(invoicesAR[0] as any).customer?.name || 'N/A'}`,
          impact: `+${overdueTotal.toLocaleString('es-ES')} €`,
          metric: 'DSO',
        })
      }

      if (alertCustomers.length > 0) {
        recommendations.push({
          priority: 'warning',
          title: `Revisar límite de crédito de ${alertCustomers.length} cliente(s)`,
          action: `${alertCustomers[0].name} tiene score ${alertCustomers[0].creditScore}. Considerar reducir exposición`,
          impact: 'Reducir riesgo de impago',
          metric: 'Scoring',
        })
      }

      if (recommendations.length < 3 && invoicesAP.length > 0) {
        recommendations.push({
          priority: 'info',
          title: `${invoicesAP.length} pagos pendientes de aprobar`,
          action: `Aprobar lote de ${pendingAPTotal.toLocaleString('es-ES')} € para mantener relación con proveedores`,
          impact: `-${pendingAPTotal.toLocaleString('es-ES')} €`,
          metric: 'DPO',
        })
      }

      return { recommendations: recommendations.slice(0, 3), generatedAt: new Date().toISOString(), fallback: true }
    }
  }

  async getHistory(tenantId: string, sessionId: string) {
    return prisma.botMessage.findMany({
      where: { tenantId, sessionId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async getSessions(tenantId: string) {
    const messages = await prisma.botMessage.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { sessionId: true, content: true, role: true, context: true, createdAt: true },
    })
    const sessionsMap = new Map<string, { sessionId: string; firstMessage: string; context: string | null; messageCount: number; lastActivity: Date }>()
    for (const m of messages) {
      const existing = sessionsMap.get(m.sessionId)
      if (!existing) {
        sessionsMap.set(m.sessionId, {
          sessionId: m.sessionId,
          firstMessage: m.role === 'USER' ? m.content.slice(0, 80) : '',
          context: m.context,
          messageCount: 1,
          lastActivity: m.createdAt,
        })
      } else {
        existing.messageCount++
        if (!existing.firstMessage && m.role === 'USER') {
          existing.firstMessage = m.content.slice(0, 80)
        }
      }
    }
    return [...sessionsMap.values()]
      .filter(s => s.firstMessage)
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
  }
}
