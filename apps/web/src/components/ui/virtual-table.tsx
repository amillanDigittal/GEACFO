'use client'

import { useRef, memo, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface VirtualTableBodyProps<T> {
  /** Full filtered/sorted array */
  data: T[]
  /** Estimated row height in px */
  rowHeight?: number
  /** Max visible height of the scrollable area */
  maxHeight?: number
  /** Render function — receives item and absolute index, must return <td> elements */
  renderRow: (item: T, index: number) => ReactNode
  /** Optional className per row */
  rowClassName?: (item: T) => string
  /** Key extractor */
  getKey: (item: T) => string
}

/** Memoized table row — skips re-render when item/className haven't changed */
const MemoRow = memo(function MemoRow({ itemKey, className, children }: { itemKey: string; className: string; children: ReactNode }) {
  return (
    <tr className={`border-b border-border hover:bg-muted/50 transition-colors ${className}`}>
      {children}
    </tr>
  )
})

/**
 * Drop-in replacement for `<tbody>{data.slice(page*N,...).map(...)}</tbody>` + pagination.
 * For small datasets (<100), renders all rows in a scrollable div.
 * For large datasets (100+), virtualizes to only render visible rows.
 */
export function VirtualTableBody<T>({
  data,
  rowHeight = 48,
  maxHeight = 520,
  renderRow,
  rowClassName,
  getKey,
}: VirtualTableBodyProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Sin registros
      </div>
    )
  }

  // Small dataset: plain scrollable table (no virtualization overhead)
  if (data.length <= 100) {
    return (
      <>
        <div className="overflow-y-auto" style={{ maxHeight }}>
          <table className="w-full text-sm">
            <tbody>
              {data.map((item, index) => (
                <MemoRow key={getKey(item)} itemKey={getKey(item)} className={rowClassName?.(item) || ''}>
                  {renderRow(item, index)}
                </MemoRow>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-border gradient-sep text-xs text-muted-foreground">
          {data.length} registro{data.length !== 1 ? 's' : ''}
        </div>
      </>
    )
  }

  // Large dataset: virtualized
  return <VirtualizedBody data={data} rowHeight={rowHeight} maxHeight={maxHeight} renderRow={renderRow} rowClassName={rowClassName} getKey={getKey} />
}

function VirtualizedBody<T>({
  data, rowHeight = 48, maxHeight = 520, renderRow, rowClassName, getKey,
}: VirtualTableBodyProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  })

  return (
    <>
      <div ref={parentRef} className="overflow-y-auto" style={{ maxHeight }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(virtualRow => {
            const item = data[virtualRow.index]
            return (
              <table
                key={getKey(item)}
                className="w-full text-sm"
                style={{
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <tbody>
                  <MemoRow itemKey={getKey(item)} className={rowClassName?.(item) || ''}>
                    {renderRow(item, virtualRow.index)}
                  </MemoRow>
                </tbody>
              </table>
            )
          })}
        </div>
      </div>
      <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground">
        {data.length} registro{data.length !== 1 ? 's' : ''}
      </div>
    </>
  )
}
