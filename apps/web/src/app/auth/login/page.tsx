'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginForm } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from '@/components/ui/field-error'
import { useToast } from '@/components/ui/use-toast'
import { BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('auth')

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'ana.castro@grupoiberico.es', password: 'geacfo2026' },
  })

  async function onSubmit(data: LoginForm) {
    setLoading(true)
    const res = await signIn('credentials', { email: data.email, password: data.password, redirect: false })
    if (res?.ok) {
      router.push('/dashboard/cockpit')
    } else {
      toast({ title: t('error'), description: t('errorDescription'), variant: 'destructive' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-primary to-[hsl(var(--gold))] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"><BarChart3 size={28} className="text-white" /></div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-foreground mb-1">{t('heading')}</h2>
          <p className="text-xs text-muted-foreground mb-6">{t('description')}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('email')}</Label>
              <Input id="email" type="email" {...register('email')}
                className={`mt-1.5 bg-muted border-border focus:border-primary ${errors.email ? 'border-destructive' : ''}`} />
              <FieldError message={errors.email?.message} />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('password')}</Label>
              <Input id="password" type="password" {...register('password')}
                className={`mt-1.5 bg-muted border-border focus:border-primary ${errors.password ? 'border-destructive' : ''}`} />
              <FieldError message={errors.password?.message} />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 font-semibold mt-2" disabled={loading}>
              {loading ? t('submitting') : t('submit')}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">{t('demo')}</p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {t('copyright', { year: new Date().getFullYear() })}
        </p>
      </div>
    </div>
  )
}
