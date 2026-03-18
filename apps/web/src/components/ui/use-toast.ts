'use client'
import { useState, useCallback } from 'react'
type ToastVariant = 'default' | 'destructive' | 'success'
interface Toast { id: string; title?: string; description?: string; variant?: ToastVariant }
let toastFn: (toast: Omit<Toast, 'id'>) => void = () => {}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, ...t }])
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 4000)
  }, [])
  toastFn = toast
  return { toast, toasts }
}

export const toast = (t: Omit<Toast, 'id'>) => toastFn(t)
