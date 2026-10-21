import { describe, it, expect } from 'vitest'
import PlanLayout from '../layout'
import { PlanRealtime } from '@/components/room-realtime'

describe('PlanLayout', () => {
  it('mounts PlanRealtime and renders its children', () => {
    const element = PlanLayout({ children: <div data-testid="child">hi</div> })

    // The layout returns a fragment: [<PlanRealtime/>, children]
    const kids = (element as { props: { children: unknown[] } }).props.children
    expect(kids.some((c) => (c as { type?: unknown } | null)?.type === PlanRealtime)).toBe(true)

    const child = kids.find(
      (c) => (c as { props?: Record<string, unknown> } | null)?.props?.['data-testid'] === 'child',
    )
    expect(child).toBeDefined()
  })
})
