import { screenLabel } from './constants.js'
import { firstSentence, formatWhen } from './format.js'

export function interpretationPrompt(dream, depth, symbols) {
  const detailed = depth === 'detailed'
  const lines = [
    'You are a thoughtful dream interpreter. Do not give a medical or psychiatric diagnosis. Treat the dream as a personal image, not evidence about health.',
    `Depth: ${detailed ? 'detailed' : 'short'}.`,
    'Offer two angles: a psychology-based reading, and a folklore or traditional reading. Say where the two agree and where they do not. Do not claim the dream predicts the future.'
  ]
  if (detailed) {
    lines.push('Walk through the main images, then the feelings, then anything from the day that might have contributed. Keep the tone calm and specific.')
  } else {
    lines.push('Keep the whole reply under 180 words.')
  }
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
  lines.push('', 'Dream:', dream.story || '')
  if (symbols?.length) {
    lines.push('', 'Dictionary notes you may draw on (psychology, then folklore). Use them as background, not as a verdict:')
    for (const symbol of symbols) {
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
    dream.tags?.includes('Nightmare')
      ? 'The scene may be unsettling, but do not use gore.'
      : 'Keep the image calm enough to look at in the morning.',
    '',
    'Scene:',
    story
  ]
  return lines.filter((line) => line !== '').join('\n')
}
