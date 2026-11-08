import { suspendLock } from './state.js'

function bytesToB64(buffer) {
  const bytes = new Uint8Array(buffer)
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function b64ToBytes(value) {
  let text = value.replaceAll('-', '+').replaceAll('_', '/')
  while (text.length % 4) text += '='
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function fingerprintAvailable() {
  try {
    if (!window.PublicKeyCredential) return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export async function registerFingerprint() {
  suspendLock(120000)
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Dream Journal' },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: 'timothy',
        displayName: 'Timothy'
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 }
      ],
      timeout: 60000,
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred'
      },
      attestation: 'none'
    }
  })
  return bytesToB64(credential.rawId)
}

export async function unlockWithFingerprint(id) {
  suspendLock(120000)
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      timeout: 60000,
      userVerification: 'required',
      allowCredentials: [{ type: 'public-key', id: b64ToBytes(id) }]
    }
  })
  return Boolean(credential)
}
