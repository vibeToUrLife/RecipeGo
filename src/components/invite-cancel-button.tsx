'use client'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { cancelInviteAction } from '@/app/rooms/actions'
import { Button } from '@/components/ui/button'

export function InviteCancelButton({ roomId, inviteId }: { roomId: string; inviteId: string }) {
  const [pending, startTransition] = useTransition()
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
            toast.success('Invite cancelled.')
          } catch {
            toast.error('Could not cancel the invite.')
          }
        })
      }
    >
      {pending ? 'Removing…' : 'Cancel'}
    </Button>
  )
}
