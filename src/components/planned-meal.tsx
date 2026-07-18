'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RecipeViewDialog } from '@/components/recipe-view-dialog'
import {
  updatePlanServingsAction,
  movePlanEntryAction,
  removePlanEntryAction,
} from '@/app/plan/actions'
import { MEAL_SLOTS, type MealSlot } from '@/lib/plan/week'
import type { MealPlanEntryView } from '@/lib/db-types'
import { useT } from '@/components/i18n-provider'

export function PlannedMeal({ entry }: { entry: MealPlanEntryView }) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [servings, setServings] = useState(entry.servings)
  const [date, setDate] = useState(entry.plan_date)
  const [slot, setSlot] = useState<MealSlot>(entry.meal_slot)
  const [pending, start] = useTransition()

  const slotLabel: Record<MealSlot, string> = {
    breakfast: t('plan.breakfast'), lunch: t('plan.lunch'), dinner: t('plan.dinner'),
  }

  function openDialog() {
    setServings(entry.servings)
    setDate(entry.plan_date)
    setSlot(entry.meal_slot)
    setOpen(true)
  }

  const moved = date !== entry.plan_date || slot !== entry.meal_slot

  return (
    <>
      <div className="flex items-stretch overflow-hidden rounded-md bg-background text-sm">
        <button
          type="button"
          onClick={() => setViewOpen(true)}
          className="flex min-w-0 flex-1 items-center justify-between gap-1 px-2 py-1 text-left hover:bg-muted"
          aria-label={t('plan.viewRecipe')}
        >
          <span className="truncate">{entry.recipe_title}</span>
          <span className="shrink-0 text-muted-foreground">× {entry.servings}</span>
        </button>
        <button
          type="button"
          onClick={openDialog}
          aria-label={t('plan.editMeal')}
          className="flex shrink-0 items-center border-l px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
      {viewOpen && (
        <RecipeViewDialog
          recipeId={entry.recipe_id}
          title={entry.recipe_title}
          plannedServings={entry.servings}
          onClose={() => setViewOpen(false)}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{entry.recipe_title}</DialogTitle></DialogHeader>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{t('plan.forPeople')}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setServings((v) => Math.max(1, v - 1))}>–</Button>
            <span className="w-6 text-center font-semibold">{servings}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setServings((v) => v + 1)}>＋</Button>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">{t('plan.moveTo')}</span>
            <label className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{t('plan.day')}</span>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 w-40"
              />
            </label>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{t('plan.meal')}</span>
              <div className="flex gap-1">
                {MEAL_SLOTS.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={slot === s ? 'default' : 'outline'}
                    className="h-8 px-2"
                    onClick={() => setSlot(s)}
                  >
                    {slotLabel[s]}
                  </Button>
                ))}
              </div>
            </div>
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
                if (moved) {
                  const mv = await movePlanEntryAction(entry.id, date, slot)
                  if (mv.error) { toast.error(mv.error); return }
                }
                if (servings !== entry.servings) {
                  const res = await updatePlanServingsAction(entry.id, servings)
                  if (res.error) { toast.error(res.error); return }
                }
                if (moved) toast.success(t('plan.moved'))
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
