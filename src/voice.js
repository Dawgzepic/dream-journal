export function speechSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function askVoiceDisclosure() {
  return new Promise((resolve) => {
    const wrap = document.createElement('div')
    wrap.className = 'modal'
    wrap.dataset.testid = 'voice-disclosure'
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="voice-title">
      <h2 id="voice-title">Voice entry leaves this device</h2>
      <p>Dream Journal does not send your journal anywhere. Voice is different. Chrome on Android may send the audio to Google for transcription. The words that come back are then stored only on this device.</p>
      <p>You can skip this and keep typing. You can change your mind later in Settings.</p>
      <div class="row">
        <button type="button" class="btn secondary" data-testid="voice-skip">Skip</button>
        <button type="button" class="btn primary" data-testid="voice-accept">Use voice anyway</button>
      </div>
    </div>`
    const done = (value) => {
      document.removeEventListener('keydown', onKey)
      wrap.remove()
      resolve(value)
    }
    function onKey(event) {
      if (event.key === 'Escape') done('skip')
    }
    document.addEventListener('keydown', onKey)
    wrap.querySelector('[data-testid="voice-skip"]').addEventListener('click', () => done('skip'))
    wrap.querySelector('[data-testid="voice-accept"]').addEventListener('click', () => done('accept'))
    document.body.appendChild(wrap)
    wrap.querySelector('[data-testid="voice-skip"]').focus()
  })
}

export function speechText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function prefersSegmentedDictation(userAgent = '') {
  const ua = userAgent || (typeof navigator === 'undefined' ? '' : navigator.userAgent)
  return /Android/i.test(ua)
}

export function mergeCumulative(previous, next) {
  const prev = speechText(previous)
  const curr = speechText(next)
  if (!prev) return curr
  if (!curr) return prev
  const prevFold = prev.toLowerCase()
  const currFold = curr.toLowerCase()
  if (currFold.startsWith(prevFold)) return curr
  if (prevFold.startsWith(currFold)) return prev
  const overlap = overlapLength(prevFold, currFold)
  if (overlap > 0) return `${prev}${curr.slice(overlap)}`
  return `${prev} ${curr}`
}

function overlapLength(prev, curr) {
  const max = Math.min(prev.length, curr.length)
  for (let size = max; size >= 4; size--) {
    if (prev.slice(-size) === curr.slice(0, size)) return size
  }
  return 0
}

function stripCovered(interim, finalText) {
  const spoken = speechText(interim)
  const committed = speechText(finalText)
  if (!spoken || !committed) return spoken
  const spokenFold = spoken.toLowerCase()
  const committedFold = committed.toLowerCase()
  if (spokenFold.startsWith(committedFold)) return spoken.slice(committed.length).trim()
  return spoken
}

export function mergeResultList(results) {
  let finalText = ''
  let interim = ''
  const length = results?.length || 0
  for (let i = 0; i < length; i++) {
    const result = results[i]
    const transcript = result?.[0]?.transcript ?? result?.transcript ?? ''
    if (result?.isFinal) finalText = mergeCumulative(finalText, transcript)
    else interim = mergeCumulative(interim, transcript)
  }
  return { finalText, interim: stripCovered(interim, finalText) }
}

export function joinDictation(before, spoken) {
  const speech = speechText(spoken)
  if (!speech) return before || ''
  if (!before) return speech
  if (/\s$/.test(before)) return `${before}${speech}`
  return `${before} ${speech}`
}

export function composeDictation({ before = '', after = '', finalText = '' }) {
  const head = joinDictation(before, finalText)
  return { text: `${head}${after || ''}`, cursor: head.length }
}

const FATAL_SPEECH = new Set(['not-allowed', 'service-not-allowed', 'network', 'audio-capture'])

export function fatalSpeechError(code) {
  return FATAL_SPEECH.has(code)
}

export function voiceErrorText(code) {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Microphone permission was blocked.'
  if (code === 'audio-capture') return 'No microphone was available.'
  if (code === 'network') return 'The browser could not transcribe just now. You can keep typing.'
  if (code === 'no-speech') return ''
  return 'Voice entry stopped. You can keep typing.'
}

export function startDictation({ onUpdate, onSegment, onError, onEnd, userAgent } = {}) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Rec) throw new Error('Speech recognition is not available')
  const segmented = prefersSegmentedDictation(userAgent)
  let stopped = false
  let rec = null
  let restartTimer = 0
  let segmentFinal = ''
  let segmentInterim = ''

  const boot = () => {
    if (stopped) return
    rec = new Rec()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = !segmented
    rec.maxAlternatives = 1
    rec.onresult = (event) => {
      const merged = mergeResultList(event.results)
      segmentFinal = merged.finalText
      segmentInterim = merged.interim
      onUpdate?.(merged)
    }
    rec.onerror = (event) => {
      const code = event?.error || 'error'
      if (!fatalSpeechError(code)) return
      stopped = true
      onError?.(code)
    }
    rec.onend = () => {
      if (rec) rec.onresult = null
      const spoken = mergeCumulative(segmentFinal, segmentInterim)
      segmentFinal = ''
      segmentInterim = ''
      if (spoken) onSegment?.(spoken)
      onUpdate?.({ finalText: '', interim: '' })
      if (stopped) {
        onEnd?.()
        return
      }
      restartTimer = setTimeout(() => {
        if (stopped) return
        try { boot() } catch { stopped = true; onError?.('audio-capture'); onEnd?.() }
      }, segmented ? 250 : 80)
    }
    try {
      rec.start()
    } catch {
      stopped = true
      onError?.('audio-capture')
      onEnd?.()
    }
  }

  boot()
  return () => {
    stopped = true
    clearTimeout(restartTimer)
    const current = rec
    rec = null
    if (!current) return
    current.onresult = null
    current.onerror = null
    current.onend = null
    try { current.stop() } catch { /* already stopped */ }
  }
}
