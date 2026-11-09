import { detailSummaryLines } from './details.js'
import { userDreams } from './dreams.js'
import { monthKeyFromDate } from './format.js'

export const MIN_DREAMS = 5

const TRAITS = [
  ['openness', 'Openness'],
  ['conscientiousness', 'Conscientiousness'],
  ['extraversion', 'Extraversion'],
  ['agreeableness', 'Agreeableness'],
  ['sensitivity', 'Sensitivity']
]

const ARCHETYPES = [
  ['caregiver', 'Caregiver'],
  ['explorer', 'Explorer'],
  ['hero', 'Hero'],
  ['sage', 'Sage'],
  ['rebel', 'Rebel'],
  ['everyperson', 'Everyperson'],
  ['dreamer', 'Dreamer'],
  ['guardian', 'Guardian']
]

const OPPOSITE = { E: 'I', I: 'E', S: 'N', N: 'S', T: 'F', F: 'T', J: 'P', P: 'J' }

const RAW_QUIZ = [
  ['openness', 1, 'I notice small changes in a room before other people mention them.'],
  ['openness', 1, 'A strange dream is something I want to understand, not forget.'],
  ['openness', 1, 'I would rather try a new way home than the usual one.'],
  ['openness', 1, 'Stories with impossible events interest me more than strictly realistic ones.'],
  ['openness', 1, 'I keep objects because of the memory attached to them.'],
  ['openness', 1, 'I like a question that does not have one clean answer.'],
  ['conscientiousness', 1, 'I finish a small task before I start the next one.'],
  ['conscientiousness', 1, 'I write things down so they do not slip.'],
  ['conscientiousness', 1, 'A messy room bothers me until I put it right.'],
  ['conscientiousness', 1, 'I arrive when I said I would.'],
  ['conscientiousness', 1, 'I check a detail twice when it matters.'],
  ['conscientiousness', 1, 'Leaving something half-done nags at me.'],
  ['extraversion', 1, 'A long conversation gives me energy.'],
  ['extraversion', 1, 'I speak up in a group before the silence gets heavy.'],
  ['extraversion', 1, 'I would rather tell a story out loud than only write it.'],
  ['extraversion', 1, 'Meeting someone new is usually a good part of the day.'],
  ['extraversion', 1, 'I look for company when the day was hard.'],
  ['extraversion', -1, 'A quiet room is where I get my energy back.'],
  ['agreeableness', 1, 'I will change a small plan to keep the peace.'],
  ['agreeableness', 1, 'I notice when someone in the room has been left out.'],
  ['agreeableness', 1, 'I would rather mend a quarrel than win it.'],
  ['agreeableness', 1, 'People can tell me the unpolished version of a story.'],
  ['agreeableness', -1, 'I say the hard thing even when it stings.'],
  ['agreeableness', 1, 'I look after the practical needs of people I love.'],
  ['sensitivity', 1, 'A sharp tone stays with me for hours.'],
  ['sensitivity', 1, 'I replay a mistake more than once.'],
  ['sensitivity', 1, 'My body tells me I am worried before I have named it.'],
  ['sensitivity', -1, 'I can set a worry down and come back to it later.'],
  ['sensitivity', 1, 'Bad news lands in my body, not only in my thoughts.'],
  ['sensitivity', 1, 'Unfinished business makes my sleep worse.'],
  ['E', 1, 'I think by talking.'],
  ['I', 1, 'I think by going quiet first.'],
  ['E', 1, 'After a full day with people I often want more time with them.'],
  ['I', 1, 'After a full day with people I want a closed door.'],
  ['S', 1, 'I trust what I can point at.'],
  ['N', 1, 'I trust the pattern under the facts.'],
  ['S', 1, 'I describe a dream by the objects in it.'],
  ['N', 1, 'I describe a dream by what it seemed to mean.'],
  ['T', 1, 'I decide by what holds together logically.'],
  ['F', 1, 'I decide by who will be hurt or helped.'],
  ['T', 1, 'A fair rule matters more to me than a kind exception.'],
  ['F', 1, 'A kind exception matters more to me than a strict rule.'],
  ['J', 1, 'I like the day decided before it starts.'],
  ['P', 1, 'I like room to change the day as it happens.'],
  ['J', 1, 'A deadline makes my work better.'],
  ['P', 1, 'I do my best work when I can wander up to it.'],
  ['caregiver', 1, 'I stay with someone who is having a hard time until they are steadier.'],
  ['explorer', 1, 'I want to see what is past the next turn.'],
  ['hero', 1, 'When something is wrong I move, even if the move is small.'],
  ['sage', 1, 'I would rather understand a problem than rush to fix it.'],
  ['rebel', 1, 'I push back when a rule is only there out of habit.'],
  ['everyperson', 1, 'Ordinary rooms and ordinary meals are enough for me.'],
  ['dreamer', 1, 'A lot of my inner life happens in images and what-ifs.'],
  ['guardian', 1, 'I watch the door, and I watch the people I love.']
]

