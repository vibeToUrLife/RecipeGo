import * as cheerio from 'cheerio'
import type { ImportedRecipe } from '@/lib/recipe/types'

export function parseDurationToMinutes(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined
  const m = value.trim().match(/^P(?:([\d.]+)D)?(?:T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:[\d.]+S)?)?$/i)
  if (!m) return undefined
  const days = parseFloat(m[1] ?? '0')
  const hours = parseFloat(m[2] ?? '0')
  const mins = parseFloat(m[3] ?? '0')
  const total = days * 1440 + hours * 60 + mins
  return total > 0 ? Math.round(total) : undefined
}

const clean = (s: string) => cheerio.load(s).text().replace(/\s+/g, ' ').trim()

function textOf(v: any): string {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') return String(v.text ?? v.name ?? '')
  return ''
}

export function normalizeInstructions(raw: unknown): string[] {
  const out: string[] = []
  const walk = (node: any) => {
    if (node == null) return
    if (typeof node === 'string') {
      node.split(/\r?\n+/).map(clean).filter(Boolean).forEach((s) => out.push(s))
      return
    }
    if (Array.isArray(node)) { node.forEach(walk); return }
    const types = ([] as string[]).concat(node['@type'] ?? [])
    if (types.includes('HowToSection') || Array.isArray(node.itemListElement)) {
      walk(node.itemListElement); return
    }
    const t = clean(textOf(node))
    if (t) out.push(t)
  }
  walk(raw)
  return out
}

function firstImage(image: any): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (Array.isArray(image)) return firstImage(image[0])
  if (typeof image === 'object') return image.url ?? null
  return null
}

function parseServings(y: any): number | null {
  if (typeof y === 'number') return y
  if (Array.isArray(y)) return parseServings(y[0])
  if (typeof y === 'string') { const m = y.match(/\d+/); return m ? Number(m[0]) : null }
  return null
}

export function normalizeRecipe(node: any, url: string): ImportedRecipe {
  const ingredients = (Array.isArray(node.recipeIngredient) ? node.recipeIngredient : [])
    .map((s: any) => clean(String(s))).filter(Boolean)
  return {
    name: clean(String(node.name ?? '')),
    image: firstImage(node.image),
    servings: parseServings(node.recipeYield),
    prepMinutes: parseDurationToMinutes(node.prepTime),
    cookMinutes: parseDurationToMinutes(node.cookTime),
    ingredients,
    instructions: normalizeInstructions(node.recipeInstructions),
    sourceUrl: url,
  }
}
