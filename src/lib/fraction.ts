// Cooking quantities read better as fractions: a recipe card says "½ tsp",
// never "0.5 tsp". Scaling stores decimals (rounded to 2dp in scaleIngredients),
// so this is a *display* formatter only — the stored numbers stay decimal and
// every input field keeps taking plain numbers.

// Vulgar-fraction glyphs Unicode gives us, as [numerator, denominator, glyph].
// Ordered by value so the nearest-match scan below reads in order.
const GLYPHS: ReadonlyArray<readonly [number, number, string]> = [
  [1, 8, '⅛'],
  [1, 4, '¼'],
  [1, 3, '⅓'],
  [3, 8, '⅜'],
  [1, 2, '½'],
  [5, 8, '⅝'],
  [2, 3, '⅔'],
  [3, 4, '¾'],
  [7, 8, '⅞'],
]

// Quantities arrive rounded to 2dp, so the true fraction can sit up to 0.005
// away from the value we see (⅓ → 0.33, ⅛ → 0.13). 0.015 gives that three times
// the room it needs while staying well under half the smallest gap between two
// glyphs (⅓→⅜ is 0.042), so a value can never be pulled onto the wrong one.
const TOLERANCE = 0.015

function trimDecimal(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

/**
 * Format a quantity for display, preferring cooking fractions.
 *
 *   0.5   → "½"      1.25 → "1¼"     0.33 → "⅓"
 *   2     → "2"      0.35 → "0.35"   null → ""
 *
 * Anything that isn't close to a common fraction falls back to a trimmed
 * decimal, so no quantity is ever silently misreported.
 */
export function formatQuantity(q: number | null | undefined): string {
  if (q === null || q === undefined || !Number.isFinite(q)) return ''
  if (q < 0) return trimDecimal(q) // negatives aren't cooking quantities; show as-is
  if (Number.isInteger(q)) return String(q)

  const whole = Math.floor(q)
  const frac = q - whole

  // Round away from a fraction that is really just a whole number (1.999 → 2).
  if (frac < TOLERANCE) return String(whole)
  if (frac > 1 - TOLERANCE) return String(whole + 1)

  let best: string | null = null
  let bestDelta = TOLERANCE
  for (const [num, den, glyph] of GLYPHS) {
    const delta = Math.abs(frac - num / den)
    if (delta < bestDelta) {
      bestDelta = delta
      best = glyph
    }
  }
  if (best === null) return trimDecimal(q)

  // "1½", not "1 ½" — the glyphs are designed to sit tight against the integer.
  return whole === 0 ? best : `${whole}${best}`
}
