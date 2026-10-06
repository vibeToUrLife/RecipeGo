'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, GripVertical, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RecipeViewDialog } from '@/components/recipe-view-dialog'
import {
  updatePlanServingsAction,
  updatePlanNoteAction,
  movePlanEntryAction,
  removePlanEntryAction,
} from '@/app/plan/actions'
import { NOTE_MAX } from '@/lib/plan/note'
import { MEAL_SLOTS, type MealSlot } from '@/lib/plan/week'
import { PLAN_ENTRY_DRAG_TYPE } from '@/lib/plan/drag'
import { useFinePointer } from '@/lib/use-fine-pointer'
import type { MealPlanEntryView } from '@/lib/db-types'
import { useT } from '@/components/i18n-provider'
import { cn } from '@/lib/utils'

// onToggleEaten: the ✓ was pressed. The grid owns the eaten state, so it can
// show the change at once and put it back if the save fails.
export function PlannedMeal({ entry, onToggleEaten }: { entry: MealPlanEntryView; onToggleEaten: () => void }) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [servings, setServings] = useState(entry.servings)
  const [date, setDate] = useState(entry.plan_date)
  const [slot, setSlot] = useState<MealSlot>(entry.meal_slot)
  const [note, setNote] = useState(entry.note ?? '')
  const [pending, start] = useTransition()
  // Drag it onto another slot of the week to move it — on a computer only. On a
  // touch screen a long press stays a long press; the edit dialog moves it there.
  const canDrag = useFinePointer()
  const [dragging, setDragging] = useState(false)
  // Ticked as eaten: it stays on the plan, the meal faded well back and its card
  // see-through, so it reads as done at a glance. The ✓ and ✎ keep full
  // strength, so it's plain the tick is on and can come off again.
  const eaten = !!entry.eaten_at

  const slotLabel: Record<MealSlot, string> = {
    breakfast: t('plan.breakfast'), lunch: t('plan.lunch'), dinner: t('plan.dinner'),
  }

  function openDialog() {
    setServings(entry.servings)
    setDate(entry.plan_date)
    setSlot(entry.meal_slot)
    setNote(entry.note ?? '')
    setOpen(true)
  }

  const moved = date !== entry.plan_date || slot !== entry.meal_slot
  // Compare against the same shape the action stores, so re-saving an unchanged
  // note (or whitespace either side of it) doesn't hit the server.
  const noteChanged = (note.trim() || null) !== (entry.note ?? null)

  return (
    <>
      <div
        draggable={canDrag}
        onDragStart={(e) => {
          e.dataTransfer.setData(PLAN_ENTRY_DRAG_TYPE, entry.id)
          e.dataTransfer.effectAllowed = 'move'
          // Fade it only once the browser has taken its picture for the drag.
          setTimeout(() => setDragging(true))
        }}
        onDragEnd={() => setDragging(false)}
        className={cn('flex items-stretch overflow-hidden rounded-md text-sm', eaten ? 'bg-background/40' : 'bg-background', dragging && 'opacity-50')}
      >
        {/* The whole chip drags; the grip only shows that it can, and only
            where there's a mouse. */}
        <span
          aria-hidden
          title={t('plan.dragToMove')}
          className="hidden cursor-grab items-center pl-1 text-muted-foreground active:cursor-grabbing pointer-fine:flex print:hidden"
        >
          <GripVertical className="size-3.5" />
        </span>
        <button
          type="button"
          onClick={() => setViewOpen(true)}
          className={cn('flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-1 text-left hover:bg-muted', eaten && 'opacity-30')}
          aria-label={t('plan.viewRecipe')}
        >
          <span className="flex w-full items-center justify-between gap-1">
            <span className="truncate">{entry.recipe_title}</span>
            <span className="shrink-0 text-muted-foreground">× {entry.servings}</span>
          </span>
          {/* Shown on the grid itself — a note you have to open a dialog to read
              is no use while you're glancing at the week. */}
          {entry.note && (
            <span className="line-clamp-2 text-xs text-muted-foreground">📝 {entry.note}</span>
          )}
        </button>
        <button
          type="button"
          onClick={onToggleEaten}
          aria-label={eaten ? t('plan.markNotEaten') : t('plan.markEaten')}
          title={eaten ? t('plan.markNotEaten') : t('plan.markEaten')}
          className={cn(
            'flex shrink-0 items-center border-l px-2 print:hidden',
            eaten ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground hover:bg-muted hover:text-primary',
          )}
        >
          <Check className="size-3.5" strokeWidth={eaten ? 3 : 2} />
        </button>
        <button
          type="button"
          onClick={openDialog}
          aria-label={t('plan.editMeal')}
          className="flex shrink-0 items-center border-l px-2 text-muted-foreground hover:bg-muted hover:text-foreground print:hidden"
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

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t('plan.note')}</span>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={NOTE_MAX}
              rows={2}
              placeholder={t('plan.notePlaceholder')}
              className="min-h-14"
            />
          </label>

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
              onClick={() => start(async () => {
                const res = await removePlanEntryAction(entry.id)
                if (res.error) { toast.error(res.error); return }
                setOpen(false); router.refresh()
              })}
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
                if (noteChanged) {
                  const res = await updatePlanNoteAction(entry.id, note.trim() || null)
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
