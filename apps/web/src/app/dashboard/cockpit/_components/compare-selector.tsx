'use client'

import { useAppStore, CompareMode } from '@/store/app'
import { CalendarDays, CalendarRange } from 'lucide-react'

const OPTIONS: { value: CompareMode; label: string; icon: typeof CalendarDays }[] = [
  { value: 'mom', label: 'vs mes ant.', icon: CalendarDays },
  { value: 'yoy', label: 'vs año ant.', icon: CalendarRange },
]

export function CompareSelector() {
  const { compareMode, setCompareMode } = useAppStore()

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setCompareMode(value)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
            compareMode === value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon size={12} />
          {label}
        </button>
      ))}
    </div>
  )
}
