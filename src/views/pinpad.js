export function mountPinPad(container, { length = 4, onComplete }) {
  let entry = ''
  let current = length
  let paused = false
  let destroyed = false
  container.innerHTML = `<div class="dots" data-testid="pin-dots" aria-live="polite"></div>
    <div class="pad" role="group" aria-label="PIN pad"></div>`
  const dots = container.querySelector('.dots')
  const pad = container.querySelector('.pad')
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']
  pad.innerHTML = keys.map((key) => {
    if (!key) return '<span></span>'
    if (key === 'back') return '<button type="button" class="ghost" data-key="back" data-testid="pin-back" aria-label="Delete digit">Delete</button>'
    return `<button type="button" data-key="${key}" data-testid="pin-${key}">${key}</button>`
  }).join('')

  function draw() {
    dots.replaceChildren()
    for (let i = 0; i < current; i++) {
      const dot = document.createElement('span')
      if (i < entry.length) dot.className = 'on'
      dots.appendChild(dot)
    }
    dots.setAttribute('aria-label', `${entry.length} of ${current} digits`)
  }

  function press(key) {
    if (paused || destroyed) return
    if (key === 'back') entry = entry.slice(0, -1)
    else if (entry.length < current) entry += key
    draw()
    if (key !== 'back' && entry.length === current) {
      const pin = entry
      entry = ''
      draw()
      onComplete(pin)
    }
  }

  function onClick(event) {
    const button = event.target.closest('button[data-key]')
    if (!button) return
    press(button.dataset.key)
  }

  function onKey(event) {
    if (destroyed) return
    const target = event.target
    if (target instanceof HTMLElement && target.matches('input, textarea')) return
    if (event.key >= '0' && event.key <= '9') {
      press(event.key)
      event.preventDefault()
    } else if (event.key === 'Backspace') {
      press('back')
      event.preventDefault()
    }
  }

  pad.addEventListener('click', onClick)
  window.addEventListener('keydown', onKey)
  draw()

  return {
    setLength(next) {
      current = next
      entry = ''
      draw()
    },
    clear() {
      entry = ''
      draw()
    },
    shake() {
      dots.classList.remove('shake')
      void dots.offsetWidth
      dots.classList.add('shake')
    },
    pause() { paused = true },
    resume() { paused = false },
    destroy() {
      destroyed = true
      pad.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }
}
