import { saveDream } from '../db.js'
import { cleanDetails, chipSlug, selectQuestions } from '../lib/details.js'
import { displayTitle } from '../lib/dreams.js'
import { go } from '../runtime.js'
import { state, upsertDream } from '../state.js'
import { esc, toast } from '../ui.js'

export function mountDetails(root, route) {
  const dream = state.dreams.find((item) => item.id === route.id)
  if (!dream) {
    root.innerHTML = `<div class="page"><h1>That dream is not here</h1><p><a class="text-link" href="#/journal">Back to the journal</a></p></div>`
    return () => {}
  }
  const working = structuredClone(dream)
  if (!working.details || typeof working.details !== 'object') working.details = {}
  const questions = selectQuestions(`${working.title || ''}\n${working.story || ''}`)
  let dirty = false
  let queue = Promise.resolve()

  root.innerHTML = `<div class="page">
    <a class="back" href="#/dream/${esc(dream.id)}">Back to the dream</a>
    <h1>Dream details</h1>
    <p class="lede">Optional questions for <em>${esc(displayTitle(dream))}</em>. Answer any of them, or none. They stay on this device.</p>
    <form data-testid="details-form">
      ${questions.map((question) => questionBlock(question, working.details[question.id])).join('')}
      <div class="savebar">
        <button type="submit" class="btn primary" data-testid="save-details">Save details</button>
        <button type="button" class="btn secondary" data-testid="skip-details">Skip all</button>
        <p class="save-status" data-testid="detail-status" aria-live="polite">Answers save automatically.</p>
      </div>
    </form>
  </div>`

  function setStatus(text) {
    const el = root.querySelector('[data-testid="detail-status"]')
    if (el) el.textContent = text
  }
  function schedule() {
    dirty = true
    clearTimeout(schedule.timer)
    schedule.timer = setTimeout(() => flush(), 400)
  }
  function flush() {
    if (!dirty) return queue
    dirty = false
    clearTimeout(schedule.timer)
    working.details = cleanDetails(working.details)
    working.updatedAt = new Date().toISOString()
    const snapshot = structuredClone(working)
    upsertDream(snapshot)
    queue = queue.then(async () => {
      await saveDream(snapshot)
      setStatus('Saved')
    }).catch(() => setStatus('Could not save on this device.'))
    return queue
  }

  root.querySelector('form').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-detail-choice]')
    if (chip) {
      const id = chip.dataset.detailId
      const choice = chip.dataset.detailChoice
      const question = questions.find((item) => item.id === id)
      const current = working.details[id] || { choices: [], note: '' }
      let choices = [...(current.choices || [])]
      if (question?.multi) {
        choices = choices.includes(choice) ? choices.filter((item) => item !== choice) : [...choices, choice]
      } else {
        choices = choices.length === 1 && choices[0] === choice ? [] : [choice]
      }
      working.details[id] = { choices, note: current.note || '' }
      paint()
      schedule()
      return
    }
    const skip = event.target.closest('[data-detail-skip]')
    if (!skip) return
    const id = skip.dataset.detailSkip
    working.details[id] = { choices: [], note: '' }
    const input = root.querySelector(`[data-testid="detail-note-${id}"]`)
    if (input) input.value = ''
    paint()
    schedule()
  })
  root.querySelector('form').addEventListener('input', (event) => {
    const input = event.target.closest('[data-detail-note]')
    if (!input) return
    const id = input.dataset.detailNote
    const current = working.details[id] || { choices: [], note: '' }
    working.details[id] = { choices: current.choices || [], note: input.value }
    schedule()
  })
  root.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault()
    dirty = true
    await flush()
    toast('Details saved')
    go(`#/dream/${dream.id}`)
  })
  root.querySelector('[data-testid="skip-details"]').addEventListener('click', async () => {
    dirty = true
    await flush()
    go(`#/dream/${dream.id}`)
  })

  function paint() {
    for (const question of questions) {
      const chosen = new Set(working.details[question.id]?.choices || [])
      for (const button of root.querySelectorAll(`[data-detail-id="${question.id}"]`)) {
        button.setAttribute('aria-pressed', String(chosen.has(button.dataset.detailChoice)))
      }
    }
  }

  return () => {
    clearTimeout(schedule.timer)
    flush()
  }
}

function questionBlock(question, saved) {
  const choices = new Set(saved?.choices || [])
  const chips = question.chips.map((label) => {
    const pressed = choices.has(label)
    return `<button type="button" class="chip" aria-pressed="${pressed ? 'true' : 'false'}" data-testid="detail-chip-${question.id}-${chipSlug(label)}" data-detail-id="${esc(question.id)}" data-detail-choice="${esc(label)}">${esc(label)}</button>`
  }).join('')
  const note = question.note
    ? `<label class="field"><span>${esc(question.note)}</span><input type="text" maxlength="300" data-testid="detail-note-${esc(question.id)}" data-detail-note="${esc(question.id)}" value="${esc(saved?.note || '')}" autocomplete="off" /></label>`
    : ''
  return `<section class="card detail-q" data-testid="detail-${esc(question.id)}">
    <h2>${esc(question.prompt)}</h2>
    <div class="chips">${chips}</div>
    ${note}
    <button type="button" class="text-link" data-testid="detail-skip-${esc(question.id)}" data-detail-skip="${esc(question.id)}">Skip</button>
  </section>`
}
