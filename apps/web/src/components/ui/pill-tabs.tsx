'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface PillTab {
  key: string
  label: string
  icon?: React.ReactNode
  badge?: number
}

interface PillTabsProps {
  tabs: PillTab[]
  active: string
  onChange: (key: string) => void
  size?: 'default' | 'xs'
  className?: string
}

export function PillTabs({ tabs, active, onChange, size = 'default', className }: PillTabsProps) {
  return (
    <div className={cn('pill-tabs', className)}>
      {tabs.map(tab => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              isActive ? 'pill-tab-active' : 'pill-tab',
              size === 'xs' && 'pill-tab-xs',
            )}
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={cn(
                'ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-destructive/15 text-destructive',
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
