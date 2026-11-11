import assert from 'node:assert/strict'
import test from 'node:test'
import { bedtimeBuckets, findSymbols, recurringGroups, uniqueSymbols } from '../src/lib/analyze.js'
import { parseBackup, journalToJSON, journalToText } from '../src/lib/backup.js'
import { selectQuestions, detailSummaryLines, odditySigns } from '../src/lib/details.js'
import { defaultSettings } from '../src/lib/constants.js'
import { blankDream, normalizeDream, userDreams } from '../src/lib/dreams.js'
import { hashPin, randomSalt, verifyPin } from '../src/lib/pin.js'
import { sampleDream } from '../src/lib/sample.js'
import { SYMBOLS } from '../src/lib/symbols.js'
import { currentStreak, greeting, isQuietHours, isWorkTime, nextRealityDelay } from '../src/lib/time.js'
import { imagePrompt, interpretationPrompt } from '../src/lib/ai.js'
import { fullInterpretation } from '../src/lib/interpret.js'

test('dictionary has 150 distinct symbols with both readings', () => {
  assert.ok(SYMBOLS.length >= 150)
  const ids = new Set(SYMBOLS.map((symbol) => symbol.id))
  assert.equal(ids.size, SYMBOLS.length)
  const keys = SYMBOLS.flatMap((symbol) => symbol.keys.map((key) => key.toLowerCase()))
  assert.equal(keys.length, new Set(keys).size)
  for (const symbol of SYMBOLS) {
    assert.ok(symbol.psych.length > 40, symbol.id)
    assert.ok(symbol.folk.length > 40, symbol.id)
    assert.ok(symbol.keys.length >= 1, symbol.id)
  }
})

test('sample dream highlights the images it was written to contain', () => {
  const ranges = findSymbols(sampleDream().story)
  const ids = new Set(uniqueSymbols(ranges).map((symbol) => symbol.id))
  for (const id of ['library', 'sea', 'moon', 'water', 'horse', 'teeth', 'key', 'door', 'train', 'book', 'light', 'childhood-home', 'late']) {
    assert.ok(ids.has(id), id)
  }
  const text = 'The loose tooth fell beside another tooth.'
  const tooth = findSymbols(text)
  assert.ok(tooth.some((range) => range.symbol.id === 'teeth-falling' || range.symbol.id === 'teeth'))
  const house = findSymbols('my childhood house and another house')
  const names = house.map((range) => range.symbol.id)
  assert.ok(names.includes('childhood-home'))
  assert.ok(names.includes('house'))
})

test('salted SHA-256 keeps the PIN out of the hash', async () => {
  const salt = randomSalt()
  const hash = await hashPin('1212', salt)
  assert.match(hash, /^[a-f0-9]{64}$/)
  assert.equal(hash.includes('1212'), false)
  assert.equal(await verifyPin('1212', Buffer.from(salt).toString('hex'), hash), true)
  assert.equal(await verifyPin('0000', Buffer.from(salt).toString('hex'), hash), false)
  const other = randomSalt()
  assert.notEqual(await hashPin('1212', other), hash)
})

