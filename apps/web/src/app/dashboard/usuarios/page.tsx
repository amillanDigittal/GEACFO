'use client'
import { useState } from 'react'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useHydrated } from '@/hooks/use-hydrated'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createUserSchema, editUserSchema, type CreateUserForm, type EditUserForm } from '@/lib/validations'
import { api } from '@/lib/api'
import { useUsers } from '@/hooks/use-api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldError } from '@/components/ui/field-error'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonUsuarios } from '@/components/ui/skeleton-page'
import { UserPlus, Pencil, Trash2, Shield, Eye, EyeOff, Search } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { useTranslations } from 'next-intl'

const ROLES = ['ADMIN', 'CFO', 'CONTROLLER', 'ANALYST', 'VIEWER'] as const

interface User {
  id: string
  email: string
  name: string
  role: string
  avatarUrl: string | null
  lastLogin: string | null
  createdAt: string
  updatedAt: string
}

export default function UsuariosPage() {
  const t = useTranslations('usuarios')

  const ROLE_CONFIG: Record<string, { label: string; variant: 'destructive' | 'warning' | 'success' | 'secondary' | 'default'; desc: string }> = {
    ADMIN: { label: 'Admin', variant: 'destructive', desc: t('roleAdminDesc') },
    CFO: { label: 'CFO', variant: 'default', desc: t('roleCfoDesc') },
    CONTROLLER: { label: 'Controller', variant: 'warning', desc: t('roleControllerDesc') },
    ANALYST: { label: t('roleAnalyst'), variant: 'secondary', desc: t('roleAnalystDesc') },
    VIEWER: { label: t('roleViewer'), variant: 'secondary', desc: t('roleViewerDesc') },
  }

  const { data: users = [], isLoading, mutate } = useUsers()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  const form = useForm<CreateUserForm | EditUserForm>({
    resolver: zodResolver(editUser ? editUserSchema : createUserSchema),
    defaultValues: { name: '', email: '', role: 'ANALYST', password: '' },
  })

  const { toast } = useToast()

  useKeyboardShortcuts([
    { key: 'n', label: t('shortcutNewUser'), action: () => openCreate() },
    { key: 'r', label: t('shortcutRefresh'), action: () => { mutate() } },
  ])

  const hydrated = useHydrated()

  if (!hydrated || isLoading) return <SkeletonUsuarios />

  const filtered = search
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    : users

  function openCreate() {
    setEditUser(null)
    form.reset({ name: '', email: '', role: 'ANALYST', password: '' })
    setShowPassword(false)
    setDialogOpen(true)
  }

  function openEdit(user: User) {
    setEditUser(user)
    form.reset({ name: user.name, email: user.email, role: user.role as any, password: '' })
    setShowPassword(false)
    setDialogOpen(true)
  }

  async function handleSave(data: CreateUserForm | EditUserForm) {
    setSaving(true)
    try {
      if (editUser) {
        const payload: any = { name: data.name, email: data.email, role: data.role }
        if (data.password) payload.password = data.password
        await api.users.update(editUser.id, payload)
        toast({ title: t('toastUserUpdated'), description: t('toastUserUpdatedDesc', { name: data.name }) })
      } else {
        await api.users.create({ name: data.name, email: data.email, role: data.role, password: data.password })
        toast({ title: t('toastUserCreated'), description: t('toastUserCreatedDesc', { name: data.name }) })
      }
      setDialogOpen(false)
      mutate()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    try {
      await api.users.remove(deleteConfirm.id)
      toast({ title: t('toastUserDeleted'), description: t('toastUserDeletedDesc', { name: deleteConfirm.name }) })
      setDeleteConfirm(null)
      mutate()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      setDeleteConfirm(null)
    }
  }

  function fmtDate(d: string | null) {
    if (!d) return t('timeNever')
    const date = new Date(d)
    const now = new Date()
    const diffH = Math.floor((now.getTime() - date.getTime()) / 3600000)
    if (diffH < 1) return t('timeMomentsAgo')
    if (diffH < 24) return t('timeHoursAgo', { hours: diffH })
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return t('timeDaysAgo', { days: diffD })
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Role counts
  const roleCounts: Record<string, number> = {}
  users.forEach(u => { roleCounts[u.role] = (roleCounts[u.role] || 0) + 1 })

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: users.length })}
        lastUpdated={null}
        onRefresh={() => mutate()}
        actions={
          <Button size="sm" onClick={openCreate}>
            <UserPlus size={14} className="mr-1" />{t('newUser')}
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {ROLES.map(r => {
          const cfg = ROLE_CONFIG[r]
          return (
            <div key={r} className="bg-card border border-border rounded-xl p-3 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{cfg.label}</div>
              <div className="font-mono text-xl font-bold">{roleCounts[r] || 0}</div>
            </div>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchPlaceholder')} className="pl-8 h-9 text-sm" />
      </div>

      {/* User cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(user => {
          const rCfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.VIEWER
          const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
          return (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-[hsl(var(--gold))] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm truncate">{user.name}</span>
                      <Badge variant={rCfg.variant}>{rCfg.label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span>{t('lastAccess')}: {fmtDate(user.lastLogin)}</span>
                      <span>·</span>
                      <span>{t('created')}: {fmtDate(user.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-1">
                    <Shield size={10} />
                    <span>{rCfg.desc}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(user)}>
                    <Pencil size={12} />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(user)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {search ? t('noUsersFoundSearch') : t('noUsersRegistered')}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? t('editUser') : t('newUser')}</DialogTitle>
            <DialogDescription>{editUser ? t('editUserDesc', { name: editUser.name }) : t('newUserDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('labelFullName')} *</label>
              <Input {...form.register('name')} placeholder={t('placeholderFullName')} className={form.formState.errors.name ? 'border-destructive' : ''} />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('labelEmail')} *</label>
              <Input type="email" {...form.register('email')} placeholder={t('placeholderEmail')} className={form.formState.errors.email ? 'border-destructive' : ''} />
              <FieldError message={form.formState.errors.email?.message} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('labelRole')} *</label>
              <div className="grid grid-cols-5 gap-1.5">
                {ROLES.map(r => {
                  const cfg = ROLE_CONFIG[r]
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => form.setValue('role', r)}
                      className={`p-2 rounded-lg border text-center transition-colors ${form.watch('role') === r ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'}`}
                    >
                      <div className="text-[10px] font-semibold">{cfg.label}</div>
                    </button>
                  )
                })}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{ROLE_CONFIG[form.watch('role')]?.desc}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t('labelPassword')} {editUser ? t('passwordOptionalHint') : '*'}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  {...form.register('password')}
                  placeholder={editUser ? '••••••••' : t('placeholderPassword')}
                  className={form.formState.errors.password ? 'border-destructive' : ''}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <FieldError message={form.formState.errors.password?.message} />
              {!editUser && !form.formState.errors.password && (
                <p className="text-[10px] text-muted-foreground mt-1">{t('passwordRequirements')}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
              <Button type="submit" disabled={saving}>
                {saving ? t('saving') : editUser ? t('saveChanges') : t('createUser')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteUser')}</DialogTitle>
            <DialogDescription>
              {t('deleteUserConfirm', { name: deleteConfirm?.name || '', email: deleteConfirm?.email || '' })}
              {' '}{t('deleteUserWarning')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t('cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('delete')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
