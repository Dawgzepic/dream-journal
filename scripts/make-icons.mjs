import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const root = path.resolve(import.meta.dirname, '..')
const iconDir = path.join(root, 'public', 'icons')
fs.mkdirSync(iconDir, { recursive: true })

function mix(a, b, t) {
  const k = Math.max(0, Math.min(1, t))
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k)
  ]
}

function sample(px, py, size, maskable) {
  const nx = px / size
  const ny = py / size
  const dx = nx - 0.5
  const dy = ny - 0.46
  const dist = Math.sqrt(dx * dx + dy * dy)
  const bg = mix([46, 36, 78], [12, 8, 22], Math.min(1, dist / 0.78))

  const cx = (maskable ? 0.47 : 0.45) * size
  const cy = (maskable ? 0.52 : 0.53) * size
  const r = (maskable ? 0.22 : 0.27) * size
  const hx = cx + (maskable ? 0.11 : 0.13) * size
  const hy = cy - (maskable ? 0.045 : 0.05) * size
  const hr = (maskable ? 0.175 : 0.215) * size
  const dOuter = Math.hypot(px - cx, py - cy)
  const dHole = Math.hypot(px - hx, py - hy)

  let col = bg
  const glow = size * 0.045
  if (dOuter < r + glow && dHole > hr - 1) {
    const outerAa = Math.max(0, Math.min(1, r - dOuter + 0.8))
    const innerAa = Math.max(0, Math.min(1, dHole - hr + 0.8))
    const aa = Math.min(outerAa, innerAa)
    if (aa > 0 && dOuter <= r && dHole >= hr) {
      const light = 0.82 + 0.22 * (1 - (px - (cx - r)) / (r * 2))
      const shade = 0.94 + 0.1 * (1 - (py - (cy - r)) / (r * 2))
      const moon = [220, 206, 255].map((c) => Math.max(0, Math.min(255, c * light * shade)))
      col = mix(col, moon, aa)
    } else if (dOuter > r && dOuter < r + glow && dHole > hr + glow * 0.15) {
      const a = 1 - (dOuter - r) / glow
      col = mix(col, [176, 156, 230], a * 0.4)
    }
  }

  const stars = maskable
    ? [
        [0.3, 0.3, 0.011],
        [0.7, 0.32, 0.008],
        [0.33, 0.72, 0.007],
        [0.68, 0.7, 0.01]
      ]
    : [
        [0.16, 0.16, 0.011],
        [0.78, 0.18, 0.008],
        [0.14, 0.74, 0.007],
        [0.84, 0.7, 0.01],
        [0.62, 0.14, 0.006],
        [0.28, 0.86, 0.005],
        [0.88, 0.4, 0.0045]
      ]
  for (const [sx, sy, sr] of stars) {
    const d = Math.hypot(nx - sx, ny - sy)
    const radius = sr * 3.2
    if (d < radius) {
      const a = Math.pow(1 - d / radius, 1.6)
      col = mix(col, [246, 236, 214], a)
    }
  }
  return [col[0], col[1], col[2], 255]
}

function render(size, maskable) {
  const ss = size >= 180 ? 2 : 4
  const big = size * ss
  const pixels = Buffer.alloc(size * size * 4)
  const n = ss * ss
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const p = sample(x * ss + sx + 0.5, y * ss + sy + 0.5, big, maskable)
          r += p[0]
          g += p[1]
          b += p[2]
          a += p[3]
        }
      }
      const i = (y * size + x) * 4
      pixels[i] = Math.round(r / n)
      pixels[i + 1] = Math.round(g / n)
      pixels[i + 2] = Math.round(b / n)
      pixels[i + 3] = Math.round(a / n)
    }
  }
  return pixels
}

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    pixels.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
  return png
}

function writeIcon(filename, size, maskable) {
  const png = encodePNG(size, render(size, maskable))
  const dest = filename.startsWith('favicon')
    ? path.join(root, 'public', filename)
    : path.join(iconDir, filename)
  fs.writeFileSync(dest, png)
  const w = png.readUInt32BE(16)
  const h = png.readUInt32BE(20)
  if (w !== size || h !== size) throw new Error(`Bad size for ${filename}`)
  console.log(`wrote ${path.relative(root, dest)} ${size}x${size} (${png.length} bytes)`)
}

writeIcon('icon-192.png', 192, false)
writeIcon('icon-512.png', 512, false)
writeIcon('icon-maskable-192.png', 192, true)
writeIcon('icon-maskable-512.png', 512, true)
writeIcon('apple-touch-icon.png', 180, true)
writeIcon('favicon.png', 64, false)
