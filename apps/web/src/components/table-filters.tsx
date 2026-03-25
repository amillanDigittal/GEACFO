'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X, SlidersHorizontal } from 'lucide-react'

interface FilterOption {
  key: string
  label: string
}

interface TableFiltersProps {
  /** Text search placeholder */
  searchPlaceholder?: string
  onSearchChange: (value: string) => void
  search: string

  /** Status filter */
  statusOptions?: FilterOption[]
  status: string
  onStatusChange: (value: string) => void

  /** Priority filter (pagos only) */
  priorityOptions?: FilterOption[]
  priority?: string
  onPriorityChange?: (value: string) => void

  /** Entity filter (cliente/proveedor) — unique list extracted from data */
  entityLabel?: string
  entityOptions?: FilterOption[]
  entity?: string
  onEntityChange?: (value: string) => void

  /** Due date range */
  dueDateFrom?: string
  dueDateTo?: string
  onDueDateFromChange?: (value: string) => void
  onDueDateToChange?: (value: string) => void

  /** Active filter count for badge */
  activeCount: number
  onClearAll: () => void
}

export function TableFilters({
  searchPlaceholder = 'Buscar...',
  onSearchChange, search,
  statusOptions, status, onStatusChange,
  priorityOptions, priority, onPriorityChange,
  entityLabel, entityOptions, entity, onEntityChange,
  dueDateFrom, dueDateTo, onDueDateFromChange, onDueDateToChange,
  activeCount, onClearAll,
}: TableFiltersProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="space-y-3">
      {/* Top row: search + toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          )}
        </div>
        <Button
          variant={expanded ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal size={13} />
          Filtros
          {activeCount > 0 && (
            <span className="ml-0.5 bg-primary-foreground text-primary text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </Button>
        {activeCount > 0 && (
          <button onClick={onClearAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Expanded filter row */}
      {expanded && (
        <div className="flex flex-wrap items-end gap-3 p-3 bg-muted/30 rounded-lg border border-border">
          {/* Status */}
          {statusOptions && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Estado</label>
              <select
                value={status}
                onChange={e => onStatusChange(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs min-w-[120px]"
              >
                {statusOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
          )}

          {/* Priority */}
          {priorityOptions && onPriorityChange && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Prioridad</label>
              <select
                value={priority || 'ALL'}
                onChange={e => onPriorityChange(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs min-w-[120px]"
              >
                {priorityOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
          )}

          {/* Entity (cliente/proveedor) */}
          {entityOptions && entityOptions.length > 0 && onEntityChange && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{entityLabel || 'Entidad'}</label>
              <select
                value={entity || 'ALL'}
                onChange={e => onEntityChange(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs min-w-[140px] max-w-[200px]"
              >
                <option value="ALL">Todos</option>
                {entityOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
          )}

          {/* Due date range */}
          {onDueDateFromChange && onDueDateToChange && (
            <>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Vence desde</label>
                <input
                  type="date"
                  value={dueDateFrom || ''}
                  onChange={e => onDueDateFromChange(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Vence hasta</label>
                <input
                  type="date"
                  value={dueDateTo || ''}
                  onChange={e => onDueDateToChange(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
