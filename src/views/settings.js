import { deleteDatabase, replaceAllDreams, saveSettings } from '../db.js'
import { applyPrefs, downloadBlob, downloadPdf, journalToJSON, journalToText, parseBackup } from '../lib/backup.js'
import { DAY_LABELS } from '../lib/constants.js'
import { bufToHex, hashPin, randomSalt, verifyPin } from '../lib/pin.js'
import { lockNow } from '../runtime.js'
import { enableNotifications, startReminders } from '../reminders.js'
import { go } from '../runtime.js'
import { state, suspendLock } from '../state.js'
import { confirmModal, esc, toast } from '../ui.js'
import { fingerprintAvailable, registerFingerprint } from '../webauthn.js'
import { speechSupported } from '../voice.js'
import { askVoiceDisclosure } from '../voice.js'
import { mountPinPad } from './pinpad.js'

export function mountSettings(root) {
  const settings = state.settings
  root.innerHTML = `<div class="page">
    <p class="brand-mobile eyebrow">Dream Journal</p>
    <h1>Settings</h1>
    <section class="card">
      <h2>Privacy</h2>
      <p>Dream Journal keeps everything in this browser, on this device. There is no account, no server, and no analytics. Nothing is shared. The only time audio can leave the device is if you turn on voice entry: Chrome on Android may send what you say to Google for transcription. You choose that once, and you can turn it off.</p>
      <p>A forgotten PIN cannot be recovered. Export a backup before you need one.</p>
    </section>
    <section>
      <h2>Reminders</h2>
      <p class="lede">Web reminders are best-effort. Browsers deliver them reliably only while Dream Journal is open, and your phone may delay or drop them. The banner on the home screen is the dependable part. The morning nudge stays quiet overnight from 10:00 PM to 7:00 AM.</p>
      <div class="toggle-row">
        <span>Morning reminder to log a dream</span>
        <button type="button" class="chip" data-testid="toggle-morning" aria-pressed="${settings.morningReminder ? 'true' : 'false'}">${settings.morningReminder ? 'On' : 'Off'}</button>
      </div>
      <label class="field"><span>Morning time</span><input type="time" data-testid="morning-time" value="${esc(settings.morningTime)}" /></label>
      <button type="button" class="btn secondary" data-testid="notify-permission">Allow notifications</button>
      <p class="fine" data-notify></p>
    </section>
    <section>
      <h2>Work hours</h2>
      <p>Your usual hours stay on this device. The default is 8:00 AM to 4:30 PM on Sunday, Monday, Wednesday, Thursday, and Friday.</p>
      <div class="chips" data-days>
        ${DAY_LABELS.map((label, index) => `<button type="button" class="chip" data-testid="work-day-${index}" data-day="${index}" aria-pressed="${settings.workDays.includes(index) ? 'true' : 'false'}">${label}</button>`).join('')}
      </div>
      <div class="time-pair">
        <label class="field"><span>Starts</span><input type="time" data-testid="work-start" value="${esc(settings.workStart)}" /></label>
        <label class="field"><span>Ends</span><input type="time" data-testid="work-end" value="${esc(settings.workEnd)}" /></label>
      </div>
      <p class="form-error" data-hours-error hidden></p>
    </section>
    <section data-voice-section>
      <h2>Voice entry</h2>
      <p data-voice-copy></p>
      <button type="button" class="btn secondary" data-testid="voice-settings" hidden>Review voice entry</button>
    </section>
    <section data-finger>
      <h2>Fingerprint</h2>
      <p>Where this device supports it, you can unlock with the fingerprint already stored by the phone. Dream Journal keeps only a key id, not a biometric.</p>
      <p data-finger-state></p>
      <button type="button" class="btn secondary" data-testid="enable-fingerprint">Enable fingerprint unlock</button>
      <button type="button" class="btn secondary" data-testid="disable-fingerprint" hidden>Turn off fingerprint unlock</button>
    </section>
    <section>
      <h2>Backup</h2>
      <div class="row wrap">
        <button type="button" class="btn secondary" data-testid="export-text">Download text</button>
        <button type="button" class="btn secondary" data-testid="export-pdf">Download PDF</button>
        <button type="button" class="btn secondary" data-testid="export-json">Download JSON backup</button>
        <button type="button" class="btn secondary" data-testid="print-journal">Print</button>
      </div>
      <label class="btn secondary file-btn">Import JSON backup
        <input class="file-input" type="file" accept="application/json,.json" data-testid="import-json" />
      </label>
      <p class="form-error" data-testid="import-error" hidden></p>
    </section>
    <section>
      <h2>PIN</h2>
      <div class="row wrap">
        <button type="button" class="btn secondary" data-testid="lock-now">Lock now</button>
        <button type="button" class="btn secondary" data-testid="change-pin">Change PIN</button>
      </div>
      <div data-pin-panel hidden>
        <p data-pin-copy></p>
        <div class="len-toggle" data-new-lengths hidden>
          <button type="button" data-new-len="4">4 digits</button>
          <button type="button" data-new-len="6">6 digits</button>
        </div>
        <div data-pin-pad></div>
        <p class="form-error" data-pin-error></p>
      </div>
    </section>
    <section>
      <h2>Erase this device</h2>
      <button type="button" class="btn danger" data-testid="wipe">Delete everything</button>
    </section>
  </div>`

  const notifyNote = root.querySelector('[data-notify]')
  function paintNotify() {
    if (typeof Notification === 'undefined') {
      notifyNote.textContent = 'This browser does not offer notifications. The home banner still works.'
      root.querySelector('[data-testid="notify-permission"]').hidden = true
      return
    }
    notifyNote.textContent = Notification.permission === 'granted'
      ? 'Notifications are allowed. They still only fire reliably while the app is open.'
      : Notification.permission === 'denied'
        ? 'Notifications are blocked in the browser settings. The home banner still shows.'
        : 'Notifications are not allowed yet.'
  }
  paintNotify()

  root.querySelector('[data-testid="toggle-morning"]').addEventListener('click', async (event) => {
    settings.morningReminder = !settings.morningReminder
    event.currentTarget.setAttribute('aria-pressed', String(settings.morningReminder))
    event.currentTarget.textContent = settings.morningReminder ? 'On' : 'Off'
    await saveSettings(settings)
    startReminders()
  })
  root.querySelector('[data-testid="morning-time"]').addEventListener('change', async (event) => {
    settings.morningTime = event.target.value || '07:15'
    await saveSettings(settings)
    startReminders()
  })
  root.querySelector('[data-testid="notify-permission"]').addEventListener('click', async () => {
    suspendLock(60000)
    await enableNotifications()
    paintNotify()
  })

  const hoursError = root.querySelector('[data-hours-error]')
  root.querySelector('[data-days]').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-day]')
    if (!button) return
    const day = Number(button.dataset.day)
    const days = new Set(settings.workDays)
    if (days.has(day)) days.delete(day)
    else days.add(day)
    settings.workDays = [...days].sort((a, b) => a - b)
    button.setAttribute('aria-pressed', String(days.has(day)))
    await saveSettings(settings)
    startReminders()
  })
  async function saveHours() {
    const start = root.querySelector('[data-testid="work-start"]').value
    const end = root.querySelector('[data-testid="work-end"]').value
    if (!start || !end || end <= start) {
      hoursError.hidden = false
      hoursError.textContent = 'Work hours should end after they start.'
      root.querySelector('[data-testid="work-start"]').value = settings.workStart
      root.querySelector('[data-testid="work-end"]').value = settings.workEnd
      return
    }
    hoursError.hidden = true
    settings.workStart = start
    settings.workEnd = end
    await saveSettings(settings)
    startReminders()
  }
  root.querySelector('[data-testid="work-start"]').addEventListener('change', saveHours)
  root.querySelector('[data-testid="work-end"]').addEventListener('change', saveHours)

  const voiceSection = root.querySelector('[data-voice-section]')
  if (!speechSupported()) voiceSection.hidden = true
  else {
    const copy = root.querySelector('[data-voice-copy]')
    const button = root.querySelector('[data-testid="voice-settings"]')
    button.hidden = false
    copy.textContent = settings.voiceOptIn === true
      ? 'Voice entry is on. Chrome on Android may send audio to Google for transcription.'
      : settings.voiceOptIn === false
        ? 'Voice entry is off.'
        : 'Voice entry has not been chosen yet. You will be asked before the first use.'
    button.textContent = settings.voiceOptIn === true ? 'Turn voice entry off' : 'Turn voice entry on'
    button.addEventListener('click', async () => {
      if (settings.voiceOptIn === true) {
        settings.voiceOptIn = false
        await saveSettings(settings)
        go('#/settings')
        return
      }
      suspendLock(120000)
      const choice = await askVoiceDisclosure()
      settings.voiceOptIn = choice === 'accept'
      await saveSettings(settings)
      go('#/settings')
    })
  }

  const fingerState = root.querySelector('[data-finger-state]')
  const enableFinger = root.querySelector('[data-testid="enable-fingerprint"]')
  const disableFinger = root.querySelector('[data-testid="disable-fingerprint"]')
  fingerprintAvailable().then((ok) => {
    if (!root.isConnected) return
    if (!ok) {
      root.querySelector('[data-finger]').hidden = true
      return
    }
    const on = Boolean(settings.webauthnId)
    fingerState.textContent = on ? 'Fingerprint unlock is on for this device.' : 'Fingerprint unlock is available and off.'
    enableFinger.hidden = on
    disableFinger.hidden = !on
  })
  enableFinger.addEventListener('click', async () => {
    try {
      settings.webauthnId = await registerFingerprint()
      await saveSettings(settings)
      toast('Fingerprint unlock is on')
      go('#/settings')
    } catch (error) {
      if (error?.name !== 'NotAllowedError') toast('Fingerprint setup was cancelled.')
    }
  })
  disableFinger.addEventListener('click', async () => {
    settings.webauthnId = null
    await saveSettings(settings)
    toast('Fingerprint unlock is off')
    go('#/settings')
  })

  async function markExported() {
    if (!settings.exportedOnce) {
      settings.exportedOnce = true
      await saveSettings(settings)
    }
  }
  root.querySelector('[data-testid="export-text"]').addEventListener('click', async () => {
    const text = journalToText(state.dreams, state.settings)
    downloadBlob(`dream-journal-${new Date().toISOString().slice(0, 10)}.txt`, new Blob([text], { type: 'text/plain' }))
    await markExported()
    toast('Text file downloaded')
  })
  root.querySelector('[data-testid="export-pdf"]').addEventListener('click', async () => {
    await downloadPdf(state.dreams, state.settings)
    await markExported()
    toast('PDF downloaded')
  })
  root.querySelector('[data-testid="export-json"]').addEventListener('click', async () => {
    const json = journalToJSON(settings, state.dreams)
    downloadBlob(`dream-journal-backup-${new Date().toISOString().slice(0, 10)}.json`, new Blob([json], { type: 'application/json' }))
    await markExported()
    toast('Backup downloaded')
  })
  root.querySelector('[data-testid="print-journal"]').addEventListener('click', () => {
    suspendLock(60000)
    document.getElementById('print-root')?.remove()
    const host = document.createElement('div')
    host.id = 'print-root'
    const dreams = [...state.dreams].sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
    host.innerHTML = `<h1>Dream Journal</h1>${dreams.map((dream) => `<article><h2>${esc(dream.title || 'Untitled')}</h2><p>${esc(dream.datetime)}</p><p>${esc(dream.story || '').replaceAll('\n', '<br>')}</p></article>`).join('')}`
    document.body.appendChild(host)
    const cleanup = () => host.remove()
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  })

  const importError = root.querySelector('[data-testid="import-error"]')
  root.querySelector('[data-testid="import-json"]').addEventListener('click', () => suspendLock(120000))
  root.querySelector('[data-testid="import-json"]').addEventListener('change', async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed = parseBackup(await file.text())
      const ok = await confirmModal({
        title: 'Replace the dreams on this device?',
        body: 'The backup will replace the journal stored here. Your PIN stays as it is.',
        confirmLabel: 'Replace journal',
        testid: 'confirm-import'
      })
      if (!ok) return
      await replaceAllDreams(parsed.dreams)
      const next = applyPrefs(state.settings, parsed.preferences)
      await saveSettings(next)
      toast(parsed.truncated ? 'Backup restored. Only the first 5000 dreams were kept.' : 'Backup restored')
      go('#/home')
    } catch (error) {
      importError.hidden = false
      importError.textContent = error.message || 'That file could not be imported.'
    }
  })

  root.querySelector('[data-testid="lock-now"]').addEventListener('click', () => lockNow())

  const panel = root.querySelector('[data-pin-panel]')
  const pinCopy = root.querySelector('[data-pin-copy]')
  const pinError = root.querySelector('[data-pin-error]')
  const newLengths = root.querySelector('[data-new-lengths]')
  let pinPad = null
  let pinPhase = 'current'
  let nextPin = ''
  let nextLength = settings.pinLength || 4

  function destroyPad() {
    pinPad?.destroy()
    pinPad = null
  }
  function openPad() {
    destroyPad()
    pinPad = mountPinPad(root.querySelector('[data-pin-pad]'), {
      length: pinPhase === 'current' ? settings.pinLength || 4 : nextLength,
      onComplete: async (pin) => {
        pinPad.pause()
        try {
          if (pinPhase === 'current') {
            const ok = await verifyPin(pin, settings.pinSalt, settings.pinHash)
            if (!ok) {
              pinError.textContent = 'That PIN does not match.'
              pinPad.shake()
              return
            }
            pinPhase = 'new'
            pinError.textContent = ''
            pinCopy.textContent = 'Choose a new PIN.'
            newLengths.hidden = false
            pinPad.setLength(nextLength)
            return
          }
          if (pinPhase === 'new') {
            nextPin = pin
            pinPhase = 'confirm'
            pinCopy.textContent = 'Enter the new PIN again.'
            newLengths.hidden = true
            return
          }
          if (pin !== nextPin) {
            pinPhase = 'new'
            nextPin = ''
            pinError.textContent = 'Those do not match. Choose the new PIN again.'
            pinCopy.textContent = 'Choose a new PIN.'
            newLengths.hidden = false
            pinPad.shake()
            return
          }
          const salt = randomSalt()
          settings.pinHash = await hashPin(pin, salt)
          settings.pinSalt = bufToHex(salt)
          settings.pinLength = nextLength
          await saveSettings(settings)
          toast('PIN changed')
          panel.hidden = true
          destroyPad()
        } finally {
          pinPad?.clear()
          pinPad?.resume()
        }
      }
    })
  }
  root.querySelector('[data-testid="change-pin"]').addEventListener('click', () => {
    panel.hidden = false
    pinPhase = 'current'
    nextPin = ''
    nextLength = settings.pinLength || 4
    pinError.textContent = ''
    pinCopy.textContent = 'Enter your current PIN.'
    newLengths.hidden = true
    openPad()
  })
  newLengths.addEventListener('click', (event) => {
    const button = event.target.closest('[data-new-len]')
    if (!button || pinPhase !== 'new') return
    nextLength = Number(button.dataset.newLen)
    for (const item of newLengths.querySelectorAll('button')) {
      item.setAttribute('aria-pressed', String(Number(item.dataset.newLen) === nextLength))
    }
    pinPad?.setLength(nextLength)
  })

  root.querySelector('[data-testid="wipe"]').addEventListener('click', async () => {
    const ok = await confirmModal({
      title: 'Delete everything on this device?',
      body: 'Dreams, the PIN, and settings will be erased. This cannot be undone. A backup file you already downloaded is the only copy that remains.',
      confirmLabel: 'Delete everything',
      danger: true,
      testid: 'confirm-wipe'
    })
    if (!ok) return
    await deleteDatabase()
    location.reload()
  })

  return () => destroyPad()
}
