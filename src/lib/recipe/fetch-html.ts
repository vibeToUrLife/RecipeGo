export async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('html')) throw new Error(`Not HTML: ${ct}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}
