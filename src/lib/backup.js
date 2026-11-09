import { screenLabel } from './constants.js'
import { detailSummaryLines } from './details.js'
import { cleanPersonality, personalityBundle, personalityExport } from './personality.js'
import { normalizeDream } from './dreams.js'
import { formatWhen, dayKey } from './format.js'

function pdfSafe(value) {
  return String(value ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\n\r\t\x20-\x7E]/g, '')
}

export function journalToText(dreams, settings) {
  const list = [...dreams].sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
  const parts = ['Dream Journal', 'Private copy for Timothy.', '']
  for (const dream of list) {
    parts.push(dream.title || 'Untitled')
    parts.push(formatWhen(dream.datetime))
    if (dream.isSample) parts.push('Sample dream')
    if (dream.isDraft) parts.push('Draft')
    if (dream.moodsDuring?.length) parts.push(`Mood during: ${dream.moodsDuring.join(', ')}`)
    if (dream.moodAfter) parts.push(`Mood after waking: ${dream.moodAfter}`)
    if (dream.clarity) parts.push(`Memory: ${dream.clarity}`)
    if (dream.tags?.length) parts.push(`Labels: ${dream.tags.join(', ')}`)
    if (dream.events) parts.push(`Linked events: ${dream.events}`)
    const bed = dream.bedtime || {}
    const bits = []
    if (bed.food) bits.push(`food: ${bed.food}`)
    if (bed.substance) bits.push(`caffeine or alcohol: ${bed.substance}`)
    if (bed.stress) bits.push(`stress: ${bed.stress} of 5`)
    if (bed.screen) bits.push(`screen: ${screenLabel(bed.screen)}`)
    if (bits.length) parts.push(`Before bed: ${bits.join('; ')}`)
    const detailLines = detailSummaryLines(dream)
    if (detailLines.length) {
      parts.push('Details:')
      for (const line of detailLines) parts.push(line)
    }
    parts.push('')
    parts.push(dream.story || '')
    parts.push('')
    parts.push('---')
    parts.push('')
  }
  if (!list.length) parts.push('No dreams were saved.')
  const profile = personalityExport(dreams, settings)
  if (profile) {
    parts.push(profile)
    parts.push('')
  }
  return parts.join('\n')
}

export function preferencesFrom(settings) {
  return {
    workDays: settings.workDays,
    workStart: settings.workStart,
    workEnd: settings.workEnd,
    morningReminder: settings.morningReminder,
    morningTime: settings.morningTime,
    realityReminder: settings.realityReminder,
    customMoods: settings.customMoods || [],
    customTags: settings.customTags || [],
    voiceOptIn: settings.voiceOptIn
  }
}

export function journalToJSON(settings, dreams) {
  return JSON.stringify({
    app: 'Dream Journal',
    version: 1,
    exportedAt: new Date().toISOString(),
    preferences: { ...preferencesFrom(settings), personality: personalityBundle(dreams, settings) },
    dreams
  }, null, 2)
}

export function parseBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!data || data.app !== 'Dream Journal' || !Array.isArray(data.dreams)) {
    throw new Error("That file isn't a Dream Journal backup.")
  }
  const dreams = []
  const seen = new Set()
  for (const raw of data.dreams.slice(0, 5000)) {
    const dream = normalizeDream(raw)
    if (!dream || seen.has(dream.id)) continue
    seen.add(dream.id)
    dreams.push(dream)
  }
  const prefs = data.preferences && typeof data.preferences === 'object' ? data.preferences : {}
  return { dreams, preferences: sanitizePrefs(prefs), truncated: data.dreams.length > 5000 }
}

export function sanitizePrefs(prefs) {
  const workDays = Array.isArray(prefs.workDays)
    ? [...new Set(prefs.workDays.map(Number).filter((day) => day >= 0 && day <= 6))]
    : null
  const timeOk = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')
  return {
    workDays,
    workStart: timeOk(prefs.workStart) ? prefs.workStart : null,
    workEnd: timeOk(prefs.workEnd) ? prefs.workEnd : null,
    morningReminder: typeof prefs.morningReminder === 'boolean' ? prefs.morningReminder : null,
    morningTime: timeOk(prefs.morningTime) ? prefs.morningTime : null,
    realityReminder: typeof prefs.realityReminder === 'boolean' ? prefs.realityReminder : null,
    customMoods: Array.isArray(prefs.customMoods) ? prefs.customMoods.map(String).slice(0, 40) : [],
    customTags: Array.isArray(prefs.customTags) ? prefs.customTags.map(String).slice(0, 40) : [],
    voiceOptIn: prefs.voiceOptIn === true || prefs.voiceOptIn === false ? prefs.voiceOptIn : null,
    personality: prefs.personality ? cleanPersonality(prefs.personality) : null
  }
}

export function applyPrefs(settings, prefs) {
  const next = { ...settings }
  if (prefs.workDays) next.workDays = prefs.workDays
  if (prefs.workStart && prefs.workEnd && prefs.workEnd > prefs.workStart) {
    next.workStart = prefs.workStart
    next.workEnd = prefs.workEnd
  }
  if (prefs.morningReminder != null) next.morningReminder = prefs.morningReminder
  if (prefs.morningTime) next.morningTime = prefs.morningTime
  if (prefs.realityReminder != null) next.realityReminder = prefs.realityReminder
  if (prefs.customMoods) next.customMoods = prefs.customMoods
  if (prefs.customTags) next.customTags = prefs.customTags
  if (prefs.voiceOptIn != null) next.voiceOptIn = prefs.voiceOptIn
  if (prefs.personality) next.personality = cleanPersonality(prefs.personality)
  return next
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function downloadPdf(dreams, settings) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 56
  const width = 595.28 - margin * 2
  const pageHeight = 841.89
  const leading = 16
  let y = margin

  function ensure(height) {
    if (y + height > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  function write(text, size = 12, style = 'normal') {
    doc.setFont('times', style)
    doc.setFontSize(size)
    const rows = doc.splitTextToSize(pdfSafe(text) || ' ', width)
    const step = Math.max(leading, size + 3)
    for (const row of rows) {
      ensure(step)
      doc.text(row, margin, y)
      y += step
    }
  }

  write('Dream Journal', 22, 'bold')
  write('A private journal kept on this device.', 12, 'italic')
  write(`Exported ${new Date().toLocaleString()}`, 11)
  y += 8
  const list = [...dreams].sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
  if (!list.length) write('No dreams were saved.')
  for (const dream of list) {
    y += 8
    write(dream.title || 'Untitled', 16, 'bold')
    write(formatWhen(dream.datetime), 11, 'italic')
    if (dream.isSample) write('Sample dream')
    if (dream.isDraft) write('Draft')
    if (dream.moodsDuring?.length) write(`Mood during: ${dream.moodsDuring.join(', ')}`)
    if (dream.moodAfter) write(`Mood after waking: ${dream.moodAfter}`)
    if (dream.clarity) write(`Memory: ${dream.clarity}`)
    if (dream.tags?.length) write(`Labels: ${dream.tags.join(', ')}`)
    if (dream.events) write(`Linked events: ${dream.events}`)
    const detailLines = detailSummaryLines(dream)
    if (detailLines.length) {
      write('Details:')
      for (const line of detailLines) write(line)
    }
    write(dream.story || '')
  }
  const profile = personalityExport(dreams, settings)
  if (profile) {
    y += 12
    write('Personality', 16, 'bold')
    for (const paragraph of profile.split('\n\n').slice(1)) write(paragraph)
  }
  doc.save(`dream-journal-${dayKey(new Date())}.pdf`)
}
