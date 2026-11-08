import { symbolCounts } from '../lib/analyze.js'
import { odditySigns } from '../lib/details.js'
import { userDreams } from '../lib/dreams.js'
import { state } from '../state.js'
import { esc } from '../ui.js'

export function mountLucid(root) {
  const own = userDreams(state.dreams)
  const lucid = own.filter((dream) => (dream.tags || []).includes('Lucid'))
  const counts = symbolCounts(state.dreams)
  const signs = counts.filter((row) => row.count >= 2).slice(0, 6)
  const oddities = odditySigns(state.dreams)
  const emerging = counts.filter((row) => row.count === 1).slice(0, 4)
  root.innerHTML = `<div class="page">
    <p class="brand-mobile eyebrow">Dream Journal</p>
    <h1>Lucid dreaming</h1>
    <p class="lede">A beginner’s practice of noticing. No special talent is required, and none of this is sent anywhere.</p>
    <section class="card counter">
      <p class="big-num" data-testid="lucid-count">${lucid.length}</p>
      <p>${lucid.length === 1 ? 'lucid dream logged' : 'lucid dreams logged'}</p>
      <p class="muted">Mark a dream with the Lucid label when you knew you were dreaming, even for a moment.</p>
    </section>
    <section>
      <h2>Your dream signs</h2>
      <p>A dream sign is an image that shows up often enough to become a cue. When it appears during the day, do a reality check. When it appears in a dream, it can remind you that you are asleep.</p>
      ${signs.length ? `<ul class="sign-list" data-testid="dream-signs">${signs.map((row) => `<li><strong>${esc(row.symbol.name)}</strong> in ${row.count} dreams</li>`).join('')}</ul>` : '<p class="muted" data-testid="dream-signs">As you log dreams, symbols that repeat will be listed here.</p>'}
      ${oddities.length ? `<p>Oddities you noted, useful as dream signs:</p><ul class="sign-list" data-testid="oddity-signs">${oddities.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}
      ${emerging.length ? `<p class="muted">Showing up once so far: ${esc(emerging.map((row) => row.symbol.name.toLowerCase()).join(', '))}.</p>` : ''}
    </section>
    <section class="card">
      <h2>Try this week</h2>
      <ol>
        <li>Do a reality check whenever something odd happens, and whenever you open this journal outside work hours.</li>
        <li>In the morning, write the dream before you pick up anything else.</li>
        <li>Once, on a morning you can sleep in, try wake back to bed with the MILD line below.</li>
      </ol>
    </section>
    <details open>
      <summary>Reality checks</summary>
      <p>The aim is a sincere question, not a habit your hands perform while your mind is elsewhere. Five to ten checks a day is plenty.</p>
      <ul>
        <li><strong>Hands.</strong> Count your fingers. In dreams the number often shifts when you look again.</li>
        <li><strong>Text.</strong> Read a line, look away, and read it again. Dream text rarely stays still.</li>
        <li><strong>Nose.</strong> Pinch your nose and try to breathe. In a dream you often still can.</li>
        <li><strong>Arrival.</strong> Ask how you got into this room. A missing story is a sign.</li>
      </ul>
    </details>
    <details>
      <summary>MILD</summary>
      <p>Mnemonic induction is a way of intending to notice the next dream from the inside. It is quiet, and it pairs well with a journal.</p>
      <ol>
        <li>When you wake from a dream, recall it briefly and write a line if you can.</li>
        <li>As you return to sleep, repeat one sentence: “Next time I dream, I will remember I am dreaming.”</li>
        <li>Picture yourself back in that dream, noticing a dream sign, and realizing you are asleep.</li>
        <li>If your mind wanders, return to the sentence. Force is not required.</li>
      </ol>
    </details>
    <details>
      <summary>Wake back to bed</summary>
      <p>This is tiring. Use it on a morning when you can sleep again, not before a day you need to be sharp.</p>
      <ol>
        <li>Sleep for about four to six hours.</li>
        <li>Wake and stay up for 15 to 30 minutes. Keep the light low. Read this page or your last dream.</li>
        <li>Go back to bed with the intention to notice the next dream from the inside.</li>
        <li>Use the MILD sentence as you drift.</li>
      </ol>
    </details>
    <details>
      <summary>What a dream sign is good for</summary>
      <p>You do not have to become lucid for the list to matter. A sign is also a theme: water, teeth, the old house. Seeing it on the page is already a way of knowing your nights. Lucidity, when it comes, is that same recognition happening before you wake.</p>
    </details>
  </div>`
  return () => {}
}
