'use client'
import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { addPlanEntryAction } from '@/app/plan/actions'
import { NOTE_MAX } from '@/lib/plan/note'
import { publicImageUrl } from '@/lib/image-url'
import type { Recipe } from '@/lib/db-types'
import type { MealSlot } from '@/lib/plan/week'
import { useT } from '@/components/i18n-provider'

// A recipe's photo at thumbnail size, or the plate its card shows without one.
function RecipeThumb({ recipe }: { recipe: Recipe }) {
  const img = publicImageUrl(recipe.image_path)
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-accent/40 to-primary/30 text-lg">
      {img ? <Image src={img} alt="" fill sizes="40px" className="object-cover" /> : <span aria-hidden>🍽️</span>}
    </span>
  )
}

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
        <DialogContent sheet>
          <DialogHeader><DialogTitle>{t('plan.pickRecipe')}</DialogTitle></DialogHeader>
          {!selected ? (
            <div className="flex flex-col gap-2">
              <Input autoFocus placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
              {/* On a phone the list keeps one height however many recipes it
                  holds, so the sheet's top, and the search box, stay clear of
                  the keyboard. */}
              <div className="max-h-80 overflow-y-auto max-sm:h-[65dvh] max-sm:max-h-none">
                {filtered.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t('home.noRecipes')}</p>
                ) : (
                  filtered.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setSelected(r); setServings(r.servings) }}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <RecipeThumb recipe={r} />
                      <span className="min-w-0 truncate">{r.title}</span>
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
