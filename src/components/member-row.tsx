'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removeMemberAction } from '@/app/rooms/actions'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface MemberRowProps {
  roomId: string
  userId: string
  name: string
  role: string
  canRemove: boolean
}

export function MemberRow({ roomId, userId, name, role, canRemove }: MemberRowProps) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="font-medium">{name}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground capitalize">
          {role}
        </span>
      </div>

      {canRemove && (
        confirming ? (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    await removeMemberAction(roomId, userId)
                    toast.success('Member removed')
                    router.refresh()
                  } catch {
                    toast.error('Something went wrong. Please try again.')
                  }
                })
              }
            >
              {pending ? 'Removing…' : 'Confirm'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
            Remove
          </Button>
        )
      )}
    </div>
  )
}
