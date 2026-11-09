export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function renderStory(text, ranges) {
  const source = String(text || '')
  const br = (chunk) => esc(chunk).replaceAll('\n', '<br>')
  let html = ''
  let cursor = 0
  for (const range of ranges || []) {
    html += br(source.slice(cursor, range.start))
    html += `<button type="button" class="symbol" data-symbol="${esc(range.symbol.id)}">${esc(source.slice(range.start, range.end))}</button>`
    cursor = range.end
  }
  html += br(source.slice(cursor))
  return html
}

export function icon(name) {
  const common = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
  const paths = {
    moon: '<path d="M16.2 3.4A8.2 8.2 0 1 0 21 14.2 6.5 6.5 0 0 1 16.2 3.4z"/>',
    book: '<path d="M5 4.8h9.2A3.3 3.3 0 0 1 17.5 8.1V19H8.2A3.2 3.2 0 0 0 5 15.8z"/><path d="M5 4.8v11"/>',
    chart: '<path d="M4 19h16"/><path d="M7 16v-4"/><path d="M12 16V7"/><path d="M17 16v-6"/>',
    eye: '<path d="M2.5 12S6.2 6.8 12 6.8 21.5 12 21.5 12 17.8 17.2 12 17.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.1"/>',
    sliders: '<path d="M4 8h16"/><path d="M4 16h16"/><circle cx="9" cy="8" r="1.8"/><circle cx="15" cy="16" r="1.8"/>',
    you: '<circle cx="12" cy="8" r="3"/><path d="M5.6 19.2c1.1-3.1 3.3-4.6 6.4-4.6s5.3 1.5 6.4 4.6"/>'
  }
  return `<svg ${common}>${paths[name] || ''}</svg>`
}

export function moonMark() {
  return `<svg class="moon-mark" viewBox="0 0 80 80" width="92" height="92" aria-hidden="true">
    <defs>
      <mask id="moon-cut">
        <rect width="80" height="80" fill="black"/>
        <circle cx="34" cy="40" r="22" fill="white"/>
        <circle cx="48" cy="33" r="18" fill="black"/>
      </mask>
    </defs>
    <circle cx="34" cy="40" r="28" fill="#cbb6ff" opacity="0.16"/>
    <circle cx="34" cy="40" r="22" fill="#efe8ff" mask="url(#moon-cut)"/>
    <circle cx="62" cy="18" r="1.2" fill="#f6edd8"/>
    <circle cx="16" cy="24" r="1" fill="#f6edd8"/>
    <circle cx="66" cy="52" r="1.1" fill="#f6edd8"/>
  </svg>`
}

export function mountStars() {
  const root = document.querySelector('#stars')
  if (!root || root.childElementCount) return
  for (let i = 0; i < 32; i++) {
    const star = document.createElement('span')
    star.style.left = `${(i * 37) % 100}%`
    star.style.top = `${(i * 53 + 7) % 100}%`
    star.style.animationDelay = `${(i % 9) * 0.45}s`
    const size = i % 5 === 0 ? 3 : 2
    star.style.width = `${size}px`
    star.style.height = `${size}px`
    root.appendChild(star)
  }
}

export function toast(message) {
  const host = document.querySelector('#toasts')
  if (!host) return
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = message
  host.appendChild(el)
  setTimeout(() => el.remove(), 2800)
}

export function confirmModal({ title, body, confirmLabel, danger = false, testid = 'confirm-ok' }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div')
    wrap.className = 'modal'
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <h2 id="dialog-title">${esc(title)}</h2>
      <p>${esc(body)}</p>
      <div class="row">
        <button type="button" class="btn secondary" data-cancel>Cancel</button>
        <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-ok data-testid="${esc(testid)}">${esc(confirmLabel)}</button>
      </div>
    </div>`
    const done = (value) => {
      document.removeEventListener('keydown', onKey)
      wrap.remove()
      resolve(value)
    }
    function onKey(event) {
      if (event.key === 'Escape') done(false)
    }
    document.addEventListener('keydown', onKey)
    wrap.querySelector('[data-cancel]').addEventListener('click', () => done(false))
    wrap.querySelector('[data-ok]').addEventListener('click', () => done(true))
    document.body.appendChild(wrap)
    wrap.querySelector('[data-cancel]').focus()
  })
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback below */
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.left = '-9999px'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
