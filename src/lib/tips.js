export const NOTES = [
  { kind: 'Tip', text: 'Dreams fade fastest in the first minute. A title and three concrete words are enough to start.' },
  { kind: 'Fact', text: 'Most dreams are forgotten within minutes of waking unless you rehearse them once, even briefly.' },
  { kind: 'Tip', text: 'Write in the present tense, as if you are still there. The next image often follows the last one.' },
  { kind: 'Fact', text: 'The body is usually still during the most vivid dreams. The journal can remember what the muscles never acted out.' },
  { kind: 'Tip', text: 'If the plot is gone, keep the feeling and one object. Mood and a single image are a real entry.' },
  { kind: 'Fact', text: 'Similar dreams often return when a daytime concern is unfinished. The wording may change while the scene stays.' },
  { kind: 'Tip', text: 'A reality check works better when something odd prompts it, not only when a timer does.' },
  { kind: 'Fact', text: 'Lucid dreaming is a skill of noticing. It is ordinary attention, practiced in the day and remembered at night.' },
  { kind: 'Tip', text: 'Nightmares are still worth logging. A few plain words count, and you can stop there.' },
  { kind: 'Fact', text: 'Caffeine, alcohol, stress, and late screens change sleep for many people. Your own notes will tell you more than a general rule.' },
  { kind: 'Tip', text: 'When you wake at night, jot before you roll over. The second sleep often keeps the first dream from you.' },
  { kind: 'Fact', text: 'Text, clocks, and hands are unreliable in dreams. That is why they make useful reality checks while you are awake.' }
]

export function noteFor(now = new Date()) {
  const start = new Date(now.getFullYear(), 0, 0)
  const day = Math.floor((now - start) / 86400000)
  const index = ((day % NOTES.length) + NOTES.length) % NOTES.length
  return NOTES[index]
}
