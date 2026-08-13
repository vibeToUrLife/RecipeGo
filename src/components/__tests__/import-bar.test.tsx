import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toast } from 'sonner'
import { ImportBar } from '@/components/import-bar'

vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

function typeUrlAndImport() {
  fireEvent.change(screen.getByPlaceholderText('https://example.com/best-pancakes'), {
    target: { value: 'https://example.com/pancakes' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'form.import' }))
}

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    headers: new Headers(init.headers ?? {}),
    json: async () => body,
  } as Response
}

describe('ImportBar', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('fills the form and reports success on a real import', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      name: 'Pancakes', image: null, servings: 4,
      ingredients: ['2 eggs'], instructions: ['Whisk'], sourceUrl: 'https://example.com/pancakes',
    })))
    const onImported = vi.fn()

    render(<ImportBar onImported={onImported} />)
    typeUrlAndImport()

    await waitFor(() => expect(onImported).toHaveBeenCalledOnce())
    expect(toast.success).toHaveBeenCalledWith('form.importedOk')
  })

  // fetch() resolves for 4xx/5xx, so an unchecked response used to be cast to a
  // recipe: the rate limiter fired, and the user saw a success toast and an
  // empty form.
  it('surfaces a rate limit instead of reporting a successful import', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(
      { error: 'Too many imports — please slow down.' },
      { status: 429, headers: { 'Retry-After': '42' } },
    )))
    const onImported = vi.fn()

    render(<ImportBar onImported={onImported} />)
    typeUrlAndImport()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('form.importRateLimited'))
    expect(onImported).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('explains a rejected URL rather than silently emptying the form', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Invalid URL' }, { status: 400 })))
    const onImported = vi.fn()

    render(<ImportBar onImported={onImported} />)
    typeUrlAndImport()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('form.importBadUrl'))
    expect(onImported).not.toHaveBeenCalled()
  })

  it('tells the user to sign in again when the session expired', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Unauthorized' }, { status: 401 })))
    const onImported = vi.fn()

    render(<ImportBar onImported={onImported} />)
    typeUrlAndImport()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('form.importSignedOut'))
    expect(onImported).not.toHaveBeenCalled()
  })

  it('rejects a 200 body that is not actually a recipe', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ unexpected: true })))
    const onImported = vi.fn()

    render(<ImportBar onImported={onImported} />)
    typeUrlAndImport()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('form.importFailed'))
    expect(onImported).not.toHaveBeenCalled()
  })

  it('still hands over a page it could not parse, so the form opens for manual entry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      needsManualEntry: true, name: '', image: null, servings: null,
      ingredients: [], instructions: [], sourceUrl: 'https://example.com/pancakes',
    })))
    const onImported = vi.fn()

    render(<ImportBar onImported={onImported} />)
    typeUrlAndImport()

    await waitFor(() => expect(onImported).toHaveBeenCalledOnce())
    expect(toast.info).toHaveBeenCalledWith('form.importManual')
    expect(toast.error).not.toHaveBeenCalled()
  })
})
