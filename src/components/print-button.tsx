'use client'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// "Save as PDF" without a PDF dependency: every browser's print dialog offers a
// PDF destination, and the `@media print` rules in globals.css (plus `print:`
// utilities on the screen-only chrome) decide what lands on the sheet.
// Hides itself in print so the button never shows up on the page it produced.
export function PrintButton({
  label,
  hint,
  size = 'sm',
  className,
}: {
  label: string
  hint?: string
  size?: 'sm' | 'default'
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      title={hint}
      className={cn('print:hidden', className)}
      onClick={() => window.print()}
    >
      <Printer />
      {label}
    </Button>
  )
}
