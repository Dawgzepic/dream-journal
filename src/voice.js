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

export function startDictation({ onFinal, onInterim, onError, onEnd }) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition
  const rec = new Rec()
  rec.lang = 'en-US'
  rec.interimResults = true
  rec.continuous = true
  rec.onresult = (event) => {
    let finalText = ''
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const bit = event.results[i][0].transcript
      if (event.results[i].isFinal) finalText += bit
      else interim += bit
    }
    if (finalText) onFinal(finalText)
    onInterim(interim)
  }
  rec.onerror = (event) => onError(event.error || 'error')
  rec.onend = () => onEnd()
  rec.start()
  return () => {
    try { rec.onend = null; rec.stop() } catch { /* already stopped */ }
  }
}

export function voiceErrorText(code) {
  if (code === 'not-allowed') return 'Microphone permission was blocked.'
  if (code === 'network') return 'The browser could not transcribe just now. You can keep typing.'
  return 'Voice entry stopped. You can keep typing.'
}
