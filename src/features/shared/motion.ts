import type { CSSProperties } from 'react'

export function motionStyle(index: number, delay = 0): CSSProperties {
  return {
    '--motion-index': index,
    '--motion-delay': `${delay}ms`,
  } as CSSProperties
}
