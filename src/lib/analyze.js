import { userDreams } from './dreams.js'
import { monthKeyFromDate, monthLabel, plural } from './format.js'
import { SYMBOLS } from './symbols.js'

const STOP = new Set(`
a an the and or but if then than so very just only also not no nor
was were be been being am is are
i me my myself we our ours you your yours he she they them his her its
this that these those there here
of to in on at by for from with as into over under about up down out off
it have has had having do did does doing
would could should will can may might must
what when where who whom which why how
dream dreams dreamed dreaming dreamt
night tonight sleep sleeping asleep woke wake waking awake
felt feel feeling feels seemed seem like really still even back
once while during again another other
went came come coming going gone get got
said say says looked look looking saw see seen
something someone somewhere nothing anything everything
because through against before after
know knew think thought wanted want try tried
time times day days morning
just onto from with that this have been were
`.split(/\s+/).filter(Boolean))

let phraseIndex = null

function phrases() {
  if (phraseIndex) return phraseIndex
  const list = []
  for (const symbol of SYMBOLS) {
    for (const key of symbol.keys) list.push({ phrase: key.toLowerCase(), symbol })
  }
  list.sort((a, b) => b.phrase.length - a.phrase.length || a.phrase.localeCompare(b.phrase))
  phraseIndex = list
  return list
}

function lowerKeep(text) {
  let out = ''
  for (const ch of String(text || '')) {
    const low = ch.toLowerCase()
    out += low.length === ch.length ? low : ch
  }
  return out
}

function isWordChar(ch) {
  return !!ch && /[a-z0-9]/i.test(ch)
}

export function findSymbols(text) {
  const source = String(text || '')
  const lower = lowerKeep(source)
  const occupied = new Uint8Array(lower.length)
  const ranges = []
  for (const item of phrases()) {
    const phrase = item.phrase
    if (!phrase) continue
    let from = 0
    while (from <= lower.length - phrase.length) {
      const index = lower.indexOf(phrase, from)
      if (index < 0) break
      const before = index > 0 ? lower[index - 1] : ''
      const after = lower[index + phrase.length] || ''
      if (!isWordChar(before) && !isWordChar(after)) {
        let clash = false
        for (let k = index; k < index + phrase.length; k++) {
          if (occupied[k]) {
            clash = true
            break
          }
        }
        if (!clash) {
          for (let k = index; k < index + phrase.length; k++) occupied[k] = 1
          ranges.push({ start: index, end: index + phrase.length, symbol: item.symbol })
        }
      }
      from = index + 1
    }
  }
  ranges.sort((a, b) => a.start - b.start || b.end - a.end)
  return ranges
}

export function uniqueSymbols(ranges) {
  const seen = new Set()
  const out = []
  for (const range of ranges) {
    if (seen.has(range.symbol.id)) continue
    seen.add(range.symbol.id)
    out.push(range.symbol)
  }
  return out
}

