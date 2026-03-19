'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { UserPlus, Pencil, Trash2, Shield, Eye, EyeOff, Search } from 'lucide-react'
import { PageHeader } from '@/components/page-header'

const ROLES = ['ADMIN', 'CFO', 'CONTROLLER', 'ANALYST', 'VIEWER'] as const
const ROLE_CONFIG: Record<string, { label: string; variant: 'destructive' | 'warning' | 'success' | 'secondary' | 'default'; desc: string }> = {
  ADMIN: { label: 'Admin', variant: 'destructive', desc: 'Acceso total al sistema y gestión de usuarios' },
  CFO: { label: 'CFO', variant: 'default', desc: 'Acceso completo a datos financieros y aprobaciones' },
  CONTROLLER: { label: 'Controller', variant: 'warning', desc: 'Control financiero y reporting' },
  ANALYST: { label: 'Analista', variant: 'secondary', desc: 'Consulta y análisis de datos' },
  VIEWER: { label: 'Visor', variant: 'secondary', desc: 'Solo lectura' },
}

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
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState<string>('ANALYST')
  const [formPassword, setFormPassword] = useState('')

  const { toast } = useToast()
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadUsers = useCallback(() => {
    return api.users.list()
      .then(setUsers)
      .catch(console.error)
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  if (loading) return <SkeletonKPIsAndTable cols={5} rows={4} />

  const filtered = search
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    : users

  function openCreate() {
    setEditUser(null)
    setFormName('')
    setFormEmail('')
    setFormRole('ANALYST')
    setFormPassword('')
    setShowPassword(false)
    setDialogOpen(true)
  }

  function openEdit(user: User) {
    setEditUser(user)
    setFormName(user.name)
    setFormEmail(user.email)
    setFormRole(user.role)
    setFormPassword('')
    setShowPassword(false)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formName.trim() || !formEmail.trim()) {
      toast({ title: 'Error', description: 'Nombre y email son obligatorios', variant: 'destructive' })
      return
    }
    if (!editUser && !formPassword) {
      toast({ title: 'Error', description: 'La contraseña es obligatoria para nuevos usuarios', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      if (editUser) {
        const data: any = { name: formName, email: formEmail, role: formRole }
        if (formPassword) data.password = formPassword
        await api.users.update(editUser.id, data)
        toast({ title: 'Usuario actualizado', description: `${formName} actualizado correctamente` })
      } else {
        await api.users.create({ name: formName, email: formEmail, role: formRole, password: formPassword })
        toast({ title: 'Usuario creado', description: `${formName} añadido al tenant` })
      }
      setDialogOpen(false)
      loadUsers()
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
      toast({ title: 'Usuario eliminado', description: `${deleteConfirm.name} ha sido eliminado` })
      setDeleteConfirm(null)
      loadUsers()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      setDeleteConfirm(null)
    }
  }

  function fmtDate(d: string | null) {
    if (!d) return 'Nunca'
    const date = new Date(d)
    const now = new Date()
    const diffH = Math.floor((now.getTime() - date.getTime()) / 3600000)
    if (diffH < 1) return 'Hace momentos'
    if (diffH < 24) return `Hace ${diffH}h`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `Hace ${diffD}d`
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Role counts
  const roleCounts: Record<string, number> = {}
  users.forEach(u => { roleCounts[u.role] = (roleCounts[u.role] || 0) + 1 })

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Gestión de Usuarios"
        subtitle={`Grupo Ibérico SA · ${users.length} usuario${users.length !== 1 ? 's' : ''} registrado${users.length !== 1 ? 's' : ''}`}
        lastUpdated={lastUpdated}
        onRefresh={loadUsers}
        actions={
          <Button size="sm" onClick={openCreate}>
            <UserPlus size={14} className="mr-1" />Nuevo Usuario
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
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o email..." className="pl-8 h-9 text-sm" />
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
                      <span>Último acceso: {fmtDate(user.lastLogin)}</span>
                      <span>·</span>
                      <span>Creado: {fmtDate(user.createdAt)}</span>
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
          {search ? 'No se encontraron usuarios con esa búsqueda' : 'No hay usuarios registrados'}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
            <DialogDescription>{editUser ? `Modificar datos de ${editUser.name}` : 'Añadir un nuevo usuario al tenant'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nombre completo *</label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nombre y apellidos" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Email *</label>
              <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="usuario@empresa.es" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Rol *</label>
              <div className="grid grid-cols-5 gap-1.5">
                {ROLES.map(r => {
                  const cfg = ROLE_CONFIG[r]
                  return (
                    <button
                      key={r}
                      onClick={() => setFormRole(r)}
                      className={`p-2 rounded-lg border text-center transition-colors ${formRole === r ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'}`}
                    >
                      <div className="text-[10px] font-semibold">{cfg.label}</div>
                    </button>
                  )
                })}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{ROLE_CONFIG[formRole]?.desc}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Contraseña {editUser ? '(dejar vacío para no cambiar)' : '*'}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  placeholder={editUser ? '••••••••' : 'Mínimo 6 caracteres'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editUser ? 'Guardar Cambios' : 'Crear Usuario'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar Usuario</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar a <strong>{deleteConfirm?.name}</strong> ({deleteConfirm?.email})?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
