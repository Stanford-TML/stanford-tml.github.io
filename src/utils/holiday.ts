// FILE: src/utils/holiday.ts
import { useState, useEffect } from 'react'

export type HolidayType =
  | 'winter'
  | 'halloween'
  | 'newyear'
  | 'easter'
  | 'valentines'
  | 'stpatricks'
  | 'thanksgiving'
  | null

export const isMajorHoliday = (holiday: HolidayType): boolean => {
  return (
    holiday === 'winter' ||
    holiday === 'halloween' ||
    holiday === 'newyear' ||
    holiday === 'easter'
  )
}

export const isMinorHoliday = (holiday: HolidayType): boolean => {
  return (
    holiday === 'valentines' ||
    holiday === 'stpatricks' ||
    holiday === 'thanksgiving'
  )
}

const STORAGE_KEY = 'tml_holiday_override'
const EVENT_NAME = 'tml-holiday-change'

/**
 * Computes Western Easter Sunday (Meeus/Jones/Butcher algorithm) for a given year.
 */
export const getEasterSunday = (year: number): { month: number; day: number } => {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

/**
 * Computes the day of the month for the 4th Thursday of November (US Thanksgiving).
 */
export const getThanksgivingDay = (year: number): number => {
  const firstDayNov = new Date(year, 10, 1).getDay() // 0 = Sun, 1 = Mon ...
  const firstThursday = ((11 - firstDayNov) % 7) + 1
  return firstThursday + 21
}

/**
 * Detects the active holiday based on system local date.
 * - New Year's: Dec 27 – Jan 5
 * - Valentine's: Feb 10 – Feb 15
 * - St. Patrick's: Mar 14 – Mar 18
 * - Easter (Major): Easter Sunday - 3 days to + 3 days
 * - Halloween (Major): Oct 20 – Nov 1
 * - Thanksgiving: 4th Thursday of November - 2 days to + 3 days
 * - Winter / Christmas (Major): Dec 1 – Dec 26
 */
export const detectSystemHoliday = (date: Date = new Date()): HolidayType => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12
  const day = date.getDate()        // 1-31

  // 1. New Year's: Dec 27 - Jan 5
  if ((month === 12 && day >= 27) || (month === 1 && day <= 5)) {
    return 'newyear'
  }

  // 2. Valentine's Day: Feb 10 - Feb 15
  if (month === 2 && day >= 10 && day <= 15) {
    return 'valentines'
  }

  // 3. St. Patrick's Day: Mar 14 - Mar 18
  if (month === 3 && day >= 14 && day <= 18) {
    return 'stpatricks'
  }

  // 4. Easter (dynamic Western Easter Sunday +/- 3 days)
  const easter = getEasterSunday(year)
  const currentDateMs = new Date(year, month - 1, day).getTime()
  const easterDateMs = new Date(year, easter.month - 1, easter.day).getTime()
  const diffDays = Math.round((currentDateMs - easterDateMs) / (1000 * 60 * 60 * 24))
  if (diffDays >= -3 && diffDays <= 3) {
    return 'easter'
  }

  // 5. Halloween: Oct 20 - Nov 1
  if ((month === 10 && day >= 20) || (month === 11 && day === 1)) {
    return 'halloween'
  }

  // 6. Thanksgiving: 4th Thursday of November (-2 days to +3 days)
  if (month === 11) {
    const tgDay = getThanksgivingDay(year)
    if (day >= tgDay - 2 && day <= tgDay + 3) {
      return 'thanksgiving'
    }
  }

  // 7. Winter / Holidays: Dec 1 - Dec 26
  if (month === 12 && day >= 1 && day <= 26) {
    return 'winter'
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
    if (normalized === 'easter' || normalized === 'bunny' || normalized === 'spring') return 'easter'
    if (normalized === 'valentines' || normalized === 'valentine' || normalized === 'vday') return 'valentines'
    if (normalized === 'stpatricks' || normalized === 'stpatrick' || normalized === 'paddy' || normalized === 'stpatty') return 'stpatricks'
    if (normalized === 'thanksgiving' || normalized === 'turkey' || normalized === 'harvest') return 'thanksgiving'
  }

  // 2. Check manual override in sessionStorage
  try {
    const override = sessionStorage.getItem(STORAGE_KEY)
    if (override) {
      if (override === 'none') return null
      if (
        override === 'winter' ||
        override === 'halloween' ||
        override === 'newyear' ||
        override === 'easter' ||
        override === 'valentines' ||
        override === 'stpatricks' ||
        override === 'thanksgiving'
      ) {
        return override as HolidayType
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
    if (
      override === 'winter' ||
      override === 'halloween' ||
      override === 'newyear' ||
      override === 'easter' ||
      override === 'valentines' ||
      override === 'stpatricks' ||
      override === 'thanksgiving'
    ) {
      return override as HolidayType
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

