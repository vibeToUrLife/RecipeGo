'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { publicImageUrl } from '@/lib/image-url'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useT } from '@/components/i18n-provider'

// Stored extension is derived from the browser-sniffed MIME type, not the
// user-supplied filename. Must stay in sync with the bucket's allowed_mime_types
// and file_size_limit (migration 20260727120000_storage_limits.sql): Storage
// rejects anything outside them, and a limit we don't know about here can only
// come back as a bare "Upload failed".
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
// Some pickers hand over a File with an empty `type` — Android's photo picker
// and several file managers do it routinely. The bytes are still a JPEG, so
// recover the type from the filename instead of refusing a good photo.
const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}
const MAX_BYTES = 5 * 1024 * 1024 // keep equal to the bucket's file_size_limit

function mimeOf(file: File): string | undefined {
  if (file.type) return MIME_EXT[file.type] ? file.type : undefined
  return EXT_MIME[file.name.split('.').pop()?.toLowerCase() ?? '']
}

// crypto.randomUUID() exists only in secure contexts, so it is missing whenever
// the app is opened over plain http on a LAN address (http://192.168.x.x:3000 —
// how you'd reach the dev server from a phone) and on Safari below 15.4. It used
// to throw right here, which killed the upload before it started.
function uuid(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(b)
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// Storage's rejections all arrive as one opaque object; say which wall was hit,
// because each has a different fix (shrink the photo / re-run the SQL / sign in).
function reasonKey(error: { status?: number; statusCode?: string; message?: string }): string {
  const code = `${error.statusCode ?? error.status ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (code.includes('413') || code.includes('too large') || code.includes('maximum allowed size')) return 'img.tooLarge'
  if (code.includes('415') || code.includes('mime type')) return 'img.unsupportedType'
  if (code.includes('404') || code.includes('bucket not found')) return 'img.storageMissing'
  if (code.includes('403') || code.includes('401') || code.includes('row-level security') || code.includes('unauthorized')) return 'img.notAllowed'
  return 'img.uploadFailed'
}

export function ImageUpload({
  name = 'image_path',
  defaultPath,
  compact = false,
}: {
  name?: string
  defaultPath?: string | null
  compact?: boolean
}) {
  const t = useT()
  const [path, setPath] = useState<string>(defaultPath ?? '')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0]
    // Clear the picker first. A file input fires no change event when you choose
    // the same file twice, so without this a failed upload could only be retried
    // by reloading the page — the button just looked dead.
    input.value = ''
    if (!file) return
    const mime = mimeOf(file)
    if (!mime) { toast.error(t('img.unsupportedType')); return }
    if (file.size > MAX_BYTES) { toast.error(t('img.tooLarge')); return }
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error(t('img.signInAgain')); return }
      const key = `${user.id}/${uuid()}.${MIME_EXT[mime]}`
      // Upload the bytes under the type we settled on: the SDK sends a File as
      // multipart and Storage matches that part's own type against
      // allowed_mime_types, so a typeless File would arrive as
      // application/octet-stream and be rejected. slice() only relabels it.
      const body = file.type === mime ? file : file.slice(0, file.size, mime)
      const { error } = await supabase.storage
        .from('recipe-images')
        .upload(key, body, { upsert: true, contentType: mime })
      if (error) { console.error(error); toast.error(t(reasonKey(error))); return }
      setPath(key)
      toast.success(t('img.uploaded'))
    } catch (err) {
      // storage-js re-throws anything that isn't a StorageError (offline, CORS,
      // a proxy that eats the request) and getUser() can reject too. Uncaught,
      // that skipped setBusy(false) and pinned the button on "Uploading…".
      console.error(err)
      toast.error(t('img.uploadFailed'))
    } finally {
      setBusy(false)
    }
  }

  const preview = publicImageUrl(path || null)
  return (
    <div className="space-y-2">
      {/* Always rendered so FormData arrays stay index-aligned (e.g. per-step images). */}
      <input type="hidden" name={name} value={path} />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className={compact ? 'h-16 w-16 rounded-md object-cover' : 'h-32 w-full rounded-lg object-cover'}
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept={Object.keys(MIME_EXT).join(',')}
        className="hidden"
        onChange={onPick}
      />
      <Button
        type="button"
        variant="outline"
        size={compact ? 'xs' : 'sm'}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? t('img.uploading') : preview ? (compact ? t('img.change') : t('img.changeImage')) : (compact ? t('form.photo') : t('form.uploadImage'))}
      </Button>
    </div>
  )
}
