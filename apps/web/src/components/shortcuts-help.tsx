'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { SHORTCUTS_HELP_EVENT } from '@/hooks/use-keyboard-shortcuts'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { X } from 'lucide-react'

/** Global shortcuts always available on dashboard pages. */
const GLOBAL_SHORTCUTS: { key: string; label: string }[] = [
  { key: '?', label: 'Mostrar atajos de teclado' },
  { key: '⌘K', label: 'Abrir buscador (Command Palette)' },
  { key: 'R', label: 'Actualizar datos de la página' },
]

/** Page-specific shortcut definitions (for display only — actual binding is in each page). */
const PAGE_SHORTCUTS: Record<string, { key: string; label: string }[]> = {
  '/dashboard/pagos': [
    { key: 'A', label: 'Aprobar facturas seleccionadas' },
    { key: 'S', label: 'Seleccionar/deseleccionar todas' },
    { key: 'E', label: 'Exportar CSV' },
  ],
  '/dashboard/cobros': [
    { key: 'E', label: 'Exportar CSV' },
  ],
  '/dashboard/usuarios': [
    { key: 'N', label: 'Nuevo usuario' },
  ],
  '/dashboard/conciliacion': [
    { key: 'M', label: 'Auto-match movimientos' },
  ],
  '/dashboard/bot': [
    { key: 'N', label: 'Nueva conversación' },
  ],
  '/dashboard/forecast': [
    { key: 'E', label: 'Exportar CSV' },
  ],
}

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const trapRef = useFocusTrap<HTMLDivElement>(open)

  useEffect(() => {
    function onEvent() { setOpen(true) }
    window.addEventListener(SHORTCUTS_HELP_EVENT, onEvent)
    return () => window.removeEventListener(SHORTCUTS_HELP_EVENT, onEvent)
  }, [])

  // Also listen for '?' key globally
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement)?.isContentEditable) return
      if (document.querySelector('[role="dialog"]')) return

      // '?' on US keyboard = Shift+/, on ES keyboard = Shift+' — match both
      const isQuestionMark = e.key === '?' || (e.shiftKey && (e.code === 'Slash' || e.key === '/'))
      if (isQuestionMark) {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  if (!open) return null

  const pageShortcuts = PAGE_SHORTCUTS[pathname] || []

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[200] backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label="Atajos de teclado" className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[420px] z-[201]">
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Atajos de teclado</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Global */}
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">Global</div>
              <div className="space-y-1.5">
                {GLOBAL_SHORTCUTS.map(s => (
                  <ShortcutRow key={s.key} shortcutKey={s.key} label={s.label} />
                ))}
              </div>
            </div>

            {/* Page-specific */}
            {pageShortcuts.length > 0 && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">Esta página</div>
                <div className="space-y-1.5">
                  {pageShortcuts.map(s => (
                    <ShortcutRow key={s.key} shortcutKey={s.key} label={s.label} />
                  ))}
                </div>
              </div>
            )}

            {pageShortcuts.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No hay atajos específicos para esta página.
              </div>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-border text-[10px] text-muted-foreground">
            Los atajos se desactivan dentro de campos de texto y diálogos.
          </div>
        </div>
      </div>
    </>
  )
}

function ShortcutRow({ shortcutKey, label }: { shortcutKey: string; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground">{label}</span>
      <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-border bg-muted px-1.5 text-[11px] font-mono font-medium text-muted-foreground">
        {shortcutKey}
      </kbd>
    </div>
  )
}
