import { findSymbols } from './analyze.js'
import { phraseIsIdiom } from './analyze.js'
import { userDreams } from './dreams.js'
import { monthKeyFromDate, formatDay } from './format.js'
import { SYMBOLS } from './symbols.js'

export const GROUPS = [
  ['people', 'People'],
  ['places', 'Places'],
  ['things', 'Things'],
  ['themes', 'Themes']
]

const PEOPLE = new Set(['mother', 'father', 'grandmother', 'child', 'baby', 'stranger', 'crowd', 'ex', 'boss', 'teacher', 'doctor', 'celebrity'])
const PLACES = new Set(['house', 'childhood-home', 'school', 'garden', 'hospital', 'church', 'graveyard', 'forest', 'mountain', 'cave', 'tunnel', 'bridge', 'road', 'crossroads', 'maze', 'island', 'desert', 'hotel', 'airport', 'bedroom', 'kitchen', 'bathroom', 'basement', 'attic', 'library', 'sea', 'ocean', 'river', 'lake', 'water', 'park'])
const THEMES = new Set(['running', 'falling', 'flying', 'chase', 'hiding', 'escape', 'swimming', 'argument', 'kiss', 'late', 'lost', 'paralysis', 'scream', 'discard', 'swarm', 'eating'])

const EXTRA = [
  { id: 'dog', keys: ['puppy', 'puppies'] },
  { id: 'mother', keys: ['mama'] },
  { id: 'grandmother', keys: ['grandma', 'nana'] },
  { id: 'father', keys: ['dad', 'papa'] },
  { id: 'park', name: 'Park', group: 'places', keys: ['park', 'parks'] },
  { id: 'fear', name: 'Fear', group: 'themes', keys: ['afraid', 'fear', 'terrified'] },
  { id: 'anger', name: 'Anger', group: 'themes', keys: ['angry', 'anger', 'furious'] }
]

const VAGUE = new Set(['unclear', 'unknown', 'not sure', 'alone', 'none'])

const byId = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]))

function groupFor(id) {
  if (id.startsWith('mood:')) return 'themes'
  if (id.startsWith('person:')) return 'people'
  if (PEOPLE.has(id)) return 'people'
  if (PLACES.has(id)) return 'places'
  if (THEMES.has(id)) return 'themes'
  const extra = EXTRA.find((item) => item.id === id && item.group)
  if (extra?.group) return extra.group
  return 'things'
}

function baseName(id) {
  if (id.startsWith('mood:')) return id.slice(5)
  if (id.startsWith('person:')) return id.slice(7)
  const extra = EXTRA.find((item) => item.id === id && item.name)
  if (extra?.name) return extra.name
  return byId.get(id)?.name || id
}

export function cleanThemeEdits(raw) {
  const names = {}
  const merges = {}
  const hidden = []
  const pinned = []
  if (raw && typeof raw === 'object') {
    if (raw.names && typeof raw.names === 'object') {
      for (const [id, name] of Object.entries(raw.names)) {
        const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40)
        if (clean) names[String(id).slice(0, 80)] = clean
      }
    }
    if (raw.merges && typeof raw.merges === 'object') {
      for (const [from, to] of Object.entries(raw.merges)) {
        if (!from || !to || from === to) continue
        merges[String(from).slice(0, 80)] = String(to).slice(0, 80)
      }
    }
    for (const id of Array.isArray(raw.hidden) ? raw.hidden : []) hidden.push(String(id).slice(0, 80))
    for (const id of Array.isArray(raw.pinned) ? raw.pinned : []) pinned.push(String(id).slice(0, 80))
  }
  return {
    names,
    merges,
    hidden: [...new Set(hidden)].slice(0, 200),
    pinned: [...new Set(pinned)].slice(0, 40)
  }
}

