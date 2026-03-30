'use client'

import * as React from 'react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip'

interface PreviewField {
  label: string
  value: React.ReactNode
}

interface RowPreviewProps {
  fields: PreviewField[]
  children: React.ReactNode
}

export function RowPreview({ fields, children }: RowPreviewProps) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="left" className="p-0 max-w-[260px]">
          <div className="p-3 space-y-2">
            {fields.map((f, i) => (
              <div key={i} className="flex justify-between gap-4">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{f.label}</span>
                <span className="text-xs font-semibold text-foreground text-right">{f.value}</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
