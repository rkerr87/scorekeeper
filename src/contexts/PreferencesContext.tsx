import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface Preferences {
  beginnerMode: boolean
  setBeginnerMode: (v: boolean) => void
}

const PreferencesContext = createContext<Preferences>({
  beginnerMode: false,
  setBeginnerMode: () => {},
})

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [beginnerMode, setBeginnerModeState] = useState(() => {
    return localStorage.getItem('scorekeeper_beginner_mode') === 'true'
  })

  const setBeginnerMode = (v: boolean) => {
    setBeginnerModeState(v)
    localStorage.setItem('scorekeeper_beginner_mode', String(v))
  }

  return (
    <PreferencesContext.Provider value={{ beginnerMode, setBeginnerMode }}>
      {children}
    </PreferencesContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  return useContext(PreferencesContext)
}