test('work hours match Timothy’s week and reality checks stay outside them', () => {
  const settings = defaultSettings()
  const sundayMorning = new Date(2026, 10, 8, 9, 0)
  const sundayEarly = new Date(2026, 10, 8, 7, 59)
  const sundayClose = new Date(2026, 10, 8, 16, 29)
  const sundayAfter = new Date(2026, 10, 8, 16, 30)
  const tuesday = new Date(2026, 10, 10, 9, 0)
  const saturday = new Date(2026, 10, 14, 9, 0)
  const friday = new Date(2026, 10, 13, 16, 29)
  assert.equal(isWorkTime(sundayMorning, settings), true)
  assert.equal(isWorkTime(sundayEarly, settings), false)
  assert.equal(isWorkTime(sundayClose, settings), true)
  assert.equal(isWorkTime(sundayAfter, settings), false)
  assert.equal(isWorkTime(tuesday, settings), false)
  assert.equal(isWorkTime(saturday, settings), false)
  assert.equal(isWorkTime(friday, settings), true)
  assert.equal(isQuietHours(new Date(2026, 10, 8, 6, 59)), true)
  assert.equal(isQuietHours(new Date(2026, 10, 8, 7, 0)), false)
  assert.equal(isQuietHours(new Date(2026, 10, 8, 22, 0)), true)
  const during = new Date(2026, 10, 8, 10, 0, 0)
  const delay = nextRealityDelay(during, settings, () => 0)
  const at = new Date(during.getTime() + delay)
  assert.equal(at.getHours(), 16)
  assert.equal(at.getMinutes(), 35)
  assert.equal(isWorkTime(at, settings), false)
  assert.equal(isQuietHours(at), false)
  const open = new Date(2026, 10, 14, 15, 0, 0)
  assert.equal(nextRealityDelay(open, settings, () => 0), 45 * 60 * 1000)
})

test('greeting follows the time of day', () => {
  assert.equal(greeting(new Date(2026, 10, 8, 4, 0)), 'Still night, Timothy')
  assert.equal(greeting(new Date(2026, 10, 8, 8, 0)), 'Good morning, Timothy')
  assert.equal(greeting(new Date(2026, 10, 8, 13, 0)), 'Good afternoon, Timothy')
  assert.equal(greeting(new Date(2026, 10, 8, 18, 0)), 'Good evening, Timothy')
  assert.equal(greeting(new Date(2026, 10, 8, 22, 0)), 'Good night, Timothy')
})

test('streak ignores samples and drafts and survives until the day ends', () => {
  const now = new Date(2026, 10, 8, 15, 0, 0)
  const on = (day, extra = {}) => ({
    ...blankDream(),
    id: `d-${day}-${extra.isDraft ? 'draft' : 'ok'}`,
    datetime: new Date(2026, 10, day, 12).toISOString(),
    title: 'Night',
    story: 'A long enough story about a train.',
    isDraft: false,
    isSample: false,
    ...extra
  })
  assert.equal(currentStreak([on(7), on(6), on(8, { isSample: true }), on(8, { isDraft: true })], now), 2)
  assert.equal(currentStreak([on(8), on(7), on(6)], now), 3)
  assert.equal(currentStreak([on(8), on(6)], now), 1)
  assert.equal(userDreams([on(8), on(8, { isSample: true })]).length, 1)
})

test('similar dreams cluster and unrelated ones do not', () => {
  const make = (id, title, story, extra = {}) => ({
    ...blankDream(),
    id,
    title,
    story,
    isDraft: false,
    ...extra
  })
  const a = make('a', 'Glass station', 'I stood on a glass platform while a silver train passed under the sea. The doors opened onto black water and a white horse waited on the far side.')
  const b = make('b', 'Under the station again', 'Again I stood on the glass platform. A silver train passed under the sea and the doors opened onto black water. The white horse was still waiting.')
  const c = make('c', 'Garden', 'My grandmother walked with me in a garden where a huge tree held the moon. She handed me an apple and the afternoon was quiet.')
  const groups = recurringGroups([a, b, c])
  assert.equal(groups.length, 1)
  const ids = groups[0].map((dream) => dream.id).sort()
  assert.deepEqual(ids, ['a', 'b'])
})

