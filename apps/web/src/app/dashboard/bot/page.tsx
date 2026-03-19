'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageSquarePlus, History, Trash2 } from 'lucide-react'

const STORAGE_KEY = 'geacfo_bot_session'
const SUGGESTED = [
  '¿Cómo soluciono el gap de semana 8?',
  '¿Cuál es mi posición de caja hoy?',
  '¿Cuándo rompo el covenant de liquidez?',
  '¿Qué clientes tienen mayor riesgo?',
  'Genera un resumen para el board pack',
]
const CONTEXTS = ['tesoreria', 'riesgo', 'inventario', 'deuda']

const GREETING: Message = {
  role: 'assistant',
  content: 'Hola, soy el **Bot CFO** de GEACFO. Tengo acceso en tiempo real a todos los datos financieros de tu empresa: caja, forecast, riesgo, covenants e inventario.\n\n¿En qué puedo ayudarte hoy?'
}

interface Message { role: 'user' | 'assistant'; content: string }
interface Session { sessionId: string; firstMessage: string; context: string | null; messageCount: number; lastActivity: string }

function generateSessionId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function BotPage() {
  const [sessionId, setSessionId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState('tesoreria')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)

  // Initialize sessionId from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setSessionId(stored)
    } else {
      const newId = generateSessionId()
      localStorage.setItem(STORAGE_KEY, newId)
      setSessionId(newId)
    }
  }, [])

  // Load history when sessionId is set
  useEffect(() => {
    if (!sessionId) return
    setLoadingHistory(true)
    api.bot.history(sessionId)
      .then((history: any[]) => {
        if (history.length > 0) {
          const restored: Message[] = history.map(m => ({
            role: m.role === 'USER' ? 'user' as const : 'assistant' as const,
            content: m.content,
          }))
          setMessages([GREETING, ...restored])
          // Restore context from last message
          const lastWithContext = [...history].reverse().find(m => m.context)
          if (lastWithContext?.context) setContext(lastWithContext.context)
        } else {
          setMessages([GREETING])
        }
      })
      .catch(() => setMessages([GREETING]))
      .finally(() => setLoadingHistory(false))
  }, [sessionId])

  // Load sessions list
  const loadSessions = useCallback(() => {
    setLoadingSessions(true)
    api.bot.sessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false))
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages])

  function startNewSession() {
    const newId = generateSessionId()
    localStorage.setItem(STORAGE_KEY, newId)
    setSessionId(newId)
    setMessages([GREETING])
    setShowSessions(false)
    loadSessions()
  }

  function switchSession(sid: string) {
    localStorage.setItem(STORAGE_KEY, sid)
    setSessionId(sid)
    setShowSessions(false)
  }

  async function sendMessage(text?: string) {
    const msg = text || input.trim()
    if (!msg || !sessionId) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const res = await api.bot.chat(msg, sessionId, context)
      setMessages(prev => [...prev, { role: 'assistant', content: res.message }])
      loadSessions()
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

  function fmtDate(d: string) {
    const date = new Date(d)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Ahora'
    if (diffMin < 60) return `Hace ${diffMin} min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `Hace ${diffH}h`
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="space-y-4 h-[calc(100vh-160px)] md:h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-start justify-between">
        <div><h1 className="page-title">Bot CFO — Asistente IA</h1><p className="page-subtitle">Análisis conversacional con acceso a datos financieros en tiempo real · Claude API</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSessions(!showSessions)}>
            <History size={14} className="mr-1" />{showSessions ? 'Ocultar' : 'Historial'}
          </Button>
          <Button size="sm" onClick={startNewSession}>
            <MessageSquarePlus size={14} className="mr-1" />Nueva
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        <Card className={`${showSessions ? 'lg:col-span-1' : 'lg:col-span-2'} flex flex-col min-h-0`}>
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
            {loadingHistory ? (
              <div className="text-center py-10 text-sm text-muted-foreground">Cargando conversación...</div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${m.role === 'assistant' ? 'bg-gradient-to-br from-primary to-[hsl(var(--gold))] text-white' : 'bg-muted border border-border text-muted-foreground'}`}>
                    {m.role === 'assistant' ? 'AI' : 'AC'}
                  </div>
                  <div className={`max-w-[90%] md:max-w-[75%] rounded-xl p-3 text-sm leading-relaxed ${m.role === 'assistant' ? 'bg-muted border border-border text-foreground rounded-tl-none' : 'bg-primary text-white rounded-tr-none'}`}>
                    {m.role === 'assistant' ? <div className="space-y-0.5">{renderContent(m.content)}</div> : m.content}
                  </div>
                </div>
              ))
            )}
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

        {/* Sessions panel */}
        {showSessions && (
          <Card className="flex flex-col min-h-0">
            <CardHeader>
              <CardTitle>Conversaciones</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0 space-y-0">
              {loadingSessions ? (
                <div className="text-center py-6 text-sm text-muted-foreground">Cargando...</div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">Sin conversaciones previas</div>
              ) : (
                sessions.map(s => (
                  <button
                    key={s.sessionId}
                    onClick={() => switchSession(s.sessionId)}
                    className={`w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-muted/50 ${s.sessionId === sessionId ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                  >
                    <div className="text-sm font-medium truncate">{s.firstMessage || 'Conversación'}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{fmtDate(s.lastActivity)}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">{s.messageCount} msgs</span>
                      {s.context && (
                        <>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{s.context}</span>
                        </>
                      )}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Sidebar */}
        {!showSessions && (
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
                  { label: 'Datos a', value: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                  { label: 'Fuentes', value: '6 activas' },
                  { label: 'Modelo', value: 'Claude Sonnet' },
                ].map(r => (
                  <div key={r.label} className="stat-row"><span className="stat-label">{r.label}</span><span className="stat-value text-xs">{r.value}</span></div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
