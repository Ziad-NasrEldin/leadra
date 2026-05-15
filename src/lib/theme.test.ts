import { describe, expect, it } from 'vitest'
import { normalizeThemePreference } from './theme'

describe('theme preferences', () => {
  it('normalizes unknown theme values to light', () => {
    expect(normalizeThemePreference('dark')).toBe('dark')
    expect(normalizeThemePreference('light')).toBe('light')
    expect(normalizeThemePreference('system')).toBe('light')
    expect(normalizeThemePreference(null)).toBe('light')
  })
})