export function resolveTheme(id, edits) {
  const merges = cleanThemeEdits(edits).merges
  let current = id
  const seen = new Set()
  while (merges[current] && !seen.has(current)) {
    seen.add(current)
    current = merges[current]
  }
  return current
}

function wordChar(ch) {
  return !!ch && /[a-z0-9]/i.test(ch)
}

function textHasKey(text, key) {
  const lower = String(text || '').toLowerCase()
  const phrase = key.toLowerCase()
  if (!phrase) return false
  let from = 0
  while (from <= lower.length - phrase.length) {
    const index = lower.indexOf(phrase, from)
    if (index < 0) return false
    const before = index > 0 ? lower[index - 1] : ''
    const after = lower[index + phrase.length] || ''
    if (!wordChar(before) && !wordChar(after) && !phraseIsIdiom(lower, index, phrase.length)) return true
    from = index + 1
  }
  return false
}

function dreamText(dream) {
  const details = dream.details || {}
  const notes = [details.people?.note, details.reminded?.note, details.setting?.note, details.place?.note, details.heading?.note]
    .map((note) => String(note || '').trim())
    .filter(Boolean)
  return [dream.title, dream.story, ...notes].filter(Boolean).join('\n')
}

function addHit(hits, id) {
  if (!id) return
  hits.add(id)
}

function hitsFor(dream) {
  const hits = new Set()
  const text = dreamText(dream)
  for (const range of findSymbols(text)) addHit(hits, range.symbol.id)
  for (const item of EXTRA) {
    if (item.keys.some((key) => textHasKey(text, key))) addHit(hits, item.id)
  }
  for (const mood of [...(dream.moodsDuring || []), dream.moodAfter].filter(Boolean)) {
    addHit(hits, `mood:${mood}`)
  }
  const people = dream.details?.people?.choices || []
  for (const choice of people) {
    if (!choice || VAGUE.has(choice.toLowerCase())) continue
    if (choice === 'Animals') addHit(hits, 'dog')
    else if (choice === 'Family') addHit(hits, 'mother')
    else addHit(hits, `person:${choice}`)
  }
  const who = String(dream.details?.people?.note || dream.details?.reminded?.note || '').trim()
  if (who && who.length <= 40 && !who.includes('.')) addHit(hits, `person:${who}`)
  const place = String(dream.details?.setting?.note || dream.details?.place?.note || '').trim()
  if (place && /^home$/i.test(place)) addHit(hits, 'house')
  if (place && /^park$/i.test(place)) addHit(hits, 'park')
  const setting = dream.details?.setting?.choices?.[0]
  if (setting === 'Nature') addHit(hits, 'forest')
  if (setting === 'Water') addHit(hits, 'water')
  if (setting === 'City') addHit(hits, 'road')
  if (setting === 'Vehicle') addHit(hits, 'car')
  return hits
}

function trendFor(monthCount, beforeCount) {
  if (monthCount > 0 && beforeCount === 0) return 'New this month'
  if (monthCount > beforeCount) return 'More than before'
  if (monthCount === 0 && beforeCount > 0) return 'Quiet this month'
  return 'Steady'
}