test('backup text and import keep dreams and drop a bad file', () => {
  const dream = {
    ...blankDream(),
    id: 'kept',
    title: 'Glass station',
    story: 'A silver train under the sea.',
    isDraft: false,
    moodsDuring: ['Peaceful'],
    tags: ['Lucid']
  }
  const text = journalToText([dream])
  assert.match(text, /Glass station/)
  assert.match(text, /Peaceful/)
  const raw = JSON.stringify({ app: 'Dream Journal', version: 1, dreams: [dream], preferences: { workDays: [0, 1] } })
  const parsed = parseBackup(raw)
  assert.equal(parsed.dreams[0].title, 'Glass station')
  assert.equal(parsed.preferences.workDays.includes(0), true)
  assert.throws(() => parseBackup('{"app":"Other"}'), /isn't a Dream Journal backup/)
  const cleaned = normalizeDream({ title: 'Hi', story: 'A dream', moodsDuring: ['😀', 'Happy'] })
  assert.deepEqual(cleaned.moodsDuring, ['Happy'])
})

test('a light jog is not Light, and the car still counts', () => {
  const text = 'I started doing a light jog toward my car, which was all the way across the field.'
  const ids = new Set(uniqueSymbols(findSymbols(text)).map((symbol) => symbol.id))
  assert.equal(ids.has('light'), false)
  assert.equal(ids.has('car'), true)
  assert.equal(uniqueSymbols(findSymbols('light rain and a light blue door')).some((symbol) => symbol.id === 'light'), false)
  assert.equal(uniqueSymbols(findSymbols('Then the lights went out.')).some((symbol) => symbol.id === 'light'), true)
  assert.equal(uniqueSymbols(findSymbols('my shirt in my hand')).some((symbol) => symbol.id === 'hands'), false)
  assert.equal(uniqueSymbols(findSymbols('my hands were enormous')).some((symbol) => symbol.id === 'hands'), true)
})

test('interpretation prompt stays on the device and names both angles', () => {
  const dream = sampleDream()
  const symbols = uniqueSymbols(findSymbols(`${dream.title}\n${dream.story}`)).slice(0, 2)
  const prompt = interpretationPrompt(dream, 'detailed', symbols)
  assert.match(prompt, /psychology/i)
  assert.match(prompt, /folklore/i)
  assert.match(prompt, /detailed/)
  assert.match(prompt, /library/i)
  assert.match(prompt, /Putting it together/)
  assert.match(prompt, /Do not define each symbol separately/)
  assert.match(prompt, /350 to 480 words/)
  assert.match(prompt, /diagnosis/i)
  assert.match(prompt, /predicts the future/)
  assert.match(prompt, /background only/)
  assert.match(interpretationPrompt(dream, 'short', symbols), /120 to 150 words/)
  assert.equal(prompt.includes('http'), false)
})

const TRAIN_RIDE = 'I got on a boxcar train, ontop not inside, just to go around town, but didn\'t realize until it was too late that it went coast to coast, and I was stuck for the ride. I remember thinking I had to wait for water or for the train to slow down so I could jump off as safely as possible and start the long journey home, which would only get longer the more I was stuck on the train.'

test('train ride reading is one journey home, not a list of parts', () => {
  const dream = {
    ...blankDream(),
    title: 'Train Ride',
    story: TRAIN_RIDE,
    isDraft: false,
    moodsDuring: ['Anxious'],
    moodAfter: 'Sad',
    clarity: 'Clear',
    events: 'Work has been taking more of the week than I agreed to.'
  }
  for (const depth of ['short', 'detailed']) {
    const text = fullInterpretation(dream, depth)
    assert.match(text, /carried|stuck/i)
    assert.match(text, /home/i)
    assert.match(text, /Putting it together/)
    assert.match(text, /reflection/)
    assert.equal(/diagnos/i.test(text), false)
    assert.equal(/\byou will\b/i.test(text), false)
  }
  const short = fullInterpretation(dream, 'short').split('\n\n')
  const detailed = fullInterpretation(dream, 'detailed').split('\n\n')
  assert.equal(short.length, 2)
  assert.equal(detailed.length, 4)
  assert.match(detailed[2], /^Putting it together/)
  assert.match(short[0], /Anxious/i)
  assert.match(detailed[0], /waking life/i)
})

test('cars in a park reads as conflict and escape', () => {
  const dream = {
    ...blankDream(),
    title: 'Cars in a Park',
    story: 'Cars in a park were crashing into each other while people argued and shouted. I escaped through the trees before another one could reach me.',
    isDraft: false,
    moodsDuring: ['Scared'],
    moodAfter: 'Anxious',
    tags: ['Nightmare']
  }
  const text = fullInterpretation(dream, 'detailed')
  assert.match(text, /conflict|clash|argu|fight/i)
  assert.match(text, /escape|way out|get away|getting away/i)
  assert.match(text, /Putting it together/)
  assert.match(text, /nightmare/i)
  assert.match(text, /scared/i)
})

const FLEAS = 'I rolled over in my bed and locked eyes with Maple\'s dog bed right beside mine, which had a linen sheet on top. As I looked at her bed, I noticed a few black specks running around; soon there were more and more, and they started to form into a pile. At that point, I gathered the linen together and tossed it out the window.'

test('fleas are insects on a bed, not eyes or running', () => {
  const text = `Fleas\n${FLEAS}`
  const ids = uniqueSymbols(findSymbols(text)).map((symbol) => symbol.id)
  assert.equal(ids.includes('eyes'), false)
  assert.equal(ids.includes('running'), false)
  assert.ok(ids.includes('insects'), ids.join(','))
  assert.ok(ids.includes('dog'), ids.join(','))
  assert.ok(ids.includes('bed'), ids.join(','))
  assert.ok(ids.includes('bedding') || ids.includes('discard'), ids.join(','))
  const dream = {
    ...blankDream(),
    title: 'Fleas',
    story: FLEAS,
    isDraft: false,
    moodsDuring: ['Confused'],
    moodAfter: 'Confused',
    details: {
      time: { choices: ['Unclear'], note: '' },
      setting: { choices: ['Indoors'], note: 'Home' },
      ending: { choices: ['Woke up'], note: '' }
    }
  }
  for (const depth of ['short', 'detailed']) {
    const reading = fullInterpretation(dream, depth)
    assert.match(reading, /pile|speck|flea|insect/i)
    assert.match(reading, /window|throw/i)
    assert.match(reading, /old dream books|folk tradition/i)
    assert.match(reading, /Putting it together/)
    assert.equal(/weather you are walking/i.test(reading), false)
    assert.equal(/one sign on the road/i.test(reading), false)
    assert.equal(/mood that found pictures/i.test(reading), false)
    assert.equal(/you set the dream at/i.test(reading), false)
    assert.equal(/the way it ended was/i.test(reading), false)
    assert.equal(/\beyes\b/i.test(reading), false)
    assert.equal(/set the dream at unclear/i.test(reading), false)
  }
  const short = fullInterpretation(dream, 'short').split('\n\n')[0]
  const words = short.split(/\s+/).filter(Boolean).length
  assert.ok(words >= 70 && words <= 140, `short is ${words} words`)
  assert.match(short, /home/i)
  assert.match(fullInterpretation(dream, 'detailed'), /loyalty|dog/i)
  const idiom = uniqueSymbols(findSymbols('I keep an eye on the clock and running late I ran into an old friend.')).map((symbol) => symbol.id)
  assert.equal(idiom.includes('eyes'), false)
  assert.equal(idiom.includes('running'), false)
  assert.ok(idiom.includes('late'))
})

test('a thin dream still gets a gentle reading from the mood', () => {
  const dream = {
    ...blankDream(),
    title: 'Quiet',
    story: 'I sat and breathed.',
    isDraft: false,
    moodsDuring: ['Peaceful'],
    moodAfter: 'Peaceful'
  }
  const text = fullInterpretation(dream, 'short')
  assert.match(text, /peaceful/i)
  assert.match(text, /Putting it together/)
  assert.match(text, /reflection/)
  assert.equal(/train/i.test(text), false)
})

const CARS = 'Cars in a park were crashing into each other while people argued and shouted. I escaped through the trees before another one could reach me.'

test('questions follow the train ride and the cars in the park', () => {
  const train = selectQuestions(`Train Ride\n${TRAIN_RIDE}`).map((question) => question.id)
  assert.ok(train.length >= 5 && train.length <= 7, train.join(','))
  assert.equal(train[0], 'time')
  assert.equal(train[1], 'setting')
  assert.ok(train.includes('heading'))
  assert.equal(train.includes('reminded'), false)
  assert.equal(train.includes('before'), false)
  const cars = selectQuestions(`Cars in a Park\n${CARS}`).map((question) => question.id)
  assert.ok(cars.length >= 5 && cars.length <= 7, cars.join(','))
  assert.ok(cars.includes('time'))
  assert.ok(cars.includes('setting'))
  assert.ok(cars.includes('heading'))
  assert.ok(cars.includes('reminded'))
  assert.ok(cars.includes('before'))
  const long = selectQuestions(`Long\n${'I walked the road and looked around. '.repeat(40)}`)
  assert.ok(long.length > 7 && long.length <= 10)
  assert.ok(long.some((question) => question.id === 'time'))
  assert.ok(long.some((question) => question.id === 'setting'))
})

test('details survive text and json export and an old entry still opens', () => {
  const dream = {
    ...blankDream(),
    id: 'train-1',
    title: 'Train Ride',
    story: TRAIN_RIDE,
    isDraft: false,
    events: 'Work ran long.',
    details: {
      time: { choices: ['Night'], note: '' },
      setting: { choices: ['Vehicle'], note: 'on a boxcar' },
      odd: { choices: ['Yes'], note: 'a train that would not let me off' },
      ignored: { choices: ['Nope'], note: 'drop me' }
    }
  }
  const text = journalToText([dream])
  assert.match(text, /Time of day: Night/)
  assert.match(text, /on a boxcar/)
  const raw = journalToJSON(defaultSettings(), [dream])
  const parsed = parseBackup(raw)
  assert.deepEqual(parsed.dreams[0].details.time, { choices: ['Night'], note: '' })
  assert.deepEqual(parsed.dreams[0].details.setting, { choices: ['Vehicle'], note: 'on a boxcar' })
  assert.equal(parsed.dreams[0].details.ignored, undefined)
  assert.equal(parsed.dreams[0].title, 'Train Ride')
  const old = parseBackup(JSON.stringify({ app: 'Dream Journal', version: 1, dreams: [{ id: 'old', title: 'Old night', story: 'I slept.' }] }))
  assert.deepEqual(old.dreams[0].details, {})
  assert.equal(old.dreams[0].title, 'Old night')
  assert.equal(old.dreams[0].isFragments, false)
  assert.equal(journalToText(old.dreams).includes('Details:'), false)
  const reading = fullInterpretation(dream, 'detailed')
  assert.match(reading, /night/i)
  assert.match(reading, /vehicle/i)
  assert.match(reading, /boxcar/i)
  assert.match(reading, /Putting it together/)
  const prompt = interpretationPrompt(dream, 'short', [])
  assert.match(prompt, /Time of day: Night/)
  assert.match(prompt, /Setting: Vehicle, on a boxcar/)
  assert.match(imagePrompt(dream), /Time of day: Night/)
  assert.deepEqual(odditySigns([dream, { ...dream, id: 'sample', isSample: true }]), ['a train that would not let me off'])
  assert.match(detailSummaryLines(dream).join('\n'), /Anything odd: Yes/)
})

test('bedtime buckets count nightmares', () => {
  const base = { ...blankDream(), isDraft: false, story: 'A dream long enough to keep.', title: 'One' }
  const dreams = [
    { ...base, id: '1', tags: ['Nightmare'], bedtime: { ...base.bedtime, stress: 5, substance: 'Caffeine' } },
    { ...base, id: '2', tags: [], bedtime: { ...base.bedtime, stress: 1, substance: 'None' } }
  ]
  const labels = bedtimeBuckets(dreams).map((bucket) => bucket.label)
  assert.ok(labels.includes('Stress 4–5'))
  assert.ok(labels.includes('Caffeine'))
})
