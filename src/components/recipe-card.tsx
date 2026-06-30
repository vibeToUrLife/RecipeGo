'use client'
import Link from 'next/link'
import Image from 'next/image'
import type { Recipe } from '@/lib/db-types'
import { publicImageUrl } from '@/lib/image-url'
import { Card } from '@/components/ui/card'
import { useT } from '@/components/i18n-provider'

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const t = useT()
  const img = publicImageUrl(recipe.image_path)
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0)
  return (
    <Link href={`/recipes/${recipe.id}`}>
      <Card className="overflow-hidden p-0 transition hover:-translate-y-1 hover:shadow-lg">
        <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-accent/40 to-primary/30 text-5xl">
          {img ? (
            <Image src={img} alt={recipe.title} fill className="object-cover" sizes="(max-width:768px) 100vw, 33vw" />
          ) : (
            <span>🍽️</span>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-serif text-lg leading-tight text-primary">{recipe.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {total > 0 ? t('detail.min', { n: total }) : t('card.noTimeSet')} · {t('card.servingsCount', { n: recipe.servings })}
          </p>
        </div>
      </Card>
    </Link>
  )
}
