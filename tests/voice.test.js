import assert from 'node:assert/strict'
import test from 'node:test'
import { composeDictation, mergeCumulative, mergeResultList, prefersSegmentedDictation } from '../src/voice.js'

function result(transcript, isFinal) {
  return { isFinal, 0: { transcript } }
}

test('android cumulative finals replace instead of stuttering', () => {
  const steps = [
    [result('I', false)],
    [result('I was', false)],
    [result('I was in', false)],
    [result('I was in', true)],
    [result('I was in', true), result('I was in a', true)],
    [result('I was in a', true), result('I was in a house', true)],
    [result('I was in a house', true), result('I was in a house by', false)]
  ]
  const seen = steps.map((list) => mergeResultList(list))
  assert.deepEqual(seen.map((item) => item.finalText), [
    '',
    '',
    '',
    'I was in',
    'I was in a',
    'I was in a house',
    'I was in a house'
  ])
  assert.deepEqual(seen.map((item) => item.interim), [
    'I',
    'I was',
    'I was in',
    '',
    '',
    '',
    'by'
  ])
  const naive = []
  let acc = ''
  for (const list of steps) {
    for (const item of list) {
      if (item.isFinal) acc += item[0].transcript
    }
    naive.push(acc)
  }
  assert.match(naive.at(-1), /I was inI was in/)
  assert.equal(seen.at(-1).finalText, 'I was in a house')
})

test('a later final that only adds words replaces the earlier final', () => {
  assert.equal(mergeCumulative('I was', 'I was in'), 'I was in')
  assert.equal(mergeCumulative('I was in', 'I was'), 'I was in')
  assert.equal(mergeCumulative('I was in a house', 'house by the sea'), 'I was in a house by the sea')
  assert.equal(mergeCumulative('hello', 'there'), 'hello there')
  assert.equal(mergeCumulative('I was in', 'I was in'), 'I was in')
})

test('interim preview is not part of the committed dictation', () => {
  const merged = mergeResultList([
    result('I was in a house', true),
    result('I was in a house by the', false)
  ])
  const typed = composeDictation({ before: 'Once ', after: ' end', finalText: merged.finalText })
  assert.equal(typed.text, 'Once I was in a house end')
  assert.equal(typed.cursor, 'Once I was in a house'.length)
  assert.equal(merged.interim, 'by the')
  assert.equal(typed.text.includes(merged.interim), false)
})

test('a restarted session appends after the previous final without repeating it', () => {
  let before = 'Once'
  const after = ' end'
  const session = (lists) => {
    let shown = ''
    for (const list of lists) {
      const merged = mergeResultList(list)
      shown = composeDictation({ before, after, finalText: merged.finalText }).text
    }
    const spoken = mergeResultList(lists.at(-1)).finalText
    before = composeDictation({ before, after: '', finalText: spoken }).text
    return shown
  }
  session([
    [result('I was', false)],
    [result('I was in a house', true)],
    [result('I was in a house', true), result('I was in a house', true)]
  ])
  const next = session([
    [result('by the sea', false)],
    [result('by the sea', true)]
  ])
  assert.equal(next, 'Once I was in a house by the sea end')
  assert.equal(before, 'Once I was in a house by the sea')
})

test('android uses short recognition sessions', () => {
  assert.equal(prefersSegmentedDictation('Mozilla/5.0 (Linux; Android 14; Pixel) Chrome/120.0 Mobile'), true)
  assert.equal(prefersSegmentedDictation('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0'), false)
})
