import * as cheerio from 'cheerio'

// A JSON-LD node is an untrusted object parsed from a scraped page. We only ever
// read keys off it defensively (every value is `unknown` until narrowed), so a
// plain string-keyed record is the honest type — never `any`.
export type JsonLdNode = Record<string, unknown>

export function extractJsonLd(html: string): JsonLdNode[] {
  const $ = cheerio.load(html)
  const nodes: JsonLdNode[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text()
    if (!raw?.trim()) return
    let data: unknown
    try { data = JSON.parse(raw) } catch { return }
    collect(data, nodes)
  })
  return nodes
}

function collect(data: unknown, out: JsonLdNode[]): void {
  if (Array.isArray(data)) { for (const item of data) collect(item, out); return }
  if (data && typeof data === 'object') {
    const graph = (data as JsonLdNode)['@graph']
    if (Array.isArray(graph)) { for (const item of graph) collect(item, out); return }
    out.push(data as JsonLdNode)
  }
}
