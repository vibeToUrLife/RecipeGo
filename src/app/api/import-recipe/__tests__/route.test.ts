import { describe, it, expect, vi, beforeEach } from 'vitest'

// rate-limit.ts imports 'server-only' (a build-time guard against client bundling);
// neutralize it under the jsdom test environment.
vi.mock('server-only', () => ({}))

vi.mock('@/lib/recipe/fetch-html', () => ({
  fetchHtml: vi.fn(async () => `<script type="application/ld+json">{"@type":"Recipe","name":"Pancakes","recipeIngredient":["200g flour"],"recipeInstructions":["Mix"]}</script>`),
}))

// The route now authenticates (for the per-user rate-limit key), so stub the
// server client to return a signed-in user.
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'test-user' } } })) },
    rpc: vi.fn(async () => ({ data: null, error: null })),
  })),
}))

import { POST } from '../route'
import { resetRateLimit } from '@/lib/rate-limit'

function req(body: unknown) {
  return new Request('http://localhost/api/import-recipe', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/import-recipe', () => {
  beforeEach(() => { vi.clearAllMocks(); resetRateLimit() })
  it('returns 400 for missing/invalid url', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
  })
  it('returns 400 for non-http url (SSRF guard)', async () => {
    const res = await POST(req({ url: 'file:///etc/passwd' }))
    expect(res.status).toBe(400)
  })
  it('returns normalized recipe for a valid url', async () => {
    const res = await POST(req({ url: 'https://example.com/r' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('Pancakes')
    expect(json.ingredients).toEqual(['200g flour'])
  })
  it('rate-limits a single user after 10 imports in the window', async () => {
    for (let i = 0; i < 10; i++) {
      const ok = await POST(req({ url: 'https://example.com/r' }))
      expect(ok.status).toBe(200)
    }
    const blocked = await POST(req({ url: 'https://example.com/r' }))
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeTruthy()
  })
})
