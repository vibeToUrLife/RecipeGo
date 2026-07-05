'use client'

import Link from 'next/link'
import { Check, ChevronDown } from 'lucide-react'
import type { Room } from '@/lib/db-types'
import { useCurrentRoomId } from '@/lib/use-current-room-id'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'

interface RoomSwitcherProps {
  rooms: Room[]
  roomId?: string | null
}

export function RoomSwitcher({ rooms, roomId }: RoomSwitcherProps) {
  const hookRoomId = useCurrentRoomId()
  const t = useT()
  // An explicit prop (even null = personal) wins over the URL-derived value.
  const currentRoomId = roomId !== undefined ? roomId : hookRoomId
  const currentRoom = currentRoomId ? rooms.find((r) => r.id === currentRoomId) : null
  const currentLabel = currentRoom ? currentRoom.name : t('nav.myRecipes')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1')}
      >
        {currentLabel}
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          render={<Link href="/" />}
          className={cn(!currentRoomId && 'font-semibold text-primary')}
        >
          {t('nav.myRecipes')}
          {!currentRoomId && <Check className="ml-auto size-4" />}
        </DropdownMenuItem>
        {rooms.map((room) => {
          const active = room.id === currentRoomId
          return (
            <DropdownMenuItem
              key={room.id}
              render={<Link href={`/rooms/${room.id}`} />}
              className={cn(active && 'font-semibold text-primary')}
            >
              {room.name}
              {active && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/rooms" />}>{t('nav.manageRooms')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
