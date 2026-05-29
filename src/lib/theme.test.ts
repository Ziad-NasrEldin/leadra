import { afterEach, describe, expect, it } from 'vitest'
import { applyThemePreference, normalizeThemePreference } from './theme'

describe('theme preferences', () => {
  afterEach(() => {
    document.documentElement.className = ''
    delete document.documentElement.dataset.theme
    delete document.documentElement.dataset.themeTransition
  })

  it('normalizes unknown theme values to light', () => {
    expect(normalizeThemePreference('dark')).toBe('dark')
    expect(normalizeThemePreference('light')).toBe('light')
    expect(normalizeThemePreference('system')).toBe('light')
    expect(normalizeThemePreference(null)).toBe('light')
  })

  it('switches theme without the heavy page reveal unless reveal animation is explicitly requested', () => {
    document.documentElement.dataset.theme = 'light'

    applyThemePreference('dark', { origin: { x: 10, y: 20 } })

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('theme-reveal')).toBe(false)
    expect(document.documentElement.dataset.themeTransition).toBeUndefined()
  })

  it('does not add transition guards when applying the already-active theme', () => {
    document.documentElement.dataset.theme = 'dark'

    applyThemePreference('dark')

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('theme-transitioning')).toBe(false)
    expect(document.documentElement.dataset.themeTransition).toBeUndefined()
  })
})
