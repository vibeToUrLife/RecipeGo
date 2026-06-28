// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isBlockedImportUrl } from '../url-guard'

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
