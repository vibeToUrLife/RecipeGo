'use client'
import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { inviteAction } from '@/app/rooms/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function InviteForm({ roomId }: { roomId: string }) {
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await inviteAction(roomId, formData)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success('Invitation sent — waiting for them to accept.')
        formRef.current?.reset()
      }
    })
  }

  return (
    <form ref={formRef} action={onSubmit} className="flex gap-2">
      <div className="flex-1 space-y-1">
        <Label htmlFor="invite-email" className="sr-only">Email address</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          placeholder="friend@example.com"
          required
          disabled={pending}
        />
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Inviting…' : 'Invite'}</Button>
    </form>
  )
}
