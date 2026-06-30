import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { fetchHtml } from '@/lib/recipe/fetch-html'
import { extractJsonLd } from '@/lib/recipe/extract-jsonld'
import { findRecipeNode } from '@/lib/recipe/find-recipe-node'
import { normalizeRecipe } from '@/lib/recipe/normalize'
import { isBlockedImportUrl } from '@/lib/recipe/url-guard'
import { createClient } from '@/utils/supabase/server'
import type { ImportedRecipe } from '@/lib/recipe/types'

export const runtime = 'nodejs'

const RECIPE_PATH_RE = /^\/recipes\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/

// If the URL is one of our OWN recipe pages, return its id (so a shared
// RecipeGo link can be imported without scraping the auth-gated HTML).
// reqHost must be a server-controlled value, not the client-supplied Host.
function internalRecipeId(url: string, reqHost: string | null): string | null {
  try {
    const u = new URL(url)
    if (!reqHost || u.host !== reqHost) return null
    const m = u.pathname.match(RECIPE_PATH_RE)
    return m ? m[1] : null
  } catch {
    return null
  }
}

function ingredientLine(i: { name: string; quantity: number | null; unit: string | null }): string {
  const qty = i.quantity != null ? String(i.quantity) : ''
  const unit = qty ? (i.unit ?? '') : '' // a bare unit can't be reconstructed by the parser
  return [qty, unit, i.name].map((p) => (p ?? '').toString().trim()).filter(Boolean).join(' ')
}

async function importSharedRecipe(rid: string, url: string): Promise<ImportedRecipe | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_shareable_recipe', { rid })
  if (error || !data) return null
  const r = data as {
    title: string | null
    description: string | null
    servings: number | null
    prep_minutes: number | null
    cook_minutes: number | null
    source_url: string | null
    ingredients: { name: string; quantity: number | null; unit: string | null }[]
    steps: string[]
  }
  const ings = r.ingredients ?? []
  return {
    name: r.title ?? '',
    description: r.description ?? undefined,
    image: null,
    servings: r.servings ?? null,
    prepMinutes: r.prep_minutes ?? undefined,
    cookMinutes: r.cook_minutes ?? undefined,
    ingredients: ings.map(ingredientLine).filter(Boolean), // string fallback
    structuredIngredients: ings, // preferred — no lossy round-trip
    instructions: (r.steps ?? []).filter(Boolean),
    sourceUrl: url,
  }
}

export async function POST(req: Request) {
  let url: string
  try {
    const body = await req.json()
    url = body.url
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!url || isBlockedImportUrl(url)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // A shared RecipeGo link → read the recipe directly (share-by-link).
  // Use the proxy-set host, never the client-controlled Host header.
  const rid = internalRecipeId(url, req.headers.get('x-forwarded-host') ?? req.headers.get('host'))
  if (rid) {
    const shared = await importSharedRecipe(rid, url)
    if (shared) return NextResponse.json(shared)
    return NextResponse.json({ needsManualEntry: true, name: '', image: null, ingredients: [], instructions: [], servings: null, sourceUrl: url })
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
