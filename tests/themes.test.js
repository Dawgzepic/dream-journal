import assert from 'node:assert/strict'
import test from 'node:test'
import { blankDream } from '../src/lib/dreams.js'
import { formatDay } from '../src/lib/format.js'
import { hideTheme, listThemes, mergeThemes, renameTheme, themeCardLines, themeNote, themeSpan } from '../src/lib/themes.js'

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

test('dog, dogs, and puppy are one thing', () => {
  const items = listThemes([
    dream('a', 'One', 'A dog slept by the door.'),
    dream('b', 'Two', 'The puppy followed me.'),
    dream('c', 'Three', 'Two dogs waited.')
  ], {})
  const dogs = items.filter((item) => item.id === 'dog')
  assert.equal(dogs.length, 1)
  assert.equal(dogs[0].name, 'Dog')
  assert.equal(dogs[0].group, 'things')
  assert.equal(dogs[0].count, 3)
})

test('locked eyes is not the Eyes theme', () => {
  const items = listThemes([
    dream('a', 'Look', 'I locked eyes with the puppy beside the bed.')
  ], {})
  assert.equal(items.some((item) => item.id === 'eyes'), false)
  assert.equal(items.some((item) => item.id === 'dog'), true)
  assert.equal(items.some((item) => item.id === 'bed'), true)
})

test('mom and mother merge, and a rename or hide sticks', () => {
  const dreams = [
    dream('a', 'Kitchen', 'Mom stood in the kitchen.'),
    dream('b', 'Door', 'My mother opened the door.', 3, { moodsDuring: ['Peaceful'], tags: ['Nightmare'] })
  ]
  let edits = {}
  let mothers = listThemes(dreams, edits).find((item) => item.id === 'mother')
  assert.equal(mothers.count, 2)
  edits = renameTheme(edits, 'mother', 'Mama')
  mothers = listThemes(dreams, edits).find((item) => item.id === 'mother')
  assert.equal(mothers.name, 'Mama')
  assert.match(themeNote(mothers), /kitchen/i)
  assert.match(themeNote(mothers), /door/i)
  assert.doesNotMatch(themeNote(mothers), /comes back|Peaceful|Nightmare|Seen in/)
  edits = mergeThemes(edits, 'door', 'mother')
  const merged = listThemes([
    ...dreams,
    dream('c', 'Hall', 'A door shut.')
  ], edits)
  assert.equal(merged.some((item) => item.id === 'door'), false)
  assert.ok(merged.find((item) => item.id === 'mother').count >= 3)
  edits = hideTheme(edits, 'mother', true)
  assert.equal(listThemes(dreams, edits).some((item) => item.id === 'mother'), false)
})

test('details answers count as people and places', () => {
  const items = listThemes([
    dream('a', 'Quiet', 'I stood still.', 2, {
      details: {
        people: { choices: ['Family'], note: 'Aunt May' },
        setting: { choices: ['Indoors'], note: 'Home' }
      }
    })
  ], {})
  assert.equal(items.some((item) => item.id === 'person:Aunt May'), true)
  assert.equal(items.find((item) => item.id === 'person:Aunt May').group, 'people')
  assert.equal(items.some((item) => item.id === 'house'), true)
})

test('the intro describes the scenes and does not repeat the card', () => {
  const dreams = [
    dream('a', 'Fleas', 'I rolled over in my bed and noticed specks on the dog bed, then threw the sheet out the window.', 10, { moodsDuring: ['Confused'] }),
    dream('b', 'Puppy', 'The puppy waited by the door again.', 10, { tags: ['Nightmare'] })
  ]
  const item = listThemes(dreams, {}).find((row) => row.id === 'dog')
  const note = themeNote(item)
  const card = themeCardLines(item).join(' ')
  assert.match(note, /specks on the dog bed/i)
  assert.match(note, /threw the sheet out the window/i)
  assert.match(note, /puppy waited by the door/i)
  assert.equal(themeSpan(item), `Both on ${formatDay(item.first)}.`)
  const folded = note.toLowerCase()
  for (const line of themeCardLines(item)) {
    const piece = line.toLowerCase().replace(/\.$/, '')
    assert.equal(folded.includes(piece), false, line)
  }
  assert.doesNotMatch(note, /comes back|first seen|last seen|runs from|seen in|this month|nightmare|no mood|confused/i)
  const sentences = note.split(/(?<=[.!?])\s+/).filter(Boolean)
  assert.ok(sentences.length >= 1 && sentences.length <= 3)
  assert.match(card, /Seen in 2 dreams/)
  assert.match(card, /Both on/)
  assert.match(card, /Nightmare/)
  assert.match(card, /Confused/)

  const one = listThemes([
    dream('c', 'Look', 'I locked eyes with the puppy beside the bed.', 4)
  ], {}).find((row) => row.id === 'dog')
  const short = themeNote(one)
  assert.match(short, /puppy beside the bed/i)
  assert.equal(short.split(/(?<=[.!?])\s+/).filter(Boolean).length, 1)
  assert.equal(themeSpan(one), `On ${formatDay(one.first)}.`)
  assert.doesNotMatch(short, /Seen in|comes back|Nightmare/)
})
