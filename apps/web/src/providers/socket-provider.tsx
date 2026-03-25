'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'

export interface RealtimeNotification {
  id: string
  type: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  link: string
  data?: Record<string, any>
  timestamp: string
}

interface SocketContextValue {
  socket: Socket | null
  isConnected: boolean
  notifications: RealtimeNotification[]
  clearNotifications: () => void
  unreadCount: number
  /** Request browser notification permission. Returns the permission state. */
  requestPushPermission: () => Promise<NotificationPermission>
  pushPermission: NotificationPermission | 'default'
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  notifications: [],
  clearNotifications: () => {},
  unreadCount: 0,
  requestPushPermission: async () => 'default',
  pushPermission: 'default',
})

/** Event types that trigger a browser push notification */
const PUSH_TYPES = new Set(['covenant_risk', 'payment_approved', 'payment_rejected'])

/** Show a browser Notification if the tab is not focused and permission is granted */
function maybeSendBrowserNotification(event: Omit<RealtimeNotification, 'id'>) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (document.hasFocus()) return

  // Only push for critical/warning severity OR specific event types
  const shouldPush = event.severity === 'critical' || PUSH_TYPES.has(event.type)
  if (!shouldPush) return

  const icon = event.severity === 'critical' ? '/icon-alert.png' : '/icon-info.png'
  const n = new Notification(event.title, {
    body: event.description,
    icon,
    tag: `geacfo-${event.type}-${event.timestamp}`,
    silent: false,
  })

  // Click on notification focuses the app and navigates to the relevant page
  n.onclick = () => {
    window.focus()
    if (event.link) window.location.href = event.link
    n.close()
  }

  // Auto-close after 8 seconds
  setTimeout(() => n.close(), 8000)
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([])
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'default'>('default')
  const idCounter = useRef(0)

  // Sync initial permission state
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission)
    }
  }, [])

  const requestPushPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
    const result = await Notification.requestPermission()
    setPushPermission(result)
    return result
  }, [])

  useEffect(() => {
    const token = (session as any)?.accessToken
    if (!token) return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const s = io(`${apiUrl}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    })

    s.on('connect', () => setIsConnected(true))
    s.on('disconnect', () => setIsConnected(false))

    s.on('notification', (event: Omit<RealtimeNotification, 'id'>) => {
      idCounter.current++
      setNotifications(prev => [{
        ...event,
        id: `rt-${idCounter.current}-${Date.now()}`,
      }, ...prev].slice(0, 50))

      // Send browser push notification if tab is not focused
      maybeSendBrowserNotification(event)
    })

    setSocket(s)

    return () => {
      s.disconnect()
      setSocket(null)
      setIsConnected(false)
    }
  }, [(session as any)?.accessToken])

  const clearNotifications = useCallback(() => setNotifications([]), [])

  return (
    <SocketContext.Provider value={{
      socket, isConnected, notifications, clearNotifications,
      unreadCount: notifications.length,
      requestPushPermission, pushPermission,
    }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
