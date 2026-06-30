'use client'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { cancelInviteAction } from '@/app/rooms/actions'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'

export function InviteCancelButton({ roomId, inviteId }: { roomId: string; inviteId: string }) {
  const [pending, startTransition] = useTransition()
  const t = useT()
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await cancelInviteAction(roomId, inviteId)
            toast.success(t('invite.cancelled'))
          } catch {
            toast.error(t('invite.cancelFailed'))
          }
        })
      }
    >
      {pending ? t('common.removing') : t('common.cancel')}
    </Button>
  )
}
