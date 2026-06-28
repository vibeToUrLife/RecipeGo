'use client'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { publicImageUrl } from '@/lib/image-url'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function ImageUpload({ defaultPath }: { defaultPath?: string | null }) {
  const [path, setPath] = useState<string>(defaultPath ?? '')
  const [busy, setBusy] = useState(false)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Please sign in again'); setBusy(false); return }
    const ext = file.name.split('.').pop() ?? 'jpg'
    const key = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('recipe-images').upload(key, file, { upsert: true })
    setBusy(false)
    if (error) { toast.error('Upload failed'); return }
    setPath(key)
    toast.success('Image uploaded')
  }

  const preview = publicImageUrl(path || null)
  return (
    <div className="space-y-2">
      <input type="hidden" name="image_path" value={path} />
      {preview && <img src={preview} alt="" className="h-32 w-full rounded-lg object-cover" />}
      <label>
        <input type="file" accept="image/*" className="hidden" onChange={onPick} />
        <Button type="button" variant="outline" size="sm" asChild={false} disabled={busy}>
          <span>{busy ? 'Uploading…' : preview ? 'Change image' : 'Upload image'}</span>
        </Button>
      </label>
    </div>
  )
}
