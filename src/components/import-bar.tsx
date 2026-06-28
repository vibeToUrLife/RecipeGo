'use client'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { ImportedRecipe } from '@/lib/recipe/types'

export function ImportBar({ onImported }: { onImported: (r: ImportedRecipe) => void }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  async function run() {
    if (!url) return
    setBusy(true)
    try {
      const res = await fetch('/api/import-recipe', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }),
      })
      const data = (await res.json()) as ImportedRecipe
      if (data.needsManualEntry) toast.info("Couldn’t auto-read this page — enter details manually.")
      else toast.success('Recipe imported — review and save.')
      onImported(data)
    } catch {
      toast.error('Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-5 flex gap-2 rounded-xl border border-dashed p-3">
      <Input placeholder="Paste a recipe URL to auto-import…" value={url} onChange={(e) => setUrl(e.target.value)} />
      <Button type="button" onClick={run} disabled={busy}>{busy ? 'Importing…' : 'Import'}</Button>
    </div>
  )
}
