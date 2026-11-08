import { screenLabel } from './constants.js'
import { detailCueLines } from './details.js'
import { firstSentence, formatWhen } from './format.js'

const DEPTH_WORDS = {
  short: 'about 120 to 150 words',
  medium: 'about 220 to 300 words',
  detailed: 'about 350 to 480 words'
}

export function interpretationPrompt(dream, depth, symbols) {
  const level = DEPTH_WORDS[depth] ? depth : 'short'
  const detailed = level === 'detailed'
  const lines = [
    'You are a thoughtful dream interpreter. Do not give a medical or psychiatric diagnosis. Treat the dream as a personal image, not evidence about health. Do not claim the dream predicts the future.',
    `Depth: ${level}.`,
    `Write one concise reading of ${DEPTH_WORDS[level]}. Do not define each symbol separately, and do not list the images one by one.`,
    'Use this shape:',
    'A brief psychology angle that ties the images to the moods during the dream, the feeling on waking, and any real-life links, as one connected thought.',
    'A brief folklore or traditional angle that does the same, weaving the images into the moods and the waking life instead of glossing each symbol.',
    'Then a final section labeled "Putting it together": one overall meaning that connects the story, the moods during and after the dream, and the linked real-life events into a single takeaway. End with one gentle reflective question.'
  ]
  lines.push('', `Title: ${dream.title || 'Untitled'}`, `When: ${formatWhen(dream.datetime)}`)
  if (dream.moodsDuring?.length) lines.push(`Mood during the dream: ${dream.moodsDuring.join(', ')}`)
  if (dream.moodAfter) lines.push(`Mood after waking: ${dream.moodAfter}`)
  if (dream.clarity) lines.push(`Memory clarity: ${dream.clarity}`)
  if (dream.tags?.length) lines.push(`Labels: ${dream.tags.join(', ')}`)
  if (dream.events) lines.push(`Real-life events that may be linked: ${dream.events}`)
  const bed = dream.bedtime || {}
  const bits = []
  if (bed.food) bits.push(`food or snacks: ${bed.food}`)
  if (bed.substance) bits.push(`caffeine or alcohol: ${bed.substance}`)
  if (bed.stress) bits.push(`stress: ${bed.stress} of 5`)
  if (bed.screen) bits.push(`screen time: ${screenLabel(bed.screen)}`)
  if (bits.length) lines.push(`Bedtime: ${bits.join('; ')}`)
  const cues = detailCueLines(dream)
  if (cues.length) lines.push(...cues)
  lines.push('', 'Dream:', dream.story || '')
  const notes = (symbols || []).slice(0, 5)
  if (notes.length) {
    lines.push('', 'Dictionary notes you may draw on (psychology, then folklore). Use them as background only, not as a verdict, and ignore any note that does not fit this dream:')
    for (const symbol of notes) {
      const psych = detailed ? symbol.psych : firstSentence(symbol.psych)
      const folk = detailed ? symbol.folk : firstSentence(symbol.folk)
      lines.push(`- ${symbol.name}: ${psych} / ${folk}`)
    }
  }
  return lines.join('\n')
}

export function imagePrompt(dream) {
  const moods = [...(dream.moodsDuring || []), dream.moodAfter].filter(Boolean)
  const story = String(dream.story || dream.title || 'An empty moonlit room.').trim().slice(0, 1200)
  const lines = [
    'Create one painterly illustration of this dream. No words, no letters, no watermark, no signature.',
    'Style: dark indigo night, soft moonlight, a little film grain, gentle and dignified.',
    moods.length ? `Mood to convey: ${moods.join(', ')}.` : '',
    ...detailCueLines(dream).map((line) => `${line}.`),
    dream.tags?.includes('Nightmare')
      ? 'The scene may be unsettling, but do not use gore.'
      : 'Keep the image calm enough to look at in the morning.',
    '',
    'Scene:',
    story
  ]
  return lines.filter((line) => line !== '').join('\n')
}