export function contentWords(text) {
  const found = String(text || '').toLowerCase().match(/[a-z][a-z']+/g) || []
  const out = []
  for (const raw of found) {
    const word = raw.replace(/'/g, '')
    if (word.length >= 4 && !STOP.has(word)) out.push(word)
  }
  return out
}

export function tokensFor(dream) {
  const set = new Set(contentWords(`${dream.title || ''} ${dream.story || ''}`))
  const ranges = findSymbols(`${dream.title || ''}\n${dream.story || ''}`)
  for (const symbol of uniqueSymbols(ranges)) set.add(symbol.name.toLowerCase())
  return set
}

function similar(a, b) {
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  const union = a.size + b.size - shared
  if (!union) return false
  const jaccard = shared / union
  return (shared >= 4 && jaccard >= 0.28) || shared >= 6
}

export function recurringGroups(dreams) {
  const items = userDreams(dreams)
    .map((dream) => ({ dream, tokens: tokensFor(dream) }))
    .filter((item) => item.tokens.size >= 6)
  const parent = items.map((_, index) => index)
  const find = (index) => {
    let cursor = index
    while (parent[cursor] !== cursor) {
      parent[cursor] = parent[parent[cursor]]
      cursor = parent[cursor]
    }
    return cursor
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (similar(items[i].tokens, items[j].tokens)) parent[find(i)] = find(j)
    }
  }
  const groups = new Map()
  items.forEach((item, index) => {
    const root = find(index)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(item.dream)
  })
  return [...groups.values()].filter((group) => group.length >= 2)
}

export function recurringIdSet(dreams) {
  const ids = new Set()
  for (const group of recurringGroups(dreams)) {
    for (const dream of group) ids.add(dream.id)
  }
  return ids
}

export function groupWords(dreams) {
  const freq = new Map()
  for (const dream of dreams) {
    for (const token of tokensFor(dream)) freq.set(token, (freq.get(token) || 0) + 1)
  }
  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([word]) => word)
}

export function symbolCounts(dreams) {
  const counts = new Map()
  for (const dream of userDreams(dreams)) {
    const found = uniqueSymbols(findSymbols(`${dream.title || ''}\n${dream.story || ''}`))
    for (const symbol of found) {
      const prev = counts.get(symbol.id)
      counts.set(symbol.id, { symbol, count: (prev?.count || 0) + 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.symbol.name.localeCompare(b.symbol.name))
}

export function moodTotals(dreams) {
  const counts = new Map()
  for (const dream of userDreams(dreams)) {
    const list = dream.moodsDuring?.length ? dream.moodsDuring : dream.moodAfter ? [dream.moodAfter] : []
    for (const mood of list) counts.set(mood, (counts.get(mood) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export function cloudWords(dreams) {
  const freq = new Map()
  for (const dream of userDreams(dreams)) {
    for (const word of contentWords(`${dream.title || ''} ${dream.story || ''}`)) {
      freq.set(word, (freq.get(word) || 0) + 1)
    }
  }
  for (const row of symbolCounts(dreams)) {
    const name = row.symbol.name.toLowerCase()
    freq.set(name, Math.max(freq.get(name) || 0, row.count))
  }
  let list = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const repeated = list.filter(([, count]) => count >= 2)
  if (repeated.length >= 8) list = repeated
  return list.slice(0, 36)
}

export function bedtimeBuckets(dreams) {
  const own = userDreams(dreams)
  const defs = [
    ['Stress 1–2', (dream) => dream.bedtime?.stress >= 1 && dream.bedtime.stress <= 2],
    ['Stress 4–5', (dream) => dream.bedtime?.stress >= 4],
    ['Caffeine', (dream) => dream.bedtime?.substance === 'Caffeine' || dream.bedtime?.substance === 'Both'],
    ['Alcohol', (dream) => dream.bedtime?.substance === 'Alcohol' || dream.bedtime?.substance === 'Both'],
    ['No caffeine or alcohol', (dream) => dream.bedtime?.substance === 'None'],
    ['Screen over an hour', (dream) => dream.bedtime?.screen === 'heavy'],
    ['Little or no screen', (dream) => dream.bedtime?.screen === 'none' || dream.bedtime?.screen === 'light']
  ]
  return defs
    .map(([label, pred]) => {
      const rows = own.filter(pred)
      const nightmares = rows.filter((dream) => (dream.tags || []).includes('Nightmare')).length
      return { label, count: rows.length, nightmares, share: rows.length ? nightmares / rows.length : 0 }
    })
    .filter((bucket) => bucket.count > 0)
}

function nightmareShare(rows) {
  if (!rows.length) return 0
  return rows.filter((dream) => (dream.tags || []).includes('Nightmare')).length / rows.length
}

export function correlationSentence(dreams) {
  const own = userDreams(dreams)
  const low = own.filter((dream) => dream.bedtime?.stress >= 1 && dream.bedtime.stress <= 2)
  const high = own.filter((dream) => dream.bedtime?.stress >= 4)
  const caffeine = own.filter((dream) => dream.bedtime?.substance === 'Caffeine' || dream.bedtime?.substance === 'Both')
  const sober = own.filter((dream) => dream.bedtime?.substance === 'None')
  const bits = []
  if (low.length >= 2 && high.length >= 2) {
    const highShare = nightmareShare(high)
    const lowShare = nightmareShare(low)
    if (highShare - lowShare >= 0.15) {
      bits.push(`On higher-stress nights, the Nightmare label shows up more often so far (${Math.round(highShare * 100)}% versus ${Math.round(lowShare * 100)}% on calmer nights). A handful of entries can only hint.`)
    } else if (lowShare - highShare >= 0.15) {
      bits.push('Calmer nights carry the Nightmare label more often in this small sample. Treat that as a hint, not a rule.')
    } else {
      bits.push('Stress and nightmares do not split cleanly in what you have logged so far.')
    }
  }
  if (caffeine.length >= 2 && sober.length >= 2) {
    const caffShare = nightmareShare(caffeine)
    const soberShare = nightmareShare(sober)
    if (Math.abs(caffShare - soberShare) >= 0.15) {
      const more = caffShare > soberShare ? 'Caffeine nights' : 'Nights without caffeine or alcohol'
      bits.push(`${more} lean more toward nightmares in these notes. It is still a small sample.`)
    }
  }
  if (bits.length) return bits.join(' ')
  const noted = own.filter((dream) => {
    const bed = dream.bedtime || {}
    return bed.food || bed.substance || bed.stress || bed.screen
  }).length
  if (noted < 4) {
    return 'There are not enough bedtime notes yet to line food, caffeine, alcohol, stress, or screens up against mood. Add them when you remember.'
  }
  return 'Bedtime notes are starting to collect, but no clear split with nightmares has shown up yet.'
}

export function moodTrend(dreams, now = new Date()) {
  const own = userDreams(dreams)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - start.getDay())
  const weeks = []
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(start)
    weekStart.setDate(weekStart.getDate() - i * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    weeks.push({
      start: weekStart,
      end: weekEnd,
      label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      counts: {}
    })
  }
  for (const dream of own) {
    const when = new Date(dream.datetime)
    for (const week of weeks) {
      if (when >= week.start && when < week.end) {
        const moods = dream.moodsDuring?.length ? dream.moodsDuring : dream.moodAfter ? [dream.moodAfter] : []
        for (const mood of moods) week.counts[mood] = (week.counts[mood] || 0) + 1
      }
    }
  }
  return weeks
}

export function monthOptions(dreams, now = new Date()) {
  const keys = new Set([monthKeyFromDate(now)])
  for (const dream of userDreams(dreams)) keys.add(monthKeyFromDate(dream.datetime))
  return [...keys].filter(Boolean).sort().reverse()
}

export function monthRecap(dreams, key) {
  const [year, month] = String(key).split('-').map(Number)
  const own = userDreams(dreams).filter((dream) => {
    const when = new Date(dream.datetime)
    return when.getFullYear() === year && when.getMonth() === month - 1
  })
  const totals = moodTotals(own)
  const symbols = symbolCounts(own).slice(0, 5)
  const nightmares = own.filter((dream) => (dream.tags || []).includes('Nightmare')).length
  const lucid = own.filter((dream) => (dream.tags || []).includes('Lucid')).length
  const label = monthLabel(key)
  let prose
  if (!own.length) {
    prose = `Nothing of your own is logged for ${label} yet.`
  } else {
    const bits = [`In ${label} you logged ${plural(own.length, 'dream')}.`]
    if (lucid) bits.push(`${plural(lucid, 'dream')} ${lucid === 1 ? 'is' : 'are'} marked Lucid.`)
    if (nightmares) bits.push(`${plural(nightmares, 'dream')} ${nightmares === 1 ? 'carries' : 'carry'} the Nightmare label.`)
    if (totals[0]) bits.push(`The mood you noted most was ${totals[0][0]}.`)
    if (symbols.length) bits.push(`Symbols that stood out: ${symbols.map((row) => row.symbol.name.toLowerCase()).join(', ')}.`)
    prose = bits.join(' ')
  }
  return { count: own.length, nightmares, lucid, prose, titles: own.map((dream) => dream.title || 'Untitled') }
}

export function summarize(dreams) {
  const own = userDreams(dreams)
  if (!own.length) {
    return {
      lead: 'Patterns show up once a few of your own dreams are here.',
      detail: 'The sample dream is only a guide. It is left out of streaks, charts, and this summary. Log a night, even in a few words, and the shape of your dreams can start to show.'
    }
  }
  const totals = moodTotals(dreams)
  const nightmares = own.filter((dream) => (dream.tags || []).includes('Nightmare')).length
  const lucid = own.filter((dream) => (dream.tags || []).includes('Lucid')).length
  const symbols = symbolCounts(dreams).slice(0, 3).map((row) => row.symbol.name.toLowerCase())
  const groups = recurringGroups(dreams)
  const sentences = [`You have logged ${plural(own.length, 'dream')}.`]
  if (totals[0]) sentences.push(`${totals[0][0]} is the mood you mark most.`)
  if (nightmares) sentences.push(`${plural(nightmares, 'dream')} ${nightmares === 1 ? 'carries' : 'carry'} the Nightmare label.`)
  else sentences.push('None are marked Nightmare.')
  if (lucid) sentences.push(`${plural(lucid, 'dream')} ${lucid === 1 ? 'is' : 'are'} marked Lucid.`)
  if (symbols.length) sentences.push(`Images that return: ${symbols.join(', ')}.`)
  if (groups.length) {
    const places = groups.reduce((sum, group) => sum + group.length, 0)
    sentences.push(`${plural(groups.length, 'cluster')} of similar wording, covering ${plural(places, 'dream')}, ${groups.length === 1 ? 'looks' : 'look'} like a dream coming back.`)
  }
  sentences.push(correlationSentence(dreams))
  return {
    lead: sentences.slice(0, 2).join(' '),
    detail: sentences.filter(Boolean).join(' ')
  }
}

export function thisMonthCount(dreams, now = new Date()) {
  return userDreams(dreams).filter((dream) => {
    const when = new Date(dream.datetime)
    return when.getFullYear() === now.getFullYear() && when.getMonth() === now.getMonth()
  }).length
}

const SYMBOL_NAMES = new Set(SYMBOLS.map((symbol) => symbol.name.toLowerCase()))

export function isSymbolName(word) {
  return SYMBOL_NAMES.has(String(word || '').toLowerCase())
}
