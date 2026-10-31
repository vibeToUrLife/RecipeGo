import { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { I18nProvider } from '@/components/i18n-provider'

// Drags one finger up the page from `target`; true if the move was cancelled.
// jsdom has no Touch constructor, so a plain event carries the `touches`.
function swipeCancelled(target: Element): boolean {
  const drag = (type: string, clientY: number) => {
    const e = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(e, 'touches', { value: [{ clientX: 100, clientY }] })
    target.dispatchEvent(e)
    return e.defaultPrevented
  }
  drag('touchstart', 100)
  return drag('touchmove', 50)
}

function PageWithDialog() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <main>The week&apos;s plan</main>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Pick a recipe</DialogTitle>
          <button type="button" onClick={() => setOpen(false)}>Done</button>
        </DialogContent>
      </Dialog>
    </>
  )
}

describe('DialogContent', () => {
  // iOS 26 ignores the hidden overflow Base UI locks the page with, so the
  // dialog also stops the swipe itself.
  it('keeps a swipe from scrolling the page behind it until it closes', async () => {
    render(<PageWithDialog />)
    const page = screen.getByText("The week's plan")
    expect(swipeCancelled(page)).toBe(true)

    fireEvent.click(screen.getByText('Done'))
    await waitFor(() => expect(screen.queryByText('Pick a recipe')).toBeNull())
    expect(swipeCancelled(page)).toBe(false)
  })

  it('rises from the bottom of a phone screen only when made a sheet', () => {
    const popup = (sheet: boolean) => {
      const { unmount } = render(
        <Dialog open><DialogContent sheet={sheet}><DialogTitle>Pick a recipe</DialogTitle></DialogContent></Dialog>,
      )
      const el = document.querySelector('[data-slot="dialog-content"]')!
      const classes = el.className
      unmount()
      return classes
    }
    expect(popup(true)).toMatch(/max-sm:bottom-0/)
    expect(popup(false)).not.toMatch(/max-sm:/)
  })

  // A screen reader reads the ✕ out by this name.
  it('names its close button in the language the app is in', () => {
    render(
      <I18nProvider locale="zh">
        <Dialog open><DialogContent><DialogTitle>选择食谱</DialogTitle></DialogContent></Dialog>
      </I18nProvider>,
    )
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()
  })
})
