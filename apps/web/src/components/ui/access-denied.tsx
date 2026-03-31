'use client'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export function AccessDenied() {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <ShieldX size={28} className="text-destructive" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Acceso restringido</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        No tienes permisos suficientes para acceder a esta sección.
      </p>
      <Button onClick={() => router.push('/dashboard/cockpit')}>Ir al Cockpit</Button>
    </div>
  )
}
