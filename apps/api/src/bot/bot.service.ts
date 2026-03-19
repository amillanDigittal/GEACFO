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
