import Chart from 'chart.js/auto'
import { bedtimeBuckets, groupWords, monthOptions, monthRecap, moodTrend, recurringGroups, summarize } from '../lib/analyze.js'
import { listThemes, themesByGroup } from '../lib/themes.js'
import { displayTitle } from '../lib/dreams.js'
import { monthSelfLine } from '../lib/personality.js'
import { formatDay, monthLabel } from '../lib/format.js'
import { state } from '../state.js'
import { esc } from '../ui.js'

const MOOD_COLOR = {
  Happy: '#e4d2a4',
  Scared: '#e0a8b8',
  Confused: '#b7a6d6',
  Sad: '#8fa4c4',
  Peaceful: '#a9cbb8',
  Anxious: '#d0a6de'
}
const PALETTE = ['#e4d2a4', '#e0a8b8', '#b7a6d6', '#8fa4c4', '#a9cbb8', '#d0a6de', '#9bb7d4', '#cbb6ff']

function colorFor(mood, index) {
  return MOOD_COLOR[mood] || PALETTE[index % PALETTE.length]
}

export function mountPatterns(root) {
  const summary = summarize(state.dreams)
  const options = monthOptions(state.dreams)
  const initial = options[0]
  root.innerHTML = `<div class="page">
    <p class="brand-mobile eyebrow">Dream Journal</p>
    <h1>Patterns</h1>
    <p class="lede">Your own dreams only. The sample is left out, and drafts wait until you finish them.</p>
    <section class="card" data-testid="pattern-summary"><p>${esc(summary.detail)}</p></section>
    <section>
      <h2>Mood over time</h2>
      <div class="chart-box"><canvas data-testid="mood-chart" aria-label="Moods by week"></canvas></div>
    </section>
    <section>
      <div class="row spread">
        <h2>This month</h2>
        <label class="inline"><span class="sr">Month</span>
          <select data-testid="month-select">${options.map((key) => `<option value="${esc(key)}">${esc(monthLabel(key))}</option>`).join('')}</select>
        </label>
      </div>
      <div class="card" data-testid="month-recap"></div>
    </section>
    <section data-testid="themes-overview">
      <h2>Themes and keywords</h2>
      <p class="muted">People, places, things, and themes drawn from the dream and the details you added. Open one to rename it, merge it, hide it, or pin it.</p>
      <div data-testid="theme-groups"></div>
    </section>
    <section>
      <h2>Recurring dreams</h2>
      <div data-testid="recurring"></div>
    </section>
    <section>
      <h2>Bedtime and nightmares</h2>
      <div class="chart-box"><canvas data-testid="factor-chart" aria-label="Nightmare share by bedtime factor"></canvas></div>
      <div data-testid="correlation-table"></div>
    </section>
  </div>`

  const charts = []
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  Chart.defaults.font.family = '"EB Garamond Variable", Palatino, serif'
  Chart.defaults.color = '#b7adc6'
  Chart.defaults.animation = reduced ? false : { duration: 500 }

  function make(canvas, config) {
    if (!canvas) return
    const prior = Chart.getChart(canvas)
    if (prior) prior.destroy()
    charts.push(new Chart(canvas, config))
  }

  const trend = moodTrend(state.dreams)
  const moodNames = [...new Set(trend.flatMap((week) => Object.keys(week.counts)))]
  if (moodNames.length) {
    make(root.querySelector('[data-testid="mood-chart"]'), {
      type: 'line',
      data: {
        labels: trend.map((week) => week.label),
        datasets: moodNames.map((mood, index) => ({
          label: mood,
          data: trend.map((week) => week.counts[mood] || 0),
          borderColor: colorFor(mood, index),
          backgroundColor: colorFor(mood, index),
          tension: 0.3,
          pointRadius: 3
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(214,196,255,0.12)' } }
        }
      }
    })
  } else {
    root.querySelector('[data-testid="mood-chart"]').insertAdjacentHTML('afterend', '<p class="muted">Mood lines appear after you mark a feeling on your own dreams.</p>')
  }

  const themes = listThemes(state.dreams, state.settings?.themeEdits)
  const themeGroups = root.querySelector('[data-testid="theme-groups"]')
  themeGroups.innerHTML = themesByGroup(themes).map((group) => `<section data-testid="theme-group-${group.id}">
    <h3>${esc(group.label)}</h3>
    ${group.items.length ? `<ul class="theme-list">${group.items.map((item) => `<li>
      <a href="#/theme/${esc(item.id)}" data-testid="theme-link">${item.pinned ? '<em class="badge">Pinned</em> ' : ''}${esc(item.name)} <span class="muted">${item.count}</span></a>
      <span class="fine">${esc(item.trend)}</span>
    </li>`).join('')}</ul>` : '<p class="muted">None yet.</p>'}
  </section>`).join('')

  const groups = recurringGroups(state.dreams)
  const recurring = root.querySelector('[data-testid="recurring"]')
  recurring.innerHTML = groups.length
    ? groups.map((group) => `<article class="card">
        <h3>Likely the same dream, returning</h3>
        <ul>${group.map((dream) => `<li><a href="#/dream/${esc(dream.id)}">${esc(formatDay(dream.datetime))} · ${esc(displayTitle(dream))}</a></li>`).join('')}</ul>
        <p class="muted">Shared words: ${esc(groupWords(group).join(', ') || 'a similar thread')}</p>
      </article>`).join('')
    : '<p class="muted">When two dreams share enough words, they will be flagged here as likely recurring. You can also add the Recurring label yourself.</p>'

  const buckets = bedtimeBuckets(state.dreams)
  const tableHost = root.querySelector('[data-testid="correlation-table"]')
  if (buckets.length) {
    make(root.querySelector('[data-testid="factor-chart"]'), {
      type: 'bar',
      data: {
        labels: buckets.map((bucket) => bucket.label),
        datasets: [{
          label: 'Nightmare share',
          data: buckets.map((bucket) => Math.round(bucket.share * 100)),
          backgroundColor: '#e0a8b8',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` }, grid: { color: 'rgba(214,196,255,0.12)' } },
          x: { grid: { display: false }, ticks: { maxRotation: 40, minRotation: 0 } }
        }
      }
    })
    tableHost.innerHTML = `<table>
      <caption>Nightmare share by bedtime factor</caption>
      <thead><tr><th>Factor</th><th>Dreams</th><th>Nightmares</th></tr></thead>
      <tbody>${buckets.map((bucket) => `<tr><td>${esc(bucket.label)}</td><td>${bucket.count}</td><td>${bucket.nightmares}</td></tr>`).join('')}</tbody>
    </table>`
  } else {
    tableHost.innerHTML = '<p class="muted">Bedtime factors are optional. When you note them, this chart compares them with nightmares.</p>'
  }

  const recap = root.querySelector('[data-testid="month-recap"]')
  const select = root.querySelector('[data-testid="month-select"]')
  function showMonth() {
    const data = monthRecap(state.dreams, select.value)
    const selfLine = monthSelfLine(state.dreams, select.value)
    recap.innerHTML = `<p>${esc(data.prose)}</p>${selfLine ? `<p data-testid="month-self">${esc(selfLine)}</p>` : ''}${data.titles.length ? `<ul>${data.titles.map((title) => `<li>${esc(title)}</li>`).join('')}</ul>` : ''}`
  }
  select.addEventListener('change', showMonth)
  showMonth()

  return () => {
    for (const chart of charts) chart.destroy()
  }
}
