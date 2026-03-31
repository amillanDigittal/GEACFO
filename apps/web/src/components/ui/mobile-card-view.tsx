'use client'
import { Badge } from '@/components/ui/badge'

interface CardField {
  label: string
  value: React.ReactNode
  highlight?: boolean
}

interface MobileCardViewProps<T> {
  data: T[]
  renderCard: (item: T, index: number) => { title: string; subtitle?: string; badge?: { label: string; variant?: any }; fields: CardField[]; onClick?: () => void }
  className?: string
}

export function MobileCardView<T>({ data, renderCard, className }: MobileCardViewProps<T>) {
  if (data.length === 0) return null

  return (
    <div className={`sm:hidden space-y-3 ${className || ''}`}>
      {data.map((item, i) => {
        const card = renderCard(item, i)
        return (
          <div
            key={i}
            onClick={card.onClick}
            className={`p-4 rounded-xl border border-border bg-card space-y-2 ${card.onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">{card.title}</div>
                {card.subtitle && <div className="text-xs text-muted-foreground">{card.subtitle}</div>}
              </div>
              {card.badge && <Badge variant={card.badge.variant || 'secondary'}>{card.badge.label}</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {card.fields.map((f, j) => (
                <div key={j}>
                  <div className="text-[10px] text-muted-foreground uppercase">{f.label}</div>
                  <div className={`text-sm font-mono ${f.highlight ? 'text-primary font-semibold' : ''}`}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
