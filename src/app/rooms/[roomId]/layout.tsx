import type { ReactNode } from 'react'
import { RoomRealtime } from '@/components/room-realtime'

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
      {children}
    </>
  )
}
