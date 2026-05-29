/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ThemePreference } from './types'

export const THEME_STORAGE_KEY = 'leadra.theme'

const themeMeta: Record<ThemePreference, { color: string }> = {
  light: { color: '#F6F1EA' },
  dark: { color: '#0D0D0F' },
}

const THEME_TRANSITION_CLASS = 'theme-transitioning'
let themeTransitionId = 0

export interface ThemePreferenceOptions {
  animate?: boolean
  origin?: {
    x: number
    y: number
  }
}

interface ThemeContextValue {
  themePreference: ThemePreference
  setThemePreference: (theme: ThemePreference, options?: ThemePreferenceOptions) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'dark' ? 'dark' : 'light'
}

export function applyThemePreference(theme: ThemePreference, options: ThemePreferenceOptions = {}) {
  void options
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const activeWindow = document.defaultView
  const previousTheme = root.dataset.theme === 'dark' || root.dataset.theme === 'light' ? root.dataset.theme : null
  const isChangingTheme = previousTheme !== theme

  themeTransitionId += 1
  const transitionId = themeTransitionId
  if (isChangingTheme) root.classList.add(THEME_TRANSITION_CLASS)
  root.classList.remove('theme-reveal')
  root.dataset.theme = theme
  root.style.colorScheme = theme
  delete root.dataset.themeTransition
  root.style.removeProperty('--theme-reveal-x')
  root.style.removeProperty('--theme-reveal-y')

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (themeColor) themeColor.content = themeMeta[theme].color

  const clearTransitionGuard = () => {
    if (transitionId === themeTransitionId) root.classList.remove(THEME_TRANSITION_CLASS)
  }

  if (!isChangingTheme) {
    clearTransitionGuard()
    return
  }

  if (activeWindow?.requestAnimationFrame) {
    activeWindow.requestAnimationFrame(() => activeWindow.requestAnimationFrame(clearTransitionGuard))
  } else {
    window.setTimeout(clearTransitionGuard, 0)
  }
}

function readInitialTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'light'
  return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(readInitialTheme)
  const nextThemeOptionsRef = useRef<ThemePreferenceOptions>({ animate: false })

  useLayoutEffect(() => {
    applyThemePreference(themePreference, nextThemeOptionsRef.current)
    nextThemeOptionsRef.current = { animate: false }
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)
  }, [themePreference])

  const setThemePreference = useCallback((theme: ThemePreference, options: ThemePreferenceOptions = {}) => {
    nextThemeOptionsRef.current = { ...options, animate: options.animate ?? false }
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
