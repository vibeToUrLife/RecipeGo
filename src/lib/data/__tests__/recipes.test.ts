import { describe, it, expect, vi, beforeEach } from 'vitest'

// recipes.ts imports 'server-only' (a build-time guard against client bundling);
// it throws outside a server environment, so neutralise it here.
vi.mock('server-only', () => ({}))

// The update chain setRecipeImage builds: from('recipes').update(…).eq(…).select(…).
const holder = vi.hoisted(() => ({
  user: { id: '11111111-2222-4333-8444-555555555555' } as { id: string } | null,
  updated: [{ id: 'r1' }] as { id: string }[] | null,
  error: null as unknown,
  update: vi.fn(),
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: holder.user } }) },
    from: () => ({
      update: (payload: unknown) => {
        holder.update(payload)
        return { eq: () => ({ select: async () => ({ data: holder.updated, error: holder.error }) }) }
      },
    }),
  }),
}))
import { setRecipeImage } from '@/lib/data/recipes'

const mine = `${'11111111-2222-4333-8444-555555555555'}/0f8a4c2e-1b3d-4e5f-8a9b-0c1d2e3f4a5b.jpg`

beforeEach(() => {
  holder.user = { id: '11111111-2222-4333-8444-555555555555' }
  holder.updated = [{ id: 'r1' }]
  holder.error = null
  holder.update.mockClear()
})

describe('setRecipeImage', () => {
  it('saves a photo uploaded to your own folder', async () => {
    expect(await setRecipeImage('r1', mine)).toBe(true)
    expect(holder.update).toHaveBeenCalledWith(expect.objectContaining({ image_path: mine }))
  })

  it.each([
    ['someone else’s folder', 'aaaaaaaa-2222-4333-8444-555555555555/0f8a4c2e-1b3d-4e5f-8a9b-0c1d2e3f4a5b.jpg'],
    ['a path that climbs out of yours', '11111111-2222-4333-8444-555555555555/../x/0f8a4c2e-1b3d-4e5f-8a9b-0c1d2e3f4a5b.jpg'],
    ['a file type uploads never have', '11111111-2222-4333-8444-555555555555/0f8a4c2e-1b3d-4e5f-8a9b-0c1d2e3f4a5b.svg'],
  ])('refuses a photo from %s, without touching the recipe', async (_, path) => {
    expect(await setRecipeImage('r1', path)).toBe(false)
    expect(holder.update).not.toHaveBeenCalled()
  })

  it('reports nothing saved when the recipe isn’t yours to change (no row updated)', async () => {
    holder.updated = []
    expect(await setRecipeImage('r1', mine)).toBe(false)
  })

  it('refuses when signed out', async () => {
    holder.user = null
    expect(await setRecipeImage('r1', mine)).toBe(false)
    expect(holder.update).not.toHaveBeenCalled()
  })
})
