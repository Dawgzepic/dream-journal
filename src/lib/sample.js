export function sampleDream(now = new Date()) {
  const when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 40, 0, 0)
  when.setDate(when.getDate() - 6)
  const iso = when.toISOString()
  return {
    id: 'sample-library-sea',
    title: 'The library that opened onto the sea',
    datetime: iso,
    story: [
      'I was late for something I could not name, walking the stacks of a library that should have been my childhood house.',
      'The far wall was gone. In its place was the sea, black and calm, with a thin moon laid on the water.',
      'A white horse stood between two shelves and watched me without moving.',
      'My teeth felt loose, and when I touched them one came away in my hand like a small stone.',
      'In my pocket was the old house key, but every door in the library was already open.',
      'Somewhere under the water a train whistle sounded, and I knew, briefly, that I was dreaming.',
      'Then the lights went out and I was only walking, looking for a book I had never read.'
    ].join(' '),
    moodsDuring: ['Confused', 'Peaceful'],
    moodAfter: 'Peaceful',
    clarity: 'Fuzzy',
    events: 'I had been reading before bed and thinking about a house I used to live in.',
    tags: ['Lucid'],
    bedtime: { food: 'Tea', substance: 'Caffeine', stress: 2, screen: 'light' },
    isDraft: false,
    isSample: true,
    createdAt: iso,
    updatedAt: iso
  }
}
