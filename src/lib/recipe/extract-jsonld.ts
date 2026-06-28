import * as cheerio from 'cheerio'

export function extractJsonLd(html: string): any[] {
  const $ = cheerio.load(html)
  const nodes: any[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text()
    if (!raw?.trim()) return
    let data: unknown
    try { data = JSON.parse(raw) } catch { return }
    collect(data, nodes)
  })
  return nodes
}

function collect(data: any, out: any[]): void {
  if (Array.isArray(data)) { for (const item of data) collect(item, out); return }
  if (data && typeof data === 'object') {
    if (Array.isArray(data['@graph'])) for (const item of data['@graph']) collect(item, out)
    out.push(data)
  }
}
