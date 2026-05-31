import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
const mobileBlockStart = css.indexOf('@media (pointer: coarse), (max-width: 768px)')
const mobileBlock = mobileBlockStart >= 0 ? css.slice(mobileBlockStart, css.indexOf('.inventory-scope-card::before', mobileBlockStart)) : ''

describe('mobile performance CSS', () => {
  it('disables entrance and filter animations on touch/mobile screens', () => {
    expect(mobileBlock).toContain('animation: none !important')
    expect(mobileBlock).toContain('filter: none !important')
    expect(mobileBlock).toContain('will-change: auto')
    expect(mobileBlock).toContain('.page-transition-frame > .page-entrance')
  })

  it('keeps mobile taps and fixed controls lightweight', () => {
    expect(mobileBlock).toContain('touch-action: manipulation')
    expect(mobileBlock).toContain('-webkit-tap-highlight-color: transparent')
    expect(mobileBlock).toContain('backdrop-filter: none')
    expect(mobileBlock).toContain('contain: layout paint')
  })
})
