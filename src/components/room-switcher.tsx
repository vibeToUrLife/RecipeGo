'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
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

interface RoomSwitcherProps {
  rooms: Room[]
}

export function RoomSwitcher({ rooms }: RoomSwitcherProps) {
  const currentRoomId = useCurrentRoomId()
  const currentRoom = currentRoomId ? rooms.find((r) => r.id === currentRoomId) : null
  const currentLabel = currentRoom ? currentRoom.name : 'My Recipes'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1')}
      >
        {currentLabel}
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem render={<Link href="/" />}>My Recipes</DropdownMenuItem>
        {rooms.map((room) => (
          <DropdownMenuItem key={room.id} render={<Link href={`/rooms/${room.id}`} />}>
            {room.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/rooms" />}>Manage rooms</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
