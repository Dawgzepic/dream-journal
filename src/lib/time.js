import { dayKey } from './format.js'
import { userDreams } from './dreams.js'

export function minutesOf(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '')
  if (!match) return null
  const hours = Number(match[1])
  const mins = Number(match[2])
  if (hours > 23 || mins > 59) return null
  return hours * 60 + mins
}

export function isWorkTime(date, settings) {
  const days = settings?.workDays || []
  if (!days.includes(date.getDay())) return false
  const start = minutesOf(settings.workStart)
  const end = minutesOf(settings.workEnd)
  if (start == null || end == null || end <= start) return false
  const now = date.getHours() * 60 + date.getMinutes()
  return now >= start && now < end
}

/** Reality checks stay quiet overnight so a nudge does not arrive while he is asleep. */
export function isQuietHours(date) {
  const mins = date.getHours() * 60 + date.getMinutes()
  return mins >= 22 * 60 || mins < 7 * 60
}

export function realityAllowed(date, settings) {
  return !isWorkTime(date, settings) && !isQuietHours(date)
}

function nextOpening(from, settings) {
  const cursor = new Date(from.getTime())
  cursor.setSeconds(0, 0)
  cursor.setMilliseconds(0)
  cursor.setMinutes(cursor.getMinutes() + 1)
  for (let i = 0; i < 60 * 24 * 4; i++) {
    if (realityAllowed(cursor, settings)) {
      const buffered = new Date(cursor.getTime() + 5 * 60 * 1000)
      if (realityAllowed(buffered, settings)) return buffered
    }
    cursor.setMinutes(cursor.getMinutes() + 1)
  }
  return new Date(from.getTime() + 60 * 60 * 1000)
}

export function nextRealityDelay(from, settings, rand = Math.random) {
  let when
  if (realityAllowed(from, settings)) {
    const span = 45 + Math.floor(rand() * 46)
    const at = new Date(from.getTime() + span * 60 * 1000)
    when = realityAllowed(at, settings) ? at : nextOpening(at, settings)
  } else {
    when = nextOpening(from, settings)
  }
  return Math.max(5 * 60 * 1000, when.getTime() - from.getTime())
}

export function nextAtTime(from, hhmm) {
  const mins = minutesOf(hhmm) ?? 7 * 60 + 15
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate(), Math.floor(mins / 60), mins % 60, 0, 0)
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1)
  return next
}

export function greeting(date) {
  const hour = date.getHours()
  let hello = 'Good evening'
  if (hour < 5) hello = 'Still night'
  else if (hour < 12) hello = 'Good morning'
  else if (hour < 17) hello = 'Good afternoon'
  else if (hour < 21) hello = 'Good evening'
  else hello = 'Good night'
  return `${hello}, Timothy`
}

export function loggedOn(dreams, date) {
  const key = dayKey(date)
  return userDreams(dreams).some((dream) => dayKey(dream.datetime) === key)
}

export function currentStreak(dreams, now = new Date()) {
  const days = new Set(userDreams(dreams).map((dream) => dayKey(dream.datetime)))
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let count = 0
  while (days.has(dayKey(cursor))) {
    count += 1
    cursor.setDate(cursor.getDate() - 1)
    if (count > 5000) break
  }
  return count
}

export function streakLabel(dreams, now = new Date()) {
  const count = currentStreak(dreams, now)
  if (count === 0) return 'No streak yet'
  const base = count === 1 ? '1-night streak' : `${count}-night streak`
  if (!loggedOn(dreams, now)) return `${base} · log today to keep it`
  return base
}
