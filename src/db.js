import { defaultSettings } from './lib/constants.js'
import { sampleDream } from './lib/sample.js'
import { state, removeDream, upsertDream } from './state.js'

const DB_NAME = 'dream-journal'
const DB_VERSION = 1

let dbPromise = null

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
        if (!db.objectStoreNames.contains('dreams')) {
          const store = db.createObjectStore('dreams', { keyPath: 'id' })
          store.createIndex('datetime', 'datetime')
        }
      }
      req.onsuccess = () => {
        const db = req.result
        db.onclose = () => { dbPromise = null }
        resolve(db)
      }
      req.onerror = () => {
        dbPromise = null
        reject(req.error)
      }
    })
  }
  return dbPromise
}

function mergeSettings(stored) {
  const defaults = defaultSettings()
  return {
    ...defaults,
    ...stored,
    customMoods: stored?.customMoods || [],
    customTags: stored?.customTags || [],
    workDays: stored?.workDays || defaults.workDays
  }
}

export async function loadAll() {
  const db = await openDB()
  const settings = await new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly')
    const req = tx.objectStore('kv').get('settings')
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
  if (!settings) {
    const fresh = defaultSettings()
    const sample = sampleDream()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['kv', 'dreams'], 'readwrite')
      tx.objectStore('kv').put(fresh, 'settings')
      tx.objectStore('dreams').put(sample)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return { settings: fresh, dreams: [sample] }
  }
  const dreams = await request(db.transaction('dreams', 'readonly').objectStore('dreams').getAll())
  return { settings: mergeSettings(settings), dreams: dreams || [] }
}

export async function saveSettings(settings) {
  const db = await openDB()
  await request(db.transaction('kv', 'readwrite').objectStore('kv').put(settings, 'settings'))
  state.settings = settings
}

export async function saveDream(dream) {
  const db = await openDB()
  await request(db.transaction('dreams', 'readwrite').objectStore('dreams').put(dream))
  upsertDream(dream)
}

export async function deleteDream(id) {
  const db = await openDB()
  await request(db.transaction('dreams', 'readwrite').objectStore('dreams').delete(id))
  removeDream(id)
}

export async function replaceAllDreams(dreams) {
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction('dreams', 'readwrite')
    const store = tx.objectStore('dreams')
    store.clear()
    for (const dream of dreams) store.put(dream)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  state.dreams = dreams
}

export async function deleteDatabase() {
  if (dbPromise) {
    try {
      const db = await dbPromise
      db.close()
    } catch {
      /* already closed */
    }
  }
  dbPromise = null
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}
