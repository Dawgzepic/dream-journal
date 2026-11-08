export function randomSalt() {
  return crypto.getRandomValues(new Uint8Array(16))
}

export function bufToHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function hexToBuf(hex) {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Salted SHA-256: SHA-256(salt || utf8(pin)). The PIN itself is never stored. */
export async function hashPin(pin, saltBytes) {
  const encoded = new TextEncoder().encode(String(pin))
  const data = new Uint8Array(saltBytes.length + encoded.length)
  data.set(saltBytes, 0)
  data.set(encoded, saltBytes.length)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bufToHex(digest)
}

export async function verifyPin(pin, saltHex, hashHex) {
  if (!saltHex || !hashHex || saltHex.length !== 32) return false
  const next = await hashPin(pin, hexToBuf(saltHex))
  return safeEqual(next, hashHex)
}