export const QUIZ = RAW_QUIZ.map(([dimension, dir, prompt], index) => ({
  id: `q${String(index + 1).padStart(2, '0')}`,
  dimension,
  dir,
  prompt
}))

const BIG_FIVE = new Set(TRAITS.map(([id]) => id))
const STYLE_LETTERS = new Set(Object.keys(OPPOSITE))
const ARCH_IDS = new Set(ARCHETYPES.map(([id]) => id))

export function cleanPersonality(raw) {
  const answers = {}
  const source = raw && typeof raw === 'object' ? raw.answers : null
  if (source && typeof source === 'object') {
    for (const question of QUIZ) {
      const value = source[question.id]
      if (value === 'yes' || value === 'no' || value === 'skip') answers[question.id] = value
    }
  }
  const history = []
  const rows = Array.isArray(raw?.history) ? raw.history : []
  for (const row of rows.slice(-24)) {
    if (!row || typeof row !== 'object') continue
    if (typeof row.at !== 'string' || typeof row.signature !== 'string') continue
    history.push({
      at: row.at,
      signature: row.signature.slice(0, 240),
      dreamCount: Number(row.dreamCount) || 0,
      style: String(row.style || '').slice(0, 40),
      archetype: String(row.archetype || '').slice(0, 40),
      headline: String(row.headline || '').slice(0, 280)
    })
  }
  return { answers, history }
}

function titleOf(dream) {
  return (dream.title || 'Untitled').trim()
}

function blob(dream) {
  const details = detailSummaryLines(dream).join(' ')
  return `${dream.title || ''} ${dream.story || ''} ${dream.events || ''} ${details}`.toLowerCase()
}

function moodsOf(dream) {
  return [...(dream.moodsDuring || []), dream.moodAfter].filter(Boolean)
}

function dreamClause(dream) {
  const text = blob(dream)
  const name = titleOf(dream)
  if (/speck|flea|linen|dog bed/.test(text)) {
    return `In ${name}, specks on a dog's bed become a pile and you throw the linen out the window.`
  }
  if (/coast to coast|stuck for the ride|boxcar/.test(text)) {
    return `In ${name}, you get on for a short trip and the train carries you much farther, while the way home gets longer as you wait to jump.`
  }
  if (/crash|argu|shout/.test(text) && /car/.test(text)) {
    return `In ${name}, cars crash while people argue, and you get away through the trees.`
  }
  if (/\btrain\b/.test(text)) return `In ${name}, a train comes through the scene.`
  if (/exam|school|teeth/.test(text)) return `In ${name}, school and teeth put you on the spot.`
  if (/grandmother|garden|moon/.test(text)) return `In ${name}, a garden, a grandmother, and the moon share the same quiet.`
  if (/fall|flying|childhood/.test(text)) return `In ${name}, the ground or the air stops behaving in the ordinary way.`
  return ''
}

