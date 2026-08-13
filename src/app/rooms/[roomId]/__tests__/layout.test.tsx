import { describe, it, expect } from 'vitest'
import RoomLayout from '../layout'
import { RoomRealtime } from '@/components/room-realtime'

describe('RoomLayout', () => {
  it('mounts RoomRealtime for the room and renders its children', async () => {
    const element = await RoomLayout({
      children: <div data-testid="child">hi</div>,
      params: Promise.resolve({ roomId: 'room-xyz' }),
    })

    // The layout returns a fragment: [<RoomRealtime/>, children]
    const kids = (element as { props: { children: unknown[] } }).props.children
    const realtime = kids.find(
      (c) => (c as { type?: unknown } | null)?.type === RoomRealtime,
    ) as { props: { roomId: string } } | undefined
    expect(realtime).toBeDefined()
    expect(realtime!.props.roomId).toBe('room-xyz')

    const child = kids.find(
      (c) => (c as { props?: Record<string, unknown> } | null)?.props?.['data-testid'] === 'child',
    )
    expect(child).toBeDefined()
  })
})
