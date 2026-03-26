'use client'
import { useEffect } from 'react'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { SWRConfig } from 'swr'
import { SocketProvider } from '@/providers/socket-provider'
import { SessionGuard } from '@/components/session-guard'
import { onApiError } from '@/lib/api'

function useServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed (e.g. insecure context) — silent fail
      })
    }
  }, [])
}

export function Providers({ children }: { children: React.ReactNode }) {
  useServiceWorker()

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <SWRConfig value={{ onError: onApiError }}>
          <SocketProvider>
            {children}
            <SessionGuard />
          </SocketProvider>
        </SWRConfig>
      </ThemeProvider>
    </SessionProvider>
  )
}
