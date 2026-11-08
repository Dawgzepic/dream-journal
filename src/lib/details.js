const VEHICLE = /\b(train|trains|boxcar|car|cars|bus|plane|airplane|boat|ship|bike|bicycle|vehicle|driving|drove|passenger|taxi|subway)\b/i
const PERSON = /\b(people|person|someone|somebody|stranger|strangers|friend|friends|mother|father|mom|dad|grandmother|grandfather|man|woman|boy|girl|crowd|family|roommate|animal|animals|dog|cat|horse)\b/i
const CONFLICT = /\b(chase[ds]?|chasing|argument|arguing|argued|fight|fighting|fought|crash(?:ing|ed)?|yell(?:ing|ed)?|shout(?:ing|ed)?|attack(?:ed|ing)?)\b/i

export const QUESTIONS = [
  { id: 'time', label: 'Time of day', prompt: 'What time of day was it in the dream?', chips: ['Dawn', 'Day', 'Dusk', 'Night', 'Unclear'], note: 'Anything else about the hour?' },
  { id: 'setting', label: 'Setting', prompt: 'What kind of place was it?', chips: ['Indoors', 'Outdoors', 'City', 'Nature', 'Water', 'Vehicle', 'Unknown'], note: 'A name for the place, if you have one.' },
  { id: 'heading', label: 'Where it was headed', prompt: 'Where was the vehicle headed?', chips: ['Home', 'Away', 'Nowhere clear', 'In circles'], note: 'A destination, if you knew one.' },
  { id: 'reminded', label: 'Who they reminded you of', prompt: 'Who did that person remind you of?', chips: ['Someone I know', 'Someone from the past', 'A stranger', 'Not sure'], note: 'A name or a role, if one comes to mind.' },
  { id: 'before', label: 'Feeling just before', prompt: 'What were you feeling right before it turned?', chips: ['Calm', 'Afraid', 'Angry', 'Sad', 'Numb', 'Unclear'], note: 'A few words are enough.' },
  { id: 'place', label: 'The place', prompt: 'Was the place real, familiar, or made up?', chips: ['A real place', 'Familiar', 'Made up', 'Not sure'], note: 'What did it remind you of?' },
  { id: 'ending', label: 'How it ended', prompt: 'How did it end?', chips: ['Woke up', 'Escaped', 'Resolved', 'Cut off', 'Still going'], note: '' },
  { id: 'weather', label: 'Weather and light', prompt: 'What was the weather and the light like?', chips: ['Clear', 'Rain', 'Storm', 'Fog', 'Dark', 'Bright', 'Unclear'], note: '' },
  { id: 'area', label: 'Area', prompt: 'What details of the area stood out?', chips: ['Colors', 'Sounds', 'Smells', 'Quiet', 'Crowded'], note: 'Colors, sounds, smells, or anything else.', multi: true },
  { id: 'people', label: 'Who was there', prompt: 'Who was there with you?', chips: ['Alone', 'Strangers', 'Family', 'Friends', 'Exes or old roommates', 'Animals'], note: 'Names, if you want them.', multi: true },
  { id: 'odd', label: 'Anything odd', prompt: 'Was anything odd or impossible?', chips: ['Yes', 'No', 'Not sure'], note: 'The strange bit, in a few words. It can become a dream sign.' },
  { id: 'self', label: 'Point of view', prompt: 'Were you yourself, or watching?', chips: ['Myself', 'Someone else', 'First person', 'Watching'], note: '' },
  { id: 'peak', label: 'Turning point', prompt: 'What was the strongest feeling at the turning point?', chips: ['Fear', 'Relief', 'Longing', 'Anger', 'Wonder', 'Shame'], note: '' },
  { id: 'age', label: 'Age you felt', prompt: 'About what age did you feel?', chips: ['A child', 'A teenager', 'My age now', 'Older', 'Unclear'], note: '' }
]

const BY_ID = new Map(QUESTIONS.map((question) => [question.id, question]))
const FILL = ['place', 'ending', 'weather', 'area', 'odd', 'people', 'self', 'peak', 'age']

export function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length
}

export function selectQuestions(text) {
  const source = String(text || '')
  const cap = wordCount(source) >= 120 ? 10 : 7
  const ids = []
  const add = (id) => {
    if (!ids.includes(id) && ids.length < cap) ids.push(id)
  }
  add('time')
  add('setting')
  if (VEHICLE.test(source)) add('heading')
  if (PERSON.test(source)) add('reminded')
  if (CONFLICT.test(source)) add('before')
  for (const id of FILL) add(id)
  return ids.map((id) => BY_ID.get(id))
}

