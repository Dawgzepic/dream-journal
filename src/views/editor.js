import { deleteDream, saveDream, saveSettings } from '../db.js'
import { CLARITY, CORE_TAGS, MOODS, SCREENS, SUBSTANCES } from '../lib/constants.js'
import { blankDream, isBlank, titleFrom } from '../lib/dreams.js'
import { cleanLabel, fromLocalInput, toLocalInput } from '../lib/format.js'
import { PROMPTS } from '../lib/writing-prompts.js'
import { go } from '../runtime.js'
import { removeDream, state, suspendLock, upsertDream } from '../state.js'
import { esc, toast } from '../ui.js'
import { askVoiceDisclosure, composeDictation, speechSupported, startDictation, voiceErrorText } from '../voice.js'

function chip(label, pressed, testid, extra = '') {
  return `<button type="button" class="chip" aria-pressed="${pressed ? 'true' : 'false'}" data-testid="${esc(testid)}" ${extra}>${esc(label)}</button>`
}

export function mountEditor(root, route) {
  const existing = route.id ? state.dreams.find((dream) => dream.id === route.id) : null
  if (route.id && !existing) {
    root.innerHTML = `<div class="page"><h1>That draft is not here</h1><p><a href="#/journal">Back to the journal</a></p></div>`
    return () => {}
  }
  const working = existing ? structuredClone(existing) : blankDream()
  working.isFragments = working.isFragments === true
  let wasPublished = Boolean(existing && !existing.isDraft)
  let mode = !existing || wasPublished || hasDetails(existing) ? 'full' : 'quick'
  let dirty = false
  let promptIndex = 0
  let stopVoice = null
  let queue = Promise.resolve()
  const status = { text: existing ? 'Edits save automatically.' : 'Autosave is on.' }

  root.innerHTML = `<div class="page">
    <a class="back" href="${existing ? `#/dream/${esc(existing.id)}` : '#/home'}">Back</a>
    <h1>${existing ? 'Edit dream' : 'New dream'}</h1>
    <p class="lede">You can log more than one dream from the same night.</p>
    <button type="button" class="chip fragments-toggle" data-testid="fragments-toggle" aria-pressed="false">Fragments — jumbled night</button>
    <div class="len-toggle" data-modes ${wasPublished ? 'hidden' : ''}>
      <button type="button" data-mode="quick" data-testid="mode-quick">Quick jot</button>
      <button type="button" data-mode="full" data-testid="mode-full">Full entry</button>
    </div>
    <form data-testid="dream-form" novalidate>
      <p class="hint" data-quick>A few words. This stays a draft until you finish it.</p>
      <label class="field"><span>Date and time</span><input type="datetime-local" data-testid="dream-when" required /></label>
      <label class="field" data-full><span>Title</span><input type="text" data-testid="dream-title" maxlength="200" autocomplete="off" placeholder="Optional" /></label>
      <div class="field">
        <span>The dream</span>
        <textarea data-testid="dream-story" rows="8" placeholder="Write it in the present, as if you are still there."></textarea>
        <div class="row wrap">
          <button type="button" class="btn secondary" data-testid="prompt-button">Writing prompt</button>
          <span data-voice></span>
        </div>
        <p class="prompt-line" data-testid="prompt-text" hidden></p>
        <button type="button" class="text-link" data-testid="prompt-insert" hidden>Put this in the draft</button>
        <p class="voice-live" data-testid="voice-live" aria-live="polite"></p>
      </div>
      <fieldset data-full>
        <legend>Mood during the dream</legend>
        <div class="chips" data-during></div>
        <div class="add-row">
          <input type="text" data-testid="custom-mood" maxlength="24" placeholder="Add a mood" autocomplete="off" />
          <button type="button" data-add-mood>Add</button>
        </div>
      </fieldset>
      <fieldset data-full>
        <legend>Mood after waking</legend>
        <div class="chips" data-after></div>
      </fieldset>
      <fieldset data-full>
        <legend>Memory clarity</legend>
        <div class="chips" data-clarity></div>
      </fieldset>
      <label class="field" data-full><span>Real-life events that might be linked</span><textarea data-testid="events" rows="3" placeholder="Optional"></textarea></label>
      <fieldset data-full>
        <legend>Labels</legend>
        <div class="chips" data-tags></div>
        <div class="add-row">
          <input type="text" data-testid="custom-tag" maxlength="24" placeholder="Add a label" autocomplete="off" />
          <button type="button" data-add-tag>Add</button>
        </div>
      </fieldset>
      <fieldset data-full>
        <legend>Before bed, optional</legend>
        <label class="field"><span>Food or snacks</span><input type="text" data-testid="food" maxlength="200" placeholder="Optional" /></label>
        <p class="hint">Caffeine or alcohol</p>
        <div class="chips" data-substance></div>
        <p class="hint">Stress level, 1 to 5</p>
        <div class="chips" data-stress></div>
        <p class="hint">Screen time</p>
        <div class="chips" data-screen></div>
      </fieldset>
      <p class="form-error" data-testid="form-error" hidden></p>
      <div class="savebar">
        <button type="submit" class="btn primary" data-testid="save-dream">Save dream</button>
        <button type="button" class="btn primary" data-testid="save-jot">Save jot</button>
        ${existing ? `<button type="button" class="btn secondary" data-testid="open-details">Add details</button>` : ''}
        <p class="save-status" data-testid="save-status" aria-live="polite"></p>
      </div>
    </form>
  </div>`

  const story = root.querySelector('[data-testid="dream-story"]')
  const title = root.querySelector('[data-testid="dream-title"]')
  const when = root.querySelector('[data-testid="dream-when"]')
  const events = root.querySelector('[data-testid="events"]')
  const food = root.querySelector('[data-testid="food"]')
  const error = root.querySelector('[data-testid="form-error"]')
  const saveDreamBtn = root.querySelector('[data-testid="save-dream"]')
  const saveJotBtn = root.querySelector('[data-testid="save-jot"]')
  story.value = working.story
  title.value = working.title
  when.value = toLocalInput(working.datetime)
  events.value = working.events
  food.value = working.bedtime.food || ''
  setStatus(status.text)

  function setStatus(text) {
    const el = root.querySelector('[data-testid="save-status"]')
    if (el) el.textContent = text
  }
  function setError(text) {
    error.hidden = !text
    error.textContent = text || ''
  }
  function paintChips() {
    const moods = [...MOODS, ...(state.settings.customMoods || [])]
    root.querySelector('[data-during]').innerHTML = moods.map((mood) => chip(mood, working.moodsDuring.includes(mood), `during-${mood}`, `data-during-mood="${esc(mood)}"`)).join('')
    root.querySelector('[data-after]').innerHTML = moods.map((mood) => chip(mood, working.moodAfter === mood, `after-${mood}`, `data-after-mood="${esc(mood)}"`)).join('')
    root.querySelector('[data-clarity]').innerHTML = CLARITY.map((item) => chip(item, working.clarity === item, `clarity-${item}`, `data-clarity="${esc(item)}"`)).join('')
    const tags = [...CORE_TAGS, ...(state.settings.customTags || [])]
    root.querySelector('[data-tags]').innerHTML = tags.map((tag) => chip(tag, (working.tags || []).includes(tag), `tag-${tag}`, `data-tag="${esc(tag)}"`)).join('')
    root.querySelector('[data-substance]').innerHTML = SUBSTANCES.map((item) => chip(item.label, working.bedtime.substance === item.id, `substance-${item.id}`, `data-substance="${item.id}"`)).join('')
    root.querySelector('[data-stress]').innerHTML = [1, 2, 3, 4, 5].map((n) => chip(String(n), working.bedtime.stress === n, `stress-${n}`, `data-stress="${n}"`)).join('')
    root.querySelector('[data-screen]').innerHTML = SCREENS.map((item) => chip(item.label, working.bedtime.screen === item.id, `screen-${item.id}`, `data-screen="${item.id}"`)).join('')
  }
  function storyOptional() {
    return working.isFragments === true
  }
  function applyMode() {
    const quick = mode === 'quick' && !storyOptional()
    for (const el of root.querySelectorAll('[data-full]')) el.hidden = quick
    for (const el of root.querySelectorAll('[data-quick]')) el.hidden = !quick
    root.querySelector('[data-mode="quick"]')?.setAttribute('aria-pressed', String(quick))
    root.querySelector('[data-mode="full"]')?.setAttribute('aria-pressed', String(!quick))
    root.querySelector('[data-testid="fragments-toggle"]')?.setAttribute('aria-pressed', String(storyOptional()))
    saveJotBtn.hidden = !quick
    saveDreamBtn.hidden = quick
    const detailsButton = root.querySelector('[data-testid="open-details"]')
    if (detailsButton) detailsButton.hidden = storyOptional()
    story.placeholder = storyOptional()
      ? 'Optional: anything you caught'
      : quick
        ? 'A few words. The stairs, the color, the feeling.'
        : 'Write it in the present, as if you are still there.'
    saveDreamBtn.disabled = !storyOptional() && !working.story.trim()
  }
  function schedule() {
    dirty = true
    setError('')
    saveDreamBtn.disabled = !storyOptional() && !working.story.trim()
    clearTimeout(schedule.timer)
    schedule.timer = setTimeout(() => flush(), 400)
  }
  function flush() {
    if (!dirty) return queue
    dirty = false
    clearTimeout(schedule.timer)
    const snapshot = structuredClone(working)
    snapshot.updatedAt = new Date().toISOString()
    snapshot.isDraft = !wasPublished
    if (isBlank(snapshot) && !wasPublished && !snapshot.isSample) {
      removeDream(snapshot.id)
      queue = queue.then(async () => {
        await deleteDream(snapshot.id)
        setStatus('')
      }).catch(() => setStatus('Could not save on this device.'))
      return queue
    }
    upsertDream(snapshot)
    queue = queue.then(async () => {
      await saveDream(snapshot)
      setStatus(snapshot.isDraft ? 'Draft saved' : 'Saved')
    }).catch(() => setStatus('Could not save on this device.'))
    return queue
  }

  paintChips()
  applyMode()
  if (speechSupported() && state.settings.voiceOptIn !== false) {
    root.querySelector('[data-voice]').innerHTML = '<button type="button" class="btn secondary" data-testid="voice-button">Voice</button>'
  }

  root.querySelector('[data-testid="fragments-toggle"]').addEventListener('click', () => {
    working.isFragments = !working.isFragments
    if (working.isFragments) mode = 'full'
    applyMode()
    schedule()
  })
  root.querySelector('[data-modes]')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]')
    if (!button) return
    mode = button.dataset.mode
    applyMode()
  })
  story.addEventListener('input', () => { working.story = story.value; schedule() })
  title.addEventListener('input', () => { working.title = title.value; schedule() })
  when.addEventListener('change', () => { working.datetime = fromLocalInput(when.value); schedule() })
  events.addEventListener('input', () => { working.events = events.value; schedule() })
  food.addEventListener('input', () => { working.bedtime.food = food.value; schedule() })

  async function onClick(event) {
    const during = event.target.closest('[data-during-mood]')
    if (during) {
      const mood = during.dataset.duringMood
      const index = working.moodsDuring.indexOf(mood)
      if (index >= 0) working.moodsDuring.splice(index, 1)
      else working.moodsDuring.push(mood)
      paintChips()
      schedule()
      return
    }
    const after = event.target.closest('[data-after-mood]')
    if (after) {
      working.moodAfter = working.moodAfter === after.dataset.afterMood ? '' : after.dataset.afterMood
      paintChips()
      schedule()
      return
    }
    const clarity = event.target.closest('[data-clarity]')
    if (clarity) {
      working.clarity = working.clarity === clarity.dataset.clarity ? '' : clarity.dataset.clarity
      paintChips()
      schedule()
      return
    }
    const tag = event.target.closest('[data-tag]')
    if (tag) {
      const name = tag.dataset.tag
      const index = working.tags.indexOf(name)
      if (index >= 0) working.tags.splice(index, 1)
      else working.tags.push(name)
      paintChips()
      schedule()
      return
    }
    const substance = event.target.closest('[data-substance]')
    if (substance) {
      const id = substance.dataset.substance
      working.bedtime.substance = working.bedtime.substance === id ? '' : id
      paintChips()
      schedule()
      return
    }
    const stress = event.target.closest('[data-stress]')
    if (stress) {
      const level = Number(stress.dataset.stress)
      working.bedtime.stress = working.bedtime.stress === level ? null : level
      paintChips()
      schedule()
      return
    }
    const screen = event.target.closest('[data-screen]')
    if (screen) {
      const id = screen.dataset.screen
      working.bedtime.screen = working.bedtime.screen === id ? '' : id
      paintChips()
      schedule()
    }
  }
  root.addEventListener('click', onClick)

  root.querySelector('[data-add-mood]').addEventListener('click', async () => {
    const input = root.querySelector('[data-testid="custom-mood"]')
    const label = cleanLabel(input.value)
    input.value = ''
    if (!label) return
    if (![...MOODS, ...(state.settings.customMoods || [])].some((mood) => mood.toLowerCase() === label.toLowerCase())) {
      state.settings.customMoods = [...state.settings.customMoods, label]
      await saveSettings(state.settings)
    }
    if (!working.moodsDuring.includes(label)) working.moodsDuring.push(label)
    paintChips()
    schedule()
  })
  root.querySelector('[data-add-tag]').addEventListener('click', async () => {
    const input = root.querySelector('[data-testid="custom-tag"]')
    const label = cleanLabel(input.value)
    input.value = ''
    if (!label) return
    if (![...CORE_TAGS, ...(state.settings.customTags || [])].some((tag) => tag.toLowerCase() === label.toLowerCase())) {
      state.settings.customTags = [...state.settings.customTags, label]
      await saveSettings(state.settings)
    }
    if (!working.tags.includes(label)) working.tags.push(label)
    paintChips()
    schedule()
  })

  const promptText = root.querySelector('[data-testid="prompt-text"]')
  const promptInsert = root.querySelector('[data-testid="prompt-insert"]')
  root.querySelector('[data-testid="prompt-button"]').addEventListener('click', () => {
    promptText.hidden = false
    promptInsert.hidden = false
    promptText.textContent = PROMPTS[promptIndex % PROMPTS.length]
    promptIndex += 1
  })
  promptInsert.addEventListener('click', () => {
    const line = promptText.textContent || ''
    working.story = working.story ? `${working.story.trim()}\n\n${line}` : line
    story.value = working.story
    schedule()
  })

  const voiceBtn = root.querySelector('[data-testid="voice-button"]')
  const voiceLive = root.querySelector('[data-testid="voice-live"]')
  let voiceAnchor = null
  let lastVoiceText = ''

  function resetVoiceButton() {
    stopVoice = null
    voiceAnchor = null
    lastVoiceText = ''
    if (!voiceBtn?.isConnected) return
    voiceBtn.textContent = 'Voice'
    voiceBtn.setAttribute('aria-pressed', 'false')
  }

  function applyVoice(finalText, interim) {
    if (!voiceAnchor) return
    const composed = composeDictation({ before: voiceAnchor.before, after: voiceAnchor.after, finalText })
    if (story.value !== composed.text) {
      story.value = composed.text
      story.focus({ preventScroll: true })
      story.setSelectionRange(composed.cursor, composed.cursor)
    }
    working.story = composed.text
    if (voiceLive) voiceLive.textContent = interim || ''
    if (composed.text !== lastVoiceText) {
      lastVoiceText = composed.text
      schedule()
    }
  }

  voiceBtn?.addEventListener('click', async () => {
    if (stopVoice) {
      const stop = stopVoice
      resetVoiceButton()
      if (voiceLive) voiceLive.textContent = ''
      stop()
      return
    }
    if (state.settings.voiceOptIn !== true) {
      suspendLock(120000)
      const choice = await askVoiceDisclosure()
      state.settings.voiceOptIn = choice === 'accept'
      await saveSettings(state.settings)
      if (choice !== 'accept') {
        voiceBtn.remove()
        return
      }
    }
    suspendLock(120000)
    const start = story.selectionStart ?? story.value.length
    const end = story.selectionEnd ?? start
    voiceAnchor = { before: story.value.slice(0, start), after: story.value.slice(end) }
    lastVoiceText = story.value
    voiceBtn.textContent = 'Stop voice'
    voiceBtn.setAttribute('aria-pressed', 'true')
    if (voiceLive) voiceLive.textContent = ''
    try {
      stopVoice = startDictation({
        onUpdate({ finalText, interim }) {
          applyVoice(finalText, interim)
        },
        onSegment(spoken) {
          if (!voiceAnchor) return
          voiceAnchor.before = composeDictation({ before: voiceAnchor.before, after: '', finalText: spoken }).text
          applyVoice('', '')
        },
        onError(code) {
          const message = voiceErrorText(code)
          if (voiceLive) voiceLive.textContent = message
          const stop = stopVoice
          resetVoiceButton()
          stop?.()
        },
        onEnd() {
          if (!stopVoice) return
          resetVoiceButton()
          if (voiceLive && !voiceLive.textContent) voiceLive.textContent = ''
        }
      })
    } catch {
      resetVoiceButton()
      if (voiceLive) voiceLive.textContent = 'Voice entry is not available in this browser.'
    }
  })

  root.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault()
    if (mode === 'quick') {
      await saveJot()
      return
    }
    await publish()
  })
  saveJotBtn.addEventListener('click', () => saveJot())
  root.querySelector('[data-testid="open-details"]')?.addEventListener('click', async () => {
    if (working.isFragments) return
    if (!working.story.trim()) {
      setError('Write a few words first.')
      story.focus()
      return
    }
    if (!working.title.trim()) working.title = titleFrom(working.story)
    title.value = working.title
    working.datetime = fromLocalInput(when.value)
    dirty = true
    await flush()
    go(`#/dream/${working.id}/details`)
  })

  async function publish() {
    if (!working.isFragments && !working.story.trim()) {
      setError('Write a few words first, or use quick jot.')
      story.focus()
      return
    }
    if (!working.title.trim() && !working.isFragments) working.title = titleFrom(working.story)
    title.value = working.title
    working.datetime = fromLocalInput(when.value)
    const firstPublish = !wasPublished
    wasPublished = true
    working.isDraft = false
    dirty = true
    await flush()
    toast('Dream saved')
    go(firstPublish && !working.isFragments ? `#/dream/${working.id}/details` : `#/dream/${working.id}`)
  }
  async function saveJot() {
    if (working.story.trim().length < 3) {
      setError('A few words are enough, but this is still blank.')
      story.focus()
      return
    }
    working.datetime = fromLocalInput(when.value)
    wasPublished = false
    working.isDraft = true
    dirty = true
    await flush()
    toast('Saved to finish later')
    go('#/journal')
  }

  return () => {
    root.removeEventListener('click', onClick)
    clearTimeout(schedule.timer)
    if (stopVoice) stopVoice()
    flush()
  }
}

function hasDetails(dream) {
  if (!dream) return false
  const bed = dream.bedtime || {}
  return Boolean(dream.title || dream.moodsDuring?.length || dream.moodAfter || dream.clarity || dream.events || dream.tags?.length || bed.food || bed.substance || bed.stress || bed.screen)
}
