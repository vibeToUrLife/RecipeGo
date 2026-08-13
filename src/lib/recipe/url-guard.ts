// STATIC pre-filter for import URLs: scheme allow-list + literal private-IP
// ranges. This alone does NOT cover DNS-rebinding or redirect-to-private — those
// are handled by the dynamic layer in fetch-html.ts (resolved-IP validation,
// socket pinning, and per-redirect-hop re-validation), which reuses the
// isPrivateIPv4 / isBlockedIPv6 / isBlockedAddress checks below.

export function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length !== 4) return false
  const octets = parts.map(Number)
  if (octets.some(o => !Number.isInteger(o) || o < 0 || o > 255)) return false
  const [a, b] = octets
  // loopback 127.0.0.0/8
  if (a === 127) return true
  // link-local 169.254.0.0/16 (covers cloud metadata endpoints)
  if (a === 169 && b === 254) return true
  // private 10.0.0.0/8
  if (a === 10) return true
  // private 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true
  // private 192.168.0.0/16
  if (a === 192 && b === 168) return true
  return false
}

export function isBlockedIPv6(addr: string): boolean {
  const normalized = addr.toLowerCase()
  // loopback ::1
  if (normalized === '::1') return true
  // IPv4-mapped IPv6 ::ffff:0:0/96 (e.g. ::ffff:7f00:1 == 127.0.0.1); Node/undici
  // connects to the underlying IPv4, so block the whole mapped range.
  if (normalized.startsWith('::ffff:')) return true
  // unique-local fc00::/7 — starts with fc or fd
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  // link-local fe80::/10
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
      normalized.startsWith('fea') || normalized.startsWith('feb')) return true
  return false
}

// Classify a resolved IP literal (from a DNS answer) as blocked. Used by the
// dynamic SSRF layer to reject a connection whose hostname resolves into a
// private range. Reuses the same range checks as the static hostname guard,
// plus 0.0.0.0/8 (the "this host / unspecified" block).
export function isBlockedAddress(ip: string): boolean {
  const addr = ip.toLowerCase()
  if (addr.includes(':')) return isBlockedIPv6(addr)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(addr)) {
    if (Number(addr.split('.', 1)[0]) === 0) return true // 0.0.0.0/8
    return isPrivateIPv4(addr)
  }
  // A resolved address should always be an IP literal; anything else is
  // unexpected, so fail closed.
  return true
}

export function isBlockedImportUrl(raw: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return true
  }

  const proto = parsed.protocol
  if (proto !== 'http:' && proto !== 'https:') return true

  const hostname = parsed.hostname.toLowerCase()

  // block localhost and .local / .internal suffixes and 0.0.0.0
  if (hostname === 'localhost' || hostname === '0.0.0.0') return true
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true

  // bracketed IPv6 literal — parsed.hostname strips the brackets
  if (hostname.startsWith('[') || (parsed.hostname.includes(':') && !parsed.hostname.includes('.'))) {
    // URL strips brackets; check the raw hostname
    return isBlockedIPv6(hostname.replace(/^\[|\]$/g, ''))
  }
  // plain IPv6 (no brackets in some edge parsers) — contains colon
  if (hostname.includes(':')) {
    return isBlockedIPv6(hostname)
  }

  // IPv4 literal
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return isPrivateIPv4(hostname)
  }

  return false
}
