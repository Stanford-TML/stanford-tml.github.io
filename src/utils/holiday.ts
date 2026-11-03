// FILE: src/utils/holiday.ts
import { useState, useEffect } from 'react'

export type HolidayType = 'winter' | 'halloween' | 'newyear' | null

const STORAGE_KEY = 'tml_holiday_override'
const EVENT_NAME = 'tml-holiday-change'

/**
 * Detects the active holiday based on system local date.
 * - Halloween: Oct 20 – Nov 1
 * - Winter / Christmas: Dec 1 – Dec 26
 * - New Year's: Dec 27 – Jan 5
 */
export const detectSystemHoliday = (date: Date = new Date()): HolidayType => {
  const month = date.getMonth() + 1 // 1-12
  const day = date.getDate()        // 1-31

  // Halloween: Oct 20 - Nov 1
  if ((month === 10 && day >= 20) || (month === 11 && day === 1)) {
    return 'halloween'
  }

  // Winter / Holidays: Dec 1 - Dec 26
  if (month === 12 && day >= 1 && day <= 26) {
    return 'winter'
  }

  // New Year's: Dec 27 - Jan 5
  if ((month === 12 && day >= 27) || (month === 1 && day <= 5)) {
    return 'newyear'
  }

  return null
}

/**
 * Returns the upcoming year string for New Year celebrations
 * (e.g., in Jan 2027 returns "2027"; in Feb–Dec 2026 returns "2027").
 */
export const getUpcomingYear = (date: Date = new Date()): string => {
  const month = date.getMonth() + 1 // 1-12
  const year = date.getFullYear()
  return String(month === 1 ? year : year + 1)
}

/**
 * Reads any URL parameter (?holiday=winter|halloween|newyear|none|auto)
 * or sessionStorage override for testing.
 */
export const getActiveHoliday = (): HolidayType => {
  if (typeof window === 'undefined') return null

  // 1. Check URL search params or hash query params (e.g. /?holiday=winter or /#home?holiday=winter)
  const searchParams = new URLSearchParams(window.location.search)
  let param = searchParams.get('holiday')

  if (!param && window.location.hash.includes('?')) {
    const hashQuery = window.location.hash.split('?')[1]
    const hashParams = new URLSearchParams(hashQuery)
    param = hashParams.get('holiday')
  }

  if (param) {
    const normalized = param.toLowerCase()
    if (normalized === 'none' || normalized === 'off') return null
    if (normalized === 'winter' || normalized === 'christmas' || normalized === 'xmas') return 'winter'
    if (normalized === 'halloween' || normalized === 'spooky') return 'halloween'
    if (normalized === 'newyear' || normalized === 'ny' || normalized === 'newyears') return 'newyear'
  }

  // 2. Check manual override in sessionStorage
  try {
    const override = sessionStorage.getItem(STORAGE_KEY)
    if (override) {
      if (override === 'none') return null
      if (override === 'winter' || override === 'halloween' || override === 'newyear') {
        return override
      }
    }
  } catch {
    // Ignore storage errors
  }

  // 3. Default to system clock detection
  return detectSystemHoliday()
}

export const setHolidayOverride = (override: HolidayType | 'auto') => {
  try {
    if (override === 'auto') {
      sessionStorage.removeItem(STORAGE_KEY)
    } else if (override === null) {
      sessionStorage.setItem(STORAGE_KEY, 'none')
    } else {
      sessionStorage.setItem(STORAGE_KEY, override)
    }

    // If the URL had a ?holiday=... query parameter, remove it so the theme bar
    // selection takes immediate effect without fighting the URL param.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      let changed = false
      if (url.searchParams.has('holiday')) {
        url.searchParams.delete('holiday')
        changed = true
      }
      if (url.hash.includes('?')) {
        const [hashBase, hashQuery] = url.hash.split('?')
        const hp = new URLSearchParams(hashQuery)
        if (hp.has('holiday')) {
          hp.delete('holiday')
          const remaining = hp.toString()
          url.hash = remaining ? `${hashBase}?${remaining}` : hashBase
          changed = true
        }
      }
      if (changed) {
        window.history.replaceState({}, '', url.toString())
      }
    }
  } catch {
    // Ignore storage errors
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

export const getHolidayOverrideState = (): HolidayType | 'auto' => {
  try {
    const override = sessionStorage.getItem(STORAGE_KEY)
    if (!override) return 'auto'
    if (override === 'none') return null
    if (override === 'winter' || override === 'halloween' || override === 'newyear') {
      return override
    }
  } catch {
    // Ignore
  }
  return 'auto'
}

/**
 * React hook that returns the currently active holiday and updates live
 * when overridden or when the URL hash changes.
 */
export const useHoliday = () => {
  const [holiday, setHoliday] = useState<HolidayType>(() => getActiveHoliday())
  const [overrideState, setOverrideState] = useState<HolidayType | 'auto'>(() => getHolidayOverrideState())

  useEffect(() => {
    const handleUpdate = () => {
      setHoliday(getActiveHoliday())
      setOverrideState(getHolidayOverrideState())
    }

    window.addEventListener(EVENT_NAME, handleUpdate)
    window.addEventListener('hashchange', handleUpdate)
    window.addEventListener('popstate', handleUpdate)

    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate)
      window.removeEventListener('hashchange', handleUpdate)
      window.removeEventListener('popstate', handleUpdate)
    }
  }, [])

  return {
    holiday,
    isHoliday: holiday !== null,
    overrideState,
    setHolidayOverride
  }
}

