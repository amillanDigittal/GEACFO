'use client'
import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const SESSION_ID = Math.random().toString(36).slice(2)
const SUGGESTED = [
  '¿Cómo soluciono el gap de semana 8?',
  '¿Cuál es mi posición de caja hoy?',
  '¿Cuándo rompo el covenant de liquidez?',
  '¿Qué clientes tienen mayor riesgo?',
  'Genera un resumen para el board pack',
]
const CONTEXTS = ['tesoreria', 'riesgo', 'inventario', 'deuda']

interface Message { role: 'user' | 'assistant'; content: string }

export default function BotPage() {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: 'Hola, soy el **Bot CFO** de GEACFO. Tengo acceso en tiempo real a todos los datos financieros de tu empresa: caja, forecast, riesgo, covenants e inventario.\n\n¿En qué puedo ayudarte hoy?'
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState('tesoreria')
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages])

  async function sendMessage(text?: string) {
    const msg = text || input.trim()
    if (!msg) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const res = await api.bot.chat(msg, SESSION_ID, context)
      setMessages(prev => [...prev, { role: 'assistant', content: res.message }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión con el servidor. Verifica que la API esté activa.' }])
    } finally {
      setLoading(false)
    }
  }

  function renderContent(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-foreground mb-1">{line.slice(2,-2)}</p>
      if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>
      if (line.match(/\*\*/)) return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
      return line ? <p key={i} className="mb-1">{line}</p> : <br key={i} />
    })
  }

  return (
    <div className="space-y-4 h-[calc(100vh-120px)] flex flex-col">
      <div><h1 className="page-title">Bot CFO — Asistente IA</h1><p className="page-subtitle">Análisis conversacional con acceso a datos financieros en tiempo real · Claude API</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        <Card className="lg:col-span-2 flex flex-col min-h-0">
          {/* Context */}
          <div className="flex gap-2 p-3 border-b border-border flex-wrap">
            {CONTEXTS.map(c => (
              <button key={c} onClick={() => setContext(c)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${context === c ? 'bg-primary/15 border-primary text-primary border' : 'bg-muted border border-border text-muted-foreground hover:text-foreground'}`}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${m.role === 'assistant' ? 'bg-gradient-to-br from-primary to-[hsl(var(--gold))] text-white' : 'bg-muted border border-border text-muted-foreground'}`}>
                  {m.role === 'assistant' ? 'AI' : 'AC'}
                </div>
                <div className={`max-w-[75%] rounded-xl p-3 text-sm leading-relaxed ${m.role === 'assistant' ? 'bg-muted border border-border text-foreground rounded-tl-none' : 'bg-primary text-white rounded-tr-none'}`}>
                  {m.role === 'assistant' ? <div className="space-y-0.5">{renderContent(m.content)}</div> : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[hsl(var(--gold))] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">AI</div>
                <div className="bg-muted border border-border rounded-xl rounded-tl-none p-3 flex gap-1.5 items-center">
                  {[0,1,2].map(n => <span key={n} className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: `${n*150}ms` }} />)}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && sendMessage()} placeholder="Pregunta sobre tesorería, riesgo, covenants…" className="flex-1" disabled={loading} />
            <Button onClick={() => sendMessage()} disabled={loading || !input.trim()}>Enviar</Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Preguntas Sugeridas</CardTitle></CardHeader>
            <CardContent className="space-y-2 p-3">
              {SUGGESTED.map(q => (
                <button key={q} onClick={() => sendMessage(q)} className="w-full text-left text-xs p-2.5 bg-muted hover:bg-muted/80 border border-border rounded-lg text-foreground transition-colors">{q}</button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Contexto Activo</CardTitle></CardHeader>
            <CardContent>
              {[
                { label: 'Módulo', value: context.charAt(0).toUpperCase() + context.slice(1) },
                { label: 'Datos a', value: '05/03/2026 09:14' },
                { label: 'Fuentes', value: '6 activas' },
                { label: 'Modelo', value: 'Claude Sonnet' },
              ].map(r => (
                <div key={r.label} className="stat-row"><span className="stat-label">{r.label}</span><span className="stat-value text-xs">{r.value}</span></div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
