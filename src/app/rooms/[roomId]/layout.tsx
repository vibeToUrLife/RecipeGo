import type { ReactNode } from 'react'
import { RoomRealtime } from '@/components/room-realtime'
import { RememberCollection } from '@/components/remember-collection'

export default async function RoomLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  return (
    <>
      <RoomRealtime roomId={roomId} />
      <RememberCollection value={roomId} />
      {children}
    </>
  )
}
