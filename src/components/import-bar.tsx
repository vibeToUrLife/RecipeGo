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
    <div className="mb-5 rounded-xl border-2 border-dashed border-primary/30 bg-accent/10 p-4">
      <p className="text-sm font-semibold text-primary">🔗 Import from a website</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Paste a recipe link from a cooking site and we&apos;ll auto-fill the title, ingredients, and steps for you. Or skip this and fill in the form below yourself.
      </p>
      <div className="flex gap-2">
        <Input
          type="url"
          inputMode="url"
          placeholder="https://example.com/best-pancakes"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); run() } }}
        />
        <Button type="button" onClick={run} disabled={busy}>{busy ? 'Importing…' : 'Import'}</Button>
      </div>
    </div>
  )
}
