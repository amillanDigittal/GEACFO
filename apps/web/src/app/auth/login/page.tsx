'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { BarChart3 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('ana.castro@grupoiberico.es')
  const [password, setPassword] = useState('geacfo2026')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.ok) {
      router.push('/dashboard/cockpit')
    } else {
      toast({ title: 'Error de autenticación', description: 'Credenciales inválidas', variant: 'destructive' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-primary to-[hsl(var(--gold))] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"><BarChart3 size={28} className="text-white" /></div>
          <h1 className="font-display text-2xl font-bold text-foreground">GEACFO</h1>
          <p className="text-sm text-muted-foreground mt-1">Plataforma de Inteligencia Financiera</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-foreground mb-1">Acceso CFO</h2>
          <p className="text-xs text-muted-foreground mb-6">Introduce tus credenciales para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="mt-1.5 bg-muted border-border focus:border-primary" required />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="mt-1.5 bg-muted border-border focus:border-primary" required />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 font-semibold mt-2" disabled={loading}>
              {loading ? 'Accediendo...' : 'Entrar al Dashboard'}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">Demo: ana.castro@grupoiberico.es / geacfo2026</p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          GEACFO v1.0 · © {new Date().getFullYear()} Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
