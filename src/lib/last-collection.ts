// Decides whether a fresh "/" visit should bounce the user to their last room.
// Returns the room id to redirect to, or null to stay on personal "My Recipes".
//
//  - `home` set (from "/?home=1") → the user explicitly chose personal → stay.
//  - no remembered collection, or it's "personal" → stay.
//  - a remembered room id → restore it, but only if the user is still a member
//    (validated against myRoomIds) so a left/deleted room falls back to personal.
export function roomToRestore(
  home: string | undefined,
  lastCollection: string | undefined,
  myRoomIds: string[],
): string | null {
  if (home) return null
  if (!lastCollection || lastCollection === 'personal') return null
  return myRoomIds.includes(lastCollection) ? lastCollection : null
}
