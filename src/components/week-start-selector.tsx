'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { setWeekStartAction } from '@/app/plan/actions'
import { useT } from '@/components/i18n-provider'

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const

export function WeekStartSelector({ value }: { value: number }) {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>{t('plan.weekStartsOn')}</span>
      <select
        value={value}
        disabled={pending}
        aria-label={t('plan.weekStartsOn')}
        onChange={(e) => {
          const next = Number(e.target.value)
          startTransition(async () => {
            const res = await setWeekStartAction(next)
            if (res.error) {
              toast.error(res.error)
              return
            }
            router.refresh()
          })
        }}
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
      >
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {t(`weekday.${d}`)}
          </option>
        ))}
      </select>
    </label>
  )
}
