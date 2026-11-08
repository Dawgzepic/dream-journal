import { saveSettings } from '../db.js'
import { bufToHex, hashPin, randomSalt, verifyPin } from '../lib/pin.js'
import { state, suspendLock } from '../state.js'
import { runtime } from '../runtime.js'
import { startReminders } from '../reminders.js'
import { fingerprintAvailable, unlockWithFingerprint } from '../webauthn.js'
import { moonMark } from '../ui.js'
import { mountPinPad } from './pinpad.js'

export function mountLock(root) {
  const creating = !state.settings?.pinHash
  let phase = creating ? 'create' : 'unlock'
  let length = creating ? 4 : state.settings.pinLength || 4
  let first = ''
  let fails = 0
  let lockUntil = 0
  let timer = 0

  root.innerHTML = `<section class="lock page" data-testid="lock-screen">
    <div class="lock-mark">${moonMark()}</div>
    <p class="eyebrow">Dream Journal</p>
    <h1 data-testid="lock-title"></h1>
    <p class="lede" data-testid="lock-lede"></p>
    <div class="len-toggle" data-lengths>
      <button type="button" data-len="4" data-testid="pin-length-4">4 digits</button>
      <button type="button" data-len="6" data-testid="pin-length-6">6 digits</button>
    </div>
    <div data-pad></div>
    <p class="form-error" data-testid="pin-error" role="alert"></p>
    <button type="button" class="btn secondary finger" data-testid="fingerprint" hidden>Use fingerprint</button>
    <button type="button" class="text-link" data-testid="forgot-pin">Forgot your PIN?</button>
    <p class="fine" data-forgot hidden>There is no reset. The PIN never leaves this device, and neither does a way back in. If you exported a backup, clear this site's data in the browser and import the backup after choosing a new PIN. Clearing data deletes the journal on this device.</p>
  </section>`

  const title = root.querySelector('[data-testid="lock-title"]')
  const lede = root.querySelector('[data-testid="lock-lede"]')
  const error = root.querySelector('[data-testid="pin-error"]')
  const lengths = root.querySelector('[data-lengths]')
  const finger = root.querySelector('[data-testid="fingerprint"]')
  const pad = mountPinPad(root.querySelector('[data-pad]'), { length, onComplete: (pin) => { handle(pin) } })

  function setError(message) {
    error.textContent = message || ''
  }

  function updateCopy() {
    const setup = phase === 'create' || phase === 'confirm'
    lengths.hidden = phase !== 'create'
    root.querySelector('[data-testid="forgot-pin"]').hidden = phase === 'create' || phase === 'confirm'
    for (const button of lengths.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.len) === length))
    }
    if (phase === 'create') {
      title.textContent = 'Choose a PIN'
      lede.textContent = 'Four or six digits. They stay on this device as a salted hash. If you forget the PIN, this journal cannot be opened.'
    } else if (phase === 'confirm') {
      title.textContent = 'Confirm your PIN'
      lede.textContent = 'Enter the same digits once more.'
    } else {
      title.textContent = 'The journal is locked'
      lede.textContent = 'Enter your PIN. Dreams stay on this device, and the page locks again when you leave it.'
    }
    finger.hidden = setup || finger.hidden
  }

  function countdown() {
    clearInterval(timer)
    pad.pause()
    const tick = () => {
      const left = Math.ceil((lockUntil - Date.now()) / 1000)
      if (left <= 0) {
        clearInterval(timer)
        fails = 0
        lockUntil = 0
        setError('')
        pad.resume()
        return
      }
      setError(`Too many tries. Wait ${left} seconds.`)
    }
    tick()
    timer = setInterval(tick, 250)
  }

  async function handle(pin) {
    if (Date.now() < lockUntil) return
    pad.pause()
    try {
      if (phase === 'create') {
        first = pin
        phase = 'confirm'
        setError('')
        updateCopy()
        return
      }
      if (phase === 'confirm') {
        if (pin !== first) {
          first = ''
          phase = 'create'
          setError('Those do not match. Start again.')
          pad.shake()
          updateCopy()
          return
        }
        const salt = randomSalt()
        state.settings.pinHash = await hashPin(pin, salt)
        state.settings.pinSalt = bufToHex(salt)
        state.settings.pinLength = length
        await saveSettings(state.settings)
        first = ''
        openJournal()
        return
      }
      const ok = await verifyPin(pin, state.settings.pinSalt, state.settings.pinHash)
      if (!ok) {
        fails += 1
        pad.shake()
        if (fails >= 5) {
          lockUntil = Date.now() + 15000
          countdown()
        } else setError('That PIN does not match.')
        return
      }
      fails = 0
      openJournal()
    } finally {
      pad.clear()
      if (Date.now() >= lockUntil && !state.unlocked) pad.resume()
    }
  }

  function openJournal() {
    state.unlocked = true
    startReminders()
    runtime.render()
  }

  lengths.addEventListener('click', (event) => {
    const button = event.target.closest('[data-len]')
    if (!button || phase !== 'create') return
    length = Number(button.dataset.len)
    first = ''
    pad.setLength(length)
    updateCopy()
  })

  root.querySelector('[data-testid="forgot-pin"]').addEventListener('click', () => {
    const note = root.querySelector('[data-forgot]')
    note.hidden = !note.hidden
  })

  finger.addEventListener('click', async () => {
    try {
      suspendLock(120000)
      const ok = await unlockWithFingerprint(state.settings.webauthnId)
      if (ok) openJournal()
      else setError('Fingerprint did not unlock the journal.')
    } catch (error) {
      if (error?.name !== 'NotAllowedError') setError('Fingerprint was cancelled.')
    }
  })

  if (!creating && state.settings.webauthnId) {
    fingerprintAvailable().then((ok) => {
      if (ok && finger.isConnected && phase === 'unlock') finger.hidden = false
    })
  }

  updateCopy()
  return () => {
    clearInterval(timer)
    pad.destroy()
  }
}
