import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/recipe/fetch-html', () => ({
  fetchHtml: vi.fn(async () => `<script type="application/ld+json">{"@type":"Recipe","name":"Pancakes","recipeIngredient":["200g flour"],"recipeInstructions":["Mix"]}</script>`),
}))

import { POST } from '../route'

function req(body: unknown) {
  return new Request('http://localhost/api/import-recipe', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/import-recipe', () => {
  beforeEach(() => vi.clearAllMocks())
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
})