function signHits(dreams) {
  const counts = { hearth: 0, road: 0, tide: 0, spark: 0 }
  for (const dream of dreams) {
    const text = blob(dream)
    if (/bed|home|linen|dog|kitchen/.test(text)) counts.hearth += 1
    if (/train|journey|road|car|coast/.test(text)) counts.road += 1
    if (/water|sea|ocean|rain/.test(text)) counts.tide += 1
    if (/argu|crash|shout|fire|anger/.test(text)) counts.spark += 1
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const [id, count] = ranked[0]
  const names = { hearth: 'The Hearth', road: 'The Road', tide: 'The Tide', spark: 'The Spark' }
  return { id, name: names[id], count }
}

function emptyScores() {
  return { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, sensitivity: 0 }
}

function dreamTraitLean(dreams) {
  const lean = emptyScores()
  const arch = Object.fromEntries(ARCHETYPES.map(([id]) => [id, 0]))
  if (!dreams.length) return { lean, arch, answeredDreams: 0 }
  for (const dream of dreams) {
    const text = blob(dream)
    const moods = moodsOf(dream).map((mood) => mood.toLowerCase())
    if (/speck|flea|linen|dog bed/.test(text)) {
      lean.agreeableness += 0.45
      lean.conscientiousness += 0.35
      lean.openness += 0.2
      arch.caregiver += 2
      arch.hero += 2
      arch.everyperson += 1
    }
    if (/coast to coast|stuck for the ride|boxcar/.test(text)) {
      lean.openness += 0.4
      lean.sensitivity += 0.3
      lean.extraversion -= 0.15
      arch.explorer += 3
      arch.hero += 1
    } else if (/\btrain\b/.test(text)) {
      lean.openness += 0.2
      arch.explorer += 1
    }
    if (/crash|argu|shout/.test(text)) {
      lean.agreeableness -= 0.25
      lean.extraversion += 0.2
      lean.sensitivity += 0.15
      arch.rebel += 2
      arch.hero += 1.5
    }
    if (/exam|school|teeth/.test(text)) {
      lean.openness += 0.1
      lean.sensitivity += 0.2
      arch.sage += 1.5
    }
    if (/grandmother|garden|moon/.test(text)) {
      lean.agreeableness += 0.25
      lean.openness += 0.2
      arch.caregiver += 1
      arch.dreamer += 1.5
    }
    if (/fall|flying|childhood/.test(text)) {
      lean.openness += 0.25
      arch.dreamer += 1.5
    }
    if (moods.some((mood) => mood === 'scared' || mood === 'anxious')) lean.sensitivity += 0.2
    if (moods.some((mood) => mood === 'peaceful' || mood === 'happy')) lean.sensitivity -= 0.1
    const people = dream.details?.people?.choices || []
    if (people.includes('Alone')) lean.extraversion -= 0.15
    else if (people.length) lean.extraversion += 0.15
    const detailCount = Object.keys(dream.details || {}).length
    if (detailCount) lean.conscientiousness += Math.min(detailCount, 4) * 0.05
    if (dream.clarity === 'Clear') lean.conscientiousness += 0.08
    if (String(dream.events || '').trim()) lean.openness += 0.08
  }
  const n = dreams.length
  for (const key of Object.keys(lean)) lean[key] = Math.max(-1, Math.min(1, lean[key] / n))
  return { lean, arch, answeredDreams: n }
}

function quizLean(answers) {
  const traits = emptyScores()
  const traitN = emptyScores()
  const letters = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 }
  const arch = Object.fromEntries(ARCHETYPES.map(([id]) => [id, 0]))
  let answered = 0
  for (const question of QUIZ) {
    const value = answers?.[question.id]
    if (value !== 'yes' && value !== 'no') continue
    answered += 1
    const sign = (value === 'yes' ? 1 : -1) * question.dir
    if (BIG_FIVE.has(question.dimension)) {
      traits[question.dimension] += sign
      traitN[question.dimension] += 1
    } else if (STYLE_LETTERS.has(question.dimension)) {
      letters[question.dimension] += value === 'yes' ? 1 : 0
      if (value === 'no') letters[OPPOSITE[question.dimension]] += 1
    } else if (ARCH_IDS.has(question.dimension) && value === 'yes') {
      arch[question.dimension] += 2
    }
  }
  const lean = emptyScores()
  for (const key of Object.keys(lean)) {
    if (!traitN[key]) continue
    lean[key] = Math.max(-1, Math.min(1, traits[key] / traitN[key]))
  }
  return { lean, letters, arch, answered, traitN }
}

