import { findSymbols, uniqueSymbols } from '../lib/analyze.js'
import { interpretationPrompt, imagePrompt } from '../lib/ai.js'
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
  let depth = 'short'
  let highlighted = false
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
    const prompt = interpretationPrompt(dream, depth, symbols)
    const picture = imagePrompt(dream)
    root.innerHTML = `<div class="page">
      <a class="back" href="#/dream/${esc(dream.id)}">Back to the dream</a>
      ${dream.isSample ? '<p class="badge">Sample</p>' : ''}
      <h1>Meanings</h1>
      <p class="lede">For <em>${esc(displayTitle(dream))}</em>. Choose short or detailed each time. Nothing on this page is sent anywhere.</p>
      <div class="len-toggle">
        <button type="button" data-depth="short" data-testid="depth-short" aria-pressed="${depth === 'short'}">Short</button>
        <button type="button" data-depth="detailed" data-testid="depth-detailed" aria-pressed="${depth === 'detailed'}">Detailed</button>
      </div>
      <button type="button" class="btn secondary" data-testid="highlight-symbols">${highlighted ? 'Hide symbol highlights' : 'Highlight symbols'}</button>
      <article class="prose dream-text" data-testid="meaning-story">${renderStory(dream.story || '', adjusted)}</article>
      <section data-testid="symbol-list">
        ${shown.length ? shown.map((symbol) => `<article class="card symbol-card ${active === symbol.id ? 'on' : ''}" data-symbol-card="${esc(symbol.id)}" data-testid="symbol-card">
          <h2>${esc(symbol.name)}</h2>
          <p><span class="eyebrow">Psychology</span> ${esc(depth === 'detailed' ? symbol.psych : firstSentence(symbol.psych))}</p>
          <p><span class="eyebrow">Folklore</span> ${esc(depth === 'detailed' ? symbol.folk : firstSentence(symbol.folk))}</p>
        </article>`).join('') : highlighted ? '<p class="muted">None of the dictionary symbols appear in this dream as whole words. You can still copy a prompt.</p>' : '<p class="muted">Symbols stay quiet until you ask for them. The dictionary holds common images, each with a psychology reading and a folklore reading. They are ideas, not a diagnosis.</p>'}
      </section>
      <section class="card">
        <h2>Ask without sending</h2>
        <p>This builds a prompt on your device. It includes the dream, the depth you chose, and both the psychology and folklore angles.</p>
        <textarea data-testid="ai-prompt" readonly rows="8"></textarea>
        <button type="button" class="btn primary" data-testid="copy-interpretation">Copy interpretation prompt</button>
        <p class="paste-note">Paste this to Grokel</p>
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
