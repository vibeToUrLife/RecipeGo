// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isBlockedImportUrl, isBlockedAddress } from '../url-guard'

describe('isBlockedImportUrl', () => {
  it('allows a normal https url', () => {
    expect(isBlockedImportUrl('https://example.com/recipe')).toBe(false)
  })
  it('allows a normal http url', () => {
    expect(isBlockedImportUrl('http://example.com')).toBe(false)
  })
  it('blocks ftp scheme (non-http(s))', () => {
    expect(isBlockedImportUrl('ftp://example.com')).toBe(true)
  })
  it('blocks file:// scheme', () => {
    expect(isBlockedImportUrl('file:///etc/passwd')).toBe(true)
  })
  it('blocks unparseable strings', () => {
    expect(isBlockedImportUrl('not a url')).toBe(true)
  })
  it('blocks localhost', () => {
    expect(isBlockedImportUrl('http://localhost/x')).toBe(true)
  })
  it('blocks 127.0.0.1 (loopback)', () => {
    expect(isBlockedImportUrl('http://127.0.0.1/x')).toBe(true)
  })
  it('blocks 169.254.169.254 (cloud metadata)', () => {
    expect(isBlockedImportUrl('http://169.254.169.254/latest/meta-data')).toBe(true)
  })
  it('blocks 10.x.x.x private range', () => {
    expect(isBlockedImportUrl('http://10.0.0.5/x')).toBe(true)
  })
  it('blocks 192.168.x.x private range', () => {
    expect(isBlockedImportUrl('http://192.168.1.1/x')).toBe(true)
  })
  it('blocks 172.16.x.x private range', () => {
    expect(isBlockedImportUrl('http://172.16.0.1/x')).toBe(true)
  })
  it('blocks IPv6 loopback ::1', () => {
    expect(isBlockedImportUrl('http://[::1]/x')).toBe(true)
  })
  it('blocks IPv4-mapped IPv6 (::ffff: range) that resolves to a private IPv4', () => {
    expect(isBlockedImportUrl('http://[::ffff:127.0.0.1]/x')).toBe(true)
    expect(isBlockedImportUrl('http://[::ffff:192.168.1.1]/x')).toBe(true)
  })
})

// isBlockedAddress classifies a *resolved* IP literal (a DNS answer) — this is
// what the dynamic layer applies to every address a hostname resolves to.
describe('isBlockedAddress (resolved-IP classifier)', () => {
  it.each([
    ['127.0.0.1', true],   // loopback
    ['127.9.9.9', true],   // 127/8
    ['10.0.0.5', true],    // 10/8
    ['172.16.0.1', true],  // 172.16/12 low edge
    ['172.31.255.255', true],
    ['172.32.0.1', false], // just outside 172.16/12
    ['192.168.1.1', true], // 192.168/16
    ['169.254.169.254', true], // link-local / cloud metadata
    ['0.0.0.0', true],     // unspecified / this-host
    ['0.1.2.3', true],     // 0/8
    ['8.8.8.8', false],    // public
    ['93.184.216.34', false], // public
  ])('classifies IPv4 %s as blocked=%s', (ip, blocked) => {
    expect(isBlockedAddress(ip as string)).toBe(blocked)
  })

  it.each([
    ['::1', true],           // loopback
    ['fc00::1', true],       // ULA fc00::/7
    ['fd12:3456::1', true],  // ULA
    ['fe80::1', true],       // link-local
    ['::ffff:127.0.0.1', true], // IPv4-mapped loopback
    ['2606:4700:4700::1111', false], // public (Cloudflare)
  ])('classifies IPv6 %s as blocked=%s', (ip, blocked) => {
    expect(isBlockedAddress(ip as string)).toBe(blocked)
  })
})