function mixTrait(quizValue, quizWeight, dreamValue, dreamWeight) {
  const weight = quizWeight + dreamWeight
  if (!weight) return 50
  const mixed = (quizValue * quizWeight + dreamValue * dreamWeight) / weight
  return Math.max(12, Math.min(90, Math.round(50 + mixed * 34)))
}

function styleFrom(letters, traits) {
  const pick = (a, b, traitId, highMeansA) => {
    if (letters[a] !== letters[b]) return letters[a] > letters[b] ? a : b
    if (traitId === 'extraversion') return traits.extraversion >= 50 ? 'E' : 'I'
    if (traitId === 'openness') return traits.openness >= 50 ? 'N' : 'S'
    if (traitId === 'agreeableness') return traits.agreeableness >= 50 ? 'F' : 'T'
    return traits.conscientiousness >= 50 ? 'J' : 'P'
  }
  const code = [
    pick('E', 'I', 'extraversion'),
    pick('S', 'N', 'openness'),
    pick('T', 'F', 'agreeableness'),
    pick('J', 'P', 'conscientiousness')
  ].join('')
  const names = {
    E: 'outward',
    I: 'inward',
    S: 'concrete',
    N: 'imagining',
    T: 'analytic',
    F: 'tender',
    J: 'orderly',
    P: 'flexible'
  }
  const words = code.split('').map((letter) => names[letter])
  return {
    code,
    label: `${code}-style`,
    blurb: `${words[0].charAt(0).toUpperCase()}${words[0].slice(1)} and ${words[1]}, ${words[2]} when choosing, ${words[3]} about plans. This is a style nickname, not an official Myers-Briggs type.`
  }
}

