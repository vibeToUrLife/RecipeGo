'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function ShareRecipeButton({ recipeId }: { recipeId: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const url = `${window.location.origin}/recipes/${recipeId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied — paste it into "Import from a website" to add this recipe.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked — show the link so they can copy it by hand.
      toast.message('Copy this link to share', { description: url })
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? '✓ Copied' : '🔗 Share'}
    </Button>
  )
}
