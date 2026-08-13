'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { addPlanEntryAction } from '@/app/plan/actions'
import { NOTE_MAX } from '@/lib/plan/note'
import type { Recipe } from '@/lib/db-types'
import type { MealSlot } from '@/lib/plan/week'
import { useT } from '@/components/i18n-provider'

export function AddMealDialog({
  planDate, slot, recipes, roomId,
}: {
  planDate: string
  slot: MealSlot
  recipes: Recipe[]
  roomId: string | null
}) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [servings, setServings] = useState(1)
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()

  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()))
  function reset() { setQ(''); setSelected(null); setServings(1); setNote('') }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-3.5" /> {t('plan.addMeal')}
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('plan.pickRecipe')}</DialogTitle></DialogHeader>
          {!selected ? (
            <div className="flex flex-col gap-2">
              <Input autoFocus placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="max-h-64 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t('home.noRecipes')}</p>
                ) : (
                  filtered.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setSelected(r); setServings(r.servings) }}
                      className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {r.title}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="font-medium">{selected.title}</p>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{t('plan.forPeople')}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setServings((v) => Math.max(1, v - 1))}>–</Button>
                <span className="w-6 text-center font-semibold">{servings}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setServings((v) => v + 1)}>＋</Button>
              </div>
              {/* Optional — most meals don't need one, so it stays out of the way
                  rather than blocking the add. */}
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>{t('common.back')}</Button>
                <Button
                  disabled={pending}
                  onClick={() => start(async () => {
                    const res = await addPlanEntryAction({ recipeId: selected.id, planDate, slot, servings, roomId, note: note.trim() || null })
                    if (res.error) { toast.error(res.error); return }
                    setOpen(false); reset(); router.refresh()
                  })}
                >
                  {t('common.add')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
