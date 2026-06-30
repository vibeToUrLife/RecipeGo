'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'

export function ShareRecipeButton({ recipeId }: { recipeId: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)

  async function copy() {
    const url = `${window.location.origin}/recipes/${recipeId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t('detail.shareCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked — show the link so they can copy it by hand.
      toast.message(t('detail.shareCopyManual'), { description: url })
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? t('detail.copied') : t('detail.share')}
    </Button>
  )
}
