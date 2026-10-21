import type { ReactNode } from 'react'
import { PlanRealtime } from '@/components/room-realtime'

// Keeps your own plan live across your devices and tabs (a room's plan gets
// the same from the room layout).
export default function PlanLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PlanRealtime />
      {children}
    </>
  )
}
