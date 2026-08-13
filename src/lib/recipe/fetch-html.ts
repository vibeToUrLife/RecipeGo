import { Agent, fetch as undiciFetch, type Response as UndiciResponse } from 'undici'
import { lookup as dnsLookup } from 'node:dns'
import type { LookupFunction } from 'node:net'
import { isBlockedImportUrl, isBlockedAddress } from '@/lib/recipe/url-guard'

const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3
const MAX_BYTES = 3 * 1024 * 1024 // 3 MiB — ample for recipe HTML, bounds memory

interface LookupAddress { address: string; family: number }

// DNS lookup used by the undici Agent's connector. It resolves every address a
// hostname points at, refuses the whole connection if ANY of them is a
// private/loopback/link-local/ULA address, and otherwise hands the vetted IP
// straight to the socket.
//
// Why validate *inside* the lookup (socket pinning) rather than "resolve, check,
// then fetch(url)"? Because a plain fetch re-resolves the hostname independently
// when it opens the socket. Between our check and that second resolution an
// attacker's DNS server can return a fresh answer — a public IP the first time
// (passes the check) and 169.254.169.254 the second time (the actual connect).
// That TOCTOU is exactly DNS rebinding. Here undici connects to precisely the
// address this function returns, so the IP we approved is the IP we talk to;
// there is no second, unchecked resolution.
function guardedLookup(
  hostname: string,
  options: { all?: boolean; family?: number },
  callback: (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void,
): void {
  dnsLookup(hostname, { all: true }, (err, resolved) => {
    if (err) return callback(err)
    const addrs = resolved as unknown as LookupAddress[]
    if (addrs.length === 0) return callback(new Error(`No addresses for ${hostname}`))
    for (const a of addrs) {
      if (isBlockedAddress(a.address)) {
        return callback(new Error(`Blocked private address for ${hostname}: ${a.address}`))
      }
    }
    if (options.all) return callback(null, addrs)
    const pick = options.family ? addrs.find((a) => a.family === options.family) ?? addrs[0] : addrs[0]
    callback(null, pick.address, pick.family)
  })
}

// One shared agent: the validating connector is applied to every connection,
// including each redirect hop (a new connection through the same agent).
const safeAgent = new Agent({ connect: { lookup: guardedLookup as unknown as LookupFunction } })

// Read the body as UTF-8 text but never buffer more than MAX_BYTES. `res.text()`
// would buffer the whole response, so a malicious/huge page could exhaust memory.
// We stream, count bytes, and abort the moment the cap is crossed.
async function readCapped(res: UndiciResponse): Promise<string> {
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    throw new Error(`Response too large: ${declared} bytes`)
  }
  if (!res.body) return ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let html = ''
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) throw new Error(`Response exceeded ${MAX_BYTES} bytes`)
      html += decoder.decode(value, { stream: true })
    }
    html += decoder.decode() // flush any trailing multi-byte sequence
    return html
  } finally {
    // Release the socket if we bailed out early (over-size / abort).
    reader.cancel().catch(() => {})
  }
}

export async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let current = url
    for (let hop = 0; ; hop++) {
      // Re-run the full static guard on EVERY hop, not just the first URL — a
      // redirect can point at a new scheme or a literal private IP.
      if (isBlockedImportUrl(current)) throw new Error(`Blocked URL: ${current}`)

      const res = await undiciFetch(current, {
        redirect: 'manual', // we follow redirects ourselves so each hop is re-validated
        signal: controller.signal,
        dispatcher: safeAgent, // resolved-IP validation + socket pinning happen here
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      })

      const isRedirect = res.status >= 300 && res.status < 400 && res.headers.has('location')
      if (isRedirect) {
        if (hop >= MAX_REDIRECTS) throw new Error('Too many redirects')
        // Resolve relative redirects against the current URL; the next loop
        // iteration re-validates it (static guard + connect-time resolved-IP check).
        current = new URL(res.headers.get('location')!, current).toString()
        continue
      }

      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('html')) throw new Error(`Not HTML: ${ct}`)
      return await readCapped(res)
    }
  } finally {
    clearTimeout(t)
  }
}
