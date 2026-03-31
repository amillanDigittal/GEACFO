'use client'
import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useBotHistory, useBotSessions } from '@/hooks/use-api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageSquarePlus, History, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useTranslations } from 'next-intl'
import { useHydrated } from '@/hooks/use-hydrated'

const STORAGE_KEY = 'geacfo_bot_session'
const CONTEXTS = ['tesoreria', 'riesgo', 'inventario', 'deuda']

interface Message { role: 'user' | 'assistant'; content: string }
interface Session { sessionId: string; firstMessage: string; context: string | null; messageCount: number; lastActivity: string }

function generateSessionId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function getFollowUps(lastMessage: string): string[] {
  const lower = lastMessage.toLowerCase()
  const suggestions: string[] = []

  if (lower.includes('dso') || lower.includes('cobr')) suggestions.push('¿Qué clientes tienen mayor DSO?')
  if (lower.includes('liquidez') || lower.includes('ratio')) suggestions.push('¿Cómo puedo mejorar la liquidez?')
  if (lower.includes('deuda') || lower.includes('covenant')) suggestions.push('¿Cuál es el riesgo de incumplir covenants?')
  if (lower.includes('flujo') || lower.includes('cash')) suggestions.push('¿Cuál es la proyección de caja a 13 semanas?')
  if (lower.includes('proveedor') || lower.includes('pago')) suggestions.push('¿Qué pagos vencen esta semana?')
  if (lower.includes('client') || lower.includes('scoring')) suggestions.push('¿Qué clientes tienen mayor riesgo?')
  if (lower.includes('ebitda') || lower.includes('margen')) suggestions.push('¿Cómo evoluciona el margen EBITDA?')
  if (lower.includes('inventario') || lower.includes('stock')) suggestions.push('¿Cuál es la rotación de inventario actual?')

  if (suggestions.length === 0) suggestions.push('¿Cuál es el resumen financiero actual?')
  return suggestions.slice(0, 3)
}

export default function BotPage() {
  const t = useTranslations('bot')

  const SUGGESTED = [
    t('suggested1'),
    t('suggested2'),
    t('suggested3'),
    t('suggested4'),
    t('suggested5'),
  ]

  const GREETING: Message = {
    role: 'assistant',
    content: t('greeting'),
  }

  const [sessionId, setSessionId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState('tesoreria')
  const [showSessions, setShowSessions] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const hydrated = useHydrated()

  // SWR hooks for data fetching
  const { data: historyData, isLoading: loadingHistory, mutate: mutateHistory } = useBotHistory(sessionId || null)
  const { data: sessions = [], isLoading: loadingSessions, mutate: mutateSessions } = useBotSessions()

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

  // Sync local messages state from SWR history data
  useEffect(() => {
    if (!historyData) return
    if (historyData.length > 0) {
      const restored: Message[] = historyData.map((m: any) => ({
        role: m.role === 'USER' ? 'user' as const : 'assistant' as const,
        content: m.content,
      }))
      setMessages([GREETING, ...restored])
      // Restore context from last message
      const lastWithContext = [...historyData].reverse().find((m: any) => m.context)
      if (lastWithContext?.context) setContext(lastWithContext.context)
    } else {
      setMessages([GREETING])
    }
  }, [historyData])

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages])

  function startNewSession() {
    const newId = generateSessionId()
    localStorage.setItem(STORAGE_KEY, newId)
    setSessionId(newId)
    setMessages([GREETING])
    setShowSessions(false)
    mutateSessions()
  }

  useKeyboardShortcuts([
    { key: 'n', label: t('newConversation'), action: startNewSession },
  ])

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
      mutateHistory()
      mutateSessions()
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: t('connectionError') }])
    } finally {
      setLoading(false)
    }
  }

  function renderContent(text: string) {
    return (
      <ReactMarkdown
        skipHtml
        components={{
          p: ({ children }) => <p className="mb-1">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-0.5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          code: ({ children }) => <code className="px-1 py-0.5 rounded bg-background text-xs font-mono">{children}</code>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>,
        }}
      >
        {text}
      </ReactMarkdown>
    )
  }

  function fmtDate(d: string) {
    const date = new Date(d)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return t('timeNow')
    if (diffMin < 60) return t('timeMinutesAgo', { minutes: diffMin })
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return t('timeHoursAgo', { hours: diffH })
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="space-y-4 h-[calc(100vh-160px)] md:h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-start justify-between">
        <div><h1 className="page-title">{t('pageTitle')}</h1><p className="page-subtitle">{t('pageSubtitle')}</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSessions(!showSessions)}>
            <History size={14} className="mr-1" />{showSessions ? t('hide') : t('history')}
          </Button>
          <Button size="sm" onClick={startNewSession}>
            <MessageSquarePlus size={14} className="mr-1" />{t('new')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 flex-1 min-h-0">
        <Card className="lg:col-span-2 flex flex-col min-h-0 flex-1">
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
              <div className="text-center py-10 text-sm text-muted-foreground">{t('loadingConversation')}</div>
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
            {/* Follow-up suggestions */}
            {messages.length > 1 && messages[messages.length - 1]?.role === 'assistant' && !loading && (
              <div className="flex flex-wrap gap-2 mt-2 ml-11">
                {getFollowUps(messages[messages.length - 1].content).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && sendMessage()} placeholder={t('inputPlaceholder')} className="flex-1" disabled={loading} />
            <Button onClick={() => sendMessage()} disabled={loading || !input.trim()}>{t('send')}</Button>
          </div>
        </Card>

        {/* Sidebar — hidden on mobile */}
        <div className="hidden lg:flex flex-col gap-4 relative">
          <Card>
            <CardHeader><CardTitle>{t('suggestedQuestions')}</CardTitle></CardHeader>
            <CardContent className="space-y-2 p-3">
              {SUGGESTED.map(q => (
                <button key={q} onClick={() => sendMessage(q)} className="w-full text-left text-xs p-2.5 bg-muted hover:bg-muted/80 border border-border rounded-lg text-foreground transition-colors">{q}</button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t('activeContext')}</CardTitle></CardHeader>
            <CardContent>
              {[
                { label: t('contextModule'), value: context.charAt(0).toUpperCase() + context.slice(1) },
                { label: t('contextDataAt'), value: hydrated ? new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
                { label: t('contextSources'), value: t('contextSourcesValue') },
                { label: t('contextModel'), value: 'Claude Sonnet' },
              ].map(r => (
                <div key={r.label} className="stat-row"><span className="stat-label">{r.label}</span><span className="stat-value text-xs">{r.value}</span></div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sessions panel — always rendered as fixed overlay */}
      {showSessions && (
        <>
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setShowSessions(false)} />
          <Card className="fixed inset-x-4 top-4 bottom-4 z-50 flex flex-col overflow-hidden sm:inset-x-auto sm:right-4 sm:left-auto sm:w-96">
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <CardTitle>{t('conversations')}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowSessions(false)} className="text-xs">{t('hide')}</Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0 space-y-0">
              {loadingSessions ? (
                <div className="text-center py-6 text-sm text-muted-foreground">{t('loading')}</div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">{t('noConversations')}</div>
              ) : (
                sessions.map(s => (
                  <button
                    key={s.sessionId}
                    onClick={() => switchSession(s.sessionId)}
                    className={`w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-muted/50 ${s.sessionId === sessionId ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                  >
                    <div className="text-sm font-medium truncate">{s.firstMessage || t('conversationDefault')}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{fmtDate(s.lastActivity)}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">{t('messageCount', { count: s.messageCount })}</span>
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
        </>
      )}
    </div>
  )
}
