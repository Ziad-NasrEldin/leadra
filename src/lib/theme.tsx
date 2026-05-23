/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ThemePreference } from './types'

export const THEME_STORAGE_KEY = 'leadra.theme'

const themeMeta: Record<ThemePreference, { color: string }> = {
  light: { color: '#F6F1EA' },
  dark: { color: '#0D0D0F' },
}

const THEME_TRANSITION_CLASS = 'theme-transitioning'
const THEME_REVEAL_CLASS = 'theme-reveal'
const THEME_REVEAL_MS = 900
let themeTransitionId = 0
let themeRevealId = 0

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
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const activeWindow = document.defaultView
  const previousTheme = root.dataset.theme === 'dark' || root.dataset.theme === 'light' ? root.dataset.theme : null
  const reduceMotion = activeWindow?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const shouldReveal = Boolean(activeWindow) && options.animate !== false && previousTheme !== null && previousTheme !== theme && !reduceMotion
  themeTransitionId += 1
  const transitionId = themeTransitionId
  root.classList.add(THEME_TRANSITION_CLASS)
  root.classList.remove(THEME_REVEAL_CLASS)
  root.dataset.theme = theme
  root.style.colorScheme = theme

  if (shouldReveal) {
    const revealWindow = activeWindow as Window
    themeRevealId += 1
    const revealId = themeRevealId
    root.dataset.themeTransition = theme
    root.style.setProperty('--theme-reveal-x', `${Math.round(options.origin?.x ?? revealWindow.innerWidth / 2)}px`)
    root.style.setProperty('--theme-reveal-y', `${Math.round(options.origin?.y ?? revealWindow.innerHeight / 2)}px`)
    void root.offsetWidth
    root.classList.add(THEME_REVEAL_CLASS)
    revealWindow.setTimeout(() => {
      if (revealId !== themeRevealId) return
      root.classList.remove(THEME_REVEAL_CLASS)
      delete root.dataset.themeTransition
    }, THEME_REVEAL_MS)
  } else {
    themeRevealId += 1
    delete root.dataset.themeTransition
  }

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (themeColor) themeColor.content = themeMeta[theme].color

  const clearTransitionGuard = () => {
    if (transitionId === themeTransitionId) root.classList.remove(THEME_TRANSITION_CLASS)
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
    nextThemeOptionsRef.current = { ...options, animate: options.animate ?? true }
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
