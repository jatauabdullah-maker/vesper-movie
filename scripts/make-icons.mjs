// Generates Vesper's PWA icons (PNG) with zero dependencies — plain Node + zlib.
// The mark is the Vesper evening star: a four-point concave star with the
// gold→ember brand gradient on the warm charcoal app background.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const SIZE = { bg: [14, 12, 9], inner: [23, 19, 13] }

function crc32(buf) {
  let c, table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function starMask(x, y, cx, cy, R) {
  const dx = (x - cx) / R
  const dy = (y - cy) / R
  const r = Math.hypot(dx, dy)
  if (r > 1) return 0
  const theta = Math.atan2(dy, dx)
  // concave 4-point star: outer radius peaks at 0/90/180/270°, waist at 45°
  const w = Math.abs(Math.cos(2 * theta)) ** 3
  const boundary = 0.34 + 0.66 * w
  return r <= boundary ? 1 : 0
}

function makeIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const R = size * (maskable ? 0.3 : 0.38) // star radius (smaller on maskable so it survives the safe zone)
  const grad = size // gradient spans the full canvas diagonally

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4

      // background: flat charcoal, with a faint warm halo for depth (stronger on maskable)
      let r = SIZE.bg[0], g = SIZE.bg[1], b = SIZE.bg[2]
      const d = Math.hypot(x - cx, y - cy) / (size * 0.62)
      const halo = maskable ? 1 : 0.45
      if (d < 1) {
        const t = (1 - d) * halo
        r += (SIZE.inner[0] - r) * t * 1.6
        g += (SIZE.inner[1] - g) * t * 1.6
        b += (SIZE.inner[2] - b) * t * 1.6
      }

      // star with gold→ember diagonal gradient
      if (starMask(x, y, cx, cy, R)) {
        const t = Math.min(1, Math.max(0, (x + y) / grad))
        const stops = [
          [255, 210, 122], // #ffd27a
          [242, 177, 61],  // #f2b13d
          [226, 72, 61],   // #e2483d
        ]
        const seg = t < 0.55 ? t / 0.55 : (t - 0.55) / 0.45
        const a = t < 0.55 ? stops[0] : stops[1]
        const bb = t < 0.55 ? stops[1] : stops[2]
        r = a[0] + (bb[0] - a[0]) * seg
        g = a[1] + (bb[1] - a[1]) * seg
        b = a[2] + (bb[2] - a[2]) * seg
      }

      rgba[i] = Math.round(r)
      rgba[i + 1] = Math.round(g)
      rgba[i + 2] = Math.round(b)
      rgba[i + 3] = 255
    }
  }
  return encodePng(size, rgba)
}

for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), makeIcon(size))
  writeFileSync(join(outDir, `icon-maskable-${size}.png`), makeIcon(size, { maskable: true }))
}
console.log('icons written to public/icons')
