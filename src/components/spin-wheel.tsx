'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Recipe } from '@/lib/db-types'
import { useT } from '@/components/i18n-provider'
import { Button } from '@/components/ui/button'

const COLORS = ['var(--primary)', 'var(--accent)', 'var(--secondary)']
const CX = 110
const CY = 110
const R = 104

// Point on the wheel edge at a clockwise angle (degrees) measured from the top.
function edge(angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180
  return { x: CX + R * Math.sin(a), y: CY - R * Math.cos(a) }
}

export function SpinWheel({ recipes }: { recipes: Recipe[] }) {
  const t = useT()
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<Recipe | null>(null)
  const n = recipes.length

  if (n === 0) {
    return <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">{t('spin.empty')}</p>
  }

  const seg = 360 / n

  function spin() {
    if (spinning) return
    setSpinning(true)
    setWinner(null)
    const win = Math.floor(Math.random() * n)
    // Rotation (clockwise) that brings the winner's centre under the top pointer.
    const targetMod = (360 - (win + 0.5) * seg) % 360
    const currentMod = ((rotation % 360) + 360) % 360
    const delta = (targetMod - currentMod + 360) % 360
    setRotation(rotation + 360 * 6 + delta) // 6 full turns + land on the winner
    setTimeout(() => {
      setWinner(recipes[win])
      setSpinning(false)
    }, 4200)
  }

  // With many recipes the labels become an unreadable ring — hide them and let
  // the result card reveal the winner instead.
  const showLabels = n <= 12
  const maxChars = n <= 6 ? 12 : 8
  const fontSize = n <= 8 ? 9 : 7

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="relative mx-auto aspect-square w-full">
        {/* fixed pointer at the top, pointing into the wheel */}
        <div
          className="absolute left-1/2 top-0 z-10 -translate-x-1/2"
          style={{ width: 0, height: 0, borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderTop: '18px solid var(--primary)' }}
          aria-hidden
        />
        {/* rotating wheel */}
        <div
          className="h-full w-full drop-shadow"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
          }}
        >
          <svg viewBox="0 0 220 220" className="h-full w-full">
            {n === 1 ? (
              <circle cx={CX} cy={CY} r={R} fill={COLORS[0]} stroke="#fff" strokeWidth="1.5" />
            ) : (
              recipes.map((r, i) => {
                const start = i * seg
                const end = (i + 1) * seg
                const s = edge(start)
                const e = edge(end)
                const mid = (start + end) / 2
                const a = (mid * Math.PI) / 180
                const lr = R * 0.62
                const lx = CX + lr * Math.sin(a)
                const ly = CY - lr * Math.cos(a)
                const flip = mid > 90 && mid < 270
                const label = r.title.length > maxChars ? r.title.slice(0, maxChars) + '…' : r.title
                return (
                  <g key={r.id}>
                    <path
                      d={`M ${CX} ${CY} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`}
                      fill={COLORS[i % COLORS.length]}
                      stroke="#fff"
                      strokeWidth="1.5"
                    />
                    {showLabels && (
                      <text
                        x={lx}
                        y={ly}
                        fill="#fff"
                        fontSize={fontSize}
                        fontWeight={600}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${flip ? mid + 180 : mid}, ${lx.toFixed(2)}, ${ly.toFixed(2)})`}
                      >
                        {label}
                      </text>
                    )}
                  </g>
                )
              })
            )}
            {/* hub */}
            <circle cx={CX} cy={CY} r="13" fill="#fff" stroke="var(--primary)" strokeWidth="2" />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <Button type="button" onClick={spin} disabled={spinning} size="lg">
          {spinning ? t('spin.spinning') : winner ? t('spin.again') : t('spin.spin')}
        </Button>
      </div>

      {winner && !spinning && (
        <div className="rounded-2xl border border-secondary/30 bg-secondary/5 p-5 text-center">
          <p className="text-sm text-muted-foreground">{t('spin.result')}</p>
          <h2 className="mt-1 font-serif text-2xl text-primary">{winner.title}</h2>
          <div className="mt-3">
            <Button asChild><Link href={`/recipes/${winner.id}`}>{t('spin.view')}</Link></Button>
          </div>
        </div>
      )}
    </div>
  )
}
