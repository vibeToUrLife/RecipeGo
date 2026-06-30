'use client'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { ImportedRecipe } from '@/lib/recipe/types'
import { useT } from '@/components/i18n-provider'

export function ImportBar({ onImported }: { onImported: (r: ImportedRecipe) => void }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const t = useT()

  async function run() {
    if (!url) return
    setBusy(true)
    try {
      const res = await fetch('/api/import-recipe', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }),
      })
      const data = (await res.json()) as ImportedRecipe
      if (data.needsManualEntry) toast.info(t('form.importManual'))
      else toast.success(t('form.importedOk'))
      onImported(data)
    } catch {
      toast.error(t('form.importFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-5 rounded-xl border-2 border-dashed border-primary/30 bg-accent/10 p-4">
      <p className="text-sm font-semibold text-primary">{t('form.importTitle')}</p>
      <p className="mb-3 text-xs text-muted-foreground">
        {t('form.importHint')}
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
        <Button type="button" onClick={run} disabled={busy}>{busy ? t('form.importing') : t('form.import')}</Button>
      </div>
    </div>
  )
}
