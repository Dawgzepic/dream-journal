import { saveSettings } from '../db.js'
import { formatDay } from '../lib/format.js'
import { GROUPS, hideTheme, listThemes, mergeThemes, pinTheme, renameTheme, themeById, themeCardLines, themeNote } from '../lib/themes.js'
import { go } from '../runtime.js'
import { state } from '../state.js'
import { esc, toast } from '../ui.js'

export function mountTheme(root, route) {
  const edits = state.settings?.themeEdits
  const item = themeById(state.dreams, edits, route.id)
  if (!item) {
    root.innerHTML = `<div class="page"><h1>That theme is not here</h1><p><a href="#/patterns">Back to patterns</a></p></div>`
    return () => {}
  }
  const others = listThemes(state.dreams, edits).filter((theme) => theme.id !== item.id)
  const pinned = Boolean(item.pinned)
  root.innerHTML = `<div class="page">
    <a class="back" href="#/patterns">Back to patterns</a>
    <p class="eyebrow">${esc(GROUPS.find(([id]) => id === item.group)?.[1] || 'Theme')}</p>
    <h1 data-testid="theme-title">${esc(item.name)}</h1>
    <p class="lede" data-testid="theme-note">${esc(themeNote(item))}</p>
    <section class="card" data-testid="theme-card">
      ${themeCardLines(item).map((line) => `<p>${esc(line)}</p>`).join('')}
    </section>
    <section>
      <h2>Dreams</h2>
      <ul data-testid="theme-dreams">${item.dreams.map((dream) => `<li><a href="#/dream/${esc(dream.id)}">${esc(formatDay(dream.datetime))} · ${esc(dream.title)}</a></li>`).join('') || '<li>None yet.</li>'}</ul>
    </section>
    <section class="card">
      <h2>Keep track of it</h2>
      <label class="field"><span>Name</span><input data-testid="theme-name" maxlength="40" value="${esc(item.name)}" /></label>
      <button type="button" class="btn secondary" data-testid="theme-rename">Rename</button>
      <p class="hint">Merge this into another item</p>
      <select data-testid="theme-merge-target">${others.map((theme) => `<option value="${esc(theme.id)}">${esc(theme.name)}</option>`).join('')}</select>
      <button type="button" class="btn secondary" data-testid="theme-merge">Merge</button>
      <div class="row wrap">
        <button type="button" class="btn secondary" data-testid="theme-pin">${pinned ? 'Unpin' : 'Pin'}</button>
        <button type="button" class="btn secondary" data-testid="theme-hide">Hide</button>
      </div>
    </section>
  </div>`

  async function save(next, hash) {
    state.settings.themeEdits = next
    await saveSettings(state.settings)
    toast('Saved')
    go(hash)
  }

  root.querySelector('[data-testid="theme-rename"]').addEventListener('click', async () => {
    const name = root.querySelector('[data-testid="theme-name"]').value
    await save(renameTheme(state.settings.themeEdits, item.id, name), `#/theme/${encodeURIComponent(item.id)}`)
  })
  root.querySelector('[data-testid="theme-merge"]').addEventListener('click', async () => {
    const target = root.querySelector('[data-testid="theme-merge-target"]').value
    if (!target) return
    await save(mergeThemes(state.settings.themeEdits, item.id, target), `#/theme/${encodeURIComponent(target)}`)
  })
  root.querySelector('[data-testid="theme-pin"]').addEventListener('click', async () => {
    await save(pinTheme(state.settings.themeEdits, item.id, !pinned), `#/theme/${encodeURIComponent(item.id)}`)
  })
  root.querySelector('[data-testid="theme-hide"]').addEventListener('click', async () => {
    await save(hideTheme(state.settings.themeEdits, item.id, true), '#/patterns')
  })
  return () => {}
}