function topArchetype(scores) {
  return [...ARCHETYPES]
    .map(([id, name]) => ({ id, name, score: scores[id] || 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

function joinBits(bits) {
  if (bits.length <= 1) return bits[0] || ''
  if (bits.length === 2) return `${bits[0]} and ${bits[1]}`
  return `${bits.slice(0, -1).join(', ')}, and ${bits[bits.length - 1]}`
}

function signBlurb(sign, dreams) {
  const text = dreams.map(blob).join(' ')
  if (sign.id === 'hearth') {
    const bits = []
    if (/bed/.test(text)) bits.push('a bed')
    if (/dog/.test(text)) bits.push('a dog')
    if (/\bhouse\b/.test(text)) bits.push('a house')
    else if (/\bhome\b/.test(text)) bits.push('getting home')
    if (!bits.length) return 'The Hearth is the folklore name for nights that stay indoors.'
    return `The Hearth fits because the dreams gather around ${joinBits(bits)}.`
  }
  if (sign.id === 'road') {
    const bits = []
    if (/train/.test(text)) bits.push('a train is on the move')
    if (/\bcars?\b/.test(text)) bits.push('cars are trying to cross the same ground')
    if (/way home|journey home|coast to coast/.test(text)) bits.push('the way home is part of the distance')
    if (!bits.length) return 'The Road is the folklore name for nights spent traveling.'
    return `The Road fits because ${joinBits(bits)}.`
  }
  if (sign.id === 'tide' && /water|sea|ocean|rain/.test(text)) {
    return 'The Tide fits because water is in the scene, as something you wait on or travel over.'
  }
  if (sign.id === 'spark' && /argu|crash|shout|fire/.test(text)) {
    return 'The Spark fits because an argument, a shout, or a crash is the heat in the scene.'
  }
  return `${sign.name} is a folklore name for the places in these dreams, not a birth chart.`
}

function evidenceCards(dreams) {
  const cards = []
  for (const dream of dreams) {
    const text = blob(dream)
    const name = titleOf(dream)
    const events = String(dream.events || '').trim()
    if (/speck|flea|dog bed|linen/.test(text)) {
      cards.push({
        id: `${dream.id}:care`,
        traits: ['agreeableness', 'conscientiousness'],
        theme: 'a mess spreading on a bed',
        sentence: `In the ${name} dream, specks on a dog's bed become a pile and you throw the linen out the window.`
      })
    } else if (/coast to coast|stuck for the ride|boxcar/.test(text)) {
      const waking = events ? ` You tied that ride to waking life: ${events.charAt(0).toLowerCase()}${events.slice(1).replace(/\.$/, '')}.` : ''
      cards.push({
        id: `${dream.id}:journey`,
        traits: ['sensitivity', 'openness'],
        theme: 'a short trip that runs too long',
        sentence: `In the ${name} dream, you board for a quick trip and the way home gets longer while you wait for a safe jump.${waking}`
      })
    } else if (/crash|argu/.test(text) && /\bcar/.test(text)) {
      cards.push({
        id: `${dream.id}:clash`,
        traits: ['extraversion', 'agreeableness'],
        theme: 'a noisy clash you step out of',
        sentence: `In the ${name} dream, cars crash while people argue, and you leave through the trees.`
      })
    } else if (/grandmother|garden/.test(text) && /moon/.test(text)) {
      cards.push({
        id: `${dream.id}:garden`,
        traits: ['openness', 'agreeableness'],
        theme: 'a quiet garden under the moon',
        sentence: `In the ${name} dream, you walk in a garden with your grandmother while the moon hangs overhead.`
      })
    } else if (/exam|teeth|school/.test(text)) {
      cards.push({
        id: `${dream.id}:exam`,
        traits: ['conscientiousness', 'sensitivity'],
        theme: 'being put on the spot',
        sentence: `In the ${name} dream, an exam at the old school puts you on the spot.`
      })
    } else if (/\btrain\b/.test(text)) {
      cards.push({
        id: `${dream.id}:train`,
        traits: ['openness'],
        theme: 'a train passing through',
        sentence: `In the ${name} dream, a train passes through the scene.`
      })
    } else if (/fall|flying|childhood/.test(text)) {
      cards.push({
        id: `${dream.id}:air`,
        traits: ['openness', 'sensitivity'],
        theme: 'the ground giving way',
        sentence: `In the ${name} dream, you are in the air and then the ground gives way.`
      })
    }
  }
  return cards
}

function assignCards(cards) {
  const used = new Set()
  const assigned = {}
  for (const [id] of TRAITS) {
    const card = cards.find((item) => !used.has(item.id) && item.traits[0] === id)
    if (!card) continue
    used.add(card.id)
    assigned[id] = card
  }
  for (const [id] of TRAITS) {
    if (assigned[id]) continue
    const card = cards.find((item) => !used.has(item.id) && item.traits.includes(id))
    if (!card) continue
    used.add(card.id)
    assigned[id] = card
  }
  return { assigned, used }
}

function traitBlurbs(traits, dreams) {
  const cards = evidenceCards(dreams)
  const { assigned, used } = assignCards(cards)
  const blurbs = TRAITS.map(([id, label]) => {
    const card = assigned[id]
    const sentence = card
      ? card.sentence
      : `Not enough dreams yet to read ${label.toLowerCase()} from the nights you logged.`
    return { id, label, score: traits[id], sentence }
  })
  return { blurbs, cards, used }
}

function strengthsAndGaps(dreams, cards, used) {
  const strengths = []
  const gaps = []
  const spare = cards.filter((card) => !used.has(card.id))
  if (spare[0]) strengths.push(spare[0].sentence)
  else if (cards.some((card) => card.id.endsWith(':care') || card.id.endsWith(':clash'))) {
    strengths.push('When a scene turns messy, you tend to move it out of the room or leave it.')
  } else strengths.push('Not enough repeated action yet to name a strength beyond the nights you wrote down.')
  if (cards.some((card) => card.id.endsWith(':journey'))) {
    gaps.push('The delay shows up as a trip that keeps going after you wanted to step off.')
  } else if (spare[1]) gaps.push(spare[1].sentence)
  else gaps.push('Not enough dreams yet to name a repeated blind spot.')
  return { strengths, gaps }
}

function latelyLine(dreams, cards) {
  const newest = [...dreams].sort((a, b) => new Date(b.datetime) - new Date(a.datetime)).slice(0, 3)
  const feelings = [...new Set(newest.flatMap((dream) => moodsOf(dream).map((mood) => mood.toLowerCase())))]
  if (feelings.length) return `The newest nights feel ${joinBits(feelings)}.`
  const themes = newest.map((dream) => cards.find((card) => card.id.startsWith(`${dream.id}:`))?.theme).filter(Boolean)
  if (themes.length) return `Lately the mind is on ${joinBits(themes)}.`
  return 'The newest nights are too quiet to name a fresh theme yet.'
}

function shapeLines(cards) {
  const themes = [...new Set(cards.map((card) => card.theme))].slice(0, 3)
  const lines = []
  lines.push(themes.length
    ? `These nights keep circling ${joinBits(themes)}.`
    : 'These nights do not settle on one picture yet.')
  if (cards.some((card) => card.id.endsWith(':journey'))) {
    lines.push('The hard moment is noticing that a small start has already gone farther than you chose.')
  } else if (cards.some((card) => card.id.endsWith(':care') || card.id.endsWith(':clash'))) {
    lines.push('When the scene turns, you move the trouble out instead of staying in the middle of it.')
  }
  return lines
}

export function buildProfile(dreams, store) {
  const own = userDreams(dreams)
  const clean = cleanPersonality(store)
  const dreamPart = dreamTraitLean(own)
  const quiz = quizLean(clean.answers)
  const quizWeight = quiz.answered ? Math.min(quiz.answered / 16, 1) : 0
  const dreamWeight = own.length ? 1 : 0
  const traits = {}
  for (const [id] of TRAITS) {
    const qN = quiz.traitN[id]
    traits[id] = mixTrait(quiz.lean[id], qN ? quizWeight : 0, dreamPart.lean[id], dreamWeight)
  }
  const archScores = {}
  for (const [id] of ARCHETYPES) {
    archScores[id] = (dreamPart.arch[id] || 0) + (quiz.arch[id] || 0)
  }
  const archetypeOrder = topArchetype(archScores)
  const archetype = archetypeOrder[0]
  const style = styleFrom(quiz.letters, traits)
  const sign = signHits(own)
  const { blurbs, cards, used } = traitBlurbs(traits, own)
  const { strengths, gaps } = strengthsAndGaps(own, cards, used)
  const shape = shapeLines(cards)
  const recent = latelyLine(own, cards)
  const agreed = QUIZ.filter((question) => clean.answers[question.id] === 'yes').slice(0, 1)
  const character = `The dream character is the ${archetype.name}, ${characterLine(archetype.id, own)}`
  const signLine = signBlurb(sign, own)
  const styleLine = `The style name is ${style.label}. ${style.blurb}`
  const quizLine = agreed.length
    ? `On the quiz you said yes to this: ${agreed[0].prompt}`
    : (own.length ? 'The quiz is not in this reading yet, so the traits above are from the dreams alone.' : '')
  const note = 'This is a reflection from your own words and your quiz answers, not a diagnosis and not a prediction.'
  const ready = own.length >= MIN_DREAMS
  const signature = [
    own.length,
    quiz.answered,
    style.code,
    archetype.id,
    TRAITS.map(([id]) => traits[id]).join('.'),
    own.map((dream) => dream.id).sort().join(',')
  ].join('|')
  return {
    ready,
    dreamCount: own.length,
    needed: MIN_DREAMS,
    quizAnswered: quiz.answered,
    quizTotal: QUIZ.length,
    traits: blurbs,
    archetype,
    archetypes: archetypeOrder,
    style,
    sign,
    strengths,
    gaps,
    lately: recent,
    shape: ready ? shape : [],
    character: ready ? character : '',
    signLine: ready ? signLine : '',
    styleLine: ready ? styleLine : '',
    quizLine: ready ? quizLine : '',
    note,
    paragraphs: ready ? shape : [],
    essay: ready ? profilePageText({
      shape, traits: blurbs, strengths, gaps, lately: recent, character, signLine, styleLine, quizLine, note, ready: true
    }) : '',
    headline: ready ? `${archetype.name} and ${sign.name}` : '',
    signature
  }
}

function characterLine(id, dreams) {
  const text = dreams.map(blob).join(' ')
  if (id === 'caregiver' && /dog bed|linen/.test(text)) {
    return 'the person who sees a small infestation on a dog\'s bed and gets it out of the room.'
  }
  if (id === 'hero' && /window|escap|jump/.test(text)) {
    return 'someone who would rather move a problem outside than stay parked in it.'
  }
  if (id === 'explorer') {
    return 'the rider who boards for a short distance and then has to reckon with how far the road actually goes.'
  }
  if (id === 'rebel') return 'the one who will not stay inside an argument just because it is loud.'
  if (id === 'sage') return 'the one who keeps the exam, the book, or the strange detail because understanding it matters.'
  if (id === 'dreamer') return 'the one who lets the moon, the fall, or the impossible image finish its sentence.'
  if (id === 'guardian') return 'the one who watches the bed, the door, and whoever is sleeping nearby.'
  if (id === 'everyperson') return 'the one whose important scenes happen in ordinary rooms, on a bed or in a park, not on a stage.'
  return 'the figure these particular dreams keep asking you to play.'
}

export function applySnapshot(store, profile, now = new Date()) {
  const clean = cleanPersonality(store)
  if (!profile?.ready) return clean
  const last = clean.history[clean.history.length - 1]
  if (last && last.signature === profile.signature) return clean
  clean.history = [...clean.history, {
    at: now.toISOString(),
    signature: profile.signature,
    dreamCount: profile.dreamCount,
    style: profile.style.label,
    archetype: profile.archetype.name,
    headline: profile.headline
  }].slice(-24)
  return clean
}

export function profilePageText(profile) {
  if (!profile?.ready && !profile?.shape) return ''
  return [
    ...(profile.shape || []),
    ...(profile.traits || []).map((trait) => trait.sentence),
    ...(profile.strengths || []),
    ...(profile.gaps || []),
    profile.lately,
    profile.character,
    profile.signLine,
    profile.styleLine,
    profile.quizLine,
    profile.note
  ].filter(Boolean).join('\n')
}

export function personalityBundle(dreams, settings) {
  const stored = cleanPersonality(settings?.personality)
  const profile = buildProfile(dreams || [], stored)
  return {
    answers: stored.answers,
    history: stored.history,
    profile: profile.ready ? {
      headline: profile.headline,
      style: profile.style.label,
      archetype: profile.archetype.name,
      essay: profile.essay
    } : null
  }
}

export function personalityExport(dreams, settings) {
  const profile = buildProfile(dreams, settings?.personality)
  if (!profile.ready) return ''
  return ['Personality', profile.essay].join('\n\n')
}

export function monthSelfLine(dreams, key) {
  const own = userDreams(dreams).filter((dream) => monthKeyFromDate(dream.datetime) === key)
  const bits = own.map(dreamClause).filter(Boolean)
  if (!bits.length) return ''
  return `Personality snapshot: ${bits.slice(0, 3).join(' ')}`
}
