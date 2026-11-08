export const state = {
  unlocked: false,
  settings: null,
  dreams: [],
  suspendLockUntil: 0,
  booted: false,
  storageError: null
}

export function suspendLock(ms = 60000) {
  state.suspendLockUntil = Math.max(state.suspendLockUntil, Date.now() + ms)
}

export function upsertDream(dream) {
  const index = state.dreams.findIndex((item) => item.id === dream.id)
  if (index >= 0) state.dreams[index] = dream
  else state.dreams.push(dream)
}

export function removeDream(id) {
  state.dreams = state.dreams.filter((dream) => dream.id !== id)
}
