// @vitest-environment node
//
// The headline SSRF case: a hostname that is NOT a literal private IP (so it
// sails past the static pre-filter) but RESOLVES to a private address. Uses the
// real url-guard and a stub resolver that maps every host to loopback, plus a
// real loopback server that must never be contacted.
//
// Regression guard: delete the isBlockedAddress check inside guardedLookup and
// this test flips — undici connects to the loopback server, `hits` becomes 1,
// and fetchHtml resolves instead of rejecting.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

// Stub resolver: any hostname resolves to 127.0.0.1 (a blocked, private address).
// guardedLookup always calls dns.lookup with { all: true }, so return the array form.
vi.mock('node:dns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:dns')>()
  const lookup = (_hostname: string, _options: unknown, callback: (e: unknown, a: unknown) => void) => {
    callback(null, [{ address: '127.0.0.1', family: 4 }])
  }
  return { ...actual, default: { ...actual, lookup }, lookup }
})

import { fetchHtml } from '@/lib/recipe/fetch-html'

let server: Server
let port: number
let hits = 0

beforeAll(async () => {
  server = createServer((_req, res) => {
    hits++
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<html><body>internal secret</body></html>')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = (server.address() as AddressInfo).port
})
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))
beforeEach(() => { hits = 0 })

describe('fetchHtml — SSRF via DNS resolution', () => {
  it('rejects a hostname that resolves to a private IP, without connecting', async () => {
    await expect(
      fetchHtml(`http://totally-legit-recipes.example:${port}/recipe`),
    ).rejects.toThrow()
    expect(hits).toBe(0)
  })
})
