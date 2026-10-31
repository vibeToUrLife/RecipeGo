import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import manifest from '@/app/manifest'

// A PNG's width and height sit at bytes 16–23 of its header.
function pngSize(file: string): string {
  const buf = fs.readFileSync(file)
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`
}

describe('manifest', () => {
  it('opens full screen at the home page when started from the home screen', () => {
    const m = manifest()
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/')
  })

  it('points at icons in public/ that exist at the sizes it claims', () => {
    const icons = manifest().icons ?? []
    expect(icons.map((i) => i.sizes)).toEqual(['192x192', '512x512', '512x512'])
    for (const icon of icons) expect(pngSize(path.join('public', icon.src))).toBe(icon.sizes)
  })

  it('has the 180px icon iPhones use beside it', () => {
    expect(pngSize('src/app/apple-icon.png')).toBe('180x180')
  })
})
