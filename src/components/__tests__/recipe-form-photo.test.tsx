import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecipeForm } from '@/components/recipe-form'
import { saveRecipeImageAction } from '@/app/recipes/actions'
import type { RecipeWithChildren } from '@/lib/db-types'

vi.mock('@/app/recipes/actions', () => ({ saveRecipe: vi.fn(), saveRecipeImageAction: vi.fn() }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))
// Each uploader the form draws, with what it was handed.
const uploaders = vi.hoisted(() => [] as { name?: string; onUploaded?: (path: string) => Promise<boolean> }[])
vi.mock('@/components/image-upload', () => ({
  ImageUpload: (props: { name?: string; onUploaded?: (path: string) => Promise<boolean> }) => {
    uploaders.push(props)
    return null
  },
}))

const recipe = {
  id: 'r1', user_id: 'u1', room_id: null, title: 'Roast Chicken', description: null, image_path: null,
  servings: 4, prep_minutes: null, cook_minutes: null, difficulty: null, source_url: null,
  created_at: '', updated_at: '',
  ingredients: [], steps: [{ id: 's1', recipe_id: 'r1', step_number: 1, text: 'Roast it', image_path: null }],
} as unknown as RecipeWithChildren

const last = (name: string) => uploaders.filter((u) => u.name === name).at(-1)!

beforeEach(() => {
  uploaders.length = 0
  vi.mocked(saveRecipeImageAction).mockReset()
})

describe('RecipeForm photo', () => {
  it('saves a new photo to a recipe that exists the moment it uploads', async () => {
    vi.mocked(saveRecipeImageAction).mockResolvedValue({ ok: true })
    render(<RecipeForm recipe={recipe} rooms={[]} />)
    expect(await last('image_path').onUploaded!('u1/photo.jpg')).toBe(true)
    expect(saveRecipeImageAction).toHaveBeenCalledWith('r1', 'u1/photo.jpg')
  })

  it('passes on that it couldn’t be saved', async () => {
    vi.mocked(saveRecipeImageAction).mockResolvedValue({ ok: false })
    render(<RecipeForm recipe={recipe} rooms={[]} />)
    expect(await last('image_path').onUploaded!('u1/photo.jpg')).toBe(false)
  })

  it('leaves a new recipe’s photo, and step photos, to be saved with the form', () => {
    render(<RecipeForm rooms={[]} />)
    expect(last('image_path').onUploaded).toBeUndefined()
    uploaders.length = 0
    render(<RecipeForm recipe={recipe} rooms={[]} />)
    expect(last('step_image').onUploaded).toBeUndefined()
  })
})
