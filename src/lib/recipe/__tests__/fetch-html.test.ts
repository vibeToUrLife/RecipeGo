// @vitest-environment node
//
// Redirect re-validation, response-size cap, and the happy path. A real loopback
// HTTP server is the fixture; url-guard is replaced with a controllable double
// that ALLOWS the loopback server (so it can be reached) but BLOCKS the private
// redirect target — the only way to exercise a real server without the real
// guard refusing the loopback connection outright.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

const guard = vi.hoisted(() => ({
  // Block only the metadata target; allow the loopback fixture.
  isBlockedImportUrl: vi.fn((u: string) => u.includes('169.254.169.254')),
  isBlockedAddress: vi.fn((ip: string) => ip === '169.254.169.254'),
}))
vi.mock('@/lib/recipe/url-guard', () => guard)

import { fetchHtml } from '@/lib/recipe/fetch-html'

let server: Server
let base: string
let hits: string[] = []

beforeAll(async () => {
  server = createServer((req, res: ServerResponse) => {
    res.on('error', () => {}) // swallow ECONNRESET when the client aborts an over-size read
    hits.push(req.url ?? '')
    if (req.url === '/ok') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<html><body><h1>ok</h1></body></html>')
    } else if (req.url === '/redirect') {
      res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' })
      res.end()
    } else if (req.url === '/big') {
      res.writeHead(200, { 'content-type': 'text/html' })
      const chunk = 'a'.repeat(64 * 1024)
      const target = 4 * 1024 * 1024 // 4 MiB — over the 3 MiB cap
      let sent = 0
      const pump = () => {
        while (sent < target) {
          sent += chunk.length
          if (!res.write(chunk)) { res.once('drain', pump); return }
        }
        res.end()
      }
      pump()
    } else {
      res.writeHead(404); res.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))
beforeEach(() => { hits = []; guard.isBlockedImportUrl.mockClear(); guard.isBlockedAddress.mockClear() })

describe('fetchHtml — redirects and size cap', () => {
  it('reads a normal small HTML page (happy path)', async () => {
    const html = await fetchHtml(`${base}/ok`)
    expect(html).toContain('<h1>ok</h1>')
  })

  it('rejects a redirect to a private address and re-validates every hop', async () => {
    await expect(fetchHtml(`${base}/redirect`)).rejects.toThrow()
    // The per-hop static guard ran on the redirect TARGET, not just the entry URL.
    expect(guard.isBlockedImportUrl).toHaveBeenCalledWith(
      expect.stringContaining('169.254.169.254'),
    )
    // The metadata endpoint itself was never fetched — the server only saw /redirect.
    expect(hits).toEqual(['/redirect'])
  })

  it('aborts an over-size response body instead of buffering it all', async () => {
    await expect(fetchHtml(`${base}/big`)).rejects.toThrow(/exceeded|too large/i)
  })
})
