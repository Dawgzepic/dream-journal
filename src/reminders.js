import { state } from './state.js'
import { isQuietHours, isWorkTime, loggedOn, nextAtTime, nextRealityDelay } from './lib/time.js'

let timers = []

const CHECKS = [
  'Look at your hands and count your fingers.',
  'Read a sentence twice. Did it stay the same?',
  'Pinch your nose and try to breathe through it.',
  'Ask how you arrived in this room. Is there a story?'
]

export function stopReminders() {
  for (const timer of timers) clearTimeout(timer)
  timers = []
}

function notify(title, body) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  if (document.visibilityState !== 'visible' || !state.unlocked) return
  try {
    new Notification(title, { body, icon: `${import.meta.env.BASE_URL}icons/icon-192.png`, tag: 'dream-journal' })
  } catch {
    /* Some browsers only notify from a service worker. The banner still shows. */
  }
}

export function startReminders() {
  stopReminders()
  if (!state.unlocked || !state.settings) return
  const settings = state.settings
  if (settings.morningReminder !== false) {
    const delay = Math.max(5000, nextAtTime(new Date(), settings.morningTime || '07:15').getTime() - Date.now())
    timers.push(setTimeout(() => {
      if (!state.unlocked) return
      notify('What do you remember?', 'If a dream is still nearby, jot a few words before it fades.')
      startReminders()
    }, delay))
  }
  if (settings.realityReminder !== false) {
    const delay = nextRealityDelay(new Date(), settings)
    timers.push(setTimeout(() => {
      if (!state.unlocked) return
      const now = new Date()
      if (!isWorkTime(now, state.settings) && !isQuietHours(now)) {
        notify('Reality check', CHECKS[now.getDate() % CHECKS.length])
      }
      startReminders()
    }, delay))
  }
}

export function homeBanner(settings, dreams, now = new Date()) {
  const note = 'Web reminders are best-effort and may not arrive if the app is closed.'
  const hour = now.getHours()
  if (settings.morningReminder !== false && hour >= 5 && hour < 11) {
    const today = loggedOn(dreams, now)
    return {
      title: 'Morning reminder',
      body: today
        ? 'You already kept a dream today. If another one is still nearby, you can log that too.'
        : 'Last night is close. A title and a few words are enough before it fades.',
      note
    }
  }
  if (settings.realityReminder !== false && !isWorkTime(now, settings) && !isQuietHours(now)) {
    return {
      title: 'Reality check',
      body: CHECKS[now.getDate() % CHECKS.length],
      note
    }
  }
  return {
    title: 'Reminders',
    body: 'A morning nudge and daytime reality checks stay quiet during your work hours, and overnight from 10:00 PM to 7:00 AM.',
    note
  }
}

export async function enableNotifications() {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}
