'use client'
import { Button } from '@/components/ui/button'

export function ServingsStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground">Servings</span>
      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onChange(Math.max(1, value - 1))}>–</Button>
      <span className="w-6 text-center font-semibold">{value}</span>
      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onChange(value + 1)}>＋</Button>
      <span className="text-xs text-muted-foreground">(quantities auto-scale)</span>
    </div>
  )
}
