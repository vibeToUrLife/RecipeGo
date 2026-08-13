// The rule for a planned meal's note, shared so the dialog that types one and
// the action that stores it can't drift apart. No I/O — unit-tested.
export const NOTE_MAX = 500

// Blank (or whitespace-only) becomes null, so "no note" is one stored value
// rather than two. Returns undefined for input that can't be accepted at all.
export function cleanNote(s: unknown): string | null | undefined {
  if (s == null) return null
  if (typeof s !== 'string') return undefined
  const clean = s.trim()
  if (!clean) return null
  return clean.length <= NOTE_MAX ? clean : undefined
}
