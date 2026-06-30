'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { updatePlanServingsAction, removePlanEntryAction } from '@/app/plan/actions'
import type { MealPlanEntryView } from '@/lib/db-types'
import { useT } from '@/components/i18n-provider'

export function PlannedMeal({ entry }: { entry: MealPlanEntryView }) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [servings, setServings] = useState(entry.servings)
  const [pending, start] = useTransition()

  return (
    <>
      <button
        type="button"
        onClick={() => { setServings(entry.servings); setOpen(true) }}
        className="flex w-full items-center justify-between gap-1 rounded-md bg-background px-2 py-1 text-left text-sm hover:bg-muted"
      >
        <span className="truncate">{entry.recipe_title}</span>
        <span className="shrink-0 text-muted-foreground">× {entry.servings}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{entry.recipe_title}</DialogTitle></DialogHeader>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{t('plan.forPeople')}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setServings((v) => Math.max(1, v - 1))}>–</Button>
            <span className="w-6 text-center font-semibold">{servings}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setServings((v) => v + 1)}>＋</Button>
          </div>
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={() => start(async () => { await removePlanEntryAction(entry.id); setOpen(false); router.refresh() })}
            >
              {t('plan.remove')}
            </Button>
            <Button
              disabled={pending}
              onClick={() => start(async () => {
                const res = await updatePlanServingsAction(entry.id, servings)
                if (res.error) { toast.error(res.error); return }
                setOpen(false); router.refresh()
              })}
            >
              {t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
