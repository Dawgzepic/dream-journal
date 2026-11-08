import { userDreams } from '../lib/dreams.js'
import { displayTitle } from '../lib/dreams.js'
import { dayKey, excerpt, hashString } from '../lib/format.js'
import { moodTotals, summarize, thisMonthCount } from '../lib/analyze.js'
import { noteFor } from '../lib/tips.js'
import { greeting, streakLabel } from '../lib/time.js'
import { homeBanner } from '../reminders.js'
import { state } from '../state.js'
import { esc, icon } from '../ui.js'

function dailyPick(items, now) {
  if (!items.length) return null
  const key = `${dayKey(now)}:${items.map((item) => item.id).sort().join('|')}`
  return items[hashString(key) % items.length]
}

export function mountHome(root) {
  const now = new Date()
  const own = userDreams(state.dreams)
  const finished = state.dreams.filter((dream) => !dream.isDraft)
  const lucid = own.filter((dream) => (dream.tags || []).includes('Lucid')).length
  const nightmares = own.filter((dream) => (dream.tags || []).includes('Nightmare')).length
  const summary = summarize(state.dreams)
  const moods = moodTotals(state.dreams).slice(0, 4)
  const maxMood = Math.max(1, ...moods.map(([, count]) => count))
  const banner = homeBanner(state.settings, state.dreams, now)
  const sample = state.dreams.find((dream) => dream.isSample)
  const pick = dailyPick(finished, now)
  const note = noteFor(now)
  const showNag = !state.settings.exportedOnce && own.length > 0

  const bars = moods.length
    ? `<div class="bars" data-testid="mood-bars">${moods.map(([mood, count]) => `<div class="bar-row">
        <span>${esc(mood)}</span>
        <span class="bar-track"><span style="width:${Math.round((count / maxMood) * 100)}%"></span></span>
        <em>${count}</em>
      </div>`).join('')}</div>`
    : '<p class="muted">Moods will gather here after a few of your own dreams.</p>'

  const random = pick
    ? `<a class="card link-card" href="#/dream/${esc(pick.id)}" data-testid="random-dream">
        <p class="eyebrow">A page at random</p>
        <h2>${esc(displayTitle(pick))}</h2>
        ${pick.isSample ? '<span class="badge">Sample</span>' : ''}
        <p class="excerpt">${esc(excerpt(pick.story, 220))}</p>
      </a>`
    : `<section class="card" data-testid="random-dream"><p class="eyebrow">A page at random</p><p>Once you have kept a dream, one will surface here.</p></section>`

  root.innerHTML = `<div class="page home">
    <header class="mast">
      <p class="brand brand-mobile">${icon('moon')}<span>Dream Journal</span></p>
      <h1 data-testid="greeting">${esc(greeting(now))}</h1>
      <p class="streak" data-testid="streak">${esc(streakLabel(state.dreams, now))}</p>
    </header>
    <section class="banner" data-testid="reminder-banner">
      <strong>${esc(banner.title)}</strong>
      <p>${esc(banner.body)} ${esc(banner.note)}</p>
    </section>
    <section class="card patterns-lead">
      <h2>The shape of your nights</h2>
      <div class="stats">
        <div class="stat" data-testid="stat-dreams"><strong>${own.length}</strong><span>Dreams</span></div>
        <div class="stat" data-testid="stat-month"><strong>${thisMonthCount(state.dreams, now)}</strong><span>This month</span></div>
        <div class="stat" data-testid="stat-lucid"><strong>${lucid}</strong><span>Lucid</span></div>
        <div class="stat" data-testid="stat-nightmare"><strong>${nightmares}</strong><span>Nightmares</span></div>
      </div>
      <a class="btn primary big" href="#/new" data-testid="new-dream">New dream</a>
      ${bars}
      <p class="lead" data-testid="home-summary">${esc(summary.lead)}</p>
      <a class="text-link" href="#/patterns">See patterns</a>
    </section>
    ${sample ? '<p class="sample-note" data-testid="sample-note">A sample dream is in the journal, clearly marked. Delete it whenever you like.</p>' : ''}
    ${showNag ? '<p class="nag" data-testid="backup-nag">When you can, export a backup from Settings. A forgotten PIN cannot be recovered.</p>' : ''}
    ${random}
    <section class="card" data-testid="tip">
      <p class="eyebrow">${esc(note.kind)} from the margin</p>
      <p>${esc(note.text)}</p>
    </section>
    <p class="privacy-line" data-testid="privacy-line">On this device only. No account, no sharing.</p>
  </div>`
  return () => {}
}
