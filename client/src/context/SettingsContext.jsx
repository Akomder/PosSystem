import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import translations from '../i18n/translations'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('pos_dark')
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('pos_lang') || 'en'
  })

  // Apply / remove dark class on <html>
  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('pos_dark', String(dark))
  }, [dark])

  // Apply / remove lang-lo class on <html> for Poppins font
  useEffect(() => {
    const root = document.documentElement
    if (lang === 'lo') {
      root.classList.add('lang-lo')
    } else {
      root.classList.remove('lang-lo')
    }
  }, [lang])

  const toggleDark = useCallback(() => setDark((v) => !v), [])

  const setLang = useCallback((l) => {
    setLangState(l)
    localStorage.setItem('pos_lang', l)
  }, [])

  const t = useCallback((key) => {
    const dict = translations[lang] || translations.en
    return dict[key] ?? translations.en[key] ?? key
  }, [lang])

  return (
    <SettingsContext.Provider value={{ dark, toggleDark, lang, setLang, t }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
