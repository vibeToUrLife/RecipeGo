'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInviteAction, declineInviteAction } from '@/app/rooms/actions'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function InviteActions({ inviteId }: { inviteId: string }) {
  const [acceptPending, startAccept] = useTransition()
  const [declinePending, startDecline] = useTransition()
  const router = useRouter()

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={acceptPending || declinePending}
        onClick={() =>
          startAccept(async () => {
            try {
              await acceptInviteAction(inviteId)
              toast.success('Invite accepted')
              router.refresh()
            } catch {
              toast.error('Something went wrong. Please try again.')
            }
          })
        }
      >
        {acceptPending ? 'Saving…' : 'Accept'}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={acceptPending || declinePending}
        onClick={() =>
          startDecline(async () => {
            try {
              await declineInviteAction(inviteId)
              toast.success('Invite declined')
              router.refresh()
            } catch {
              toast.error('Something went wrong. Please try again.')
            }
          })
        }
      >
        {declinePending ? 'Declining…' : 'Decline'}
      </Button>
    </div>
  )
}
