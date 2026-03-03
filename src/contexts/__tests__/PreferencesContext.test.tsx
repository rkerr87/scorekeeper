import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { PreferencesProvider, usePreferences } from '../PreferencesContext'

function wrapper({ children }: { children: ReactNode }) {
  return <PreferencesProvider>{children}</PreferencesProvider>
}

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

vi.stubGlobal('localStorage', localStorageMock)

describe('PreferencesContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should default to beginnerMode: false', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper })
    expect(result.current.beginnerMode).toBe(false)
  })

  it('should update state and persist to localStorage when setBeginnerMode(true) is called', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper })

    act(() => {
      result.current.setBeginnerMode(true)
    })

    expect(result.current.beginnerMode).toBe(true)
    expect(localStorage.getItem('scorekeeper_beginner_mode')).toBe('true')
  })

  it('should initialize beginnerMode from localStorage on mount', () => {
    localStorage.setItem('scorekeeper_beginner_mode', 'true')

    const { result } = renderHook(() => usePreferences(), { wrapper })

    expect(result.current.beginnerMode).toBe(true)
  })
})
