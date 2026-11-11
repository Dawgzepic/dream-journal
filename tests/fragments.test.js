import assert from 'node:assert/strict'
import test from 'node:test'
import { monthRecap, symbolCounts } from '../src/lib/analyze.js'
import { journalToText, parseBackup } from '../src/lib/backup.js'
import { blankDream, displayTitle, normalizeDream } from '../src/lib/dreams.js'
import { buildProfile, fragmentsRecallLine, MIN_DREAMS } from '../src/lib/personality.js'
import { listThemes } from '../src/lib/themes.js'

function dream(id, title, story, day, extra = {}) {
  return {
    ...blankDream(),
    id,
    title,
    story,
    isDraft: false,
    datetime: `2026-11-${String(day).padStart(2, '0')}T12:00:00.000Z`,
    ...extra
  }
}

test('an old entry stays a normal dream, and a blank fragments night is kept', () => {
  const old = normalizeDream({ id: 'old', title: 'Old night', story: 'I slept.' })
  assert.equal(old.isFragments, false)
  assert.equal(displayTitle(old), 'Old night')
  const empty = normalizeDream({ id: 'bits', isFragments: true, story: '', title: '' })
  assert.equal(empty.isFragments, true)
  assert.equal(empty.story, '')
  assert.equal(displayTitle(empty), 'Fragments')
  assert.equal(normalizeDream({ id: 'gone', story: '', title: '' }), null)
  const text = journalToText([empty])
  assert.match(text, /Fragments night/)
  const round = parseBackup(JSON.stringify({ app: 'Dream Journal', version: 1, dreams: [empty] }))
  assert.equal(round.dreams[0].isFragments, true)
})

test('patterns count fragments nights and do not mine them for themes', () => {
  const dreams = [
    dream('a', 'Door', 'A dog slept by the door.', 2),
    dream('b', 'Flashes', 'A dog, a train, and my mother in the kitchen.', 3, { isFragments: true })
  ]
  assert.equal(listThemes(dreams, {}).some((item) => item.id === 'train'), false)
  assert.equal(listThemes(dreams, {}).some((item) => item.id === 'mother'), false)
  assert.equal(listThemes(dreams, {}).find((item) => item.id === 'dog').count, 1)
  assert.equal(symbolCounts(dreams).some((row) => row.symbol.id === 'train'), false)
  const recap = monthRecap(dreams, '2026-11')
  assert.match(recap.prose, /1 fragments night is in this month/)
  assert.doesNotMatch(recap.prose, /train/)
})

test('fragments nights do not unlock or score the profile', () => {
  const scored = [1, 2, 3, 4].map((day) => dream(`s${day}`, `Night ${day}`, `I walked past a quiet hedge on night ${day}.`, day))
  const flashes = [8, 9, 10].map((day) => dream(`f${day}`, 'Flashes', 'A purple lighthouse and a dog.', day, { isFragments: true, moodsDuring: ['Scared'] }))
  const now = new Date('2026-11-11T18:00:00.000Z')
  const locked = buildProfile([...scored, ...flashes], { answers: {} }, now)
  assert.equal(locked.ready, false)
  assert.equal(locked.dreamCount, 4)
  assert.equal(locked.dreamCount < MIN_DREAMS, true)
  assert.equal(locked.essay, '')
  assert.match(fragmentsRecallLine([...scored, ...flashes], now), /3 fragments nights in the last 30 days/)
  const fifth = dream('s5', 'Fifth', 'I walked past a quiet hedge on the fifth night.', 5)
  const open = buildProfile([...scored, fifth], { answers: {} }, now)
  const withFlashes = buildProfile([...scored, fifth, ...flashes], { answers: {} }, now)
  assert.equal(withFlashes.ready, true)
  assert.equal(withFlashes.dreamCount, open.dreamCount)
  assert.deepEqual(withFlashes.traits.map((trait) => trait.sentence), open.traits.map((trait) => trait.sentence))
  assert.equal(withFlashes.lately, open.lately)
  assert.equal(withFlashes.archetype.id, open.archetype.id)
  assert.doesNotMatch(withFlashes.essay, /lighthouse|purple/)
  assert.match(withFlashes.essay, /Lots of fragments nights lately/)
  assert.match(withFlashes.essay, /waking briefly during the night/)
  assert.match(withFlashes.recallLine, /3 fragments nights in the last 30 days/)
})
