import { findSymbols, promptSymbols, uniqueSymbols } from '../lib/analyze.js'
import { interpretationPrompt, imagePrompt } from '../lib/ai.js'
import { fullInterpretation } from '../lib/interpret.js'
import { displayTitle } from '../lib/dreams.js'
import { firstSentence } from '../lib/format.js'
import { symbolById } from '../lib/symbols.js'
import { state } from '../state.js'
import { copyText, esc, renderStory, toast } from '../ui.js'

export function mountMeaning(root, route) {
  const dream = state.dreams.find((item) => item.id === route.id)
  if (!dream) {
    root.innerHTML = `<div class="page"><h1>That dream is not here</h1><p><a href="#/journal">Back to the journal</a></p></div>`
    return () => {}
  }
  if (dream.isFragments) {
    root.innerHTML = `<div class="page">
      <a class="back" href="#/dream/${esc(dream.id)}">Back to the dream</a>
      <h1>Meanings</h1>
      <p data-testid="fragments-note">A night of fragments — lots of dreaming, little to hold onto.</p>
      ${dream.story ? `<article class="prose">${esc(dream.story).replaceAll('\n', '<br>')}</article>` : ''}
    </div>`
    return () => {}
  }
  let depth = 'short'
  let highlighted = false
  let notesOpen = false
  let active = ''

  function draw() {
    const y = window.scrollY
    const text = `${dream.title}\n${dream.story || ''}`
    const ranges = highlighted ? findSymbols(text).filter((range) => range.start >= (dream.title.length + 1)) : []
    const adjusted = ranges.map((range) => ({
      ...range,
      start: range.start - dream.title.length - 1,
      end: range.end - dream.title.length - 1
    })).filter((range) => range.start >= 0)
    const symbols = uniqueSymbols(findSymbols(`${dream.title}\n${dream.story || ''}`))
    const shown = highlighted ? symbols : []
    const prompt = interpretationPrompt(dream, depth, promptSymbols(`${dream.title}\n${dream.story || ''}`))
    const picture = imagePrompt(dream)
    const reading = fullInterpretation(dream, depth)
    root.innerHTML = `<div class="page">
      <a class="back" href="#/dream/${esc(dream.id)}">Back to the dream</a>
      ${dream.isSample ? '<p class="badge">Sample</p>' : ''}
      <h1>Meanings</h1>
      <p class="lede">For <em>${esc(displayTitle(dream))}</em>. Choose short or detailed each time. Nothing on this page is sent anywhere.</p>
      <div class="len-toggle">
        <button type="button" data-depth="short" data-testid="depth-short" aria-pressed="${depth === 'short'}">Short</button>
        <button type="button" data-depth="detailed" data-testid="depth-detailed" aria-pressed="${depth === 'detailed'}">Detailed</button>
      </div>
      <section class="card reading" data-testid="full-interpretation">
        <h2>Full interpretation</h2>
        ${readingParagraphs(reading)}
      </section>
      <button type="button" class="btn secondary" data-testid="highlight-symbols">${highlighted ? 'Hide symbol highlights' : 'Highlight symbols'}</button>
      <article class="prose dream-text" data-testid="meaning-story">${renderStory(dream.story || '', adjusted)}</article>
      <details class="card symbol-notes" data-testid="symbol-notes" ${notesOpen ? 'open' : ''}>
        <summary>Symbol notes</summary>
        <section data-testid="symbol-list">
          ${shown.length ? shown.map((symbol) => `<article class="card symbol-card ${active === symbol.id ? 'on' : ''}" data-symbol-card="${esc(symbol.id)}" data-testid="symbol-card">
            <h2>${esc(symbol.name)}</h2>
            <p><span class="eyebrow">Psychology</span> ${esc(depth === 'detailed' ? symbol.psych : firstSentence(symbol.psych))}</p>
            <p><span class="eyebrow">Folklore</span> ${esc(depth === 'detailed' ? symbol.folk : firstSentence(symbol.folk))}</p>
          </article>`).join('') : highlighted ? '<p class="muted">None of the dictionary symbols appear in this dream as whole words. You can still copy a prompt.</p>' : '<p class="muted">These are notes on single images, not the reading of the dream. They stay quiet until you ask for highlights. Each note is an idea, not a diagnosis.</p>'}
        </section>
      </details>
      <section class="card">
        <h2>Want a deeper AI reading?</h2>
        <p>Copy this and paste it to Grokel in the Grok Bot app.</p>
        <p class="fine">The text in the box is a request for an AI, not the reading itself.</p>
        <textarea data-testid="ai-prompt" readonly rows="8"></textarea>
        <button type="button" class="btn primary" data-testid="copy-interpretation">Copy interpretation prompt</button>
      </section>
      <section class="card">
        <h2>AI dream picture</h2>
        <p>A prompt for an image, also built here. No picture is requested from the network.</p>
        <textarea data-testid="image-prompt" readonly rows="6"></textarea>
        <button type="button" class="btn secondary" data-testid="copy-image">Copy image prompt</button>
        <p class="paste-note">Paste this to Grokel</p>
      </section>
    </div>`
    root.querySelector('[data-testid="ai-prompt"]').value = prompt
    root.querySelector('[data-testid="image-prompt"]').value = picture
    root.querySelector('[data-testid="symbol-notes"]').addEventListener('toggle', (event) => {
      notesOpen = event.currentTarget.open
    })
    root.querySelector('[data-testid="highlight-symbols"]').addEventListener('click', () => {
      highlighted = !highlighted
      draw()
    })
    root.querySelector('[data-depth="short"]').addEventListener('click', () => { depth = 'short'; draw() })
    root.querySelector('[data-depth="detailed"]').addEventListener('click', () => { depth = 'detailed'; draw() })
    root.querySelector('[data-testid="copy-interpretation"]').addEventListener('click', () => copyPrompt(prompt, root.querySelector('[data-testid="copy-interpretation"]')))
    root.querySelector('[data-testid="copy-image"]').addEventListener('click', () => copyPrompt(picture, root.querySelector('[data-testid="copy-image"]')))
    window.scrollTo(0, y)
  }

  function readingParagraphs(reading) {
    return reading.split('\n\n').map((para) => {
      if (para.startsWith('Putting it together:')) {
        return `<p><strong>Putting it together.</strong> ${esc(para.slice('Putting it together:'.length).trim())}</p>`
      }
      if (para.startsWith('This is a reflection')) return `<p class="fine">${esc(para)}</p>`
      return `<p>${esc(para)}</p>`
    }).join('')
  }

  function onSymbol(event) {
    const button = event.target.closest('button.symbol')
    if (!button) return
    active = button.dataset.symbol
    const symbol = symbolById(active)
    if (!symbol) return
    const card = root.querySelector(`[data-symbol-card="${CSS.escape(active)}"]`)
    root.querySelectorAll('.symbol-card').forEach((el) => el.classList.toggle('on', el === card))
    card?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' })
  }

  async function copyPrompt(text, button) {
    const ok = await copyText(text)
    if (ok) {
      button.textContent = 'Copied'
      toast('Copied')
    } else button.textContent = 'Select the text below'
    setTimeout(() => {
      if (!button.isConnected) return
      button.textContent = button.dataset.testid === 'copy-image' ? 'Copy image prompt' : 'Copy interpretation prompt'
    }, 2000)
  }

  draw()
  root.addEventListener('click', onSymbol)
  return () => root.removeEventListener('click', onSymbol)
}
