import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RecipePhoto } from '@/components/recipe-photo'

// Just which file each image shows, and how it's fitted.
vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    <span role="img" aria-label={alt || 'backdrop'} data-src={src} className={className} />
  ),
}))

describe('RecipePhoto', () => {
  it('shows the whole photo, fitted rather than cropped, over a blurred copy of itself', () => {
    render(<RecipePhoto src="https://x/photo.jpg" alt="Roast Chicken" sizes="100vw" />)
    const photo = screen.getByRole('img', { name: 'Roast Chicken' })
    expect(photo).toHaveClass('object-contain')
    expect(photo).not.toHaveClass('object-cover')
    const backdrop = screen.getByRole('img', { name: 'backdrop' })
    expect(backdrop).toHaveAttribute('data-src', 'https://x/photo.jpg')
    expect(backdrop).toHaveClass('blur-2xl')
  })

  it('shows the plate when there is no photo', () => {
    const { container } = render(<RecipePhoto src={null} alt="Roast Chicken" sizes="100vw" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
