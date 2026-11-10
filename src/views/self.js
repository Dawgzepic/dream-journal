import Chart from 'chart.js/auto'
import { saveSettings } from '../db.js'
import { formatWhen } from '../lib/format.js'
import { applySnapshot, buildProfile, cleanPersonality, MIN_DREAMS, QUIZ } from '../lib/personality.js'
import { listThemes } from '../lib/themes.js'
import { state } from '../state.js'
import { esc } from '../ui.js'

const WHEEL_COLORS = ['#cbb6ff', '#e4d2a4', '#e0a8b8', '#a9cbb8', '#8fa4c4', '#d0a6de', '#9bb7d4', '#f6f1e8']

export function mountSelf(root) {
  const store = cleanPersonality(state.settings?.personality)
  const profile = buildProfile(state.dreams, store)
  const saved = applySnapshot(store, profile)
  if (saved.history.length !== store.history.length || saved.history.at(-1)?.signature !== store.history.at(-1)?.signature) {
    state.settings.personality = saved
    saveSettings(state.settings).catch(() => {})
  }
  const personality = saved
  let quizIndex = Math.max(0, QUIZ.findIndex((question) => !personality.answers[question.id]))
  if (quizIndex < 0) quizIndex = 0
  const charts = []

  function draw() {
    for (const chart of charts) chart.destroy()
    charts.length = 0
    const current = buildProfile(state.dreams, personality)
    const question = QUIZ[quizIndex]
    const answered = QUIZ.filter((item) => personality.answers[item.id] === 'yes' || personality.answers[item.id] === 'no').length
    const skipped = QUIZ.filter((item) => personality.answers[item.id] === 'skip').length
    root.innerHTML = `<div class="page">
      <p class="brand-mobile eyebrow">Dream Journal</p>
      <h1>You</h1>
      <p class="lede">A personality sketch from the quiz and from dreams you have logged. It stays on this device.</p>
      <p class="fine" data-testid="self-note">This is a reflection, not a diagnosis, and it does not predict the future.</p>
      ${current.ready ? profileHtml(current, personality) : progressHtml(current)}
      ${quizHtml(question, answered, skipped)}
    </div>`
    wire(current)
    if (current.ready) drawCharts(current)
  }

  function themeCard() {
    const themes = listThemes(state.dreams, state.settings?.themeEdits).slice(0, 6)
    if (!themes.length) return ''
    return `<section class="card" data-testid="self-themes">
      <h2>Themes that return</h2>
      <p>${themes.map((item) => `<a href="#/theme/${esc(item.id)}">${esc(item.name)}</a>`).join(', ')}</p>
    </section>`
  }

  function progressHtml(current) {
    return `<section class="card" data-testid="self-progress">
      <h2>${current.dreamCount} of ${MIN_DREAMS} dreams</h2>
      <p>The full profile opens at ${MIN_DREAMS} of your own dreams. The sample does not count. The quiz can be taken now, and it will be waiting when the profile opens.</p>
    </section>`
  }

  function profileHtml(current, source) {
    const history = source.history || []
    return `<section data-testid="self-profile">
      <section class="card" data-testid="self-shape">
        <h2>The shape of it</h2>
        ${current.shape.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}
      </section>
      <section class="card">
        <h2>Dream character</h2>
        <p>${esc(current.character)}</p>
        <p>${esc(current.signLine)}</p>
        <p>${esc(current.styleLine)}</p>
        ${current.quizLine ? `<p>${esc(current.quizLine)}</p>` : ''}
      </section>
      <section>
        <h2>Traits</h2>
        <div class="self-bars" data-testid="trait-bars">
          ${current.traits.map((trait) => `<div class="bar-row"><span>${esc(trait.label)}</span><div class="bar-track"><span style="width:${trait.score}%"></span></div><em>${trait.score}</em></div><p>${esc(trait.sentence)}</p>`).join('')}
        </div>
      </section>
      <section class="card">
        <h2>Strengths and blind spots</h2>
        ${current.strengths.map((line) => `<p>${esc(line)}</p>`).join('')}
        ${current.gaps.map((line) => `<p>${esc(line)}</p>`).join('')}
      </section>
      <section class="card" data-testid="self-lately">
        <h2>On your mind lately</h2>
        <p>${esc(current.lately || 'Log a few more nights and this will name them.')}</p>
      </section>
      ${themeCard()}
      <section>
        <h2>Charts</h2>
        <div class="chart-box"><canvas data-testid="trait-radar" aria-label="Trait radar"></canvas></div>
        <div class="chart-box wheel"><canvas data-testid="archetype-wheel" aria-label="Archetype wheel"></canvas></div>
        <p class="muted">The wheel leans toward ${esc(current.archetype.name)}. No trend line is drawn. Change over time is the dated list below.</p>
      </section>
      <section>
        <h2>How this has changed</h2>
        ${history.length ? `<ol class="timeline-list" data-testid="profile-timeline">${history.map((row) => `<li><time datetime="${esc(row.at)}">${esc(formatWhen(row.at))}</time> ${esc(row.archetype)}, ${esc(row.style)}, ${row.dreamCount} dreams. ${esc(row.headline)}</li>`).join('')}</ol>` : '<p class="muted">The first snapshot is saved with this visit.</p>'}
      </section>
    </section>`
  }

  function quizHtml(question, answered, skipped) {
    const choice = personality.answers[question.id] || ''
    return `<section class="card" data-testid="self-quiz">
      <h2>Personality quiz</h2>
      <p class="muted" data-testid="quiz-count">${answered} answered, ${skipped} skipped, of ${QUIZ.length}. You can skip any question and retake the whole quiz.</p>
      <p data-testid="quiz-prompt">${esc(question.prompt)}</p>
      <div class="chips">
        <button type="button" class="chip" data-testid="quiz-yes" aria-pressed="${choice === 'yes'}">Yes</button>
        <button type="button" class="chip" data-testid="quiz-no" aria-pressed="${choice === 'no'}">No</button>
        <button type="button" class="chip" data-testid="quiz-skip" aria-pressed="${choice === 'skip'}">Skip</button>
      </div>
      <div class="row wrap">
        <button type="button" class="btn secondary" data-testid="quiz-back" ${quizIndex === 0 ? 'disabled' : ''}>Back</button>
        <button type="button" class="btn secondary" data-testid="quiz-next" ${quizIndex >= QUIZ.length - 1 ? 'disabled' : ''}>Next</button>
        <button type="button" class="text-link" data-testid="quiz-retake">Retake quiz</button>
      </div>
      <p class="save-status" data-testid="quiz-status">Answers save on this device.</p>
    </section>`
  }

  function drawCharts(current) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    Chart.defaults.font.family = '"EB Garamond Variable", Palatino, serif'
    Chart.defaults.color = '#b7adc6'
    Chart.defaults.animation = reduced ? false : { duration: 400 }
    const labels = current.traits.map((trait) => trait.label)
    const scores = current.traits.map((trait) => trait.score)
    const radar = root.querySelector('[data-testid="trait-radar"]')
    const wheel = root.querySelector('[data-testid="archetype-wheel"]')
    if (radar) {
      charts.push(new Chart(radar, {
        type: 'radar',
        data: { labels, datasets: [{ data: scores, borderColor: '#cbb6ff', backgroundColor: 'rgba(203,182,255,0.28)', pointBackgroundColor: '#e4d2a4' }] },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              min: 0,
              max: 100,
              ticks: { display: false },
              grid: { color: 'rgba(214,196,255,0.2)' },
              angleLines: { color: 'rgba(214,196,255,0.2)' },
              pointLabels: { color: '#f6f1e8', font: { size: 12 } }
            }
          }
        }
      }))
    }
    if (wheel) {
      charts.push(new Chart(wheel, {
        type: 'doughnut',
        data: {
          labels: current.archetypes.map((item) => item.name),
          datasets: [{ data: current.archetypes.map((item) => Math.max(item.score, 0.2)), backgroundColor: WHEEL_COLORS, borderColor: '#1c1628', borderWidth: 2 }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '58%' }
      }))
    }
  }

  async function choose(value) {
    const question = QUIZ[quizIndex]
    personality.answers[question.id] = value
    state.settings.personality = personality
    const status = root.querySelector('[data-testid="quiz-status"]')
    try {
      await saveSettings(state.settings)
      if (status) status.textContent = 'Saved'
    } catch {
      if (status) status.textContent = 'Could not save on this device.'
    }
    if (value !== 'stay' && quizIndex < QUIZ.length - 1) quizIndex += 1
    draw()
  }

  function wire() {
    root.querySelector('[data-testid="quiz-yes"]')?.addEventListener('click', () => choose('yes'))
    root.querySelector('[data-testid="quiz-no"]')?.addEventListener('click', () => choose('no'))
    root.querySelector('[data-testid="quiz-skip"]')?.addEventListener('click', () => choose('skip'))
    root.querySelector('[data-testid="quiz-back"]')?.addEventListener('click', () => {
      quizIndex = Math.max(0, quizIndex - 1)
      draw()
    })
    root.querySelector('[data-testid="quiz-next"]')?.addEventListener('click', () => {
      quizIndex = Math.min(QUIZ.length - 1, quizIndex + 1)
      draw()
    })
    root.querySelector('[data-testid="quiz-retake"]')?.addEventListener('click', async () => {
      personality.answers = {}
      quizIndex = 0
      state.settings.personality = personality
      await saveSettings(state.settings).catch(() => {})
      draw()
    })
  }

  draw()
  return () => {
    for (const chart of charts) chart.destroy()
  }
}
