import assert from 'node:assert/strict'
import test from 'node:test'
import { blankDream } from '../src/lib/dreams.js'
import { hideTheme, listThemes, mergeThemes, renameTheme, themeNote } from '../src/lib/themes.js'

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
  assert.match(themeNote(mothers), /Mama comes back in 2 dreams/)
  assert.match(themeNote(mothers), /Peaceful/)
  assert.match(themeNote(mothers), /Nightmare/)
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
