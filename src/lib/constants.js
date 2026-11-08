export const APP_NAME = 'Dream Journal'

export const MOODS = ['Happy', 'Scared', 'Confused', 'Sad', 'Peaceful', 'Anxious']

export const CLARITY = ['Clear', 'Fuzzy', 'Fragments']

export const CORE_TAGS = ['Recurring', 'Nightmare', 'Lucid']

export const SUBSTANCES = [
  { id: 'None', label: 'None' },
  { id: 'Caffeine', label: 'Caffeine' },
  { id: 'Alcohol', label: 'Alcohol' },
  { id: 'Both', label: 'Both' }
]

export const SCREENS = [
  { id: 'none', label: 'None' },
  { id: 'light', label: 'Under 30 min' },
  { id: 'medium', label: '30–60 min' },
  { id: 'heavy', label: 'Over an hour' }
]

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function screenLabel(id) {
  return SCREENS.find((item) => item.id === id)?.label || ''
}

export function defaultSettings() {
  return {
    version: 1,
    pinHash: null,
    pinSalt: null,
    pinLength: 4,
    webauthnId: null,
    workDays: [0, 1, 3, 4, 5],
    workStart: '08:00',
    workEnd: '16:30',
    morningReminder: true,
    morningTime: '07:15',
    realityReminder: true,
    voiceOptIn: null,
    exportedOnce: false,
    customMoods: [],
    customTags: [],
    createdAt: new Date().toISOString()
  }
}
