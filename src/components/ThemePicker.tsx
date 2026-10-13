import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

type Appearance = 'system' | 'light' | 'dark'
const preferenceKey = 'rnl-appearance'
const parseAppearance = (value: string | null): Appearance => value === 'dark' || value === 'light' ? value : 'system'

export function ThemePicker() {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    try { return parseAppearance(localStorage.getItem(preferenceKey)) }
    catch { return 'system' }
  })

  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')

  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const theme = appearance === 'dark' || (appearance === 'system' && query.matches) ? 'dark' : 'light'
      setDark(theme === 'dark')
      document.documentElement.dataset.theme = theme
      document.documentElement.style.colorScheme = theme
    }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [appearance])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === preferenceKey) setAppearance(parseAppearance(event.newValue))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  function changeAppearance(value: string) {
    const next = parseAppearance(value)
    setAppearance(next)
    try { localStorage.setItem(preferenceKey, next) }
    catch { /* Session appearance still works if local storage is unavailable. */ }
  }

  return (
    <button type="button" className="theme-toggle" aria-label="Toggle color theme" aria-pressed={dark} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => changeAppearance(dark ? 'light' : 'dark')}>
      {dark ? <Sun size={20} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={20} strokeWidth={1.75} aria-hidden="true" />}
    </button>
  )
}