export function chipSlug(label) {
  return String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function clip(value, max) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

export function cleanDetails(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  for (const question of QUESTIONS) {
    const item = raw[question.id]
    if (!item || typeof item !== 'object') continue
    const allowed = new Set(question.chips)
    const source = Array.isArray(item.choices) ? item.choices : item.choice ? [item.choice] : []
    const choices = []
    for (const choice of source) {
      const text = clip(choice, 80)
      if (!allowed.has(text) || choices.includes(text)) continue
      choices.push(text)
      if (!question.multi) break
      if (choices.length >= 6) break
    }
    const note = clip(item.note, 300)
    if (!choices.length && !note) continue
    out[question.id] = { choices, note }
  }
  return out
}

export function detailSummaryLines(dream) {
  const details = dream?.details || {}
  const lines = []
  for (const question of QUESTIONS) {
    const item = details[question.id]
    if (!item) continue
    const bits = [...(item.choices || [])]
    if (item.note) bits.push(item.note)
    if (!bits.length) continue
    lines.push(`${question.label}: ${bits.join('. ')}`)
  }
  return lines
}

export function detailCueLines(dream) {
  const details = dream?.details || {}
  const lines = []
  const join = (item) => [...(item?.choices || []), item?.note].filter(Boolean).join(', ')
  const time = join(details.time)
  const setting = join(details.setting)
  const weather = join(details.weather)
  const area = join(details.area)
  if (time) lines.push(`Time of day: ${time}`)
  if (setting) lines.push(`Setting: ${setting}`)
  if (weather) lines.push(`Weather and light: ${weather}`)
  if (area) lines.push(`Colors and surroundings: ${area}`)
  return lines
}

const VAGUE = new Set(['unclear', 'unknown', 'not sure'])

function usefulChoice(item) {
  const choice = item?.choices?.[0] || ''
  if (!choice || VAGUE.has(choice.toLowerCase())) return ''
  return choice
}

function timeWhen(time) {
  return {
    dawn: 'at dawn',
    day: 'in the daytime',
    dusk: 'at dusk',
    night: 'at night'
  }[String(time || '').toLowerCase()] || ''
}

function settingWhere(setting, note, story) {
  const extra = String(note || '').trim()
  const set = String(setting || '').toLowerCase()
  const home = /\bhome\b/i.test(extra)
  const inBed = /\bbed\b/i.test(story || '')
  if (home && set === 'indoors' && inBed) return 'at home, in your own bed'
  if (home && set === 'indoors') return 'at home, indoors'
  if (home) return 'at home'
  if (set === 'vehicle') return extra ? `in a vehicle, ${extra}` : 'in a vehicle'
  if (set === 'indoors') return extra ? `indoors, ${extra}` : 'indoors'
  if (set === 'outdoors') return extra ? `outdoors, ${extra}` : 'outdoors'
  if (set === 'city') return extra ? `in the city, ${extra}` : 'in the city'
  if (set === 'nature') return extra ? `out in nature, ${extra}` : 'out in nature'
  if (set === 'water') return extra ? `by the water, ${extra}` : 'by the water'
  if (extra) return extra
  return ''
}

function endingClause(ending, where, when) {
  const place = [when, where].filter(Boolean).join(', ')
  const key = String(ending || '').toLowerCase()
  if (key === 'woke up') return place ? `You woke from it ${place}.` : 'You woke from it.'
  if (key === 'escaped') return place ? `You got away, ${place}.` : 'You got away.'
  if (key === 'resolved') return place ? `It resolved, ${place}.` : 'It came to a resolution.'
  if (key === 'cut off') return place ? `It cut off, ${place}.` : 'It cut off before it finished.'
  if (key === 'still going') return place ? `It was still going, ${place}.` : 'It was still going when the dream stopped.'
  return place ? `This was ${place}.` : ''
}

export function detailReadingBits(dream) {
  const details = dream?.details || {}
  const bits = []
  const time = usefulChoice(details.time)
  const setting = usefulChoice(details.setting)
  const where = settingWhere(setting, details.setting?.note, dream?.story)
  const when = timeWhen(time)
  const ending = usefulChoice(details.ending)
  const placed = endingClause(ending, where, when)
  if (placed) bits.push(placed)
  const people = (details.people?.choices || []).filter((choice) => !VAGUE.has(String(choice).toLowerCase()))
  if (people.length === 1 && people[0].toLowerCase() === 'alone') bits.push('You were alone in it.')
  else if (people.length) bits.push(`You were with ${people.join(' and ').toLowerCase()}.`)
  const place = details.place?.choices || []
  const familiar = place.some((choice) => /familiar|real place/i.test(choice))
  const remind = String(details.place?.note || '').trim()
  const events = String(dream?.events || '').trim()
  if (familiar && events) {
    bits.push(remind
      ? `The familiar place, ${remind}, sits next to what you linked from waking life: ${events}`
      : `The place felt familiar, next to what you linked from waking life: ${events}`)
  } else if (familiar && remind) {
    bits.push(`The place felt familiar. It reminded you of ${remind}.`)
  }
  return bits
}

export function odditySigns(dreams) {
  const out = []
  for (const dream of dreams || []) {
    if (!dream || dream.isDraft || dream.isSample) continue
    const odd = dream.details?.odd
    if (!odd) continue
    if ((odd.choices || []).includes('No')) continue
    const note = String(odd.note || '').trim()
    const yes = (odd.choices || []).includes('Yes')
    if (yes && note) out.push(note)
  }
  return [...new Set(out)].slice(0, 8)
}
