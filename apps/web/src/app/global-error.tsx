'use client'

/**
 * Global error boundary — catches errors in the root layout itself.
 * Must provide its own <html>/<body> since the root layout may have failed.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0d1117', color: '#e6edf3' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '360px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Error crítico</h1>
            <p style={{ fontSize: '14px', color: '#8b949e', marginBottom: '24px' }}>
              La aplicación ha encontrado un error grave. Intenta recargar la página.
            </p>
            <button
              onClick={reset}
              style={{
                background: '#2563eb', color: 'white', border: 'none', padding: '10px 24px',
                borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Recargar
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
