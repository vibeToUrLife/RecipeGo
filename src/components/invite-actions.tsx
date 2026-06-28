'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInviteAction, declineInviteAction } from '@/app/rooms/actions'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function InviteActions({ inviteId }: { inviteId: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  function handleAccept() {
    start(async () => {
      await acceptInviteAction(inviteId)
      toast.success('Invite accepted')
      router.refresh()
    })
  }

  function handleDecline() {
    start(async () => {
      await declineInviteAction(inviteId)
      toast.success('Invite declined')
      router.refresh()
    })
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={handleAccept}>
        {pending ? 'Saving…' : 'Accept'}
      </Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={handleDecline}>
        Decline
      </Button>
    </div>
  )
}
