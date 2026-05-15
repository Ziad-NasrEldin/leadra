/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ThemePreference } from './types'

export const THEME_STORAGE_KEY = 'leadra.theme'

const themeMeta: Record<ThemePreference, { color: string }> = {
  light: { color: '#F6F1EA' },
  dark: { color: '#0D0D0F' },
}

interface ThemeContextValue {
  themePreference: ThemePreference
  setThemePreference: (theme: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'dark' ? 'dark' : 'light'
}

export function applyThemePreference(theme: ThemePreference) {
  if (typeof document === 'undefined') return

  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (themeColor) themeColor.content = themeMeta[theme].color
}

function readInitialTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'light'
  return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(readInitialTheme)

  useEffect(() => {
    applyThemePreference(themePreference)
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)
  }, [themePreference])

  const setThemePreference = useCallback((theme: ThemePreference) => {
    setThemePreferenceState(normalizeThemePreference(theme))
  }, [])

  const value = useMemo(
    () => ({ themePreference, setThemePreference }),
    [setThemePreference, themePreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider.')
  return value
}
