import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// setup_all.sql is what SETUP.md's recommended path (Method A) tells people to
// paste into the Supabase SQL editor, and it claims to be every migration
// combined. It once fell a whole feature behind: the meal-planner DDL was never
// folded in, so a database set up that way had no meal_plan_entries table and
// the app blew up the moment anyone added a recipe to their plan. Nothing in
// the toolchain notices that drift — the two files are only equivalent by hand.
const dir = join(process.cwd(), 'supabase')
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '')

const setupAll = stripComments(readFileSync(join(dir, 'setup_all.sql'), 'utf8'))
const migrations = readdirSync(join(dir, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .map((file) => ({ file, sql: stripComments(readFileSync(join(dir, 'migrations', file), 'utf8')) }))

// Only public tables — the storage.* grants live in their own section and are
// written differently in the aggregate.
const CREATE_TABLE = /create table (?:if not exists )?public\.(\w+)/gi
const ADD_COLUMN = /alter table\s+public\.\w+\s+add column (?:if not exists )?(\w+)/gi
const captures = (sql: string, re: RegExp) => [...sql.matchAll(re)].map((m) => m[1])

describe('setup_all.sql stays level with supabase/migrations', () => {
  it('has migrations to check', () => {
    expect(migrations.length).toBeGreaterThan(0)
  })

  it.each(migrations)('covers $file', ({ sql }) => {
    for (const table of captures(sql, CREATE_TABLE)) {
      expect(setupAll).toMatch(
        new RegExp(`create table (?:if not exists )?public\\.${table}\\b`, 'i'),
      )
    }
    // A column added by a later migration may be inlined into the aggregate's
    // create table instead, so look for the name rather than the statement.
    for (const column of captures(sql, ADD_COLUMN)) {
      expect(setupAll).toMatch(new RegExp(`\\b${column}\\b`))
    }
  })
})
