import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { fetchHtml } from '@/lib/recipe/fetch-html'
import { extractJsonLd } from '@/lib/recipe/extract-jsonld'
import { findRecipeNode } from '@/lib/recipe/find-recipe-node'
import { normalizeRecipe } from '@/lib/recipe/normalize'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let url: string
  try {
    const body = await req.json()
    url = body.url
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const html = await fetchHtml(url)
    const node = findRecipeNode(extractJsonLd(html))
    if (!node) {
      const $ = cheerio.load(html)
      return NextResponse.json({
        needsManualEntry: true,
        name: $('meta[property="og:title"]').attr('content') ?? $('title').text().trim() ?? '',
        image: $('meta[property="og:image"]').attr('content') ?? null,
        ingredients: [], instructions: [], servings: null, sourceUrl: url,
      })
    }
    return NextResponse.json(normalizeRecipe(node, url))
  } catch {
    return NextResponse.json({ needsManualEntry: true, name: '', image: null, ingredients: [], instructions: [], servings: null, sourceUrl: url })
  }
}
