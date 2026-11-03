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

  // jsdom can't decode an image, so this one can't be made smaller either.
  it('rejects an oversized image it can’t shrink, naming the limit', async () => {
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

  describe('shrinking a big photo first', () => {
    // A decoder that sees a `width`×`height` photo, and a canvas whose JPEG is `jpegBytes`.
    function decodeAs(width: number, height: number, jpegBytes = 300_000) {
      const drawn: { width: number; height: number }[] = []
      vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close: vi.fn() })))
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
        drawn.push({ width: this.width, height: this.height })
        return { fillRect: vi.fn(), drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
      } as never)
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) =>
        done(new Blob([new Uint8Array(jpegBytes)], { type: 'image/jpeg' })))
      return drawn
    }
    afterEach(() => vi.unstubAllGlobals())

    it('sends a big phone photo as a smaller JPEG, at most 2000px across', async () => {
      const drawn = decodeAs(4032, 3024)
      render(<ImageUpload />)
      pick(file('IMG_0001.png', 'image/png', 6 * 1024 * 1024))

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('img.uploaded'))
      const [, key, body, options] = upload.mock.calls[0]
      expect(drawn).toEqual([{ width: 2000, height: 1500 }])
      expect(key).toMatch(/\.jpg$/)
      expect((body as Blob).size).toBe(300_000)
      expect(options).toMatchObject({ contentType: 'image/jpeg' })
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('sends a small photo as it is', async () => {
      const drawn = decodeAs(1200, 900)
      render(<ImageUpload />)
      const small = file('dinner.png', 'image/png', 200_000)
      pick(small)

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('img.uploaded'))
      expect(drawn).toEqual([])
      expect(upload.mock.calls[0][2]).toBe(small)
      expect(upload.mock.calls[0][1]).toMatch(/\.png$/)
    })

    it('sends the original if the JPEG would come out no smaller', async () => {
      decodeAs(3000, 3000, 900_000)
      render(<ImageUpload />)
      const photo = file('dinner.jpg', 'image/jpeg', 800_000)
      pick(photo)

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('img.uploaded'))
      expect(upload.mock.calls[0][2]).toBe(photo)
    })

    it('sends the original if the photo won’t decode', async () => {
      vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('bad image') }))
      render(<ImageUpload />)
      const photo = file('dinner.jpg', 'image/jpeg', 100_000)
      pick(photo)

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('img.uploaded'))
      expect(upload.mock.calls[0][2]).toBe(photo)
    })
  })

  describe('saving the photo the moment it uploads', () => {
    it('hands the new photo on to be saved, and says it was', async () => {
      const onUploaded = vi.fn().mockResolvedValue(true)
      render(<ImageUpload onUploaded={onUploaded} />)
      pick(file('dinner.jpg', 'image/jpeg'))

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('img.saved'))
      expect(onUploaded).toHaveBeenCalledWith(hidden().value)
      expect(hidden().value).toMatch(/^user-1\//)
    })

    // Failed or unreachable, the photo is still in the form, so Save keeps it.
    it.each([
      ['fails', () => Promise.resolve(false)],
      ['can’t be reached', () => Promise.reject(new TypeError('Failed to fetch'))],
    ])('says to press Save when saving it %s', async (_, save) => {
      render(<ImageUpload onUploaded={vi.fn(save)} />)
      pick(file('dinner.jpg', 'image/jpeg'))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('img.notSaved'))
      expect(hidden().value).toMatch(/^user-1\//)
      expect(button()).not.toBeDisabled()
    })
  })
})
