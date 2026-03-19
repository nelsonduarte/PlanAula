#!/usr/bin/env node
// Generates build/icon.png (256×256) and build/icon.ico without external dependencies
const { deflateSync } = require('zlib')
const { writeFileSync, mkdirSync, existsSync } = require('fs')
const { join } = require('path')

const buildDir = join(__dirname, '..', 'build')
if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true })

// ── CRC32 (required by PNG) ────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const tb = Buffer.from(type, 'ascii')
  const lb = Buffer.allocUnsafe(4); lb.writeUInt32BE(data.length, 0)
  const cb = Buffer.allocUnsafe(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0)
  return Buffer.concat([lb, tb, data, cb])
}

function makePNG(size, getPixel) {
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr.writeUInt8(8, 8)  // bit depth
  ihdr.writeUInt8(6, 9)  // RGBA
  ihdr.writeUInt8(0, 10); ihdr.writeUInt8(0, 11); ihdr.writeUInt8(0, 12)

  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 4)
    row[0] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = getPixel(x, y)
      row[1 + x * 4] = r; row[2 + x * 4] = g; row[3 + x * 4] = b; row[4 + x * 4] = a
    }
    rows.push(row)
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// ── Draw icon ─────────────────────────────────────────────────────────────────
function drawIcon(size) {
  const buf = new Uint8Array(size * size * 4)

  const px = (x, y, r, g, b, a = 255) => {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (y * size + x) * 4
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a
  }

  const rect = (x1, y1, x2, y2, r, g, b, a = 255) => {
    for (let y = Math.max(0, Math.round(y1)); y <= Math.min(size - 1, Math.round(y2)); y++)
      for (let x = Math.max(0, Math.round(x1)); x <= Math.min(size - 1, Math.round(x2)); x++) {
        const i = (y * size + x) * 4
        buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a
      }
  }

  const circle = (cx, cy, rad, r, g, b, a = 255) => {
    const r2 = rad * rad
    for (let y = Math.max(0, Math.round(cy - rad)); y <= Math.min(size - 1, Math.round(cy + rad)); y++)
      for (let x = Math.max(0, Math.round(cx - rad)); x <= Math.min(size - 1, Math.round(cx + rad)); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) {
          const i = (y * size + x) * 4
          buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a
        }
  }

  const roundRect = (x1, y1, x2, y2, rad, r, g, b, a = 255) => {
    const rr = Math.min(rad, (x2 - x1) / 2, (y2 - y1) / 2)
    rect(x1 + rr, y1, x2 - rr, y2, r, g, b, a)
    rect(x1, y1 + rr, x2, y2 - rr, r, g, b, a)
    circle(x1 + rr, y1 + rr, rr, r, g, b, a)
    circle(x2 - rr, y1 + rr, rr, r, g, b, a)
    circle(x1 + rr, y2 - rr, rr, r, g, b, a)
    circle(x2 - rr, y2 - rr, rr, r, g, b, a)
  }

  const S = size / 256

  // Background: dark blue #1E40AF
  roundRect(0, 0, size - 1, size - 1, 36 * S, 30, 64, 175)

  // ── Graduation cap ──────────────────────────────────────────────────────────
  // Brim (flat wide band)
  roundRect(24 * S, 70 * S, 232 * S, 94 * S, 4 * S, 255, 255, 255)
  // Crown (body above brim center)
  rect(86 * S, 94 * S, 170 * S, 148 * S, 255, 255, 255)
  // Top button
  circle(128 * S, 64 * S, 10 * S, 255, 255, 255)
  // Tassel string
  rect(125 * S, 148 * S, 131 * S, 176 * S, 255, 255, 255)
  // Tassel ball (gold)
  circle(128 * S, 186 * S, 12 * S, 255, 210, 60)

  // ── Open book ───────────────────────────────────────────────────────────────
  // Left page
  roundRect(28 * S, 200 * S, 118 * S, 246 * S, 6 * S, 210, 224, 252)
  // Right page
  roundRect(138 * S, 200 * S, 228 * S, 246 * S, 6 * S, 210, 224, 252)
  // Spine
  rect(115 * S, 204 * S, 141 * S, 242 * S, 160, 185, 238)
  // Left page lines
  rect(40 * S, 213 * S, 106 * S, 217 * S, 130, 155, 215)
  rect(40 * S, 224 * S, 106 * S, 228 * S, 130, 155, 215)
  rect(40 * S, 235 * S, 88 * S, 239 * S, 130, 155, 215)
  // Right page lines
  rect(150 * S, 213 * S, 216 * S, 217 * S, 130, 155, 215)
  rect(150 * S, 224 * S, 216 * S, 228 * S, 130, 155, 215)
  rect(150 * S, 235 * S, 198 * S, 239 * S, 130, 155, 215)

  return (x, y) => {
    const i = (y * size + x) * 4
    return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]
  }
}

// ── ICO format (embeds PNG data directly — supported since Windows Vista) ──────
function makeICO(sizes, pngBuffers) {
  const count = sizes.length
  const header = Buffer.allocUnsafe(6)
  header.writeUInt16LE(0, 0)      // reserved
  header.writeUInt16LE(1, 2)      // type: icon
  header.writeUInt16LE(count, 4)  // image count

  const entries = []
  let offset = 6 + 16 * count
  for (let i = 0; i < count; i++) {
    const e = Buffer.allocUnsafe(16)
    const sz = sizes[i]
    e.writeUInt8(sz >= 256 ? 0 : sz, 0)   // width  (0 means 256)
    e.writeUInt8(sz >= 256 ? 0 : sz, 1)   // height
    e.writeUInt8(0, 2)                      // color count
    e.writeUInt8(0, 3)                      // reserved
    e.writeUInt16LE(1, 4)                   // planes
    e.writeUInt16LE(32, 6)                  // bit count
    e.writeUInt32LE(pngBuffers[i].length, 8)
    e.writeUInt32LE(offset, 12)
    entries.push(e)
    offset += pngBuffers[i].length
  }

  return Buffer.concat([header, ...entries, ...pngBuffers])
}

// ── Generate ──────────────────────────────────────────────────────────────────
console.log('Generating icon...')

const png256 = makePNG(256, drawIcon(256))
const png48  = makePNG(48,  drawIcon(48))
const png32  = makePNG(32,  drawIcon(32))
const png16  = makePNG(16,  drawIcon(16))

writeFileSync(join(buildDir, 'icon.png'), png256)
console.log('✓ build/icon.png')

writeFileSync(join(buildDir, 'icon.ico'), makeICO([256, 48, 32, 16], [png256, png48, png32, png16]))
console.log('✓ build/icon.ico')
