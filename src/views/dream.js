import { deleteDream } from '../db.js'
import { screenLabel } from '../lib/constants.js'
import { displayTitle } from '../lib/dreams.js'
import { formatWhen } from '../lib/format.js'
import { go } from '../runtime.js'
import { state } from '../state.js'
import { confirmModal, esc, toast } from '../ui.js'

export function mountDream(root, route) {
  const dream = state.dreams.find((item) => item.id === route.id)
  if (!dream) {
    root.innerHTML = `<div class="page"><h1>That dream is not here</h1><p><a class="text-link" href="#/journal">Back to the journal</a></p></div>`
    return () => {}
  }
  const bed = dream.bedtime || {}
  const bedBits = []
  if (bed.food) bedBits.push(`Food or snacks: ${bed.food}`)
  if (bed.substance) bedBits.push(`Caffeine or alcohol: ${bed.substance}`)
  if (bed.stress) bedBits.push(`Stress: ${bed.stress} of 5`)
  if (bed.screen) bedBits.push(`Screen time: ${screenLabel(bed.screen)}`)
  root.innerHTML = `<div class="page">
    <a class="back" href="#/journal">Back to journal</a>
    ${dream.isSample ? '<p class="sample-note" data-testid="sample-banner">This is a sample dream, here so the journal is not empty on the first night. You can delete it.</p>' : ''}
    ${dream.isDraft ? '<p class="sample-note">This is a draft. You can finish it when you are more awake.</p>' : ''}
    <h1 data-testid="dream-title-view">${esc(displayTitle(dream))}</h1>
    <p class="when">${esc(formatWhen(dream.datetime))}</p>
    <div class="meta">
      ${dream.moodsDuring?.length ? `<p><span>During</span> ${dream.moodsDuring.map(esc).join(', ')}</p>` : ''}
      ${dream.moodAfter ? `<p><span>After waking</span> ${esc(dream.moodAfter)}</p>` : ''}
      ${dream.clarity ? `<p><span>Memory</span> ${esc(dream.clarity)}</p>` : ''}
      ${dream.tags?.length ? `<p><span>Labels</span> ${dream.tags.map(esc).join(', ')}</p>` : ''}
    </div>
    <article class="prose">${esc(dream.story || '').replaceAll('\n', '<br>')}</article>
    ${dream.events ? `<section class="card"><h2>Linked to waking life</h2><p>${esc(dream.events)}</p></section>` : ''}
    ${bedBits.length ? `<section class="card"><h2>Before bed</h2><p>${bedBits.map(esc).join('<br>')}</p></section>` : ''}
    <div class="row wrap">
      <a class="btn primary" href="#/dream/${esc(dream.id)}/meaning" data-testid="open-meaning">Meanings</a>
      <a class="btn secondary" href="#/edit/${esc(dream.id)}">Edit</a>
      <button type="button" class="btn danger" data-testid="delete-dream">Delete</button>
    </div>
  </div>`
  root.querySelector('[data-testid="delete-dream"]').addEventListener('click', async () => {
    const ok = await confirmModal({
      title: dream.isSample ? 'Delete the sample dream?' : 'Delete this dream?',
      body: 'This removes it from the journal on this device. A backup you already exported will still contain it.',
      confirmLabel: 'Delete',
      danger: true,
      testid: 'confirm-delete'
    })
    if (!ok) return
    await deleteDream(dream.id)
    toast('Dream deleted')
    go('#/journal')
  })
  return () => {}
}
