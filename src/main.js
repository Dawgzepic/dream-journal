import '@fontsource-variable/eb-garamond/wght.css'
import '@fontsource-variable/eb-garamond/wght-italic.css'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { loadAll } from './db.js'
import { parseHash } from './router.js'
import { stopReminders } from './reminders.js'
import { runtime } from './runtime.js'
import { state } from './state.js'
import { icon, mountStars } from './ui.js'
import { mountDetails } from './views/details.js'
import { mountDream } from './views/dream.js'
import { mountEditor } from './views/editor.js'
import { mountHome } from './views/home.js'
import { mountJournal } from './views/journal.js'
import { mountLock } from './views/lock.js'
import { mountMeaning } from './views/meaning.js'
import { mountPatterns } from './views/patterns.js'
import { mountSelf } from './views/self.js'
import { mountSettings } from './views/settings.js'
import { mountTheme } from './views/theme.js'

const titles = {
  home: 'Dream Journal',
  journal: 'Journal · Dream Journal',
  editor: 'New dream · Dream Journal',
  dream: 'Dream · Dream Journal',
  meaning: 'Meanings · Dream Journal',
  details: 'Dream details · Dream Journal',
  patterns: 'Patterns · Dream Journal',
  theme: 'Theme · Dream Journal',
  self: 'You · Dream Journal',
  settings: 'Settings · Dream Journal'
}

let cleanup = () => {}
let rendering = false

function shell() {
  const app = document.querySelector('#app')
  app.innerHTML = ''
  const main = document.createElement('main')
  main.id = 'main'
  main.tabIndex = -1
  app.appendChild(main)
  return main
}

function navKey(name) {
  if (name === 'dream' || name === 'editor' || name === 'meaning' || name === 'details') return 'journal'
  if (name === 'theme') return 'patterns'
  return name
}

function navHtml(name) {
  const items = [
    ['home', '#/home', 'Home', 'moon'],
    ['journal', '#/journal', 'Journal', 'book'],
    ['patterns', '#/patterns', 'Patterns', 'chart'],
    ['self', '#/self', 'You', 'you'],
    ['settings', '#/settings', 'Settings', 'sliders']
  ]
  const current = navKey(name)
  return `<p class="nav-brand">${icon('moon')}<span>Dream Journal</span></p>
    <a class="nav-new btn primary" href="#/new" data-testid="nav-new">New dream</a>
    ${items.map(([id, href, label, glyph]) => `<a href="${href}" ${current === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span></a>`).join('')}`
}

function render() {
  if (rendering) return
  rendering = true
  try {
    const prev = cleanup
    cleanup = () => {}
    prev()
    document.querySelector('#toasts')?.replaceChildren()
    const main = shell()
    if (state.storageError) {
      document.body.classList.remove('has-nav')
      main.innerHTML = `<div class="page"><h1>Storage is blocked</h1><p>This browser is blocking on-device storage, so Dream Journal cannot keep your dreams private here. Try a regular Chrome window.</p></div>`
      return
    }
    if (!state.unlocked) {
      document.body.classList.remove('has-nav')
      cleanup = mountLock(main) || (() => {})
      document.title = 'Dream Journal'
      return
    }
    document.body.classList.add('has-nav')
    const route = parseHash(location.hash)
    const nav = document.createElement('nav')
    nav.id = 'nav'
    nav.dataset.testid = 'nav'
    nav.innerHTML = navHtml(route.name)
    document.querySelector('#app').appendChild(nav)
    const mounts = {
      home: mountHome,
      journal: mountJournal,
      editor: mountEditor,
      dream: mountDream,
      details: mountDetails,
      meaning: mountMeaning,
      patterns: mountPatterns,
      theme: mountTheme,
      self: mountSelf,
      settings: mountSettings
    }
    const mount = mounts[route.name] || mountMissing
    cleanup = mount(main, route) || (() => {})
    document.title = titles[route.name] || 'Dream Journal'
    const heading = main.querySelector('h1')
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
    window.scrollTo(0, 0)
  } finally {
    rendering = false
  }
}

function mountMissing(root) {
  root.innerHTML = `<div class="page"><h1>That page is not in the journal</h1><p><a class="text-link" href="#/home">Back home</a></p></div>`
  return () => {}
}

function lockIfHidden() {
  if (!state.unlocked) return
  if (Date.now() <= state.suspendLockUntil) return
  state.unlocked = false
  stopReminders()
  render()
}

runtime.render = render
runtime.lock = () => {
  state.unlocked = false
  stopReminders()
  render()
}

window.addEventListener('hashchange', () => {
  if (state.booted && state.unlocked) render()
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') lockIfHidden()
})
window.addEventListener('pagehide', () => lockIfHidden())
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    state.unlocked = false
    stopReminders()
    render()
  }
})

mountStars()
registerSW({
  immediate: true,
  onRegisterError(error) {
    console.error(error)
  }
})

async function boot() {
  const main = shell()
  main.innerHTML = '<p class="opening" data-testid="booting">Opening your journal…</p>'
  try {
    const data = await loadAll()
    state.settings = data.settings
    state.dreams = data.dreams
  } catch (error) {
    state.storageError = error
  }
  state.booted = true
  render()
}

boot()
