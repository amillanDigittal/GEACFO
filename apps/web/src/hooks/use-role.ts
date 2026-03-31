'use client'
import { useSession } from 'next-auth/react'

type Role = 'ADMIN' | 'CFO' | 'CONTROLLER' | 'ANALYST' | 'VIEWER'

const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 5,
  CFO: 4,
  CONTROLLER: 3,
  ANALYST: 2,
  VIEWER: 1,
}

export function useRole() {
  const { data: session } = useSession()
  const role = (session?.user?.role as Role) || 'VIEWER'

  const hasRole = (minRole: Role) => (ROLE_HIERARCHY[role] || 0) >= (ROLE_HIERARCHY[minRole] || 0)
  const isAdmin = role === 'ADMIN'
  const canEdit = hasRole('CONTROLLER')
  const canManage = hasRole('CFO')

  return { role, hasRole, isAdmin, canEdit, canManage }
}
