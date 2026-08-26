import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The recipe-images bucket caps size and allowed types server-side, and
// image-upload.tsx repeats both so a rejected photo can say which wall it hit
// instead of a bare "Upload failed". Nothing links the two: raise the cap in SQL
// alone and the uploader keeps refusing the file it would now accept; widen it
// in the component alone and Storage rejects what the UI just promised.
const root = process.cwd()
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8')

const component = read('src', 'components', 'image-upload.tsx')
const setupAll = read('supabase', 'setup_all.sql')
const migration = read('supabase', 'migrations', '20260727120000_storage_limits.sql')

const bytesFrom = (sql: string) => Number(sql.match(/file_size_limit\s*=?\s*,?\s*(\d+)/)?.[1])
const typesFrom = (sql: string) =>
  (sql.match(/allowed_mime_types\s*=?\s*,?\s*array\[([^\]]+)\]/)?.[1] ?? '')
    .split(',')
    .map((t) => t.trim().replace(/'/g, ''))
    .filter(Boolean)
    .sort()

describe('image-upload.tsx mirrors the recipe-images bucket', () => {
  const componentBytes = (() => {
    const m = component.match(/MAX_BYTES\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)/)
    return m ? Number(m[1]) * Number(m[2]) * Number(m[3]) : NaN
  })()
  const componentTypes = [...component.matchAll(/'(image\/[a-z+]+)':\s*'/g)].map((m) => m[1]).sort()

  it('reads a limit out of each file', () => {
    expect(componentBytes).toBeGreaterThan(0)
    expect(componentTypes.length).toBeGreaterThan(0)
    expect(bytesFrom(migration)).toBeGreaterThan(0)
    expect(typesFrom(migration).length).toBeGreaterThan(0)
  })

  it('agrees with the migration on the size cap', () => {
    expect(componentBytes).toBe(bytesFrom(migration))
  })

  it('agrees with the migration on the allowed types', () => {
    expect(componentTypes).toEqual(typesFrom(migration))
  })

  it('agrees with setup_all.sql, which is what Method A actually runs', () => {
    expect(bytesFrom(setupAll)).toBe(bytesFrom(migration))
    expect(typesFrom(setupAll)).toEqual(typesFrom(migration))
  })

  // A second run used to die on 42710 "policy already exists" and the SQL editor
  // rolled the whole script back, so SETUP.md's own "Image upload fails" repair
  // silently did nothing.
  it('can re-create the storage policies on a database that already has them', () => {
    const section = setupAll.slice(setupAll.indexOf('5. IMAGE STORAGE'))
    const created = [...section.matchAll(/create policy "([^"]+)" *\n?on storage\.objects/g)].map((m) => m[1])
    expect(created.length).toBeGreaterThan(0)
    for (const policy of created) {
      expect(section).toContain(`drop policy if exists "${policy}" on storage.objects;`)
    }
  })
})
