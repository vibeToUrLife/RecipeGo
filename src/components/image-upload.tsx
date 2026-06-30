'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { publicImageUrl } from '@/lib/image-url'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useT } from '@/components/i18n-provider'

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
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error(t('img.signInAgain')); setBusy(false); return }
    const ext = file.name.split('.').pop() ?? 'jpg'
    const key = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('recipe-images').upload(key, file, { upsert: true })
    setBusy(false)
    if (error) { toast.error(t('img.uploadFailed')); return }
    setPath(key)
    toast.success(t('img.uploaded'))
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
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
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
