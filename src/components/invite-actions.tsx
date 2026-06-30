'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInviteAction, declineInviteAction } from '@/app/rooms/actions'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useT } from '@/components/i18n-provider'

export function InviteActions({ inviteId }: { inviteId: string }) {
  const [acceptPending, startAccept] = useTransition()
  const [declinePending, startDecline] = useTransition()
  const router = useRouter()
  const t = useT()

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={acceptPending || declinePending}
        onClick={() =>
          startAccept(async () => {
            try {
              await acceptInviteAction(inviteId)
              toast.success(t('invite.accepted'))
              router.refresh()
            } catch {
              toast.error(t('common.errorRetry'))
            }
          })
        }
      >
        {acceptPending ? t('common.saving') : t('invite.accept')}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={acceptPending || declinePending}
        onClick={() =>
          startDecline(async () => {
            try {
              await declineInviteAction(inviteId)
              toast.success(t('invite.declined'))
              router.refresh()
            } catch {
              toast.error(t('common.errorRetry'))
            }
          })
        }
      >
        {declinePending ? t('invite.declining') : t('invite.decline')}
      </Button>
    </div>
  )
}
