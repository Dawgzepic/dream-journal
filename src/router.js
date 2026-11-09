export function parseHash(hash) {
  const path = (hash || '#/').replace(/^#/, '') || '/'
  const parts = path.split('/').filter(Boolean)
  if (!parts.length || parts[0] === 'home') return { name: 'home' }
  if (parts[0] === 'journal') return { name: 'journal' }
  if (parts[0] === 'new') return { name: 'editor', id: null }
  if (parts[0] === 'edit' && parts[1]) return { name: 'editor', id: decodeURIComponent(parts[1]) }
  if (parts[0] === 'dream' && parts[1] && parts[2] === 'meaning') return { name: 'meaning', id: decodeURIComponent(parts[1]) }
  if (parts[0] === 'dream' && parts[1] && parts[2] === 'details') return { name: 'details', id: decodeURIComponent(parts[1]) }
  if (parts[0] === 'dream' && parts[1]) return { name: 'dream', id: decodeURIComponent(parts[1]) }
  if (parts[0] === 'patterns') return { name: 'patterns' }
  if (parts[0] === 'lucid') return { name: 'lucid' }
  if (parts[0] === 'self' || parts[0] === 'you') return { name: 'self' }
  if (parts[0] === 'settings') return { name: 'settings' }
  return { name: 'missing' }
}
