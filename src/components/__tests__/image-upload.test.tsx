import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toast } from 'sonner'
import { ImageUpload } from '@/components/image-upload'

vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const upload = vi.fn()
const getUser = vi.fn()
vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser },
    storage: { from: (bucket: string) => ({ upload: (...a: unknown[]) => upload(bucket, ...a) }) },
  }),
}))

function pick(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
  return input
}

const file = (name: string, type: string, size = 16) =>
  new File([new Uint8Array(size)], name, { type })

const button = () => screen.getByRole('button')
const hidden = () => document.querySelector('input[type="hidden"]') as HTMLInputElement

describe('ImageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    upload.mockResolvedValue({ error: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('uploads under the signed-in user’s folder and publishes the key to the form', async () => {
    render(<ImageUpload />)
    pick(file('dinner.jpg', 'image/jpeg'))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('img.uploaded'))
    const [bucket, key] = upload.mock.calls[0]
    expect(bucket).toBe('recipe-images')
    expect(key).toMatch(/^user-1\/[0-9a-f-]{36}\.jpg$/)
    expect(hidden().value).toBe(key)
    expect(button()).not.toBeDisabled()
  })

  // storage-js re-throws anything that isn't a StorageError, so an offline phone
  // or a blocked request used to escape the handler and pin the button on
  // "Uploading…" with no toast — the upload looked dead with nothing to click.
  it('recovers from a thrown upload instead of hanging on "uploading"', async () => {
    upload.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<ImageUpload />)
    pick(file('dinner.jpg', 'image/jpeg'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('img.uploadFailed'))
    expect(button()).toHaveTextContent('form.uploadImage')
    expect(button()).not.toBeDisabled()
  })

  it('recovers when the session lookup itself throws', async () => {
    getUser.mockRejectedValue(new Error('network'))
    render(<ImageUpload />)
    pick(file('dinner.jpg', 'image/jpeg'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('img.uploadFailed'))
    expect(button()).not.toBeDisabled()
  })

  // Choosing the same file twice fires no change event unless the input is
  // cleared, so a failed upload was previously unretryable without a reload.
  it('clears the picker so the same file can be chosen again', async () => {
    upload.mockResolvedValue({ error: { statusCode: '500', message: 'boom' } })
    render(<ImageUpload />)
    const input = pick(file('dinner.jpg', 'image/jpeg'))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(input.value).toBe('')
  })

  it('rejects an oversized image locally, naming the limit', async () => {
    render(<ImageUpload />)
    pick(file('huge.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('img.tooLarge'))
    expect(upload).not.toHaveBeenCalled()
  })

  it('rejects a type the bucket does not allow', async () => {
    render(<ImageUpload />)
    pick(file('photo.heic', 'image/heic'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('img.unsupportedType'))
    expect(upload).not.toHaveBeenCalled()
  })

  // Android's photo picker routinely hands over a File with an empty type; the
  // bytes are a normal JPEG, so recover the type from the name and relabel the
  // body — Storage matches the uploaded part against allowed_mime_types.
  it('recovers the type from the filename when the picker omits it', async () => {
    render(<ImageUpload />)
    pick(file('IMG_0042.JPEG', ''))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('img.uploaded'))
    const [, key, body, options] = upload.mock.calls[0]
    expect(key).toMatch(/\.jpg$/)
    expect((body as Blob).type).toBe('image/jpeg')
    expect(options).toMatchObject({ contentType: 'image/jpeg' })
  })

  it('still refuses a nameless, typeless file', async () => {
    render(<ImageUpload />)
    pick(file('scan', ''))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('img.unsupportedType'))
    expect(upload).not.toHaveBeenCalled()
  })

  // crypto.randomUUID() is secure-context only: over plain http on a LAN address
  // (reaching the dev server from a phone) it is undefined and used to throw
  // before the request was ever made.
  it('uploads without crypto.randomUUID', async () => {
    const original = globalThis.crypto.randomUUID
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      render(<ImageUpload />)
      pick(file('dinner.png', 'image/png'))
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('img.uploaded'))
      expect(upload.mock.calls[0][1]).toMatch(/^user-1\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/)
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: original, configurable: true })
    }
  })

  it.each([
    [{ statusCode: '413', message: 'The object exceeded the maximum allowed size' }, 'img.tooLarge'],
    [{ statusCode: '415', message: 'mime type image/gif is not supported' }, 'img.unsupportedType'],
    [{ statusCode: '404', message: 'Bucket not found' }, 'img.storageMissing'],
    [{ statusCode: '403', message: 'new row violates row-level security policy' }, 'img.notAllowed'],
    [{ statusCode: '500', message: 'Internal error' }, 'img.uploadFailed'],
  ])('explains %o as %s', async (error, key) => {
    upload.mockResolvedValue({ error })
    render(<ImageUpload />)
    pick(file('dinner.jpg', 'image/jpeg'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(key))
    expect(hidden().value).toBe('')
  })

  it('keeps an already-saved image when a replacement fails', async () => {
    upload.mockResolvedValue({ error: { statusCode: '500', message: 'boom' } })
    render(<ImageUpload defaultPath="user-1/old.jpg" />)
    pick(file('dinner.jpg', 'image/jpeg'))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(hidden().value).toBe('user-1/old.jpg')
  })
})