export function listThemes(dreams, edits, now = new Date()) {
  const clean = cleanThemeEdits(edits)
  const own = userDreams(dreams)
  const month = monthKeyFromDate(now)
  const buckets = new Map()
  for (const dream of own) {
    const when = new Date(dream.datetime)
    const seen = new Set()
    for (const rawId of hitsFor(dream)) {
      const id = resolveTheme(rawId, clean)
      if (seen.has(id)) continue
      seen.add(id)
      if (!buckets.has(id)) {
        buckets.set(id, {
          id,
          name: clean.names[id] || baseName(id),
          group: groupFor(id),
          dreams: [],
          month: 0,
          before: 0,
          nightmares: 0,
          moodCounts: new Map(),
          pinned: clean.pinned.includes(id)
        })
      }
      const row = buckets.get(id)
      row.dreams.push(dream)
      if (monthKeyFromDate(dream.datetime) === month) row.month += 1
      else if (!Number.isNaN(when.getTime())) row.before += 1
      if ((dream.tags || []).includes('Nightmare')) row.nightmares += 1
      for (const mood of [...(dream.moodsDuring || []), dream.moodAfter].filter(Boolean)) {
        row.moodCounts.set(mood, (row.moodCounts.get(mood) || 0) + 1)
      }
    }
  }
  return [...buckets.values()]
    .filter((row) => !clean.hidden.includes(row.id))
    .map((row) => {
      const dreamsSorted = [...row.dreams].sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
      const moods = [...row.moodCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([mood, count]) => ({ mood, count }))
      return {
        id: row.id,
        name: row.name,
        group: row.group,
        count: dreamsSorted.length,
        dreams: dreamsSorted.map((dream) => ({
          id: dream.id,
          title: dream.title || 'Untitled',
          datetime: dream.datetime,
          nightmare: (dream.tags || []).includes('Nightmare')
        })),
        first: dreamsSorted[0]?.datetime || '',
        last: dreamsSorted[dreamsSorted.length - 1]?.datetime || '',
        moods,
        nightmares: row.nightmares,
        month: row.month,
        before: row.before,
        trend: trendFor(row.month, row.before),
        pinned: row.pinned
      }
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.count - a.count || a.name.localeCompare(b.name))
}

export function themeById(dreams, edits, id, now = new Date()) {
  const resolved = resolveTheme(id, edits)
  return listThemes(dreams, edits, now).find((item) => item.id === resolved)
    || listThemes(dreams, { ...cleanThemeEdits(edits), hidden: [] }, now).find((item) => item.id === resolved)
    || null
}

export function themeNote(item) {
  if (!item) return ''
  if (item.count < 2) {
    const title = item.dreams[0]?.title
    return title
      ? `${item.name} is only in ${title} so far, so there is no pattern yet.`
      : `${item.name} has not repeated yet.`
  }
  const mood = item.moods[0]
  const feeling = mood ? `The feeling written beside it most often is ${mood.mood}.` : 'No mood was written next to it.'
  const nights = item.nightmares
    ? `${item.nightmares} of those ${item.count} dreams are marked Nightmare.`
    : `None of those ${item.count} dreams are marked Nightmare.`
  const span = item.first && item.last
    ? `It runs from ${formatDay(item.first)} to ${formatDay(item.last)}.`
    : ''
  return `${item.name} comes back in ${item.count} dreams. ${span} ${feeling} ${nights}`.replace(/\s+/g, ' ').trim()
}

export function themesByGroup(items) {
  return GROUPS.map(([id, label]) => ({
    id,
    label,
    items: items.filter((item) => item.group === id)
  }))
}

export function renameTheme(edits, id, name) {
  const clean = cleanThemeEdits(edits)
  const next = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40)
  if (!next) return clean
  return { ...clean, names: { ...clean.names, [id]: next } }
}

export function hideTheme(edits, id, hidden = true) {
  const clean = cleanThemeEdits(edits)
  const set = new Set(clean.hidden)
  if (hidden) set.add(id)
  else set.delete(id)
  return { ...clean, hidden: [...set] }
}

export function pinTheme(edits, id, pinned = true) {
  const clean = cleanThemeEdits(edits)
  const set = new Set(clean.pinned)
  if (pinned) set.add(id)
  else set.delete(id)
  return { ...clean, pinned: [...set] }
}

export function mergeThemes(edits, sourceId, targetId) {
  const clean = cleanThemeEdits(edits)
  if (!sourceId || !targetId || sourceId === targetId) return clean
  const merges = { ...clean.merges, [sourceId]: targetId }
  for (const [from, to] of Object.entries(merges)) {
    if (to === sourceId) merges[from] = targetId
  }
  delete merges[targetId]
  return { ...clean, merges }
}
