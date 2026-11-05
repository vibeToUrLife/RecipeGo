import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { crc32, inflateSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'

// solid-png.ts imports 'server-only' (a build-time guard against client bundling).
vi.mock('server-only', () => ({}))

import { APPLE_WEB_APP_CAPABLE, LAUNCH_COLOURS, LAUNCH_IMAGES, launchStartupImages } from '@/lib/launch-screens'
import { solidPng } from '@/lib/solid-png'
import { GET, generateStaticParams } from '@/app/launch/[image]/route'

// Reads a PNG back: its size, its palette, its pixels, and that every chunk's
// checksum holds.
function readPng(png: Uint8Array) {
  const bytes = Buffer.from(png)
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const chunks: Record<string, Buffer> = {}
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at)
    const type = bytes.toString('latin1', at + 4, at + 8)
    const data = bytes.subarray(at + 8, at + 8 + length)
    expect(bytes.readUInt32BE(at + 8 + length)).toBe(crc32(bytes.subarray(at + 4, at + 8 + length)))
    chunks[type] = data
    at += 12 + length
  }
  expect(Object.keys(chunks)).toEqual(['IHDR', 'PLTE', 'IDAT', 'IEND'])
  const width = chunks.IHDR.readUInt32BE(0)
  const height = chunks.IHDR.readUInt32BE(4)
  return {
    width,
    height,
    depth: chunks.IHDR[8],
    colourType: chunks.IHDR[9],
    palette: `#${chunks.PLTE.toString('hex')}`,
    pixels: inflateSync(chunks.IDAT),
  }
}

describe('the iPhone launch images', () => {
  it('cover every iPhone screen, in light and in dark, each image exactly the screen’s pixels', () => {
    for (const { file, width, height, theme, media } of LAUNCH_IMAGES) {
      const screen = /^\(prefers-color-scheme: (\w+)\) and \(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: portrait\)$/.exec(media)
      expect(screen, media).not.toBeNull()
      const [, scheme, w, h, ratio] = screen!
      expect(scheme).toBe(theme)
      expect([width, height]).toEqual([Number(w) * Number(ratio), Number(h) * Number(ratio)])
      expect(file).toBe(`${width}x${height}-${theme}.png`)
    }
    // Eleven screens, each once in each theme.
    expect(new Set(LAUNCH_IMAGES.map(({ media }) => media)).size).toBe(22)
    expect(new Set(LAUNCH_IMAGES.map(({ file }) => file)).size).toBe(22)
    // Today's largest and an older, smaller one.
    expect(LAUNCH_IMAGES.map(({ file }) => file)).toEqual(expect.arrayContaining(['1320x2868-dark.png', '750x1334-light.png']))
  })

  it('are the welcome animation’s own colours, so the app opens straight into it', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
    expect(css).toMatch(new RegExp(`\\.splash \\{[^}]*background: ${LAUNCH_COLOURS.light};`))
    expect(css).toContain(`.dark .splash { background: ${LAUNCH_COLOURS.dark}; }`)
  })

  it('come with Apple’s own web app tag, without which an iPhone shows a black screen instead', () => {
    expect(APPLE_WEB_APP_CAPABLE).toEqual({ 'apple-mobile-web-app-capable': 'yes' })
    const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')
    expect(layout).toMatch(/other: \{ \.\.\.APPLE_WEB_APP_CAPABLE \}/)
  })

  it('are named in every page’s head, under /launch', () => {
    expect(launchStartupImages()).toHaveLength(22)
    expect(launchStartupImages()[0]).toEqual({ url: `/launch/${LAUNCH_IMAGES[0].file}`, media: LAUNCH_IMAGES[0].media })
  })

  it('are drawn as real PNGs, all one colour, and small', () => {
    const png = solidPng(1320, 2868, '#a24a2c')
    const read = readPng(png)
    expect(read).toMatchObject({ width: 1320, height: 2868, depth: 1, colourType: 3, palette: '#a24a2c' })
    // Each row its filter byte and 1320 one-bit pixels, all of them the palette's colour.
    expect(read.pixels.length).toBe((1 + 165) * 2868)
    expect(read.pixels.every((byte) => byte === 0)).toBe(true)
    expect(png.length).toBeLessThan(2048)

    // A width that isn't a whole number of bytes still has whole rows.
    expect(readPng(solidPng(750, 1334, '#c65d3b')).pixels.length).toBe((1 + 94) * 1334)
    expect(() => solidPng(0, 10, '#c65d3b')).toThrow(RangeError)
    expect(() => solidPng(10, 10, 'terracotta')).toThrow(RangeError)
  })

  it('are each served at its name, and nothing else is', async () => {
    expect(generateStaticParams()).toEqual(LAUNCH_IMAGES.map(({ file }) => ({ image: file })))
    const served = await GET(new Request('https://recipego.test/launch/1179x2556-light.png'), { params: Promise.resolve({ image: '1179x2556-light.png' }) })
    expect(served.status).toBe(200)
    expect(served.headers.get('content-type')).toBe('image/png')
    expect(readPng(new Uint8Array(await served.arrayBuffer()))).toMatchObject({ width: 1179, height: 2556, palette: LAUNCH_COLOURS.light })

    const unknown = await GET(new Request('https://recipego.test/launch/1x1-light.png'), { params: Promise.resolve({ image: '1x1-light.png' }) })
    expect(unknown.status).toBe(404)
  })
})
