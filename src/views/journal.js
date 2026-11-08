import { displayTitle } from '../lib/dreams.js'
import { recurringIdSet } from '../lib/analyze.js'
import { excerpt, formatDay, monthKeyFromDate, monthLabel } from '../lib/format.js'
import { state } from '../state.js'
import { esc } from '../ui.js'

function matches(dream, query) {
  if (!query) return true
  const bed = dream.bedtime || {}
  const hay = [
    dream.title, dream.story, dream.events, dream.clarity, dream.moodAfter,
    ...(dream.moodsDuring || []), ...(dream.tags || []), bed.food, bed.substance, bed.screen
  ].join(' ').toLowerCase()
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => hay.includes(word))
}

function badges(dream, recurring) {
  const out = []
  if (dream.isSample) out.push(['Sample', 'sample'])
  if (dream.isDraft) out.push(['Draft', 'draft'])
  for (const tag of dream.tags || []) out.push([tag, tag === 'Nightmare' ? 'nightmare' : 'tag'])
  if (recurring.has(dream.id) && !(dream.tags || []).includes('Recurring')) out.push(['Likely recurring', 'recur'])
  return out
}

export function mountJournal(root) {
  let filter = 'all'
  let query = ''
  root.innerHTML = `<div class="page">
    <p class="brand-mobile eyebrow">Dream Journal</p>
    <div class="row spread">
      <h1>Journal</h1>
      <a class="btn secondary" href="#/new" data-testid="journal-new">New dream</a>
    </div>
    <p class="lede">Search by any word, or scroll the nights. More than one dream can share a date.</p>
    <label class="field">
      <span>Search</span>
      <input type="search" data-testid="search" placeholder="Search words, moods, labels" autocomplete="off" />
    </label>
    <div class="chips" data-filters>
      ${['all', 'drafts', 'nightmares', 'lucid', 'recurring'].map((id) => `<button type="button" class="chip" data-filter="${id}" data-testid="filter-${id}">${id === 'all' ? 'All' : id[0].toUpperCase() + id.slice(1)}</button>`).join('')}
    </div>
    <div data-list></div>
  </div>`
  const list = root.querySelector('[data-list]')
  const search = root.querySelector('[data-testid="search"]')

  function visible(dream, recurring) {
    if (filter === 'drafts' && !dream.isDraft) return false
    if (filter === 'nightmares' && !(dream.tags || []).includes('Nightmare')) return false
    if (filter === 'lucid' && !(dream.tags || []).includes('Lucid')) return false
    if (filter === 'recurring') {
      const tagged = (dream.tags || []).includes('Recurring')
      if (!tagged && !recurring.has(dream.id)) return false
    }
    return matches(dream, query)
  }

  function draw() {
    const recurring = recurringIdSet(state.dreams)
    const dreams = [...state.dreams]
      .filter((dream) => visible(dream, recurring))
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
    for (const button of root.querySelectorAll('[data-filter]')) {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter))
    }
    if (!state.dreams.length) {
      list.innerHTML = '<p class="empty">Your journal is blank. The next dream you remember can go here.</p>'
      return
    }
    if (!dreams.length) {
      list.innerHTML = '<p class="empty" data-testid="search-empty">No dream uses those words.</p>'
      return
    }
    const groups = new Map()
    for (const dream of dreams) {
      const key = monthKeyFromDate(dream.datetime)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(dream)
    }
    list.innerHTML = [...groups.entries()].map(([key, items]) => `<section class="month-group">
      <h2>${esc(monthLabel(key))}</h2>
      <div class="timeline">${items.map((dream) => `<a class="entry" href="#/dream/${esc(dream.id)}" data-testid="dream-item" data-id="${esc(dream.id)}">
        <time datetime="${esc(dream.datetime)}">${esc(formatDay(dream.datetime))}</time>
        <span>
          <strong>${esc(displayTitle(dream))}</strong>
          <span class="badges">${badges(dream, recurring).map(([label, kind]) => `<em class="badge badge-${esc(kind)}">${esc(label)}</em>`).join('')}</span>
          <span class="excerpt">${esc(excerpt(dream.story || dream.events, 140))}</span>
        </span>
      </a>`).join('')}</div>
    </section>`).join('')
  }

  search.addEventListener('input', () => {
    query = search.value
    draw()
  })
  root.querySelector('[data-filters]').addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]')
    if (!button) return
    filter = button.dataset.filter
    draw()
  })
  draw()
  return () => {}
}
