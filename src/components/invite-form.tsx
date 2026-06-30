'use client'
import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { inviteAction } from '@/app/rooms/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/components/i18n-provider'

export function InviteForm({ roomId }: { roomId: string }) {
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const t = useT()

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await inviteAction(roomId, formData)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success(t('invite.sent'))
        formRef.current?.reset()
      }
    })
  }

  return (
    <form ref={formRef} action={onSubmit} className="flex gap-2">
      <div className="flex-1 space-y-1">
        <Label htmlFor="invite-email" className="sr-only">{t('invite.emailLabel')}</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          placeholder={t('invite.emailPlaceholder')}
          required
          disabled={pending}
        />
      </div>
      <Button type="submit" disabled={pending}>{pending ? t('invite.inviting') : t('invite.invite')}</Button>
    </form>
  )
}
