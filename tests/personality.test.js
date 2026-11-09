import assert from 'node:assert/strict'
import test from 'node:test'
import { journalToJSON, journalToText, parseBackup } from '../src/lib/backup.js'
import { defaultSettings } from '../src/lib/constants.js'
import { blankDream } from '../src/lib/dreams.js'
import { applySnapshot, buildProfile, MIN_DREAMS, monthSelfLine, QUIZ } from '../src/lib/personality.js'

const FLEAS = 'I rolled over in my bed and locked eyes with Maple\'s dog bed right beside mine, which had a linen sheet on top. As I looked at her bed, I noticed a few black specks running around; soon there were more and more, and they started to form into a pile. At that point, I gathered the linen together and tossed it out the window.'
const TRAIN = 'I got on a boxcar train, ontop not inside, just to go around town, but didn\'t realize until it was too late that it went coast to coast, and I was stuck for the ride. I remember thinking I had to wait for water or for the train to slow down so I could jump off as safely as possible and start the long journey home, which would only get longer the more I was stuck on the train.'
const CARS = 'Cars in a park were crashing into each other while people argued and shouted. I escaped through the trees before another one could reach me.'

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

function sampleSet() {
  return [
    dream('f', 'Fleas', FLEAS, 8, { moodsDuring: ['Confused'], moodAfter: 'Confused', details: { setting: { choices: ['Indoors'], note: 'Home' }, time: { choices: ['Unclear'], note: '' }, ending: { choices: ['Woke up'], note: '' } } }),
    dream('t', 'Train Ride', TRAIN, 7, { moodsDuring: ['Anxious'], moodAfter: 'Sad', events: 'Work has been taking more of the week than I agreed to.' }),
    dream('c', 'Cars in a Park', CARS, 6, { moodsDuring: ['Scared'], moodAfter: 'Anxious', tags: ['Nightmare'] }),
    dream('q', 'Cups', 'I washed the cups and went back to sleep.', 5),
    dream('h', 'Hall', 'A quiet hallway in my building.', 4)
  ]
}

test('the quiz has more than 50 questions and skips do not score', () => {
  assert.ok(QUIZ.length >= 50)
  const ids = new Set(QUIZ.map((question) => question.id))
  assert.equal(ids.size, QUIZ.length)
  const skipped = Object.fromEntries(QUIZ.map((question) => [question.id, 'skip']))
  const profile = buildProfile(sampleSet(), { answers: skipped })
  const none = buildProfile(sampleSet(), { answers: {} })
  assert.equal(profile.quizAnswered, 0)
  assert.deepEqual(profile.traits.map((trait) => trait.score), none.traits.map((trait) => trait.score))
})

test('three named dreams are not enough for the profile', () => {
  const profile = buildProfile(sampleSet().slice(0, 3), { answers: {} })
  assert.equal(profile.ready, false)
  assert.equal(profile.dreamCount, 3)
  assert.equal(profile.needed, MIN_DREAMS)
  assert.equal(profile.essay, '')
})

test('fleas, the train, and the cars produce a concrete profile', () => {
  const dreams = sampleSet()
  const profile = buildProfile(dreams, { answers: { q01: 'yes', q13: 'no' } })
  assert.equal(profile.ready, true)
  const text = profile.essay
  assert.match(text, /specks on a dog's bed/i)
  assert.match(text, /window/i)
  assert.match(text, /train/i)
  assert.match(text, /way home/i)
  assert.match(text, /cars crash|argue|get away/i)
  assert.match(text, /Cars in a Park/)
  assert.match(text, /Work has been taking more/)
  assert.match(text, /not a diagnosis/)
  assert.match(text, /not an official Myers-Briggs/)
  assert.equal(/\byou will\b/i.test(text), false)
  assert.equal(/weather you are walking/i.test(text), false)
  assert.equal(/mood that found pictures/i.test(text), false)
  assert.ok(profile.strengths.length >= 1)
  assert.ok(profile.gaps.length >= 1)
  assert.match(profile.lately, /Fleas/)
  assert.ok(profile.traits.length === 5)
  const withQuiz = profile.traits.find((trait) => trait.id === 'openness').score
  const noQuiz = buildProfile(dreams, { answers: {} }).traits.find((trait) => trait.id === 'openness').score
  assert.notEqual(withQuiz, noQuiz)
  const textExport = journalToText(dreams, { personality: { answers: { q01: 'yes' } } })
  assert.match(textExport, /Personality/)
  assert.match(textExport, /specks on a dog's bed/)
  const raw = journalToJSON({ ...defaultSettings(), personality: { answers: { q01: 'yes' }, history: [] } }, dreams)
  const parsed = parseBackup(raw)
  const data = JSON.parse(raw)
  assert.equal(parsed.preferences.personality.answers.q01, 'yes')
  assert.match(data.preferences.personality.profile.essay, /train/i)
  const line = monthSelfLine(dreams, '2026-11')
  assert.match(line, /Fleas|Train Ride|Cars in a Park/)
})

test('profile history records a change and ignores a repeat', () => {
  const dreams = sampleSet()
  const first = buildProfile(dreams, { answers: {} })
  const once = applySnapshot({ answers: {}, history: [] }, first, new Date('2026-11-01T00:00:00.000Z'))
  const twice = applySnapshot(once, first, new Date('2026-11-02T00:00:00.000Z'))
  assert.equal(once.history.length, 1)
  assert.equal(twice.history.length, 1)
  const more = [...dreams, dream('n', 'New gate', 'I found a locked gate and waited.', 9)]
  const next = buildProfile(more, twice)
  const stored = applySnapshot(twice, next, new Date('2026-11-09T00:00:00.000Z'))
  assert.equal(stored.history.length, 2)
  assert.equal(stored.history[1].dreamCount, 6)
  const early = buildProfile(dreams.slice(0, 2), { answers: {} })
  assert.equal(applySnapshot({ answers: {}, history: [] }, early).history.length, 0)
})
