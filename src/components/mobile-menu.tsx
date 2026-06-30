'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import type { Room } from '@/lib/db-types'
import { useCurrentRoomId } from '@/lib/use-current-room-id'
import { useT } from '@/components/i18n-provider'

// Hamburger menu shown only on small screens (the inline nav is hidden there).
export function MobileMenu({ rooms, signOut }: { rooms: Room[]; signOut: () => void }) {
  const [open, setOpen] = useState(false)
  const roomId = useCurrentRoomId()
  const t = useT()
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
            <Link href={recipesHref} onClick={close} className={item}>{t('nav.recipes')}</Link>
            <Link href={planHref} onClick={close} className={item}>{t('nav.plan')}</Link>
            <Link href={cookHref} onClick={close} className={item}>{t('nav.ingredients')}</Link>
            <Link href={shoppingHref} onClick={close} className={item}>{t('nav.shoppingList')}</Link>
            <div className="my-1 border-t" />
            <Link href="/" onClick={close} className={item}>{t('nav.myRecipes')}</Link>
            {rooms.map((r) => (
              <Link key={r.id} href={`/rooms/${r.id}`} onClick={close} className={item}>{r.name}</Link>
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
