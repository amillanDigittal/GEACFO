import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl font-mono font-bold text-muted-foreground/30 mb-4">404</div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground mb-6">
          La página que buscas no existe o ha sido movida.
        </p>
        <Link
          href="/dashboard/cockpit"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold py-2.5 px-5 rounded-lg hover:bg-primary/90 transition-colors text-sm"
        >
          Ir al Cockpit
        </Link>
      </div>
    </div>
  )
}
