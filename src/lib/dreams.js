import { CLARITY, SUBSTANCES, SCREENS } from './constants.js'
import { cleanDetails } from './details.js'
import { cleanLabel, uid } from './format.js'

const SUBSTANCE_IDS = new Set(SUBSTANCES.map((item) => item.id))
const SCREEN_IDS = new Set(SCREENS.map((item) => item.id))

export function userDreams(dreams) {
  return (dreams || []).filter((dream) => dream && !dream.isDraft && !dream.isSample)
}

export function blankDream() {
  const now = new Date().toISOString()
  return {
    id: uid(),
    title: '',
    datetime: now,
    story: '',
    moodsDuring: [],
    moodAfter: '',
    clarity: '',
    events: '',
    tags: [],
    bedtime: { food: '', substance: '', stress: null, screen: '' },
    details: {},
    isDraft: true,
    isSample: false,
    createdAt: now,
    updatedAt: now
  }
}

export function displayTitle(dream) {
  if (dream.title && dream.title.trim()) return dream.title.trim()
  if (dream.isDraft) return 'Untitled jot'
  return 'Untitled dream'
}

export function titleFrom(story) {
  const words = String(story || '').trim().split(/\s+/).slice(0, 6).join(' ')
  if (words.length <= 48) return words
  return `${words.slice(0, 48).trimEnd()}...`
}

export function isBlank(dream) {
  const bed = dream.bedtime || {}
  return !String(dream.title || '').trim()
    && !String(dream.story || '').trim()
    && !(dream.moodsDuring || []).length
    && !dream.moodAfter
    && !dream.clarity
    && !String(dream.events || '').trim()
    && !(dream.tags || []).length
    && !bed.food
    && !bed.substance
    && !bed.stress
    && !bed.screen
}

function clip(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function labels(list, max) {
  const source = Array.isArray(list) ? list : []
  const out = []
  for (const item of source) {
    const clean = cleanLabel(item)
    if (!clean) continue
    if (out.some((existing) => existing.toLowerCase() === clean.toLowerCase())) continue
    out.push(clean)
    if (out.length >= max) break
  }
  return out
}

export function normalizeDream(raw) {
  if (!raw || typeof raw !== 'object') return null
  const story = clip(raw.story, 100000)
  const title = clip(raw.title, 200)
  if (!story.trim() && !title.trim()) return null
  let datetime = typeof raw.datetime === 'string' ? raw.datetime : ''
  if (Number.isNaN(new Date(datetime).getTime())) datetime = new Date().toISOString()
  const stress = Number(raw.bedtime?.stress)
  const substance = SUBSTANCE_IDS.has(raw.bedtime?.substance) ? raw.bedtime.substance : ''
  const screen = SCREEN_IDS.has(raw.bedtime?.screen) ? raw.bedtime.screen : ''
  const now = new Date().toISOString()
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 80) : uid()
  return {
    id,
    title,
    datetime,
    story,
    moodsDuring: labels(raw.moodsDuring, 8),
    moodAfter: labels([raw.moodAfter], 1)[0] || '',
    clarity: CLARITY.includes(raw.clarity) ? raw.clarity : '',
    events: clip(raw.events, 5000),
    tags: labels(raw.tags, 12),
    bedtime: {
      food: clip(raw.bedtime?.food, 200),
      substance,
      stress: stress >= 1 && stress <= 5 ? Math.round(stress) : null,
      screen
    },
    details: cleanDetails(raw.details),
    isDraft: Boolean(raw.isDraft),
    isSample: Boolean(raw.isSample),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: now
  }
}
