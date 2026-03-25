'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type ConnectionState = 'connected' | 'offline' | 'api-down'

const PING_INTERVAL = 30_000   // check every 30s while connected
const RETRY_INTERVAL = 5_000   // retry every 5s when disconnected
const PING_TIMEOUT = 5_000     // consider ping failed after 5s

export function useConnectionStatus() {
  const [state, setState] = useState<ConnectionState>('connected')
  const [retrying, setRetrying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const checkApi = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), PING_TIMEOUT)
      // Hits Next.js /api/health which proxies to NestJS /health (no auth needed)
      const res = await fetch('/api/health', { signal: controller.signal, cache: 'no-store' })
      clearTimeout(timer)
      return res.ok || res.status === 503 // 503 = degraded but reachable
    } catch {
      return false
    }
  }, [])

  const evaluate = useCallback(async () => {
    if (!navigator.onLine) {
      setState('offline')
      return
    }
    setRetrying(true)
    const apiOk = await checkApi()
    setRetrying(false)
    setState(apiOk ? 'connected' : 'api-down')
  }, [checkApi])

  useEffect(() => {
    // Initial check
    evaluate()

    const schedule = () => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        await evaluate()
        schedule()
      }, state === 'connected' ? PING_INTERVAL : RETRY_INTERVAL)
    }
    schedule()

    const goOnline = () => evaluate()
    const goOffline = () => setState('offline')

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      clearTimeout(timerRef.current)
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [evaluate, state])

  return { state, retrying, retry: evaluate }
}
