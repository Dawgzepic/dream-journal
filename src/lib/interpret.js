import { promptSymbols } from './analyze.js'
import { detailReadingBits } from './details.js'

const NOTE = 'This is a reflection from your own words, not a verdict and not a prediction.'

const ARCS = [
  { id: 'stuck', test: /\b(stuck|trapped|could(?:n't| not) (?:get off|leave|move)|no way out|locked in)\b/i },
  { id: 'chased', test: /\b(chased|chasing me|ran after me|coming after|pursued|after me)\b/i },
  { id: 'escape', test: /\b(escape[ds]?|jump(?:ed)? off|get away|got away|ran away|way out)\b/i },
  { id: 'falling', test: /\b(falling|fell|fall off)\b/i },
  { id: 'lost', test: /\b(got lost|was lost|being lost|could(?:n't| not) find (?:my )?way|no idea where)\b/i },
  { id: 'late', test: /\b(too late|was late|running late)\b/i },
  { id: 'home', test: /\b(journey home|back home|going home|way home|get home|toward home)\b/i },
  { id: 'conflict', test: /\b(argument|arguing|argued|fight|fighting|fought|yell(?:ing|ed)?|shout(?:ing|ed)?|crash(?:ing|ed)?|collid\w*)\b/i },
  { id: 'flying', test: /\b(flying|flew|in the air)\b/i },
  { id: 'waiting', test: /\b(wait(?:ing|ed)?(?: for)?|had to wait|slow down)\b/i },
  { id: 'small-start', test: /\b(just to|around town|only meant|did(?:n't| not) mean|something small)\b/i },
  { id: 'far', test: /\b(coast to coast|too far|farther|further|long journey|much farther)\b/i },
  { id: 'search', test: /\b(looking for|searching for|searched for)\b/i }
]

function dreamText(dream) {
  return `${dream?.title || ''}\n${dream?.story || ''}`
}

function detectArcs(text) {
  return ARCS.filter((arc) => arc.test.test(text)).map((arc) => arc.id)
}

function has(arcs, id) {
  return arcs.includes(id)
}

function list(items) {
  const names = items.filter(Boolean)
  if (names.length <= 1) return names[0] || ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function moodSentence(dream) {
  const during = (dream.moodsDuring || []).filter(Boolean)
  const after = dream.moodAfter || ''
  if (during.length && after && !during.some((mood) => mood.toLowerCase() === after.toLowerCase())) {
    return `During the dream you felt ${list(during).toLowerCase()}, and on waking that shifted toward ${after.toLowerCase()}.`
  }
  if (during.length && after) {
    return `You felt ${list(during).toLowerCase()} in the dream, and that feeling was still there when you woke.`
  }
  if (during.length) return `Inside the dream the feeling was ${list(during).toLowerCase()}.`
  if (after) return `What stayed with you on waking was ${after.toLowerCase()}.`
  return ''
}

function claritySentence(dream) {
  if (dream.clarity === 'Clear') return 'You remember it clearly, so the shape of the story can carry more of the meaning.'
  if (dream.clarity === 'Fuzzy') return 'The memory is fuzzy, so this stays with the feeling more than the small details.'
  if (dream.clarity === 'Fragments') return 'Only fragments remain, so the reading leans on the pieces you kept.'
  return ''
}

function tagSentence(dream) {
  const tags = dream.tags || []
  const bits = []
  if (tags.includes('Nightmare')) bits.push('You marked it a nightmare, so the fear belongs in the reading and is not something to tidy away.')
  if (tags.includes('Lucid')) bits.push('You knew you were dreaming, which leaves a thread of choice in the scene.')
  if (tags.includes('Recurring')) bits.push('It has come back before, so the pattern matters more than any single detail.')
  return bits.join(' ')
}

function bedSentence(dream) {
  const bed = dream.bedtime || {}
  const bits = []
  if (bed.stress >= 4) bits.push('the evening carried high stress')
  if (bed.substance === 'Caffeine' || bed.substance === 'Both') bits.push('caffeine was still in the mix')
  if (bed.substance === 'Alcohol' || bed.substance === 'Both') bits.push('alcohol was part of the night')
  if (bed.screen === 'heavy') bits.push('the screen stayed on for a long stretch')
  if (bed.food) bits.push(`you noted ${String(bed.food).toLowerCase()} before sleep`)
  if (!bits.length) return ''
  return `Before sleep, ${list(bits)}, which can color a dream without explaining it.`
}

function eventSentence(dream) {
  const text = String(dream.events || '').trim()
  if (!text) return ''
  const clip = text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text
  return `You linked it with waking life: ${clip}`
}

function contextSentences(dream, detailed) {
  const ranked = [moodSentence(dream), eventSentence(dream), tagSentence(dream), claritySentence(dream), bedSentence(dream)].filter(Boolean)
  return ranked.slice(0, detailed ? 2 : 1)
}

function imagePhrase(symbols) {
  const names = symbols.map((symbol) => {
    if (symbol.id === 'late') return 'the sense of being late'
    if (symbol.id === 'childhood-home') return 'a childhood home'
    if (symbol.id === 'teeth-falling') return 'a loose tooth'
    return symbol.name.toLowerCase()
  })
  if (!names.length) return 'the few details you kept'
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names[0]}, ${names[1]}, and ${names[2]}`
}

function sceneFor(symbols, arcs) {
  const ids = new Set(symbols.map((symbol) => symbol.id))
  if (ids.has('train') && (has(arcs, 'stuck') || has(arcs, 'far') || has(arcs, 'small-start'))) return 'train-haul'
  if (has(arcs, 'conflict') && has(arcs, 'escape')) return 'clash-leave'
  if ((ids.has('car') && has(arcs, 'conflict')) || (ids.has('car') && has(arcs, 'escape') && has(arcs, 'conflict'))) return 'clash-leave'
  if (has(arcs, 'chased')) return 'chased'
  if (has(arcs, 'falling')) return 'falling'
  if (has(arcs, 'flying')) return 'flying'
  if (has(arcs, 'lost')) return 'lost'
  if (has(arcs, 'stuck')) return 'stuck'
  if (has(arcs, 'home')) return 'homeward'
  if (has(arcs, 'search')) return 'search'
  if (has(arcs, 'late')) return 'late'
  if (has(arcs, 'conflict')) return 'conflict'
  if (has(arcs, 'escape')) return 'escape'
  if (has(arcs, 'waiting')) return 'waiting'
  if (symbols.length) return 'symbols'
  return 'thin'
}

function scenes(symbols, arcs) {
  const images = imagePhrase(symbols)
  return {
    'train-haul': {
      psych: [
        'You got on for something small and found yourself carried much farther than you chose, by a course you can\'t steer.',
        has(arcs, 'waiting') || has(arcs, 'escape')
          ? 'Waiting for the right moment to jump says you want out but want to do it safely.'
          : 'Being stuck on the ride says the choice to board was smaller than the commitment that followed.',
        has(arcs, 'home')
          ? 'The growing distance home says you feel delay has a cost.'
          : 'The longer you stay on, the more the return becomes its own journey.'
      ].join(' '),
      folk: has(arcs, 'home')
        ? 'In older stories a train is kin to the ship that leaves on its own tide. You do not steer it. Water, when you are waiting on it, is the sign that you cross only when the crossing allows, and the journey home is the old return: every mile spent aboard is another mile of the walk back.'
        : 'In older stories a train is kin to the ship that leaves on its own tide. The rider discovers too late that the road has its own idea of the destination.',
      folkShort: 'Old stories know this road: a passage that will not stop just because you are ready to get off, and a way home that lengthens while you hesitate.',
      takeaway: 'It reads like a commitment or routine that grew bigger than you signed up for, and a wish to get back to yourself before it goes further.',
      question: 'What would it feel like to step off while the way home is still a choice?'
    },
    'clash-leave': {
      psych: symbols.some((symbol) => symbol.id === 'car')
        ? 'The cars are not a row of machines to define one by one. They are the ways people are trying to move through the same ground, and the crashing and arguing are the conflict when those paths will not share it. You looked for a way out instead of staying in the middle.'
        : 'The clash and the leaving are one motion. A conflict got too close, and you chose an escape rather than finishing the fight.',
      folk: 'Folk stories put a collision like this at a crossroads, then leave a gap for the person willing to step out of the fight. Getting away is how the traveler stays whole.',
      folkShort: 'In the old telling, a crossroads fight always has a gap at the edge, and taking it is part of the story rather than a failure of it.',
      takeaway: 'It reads like a fight you did not have to finish, and an escape that kept you intact.',
      question: 'What would safety look like if you did not have to run to find it?'
    },
    chased: {
      psych: `Something is coming after you, and ${images} belong to that pursuit rather than standing apart from it. The chase is the feeling of a pressure that will not let you set the pace.`,
      folk: 'Pursuit is one of the oldest plots: the runner, the thing behind, and the question of whether turning around would shrink it.',
      folkShort: 'Old tales treat a chase as a test of what happens when you finally look back.',
      takeaway: 'It reads like a pressure you are outrunning, and a question about whether it is as large as it feels from ahead.',
      question: 'What are you running from that might be asking to be met at a smaller size?'
    },
    falling: {
      psych: `The fall is the heart of it. ${images.charAt(0).toUpperCase()}${images.slice(1)} ride along with the drop, one loss of footing rather than separate signs.`,
      folk: 'Folk falls are rarely only about gravity. They are the moment the ground you trusted steps away.',
      folkShort: 'Stories have always used a fall for the moment support gives way.',
      takeaway: 'It reads like a loss of footing you did not schedule, and the wish to find ground again.',
      question: 'What in your days feels as if the ground has moved?'
    },
    flying: {
      psych: `The lift is doing the talking. ${images.charAt(0).toUpperCase()}${images.slice(1)} share the air with you, one picture of being above the usual road.`,
      folk: 'Flight in folk tales is a gift with a condition: height is freedom, and it is also a long way from the path other people are walking.',
      folkShort: 'Old stories lend wings sparingly, and they always ask what you can see from up there that the road hides.',
      takeaway: 'It reads like a wish to be above the usual constraints, with the uneasy knowledge that height is not the same as a plan.',
      question: 'What would you do with the height if you trusted it for a moment?'
    },
    lost: {
      psych: `You cannot find the way, and ${images} are the scenery of that lostness, not a checklist of omens. The dream is the feeling of a map that will not hold still.`,
      folk: 'Being lost is a traditional beginning. The wood, the wrong road, and the stranger all say the same thing: the familiar path has closed for now.',
      folkShort: 'Folk journeys often start at the moment the known road disappears.',
      takeaway: 'It reads like a stretch of life where the usual directions are not working, and you are still in it rather than past it.',
      question: 'Which part of your life feels like the place you cannot name?'
    },
    stuck: {
      psych: `You are stuck, and ${images} are part of what is holding you there. The dream is less about each object than about a motion that will not start.`,
      folk: 'Enchantments in old stories freeze the traveler in place until a condition is met. Being stuck is that spell without the costume.',
      folkShort: 'The old image is a traveler fixed to the spot until something, often a small permission, lets them move.',
      takeaway: 'It reads like a situation that has stopped answering to effort, and a wish for a safe way to start moving again.',
      question: 'What would a small, safe exit look like from the thing that will not let you off?'
    },
    homeward: {
      psych: `The pull is toward home. ${images.charAt(0).toUpperCase()}${images.slice(1)} travel with that return, one wish to get back rather than a set of separate pictures.`,
      folk: 'The journey home is among the oldest endings. What you meet on the way is the life you have to cross before you can arrive.',
      folkShort: 'Coming home is an old plot, and the road back is always longer in the telling than the road out.',
      takeaway: 'It reads like a wish to get back to yourself, and the sense that the way there has a cost.',
      question: 'What are you hoping will be there when you get back to yourself?'
    },
    search: {
      psych: `You are looking for something, and ${images} are the rooms of that search. The dream is the feeling of knowing a thing matters while its shape keeps shifting.`,
      folk: 'Quests in folklore are rarely about the object alone. They are about who you become while you are still looking.',
      folkShort: 'A search, in the old stories, changes the seeker more than it guarantees a find.',
      takeaway: 'It reads like a search for something you can feel more clearly than you can name.',
      question: 'What have you been looking for lately that you have not said out loud?'
    },
    late: {
      psych: `You were already behind, and ${images} belong to that lateness as one unfinished arrival. The dream is the feeling of a life that started without waiting for you to be ready.`,
      folk: 'Folk deadlines shut a door at a stated hour. Lateness is the fear of that door, even when the scene itself stays gentle.',
      folkShort: 'Old tales make lateness a closing gate, and they also know the relief when the gate turns out to be open.',
      takeaway: 'It reads like the worry of missing your own moment, held together with whatever place you were trying to reach.',
      question: 'What are you afraid will close if you do not arrive on time?'
    },
    conflict: {
      psych: `The argument is the center. ${images.charAt(0).toUpperCase()}${images.slice(1)} sit inside the conflict instead of explaining it piece by piece. Something wants to be heard, and the volume is how it gets there.`,
      folk: 'Quarrels in folk stories reveal the rule everyone had been pretending not to see. The fight is the rule, spoken at last.',
      folkShort: 'A quarrel, traditionally, is the moment a hidden rule gets said out loud.',
      takeaway: 'It reads like a tension that ran out of polite ways to stay quiet.',
      question: 'What have you been unwilling to say that the dream says loudly?'
    },
    escape: {
      psych: `Getting out is the point. ${images.charAt(0).toUpperCase()}${images.slice(1)} are the place you are leaving, one exit rather than a tour of symbols.`,
      folk: 'Escapes in old stories are judged by what they save, not by whether they look brave from the outside.',
      folkShort: 'The traditional escape is a saving move, not a failure to stay.',
      takeaway: 'It reads like a need to be elsewhere, chosen before the scene could choose for you.',
      question: 'What would you be leaving, if this exit were a waking one?'
    },
    waiting: {
      psych: `You are waiting for the right moment, and ${images} are what you wait beside. The dream is patience mixed with the fear that the opening will be brief.`,
      folk: 'Folk crossings often make the traveler wait for a sign, a tide, or a slowing of the danger. Waiting is part of the courage, not the opposite of it.',
      folkShort: 'In the old stories, waiting for the safe moment is how a crossing is survived.',
      takeaway: 'It reads like a wish to move, held back by the wish to move safely.',
      question: 'What are you waiting for permission to leave?'
    },
    symbols: {
      psych: `${images.charAt(0).toUpperCase()}${images.slice(1)} are working as one theme, not as entries to define in a row. Together they set a weather you are walking through.`,
      folk: 'Traditional tellings would hear those images as a single passage: a sign on the road, not a fortune and not a list.',
      folkShort: 'Folklore would treat them as one sign on the road, not a set of separate fortunes.',
      takeaway: 'It reads like a mood that found pictures, asking to be felt as a whole before it is taken apart.',
      question: 'Which part of this feels most like something from your waking days?'
    },
    thin: {
      psych: 'There is no single strong image to hang this on, so the reading stays close to how the night felt and to whatever turn the story made.',
      folk: 'Even a quiet dream has the old shape of a night journey: you went somewhere, and you came back with a feeling.',
      folkShort: 'A quiet dream is still a night journey: you left, and you came back carrying a mood.',
      takeaway: 'It reads like a feeling asking to be noticed, more than a plot asking to be solved.',
      question: 'What in the day felt most like the mood you woke with?'
    }
  }
}

function finish(dream, detailed, scene) {
  const extra = contextSentences(dream, detailed)
  const detail = detailReadingBits(dream).join(' ')
  const end = `Putting it together: ${scene.takeaway} ${scene.question}`
  if (!detailed) {
    const bit = extra[0] ? ` ${extra[0]}` : ''
    const sensed = detail ? ` ${detail}` : ''
    return [`${scene.psych}${bit}${sensed} ${scene.folkShort} ${end}`, NOTE]
  }
  const psych = [scene.psych, ...extra.slice(0, 2), detail].filter(Boolean).join(' ')
  return [psych, scene.folk, end, NOTE]
}

export function fullInterpretation(dream, depth = 'short') {
  const text = dreamText(dream || {})
  const symbols = promptSymbols(text, 3)
  const arcs = detectArcs(text)
  const thin = symbols.length === 0 && arcs.length === 0
  const key = thin ? 'thin' : sceneFor(symbols, arcs)
  const scene = scenes(symbols, arcs)[key]
  const detailed = depth === 'detailed'
  return finish(dream || {}, detailed, scene).join('\n\n')
}
