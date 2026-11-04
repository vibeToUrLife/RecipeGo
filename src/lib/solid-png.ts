import 'server-only'
import { deflateSync } from 'node:zlib'

// A PNG all one colour, as small as one can be: a palette of that colour alone,
// one bit a pixel, every bit 0. An iPhone's whole screen comes to under a KB.
export function solidPng(width: number, height: number, hex: string): Uint8Array {
  const colour = /^#([0-9a-f]{6})$/i.exec(hex)?.[1]
  if (!colour || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`No such image: ${width}x${height} ${hex}`)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 1 // bit depth
  header[9] = 3 // colour type: palette
  // Each row: its filter byte (0, none), then its pixels, eight to a byte.
  const rows = Buffer.alloc((1 + Math.ceil(width / 8)) * height)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('PLTE', Buffer.from(colour, 'hex')),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

let table: Uint32Array | undefined
function crc32(bytes: Buffer): number {
  table ??= Uint32Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  let crc = 0xffffffff
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
