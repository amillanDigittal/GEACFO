'use client'
import { useSyncExternalStore } from 'react'

type ToastVariant = 'default' | 'destructive' | 'success' | 'warning'
interface Toast { id: string; title?: string; description?: string; variant?: ToastVariant }

// Global store — single source of truth for all toasts
let toasts: Toast[] = []
const listeners = new Set<() => void>()

function notify() { listeners.forEach(l => l()) }

function addToast(t: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  toasts = [...toasts, { id, ...t }]
  notify()
  setTimeout(() => {
    toasts = toasts.filter(x => x.id !== id)
    notify()
  }, 4000)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getSnapshot() { return toasts }

export function useToast() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { toast: addToast, toasts: current }
}

export const toast = (t: Omit<Toast, 'id'>) => addToast(t)
