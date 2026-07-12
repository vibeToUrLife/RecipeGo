'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import type { Room } from '@/lib/db-types'
import { cn } from '@/lib/utils'
import { useCurrentRoomId } from '@/lib/use-current-room-id'
import { useT } from '@/components/i18n-provider'

// Hamburger menu shown only on small screens (the inline nav is hidden there).
// Pages that know their room (e.g. a recipe's detail/edit page) can pass roomId
// so the menu keeps the room context even when it isn't in the URL.
export function MobileMenu({ rooms, signOut, roomId: roomIdProp }: { rooms: Room[]; signOut: () => void; roomId?: string | null }) {
  const [open, setOpen] = useState(false)
  const hookRoomId = useCurrentRoomId()
  // An explicit prop (even null = personal) wins over the URL-derived value.
  const roomId = roomIdProp !== undefined ? roomIdProp : hookRoomId
  const t = useT()
  // Each page option is prefixed with where it lives — the current room's name,
  // or "My Recipes" when personal — e.g. "Southbay Kitchen – 计划".
  const currentRoom = roomId ? rooms.find((r) => r.id === roomId) : null
  const collectionLabel = currentRoom ? currentRoom.name : t('nav.myRecipes')
  const recipesHref = roomId ? `/rooms/${roomId}` : '/'
  const cookHref = roomId ? `/rooms/${roomId}/cook` : '/cook'
  const shoppingHref = roomId ? `/rooms/${roomId}/shopping-list` : '/shopping-list'
  const planHref = roomId ? `/rooms/${roomId}/plan` : '/plan'
  const close = () => setOpen(false)
  const item = 'block rounded-md px-3 py-2 text-sm hover:bg-muted'

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('nav.menu')}
        aria-expanded={open}
        className="flex items-center rounded-md p-2 text-foreground hover:bg-muted"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} aria-hidden />
          <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border bg-card p-2 text-foreground shadow-lg">
            <Link href={recipesHref} onClick={close} className={item}>{`${collectionLabel} – ${t('nav.recipes')}`}</Link>
            <Link href={planHref} onClick={close} className={item}>{`${collectionLabel} – ${t('nav.plan')}`}</Link>
            <Link href={cookHref} onClick={close} className={item}>{`${collectionLabel} – ${t('nav.ingredients')}`}</Link>
            <Link href={shoppingHref} onClick={close} className={item}>{`${collectionLabel} – ${t('nav.shoppingList')}`}</Link>
            <div className="my-1 border-t" />
            <Link href="/?home=1" onClick={close} className={cn(item, !roomId && 'font-semibold text-primary')}>{t('nav.myRecipes')}</Link>
            {rooms.map((r) => (
              <Link key={r.id} href={`/rooms/${r.id}`} onClick={close} className={cn(item, roomId === r.id && 'font-semibold text-primary')}>{r.name}</Link>
            ))}
            <Link href="/rooms" onClick={close} className={item}>{t('nav.manageRooms')}</Link>
            <div className="my-1 border-t" />
            <form action={signOut}>
              <button type="submit" className={`${item} w-full text-left`}>{t('nav.signOut')}</button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
