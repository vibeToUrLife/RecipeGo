// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { extractJsonLd } from '@/lib/recipe/extract-jsonld'
import { findRecipeNode } from '@/lib/recipe/find-recipe-node'

const html = `
<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
  {"@type":"WebPage","name":"x"},
  {"@type":["Recipe","Article"],"name":"Pancakes","recipeIngredient":["200g flour","2 eggs"]}
]}</script>
<script type="application/ld+json">{ bad json </script>
</head><body></body></html>`

describe('extractJsonLd + findRecipeNode', () => {
  it('flattens @graph and skips malformed blocks', () => {
    const nodes = extractJsonLd(html)
    expect(nodes.length).toBeGreaterThanOrEqual(2)
  })
  it('finds the Recipe node even when @type is an array', () => {
    const node = findRecipeNode(extractJsonLd(html))
    expect(node?.name).toBe('Pancakes')
  })
  it('returns null when no recipe present', () => {
    expect(findRecipeNode([{ '@type': 'WebPage' }])).toBe(null)
  })
})
