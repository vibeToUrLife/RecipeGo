import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

// RecipeGo draws its own pictures and icons (components/icons.tsx). An emoji in
// the app's text or markup would be the phone's own drawing instead, different
// on every system, so none may creep back in. Comments never show, so they're
// left out of the search.
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(file)
    return /\.tsx?$/.test(entry.name) ? [file] : []
  })
}

const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1')

describe('the app', () => {
  it('shows no emoji, only drawings of its own', () => {
    const found = sourceFiles('src').flatMap((file) =>
      withoutComments(fs.readFileSync(file, 'utf8'))
        .split('\n')
        .filter((line) => /\p{Extended_Pictographic}/u.test(line))
        .map((line) => `${file}: ${line.trim()}`),
    )
    expect(found).toEqual([])
  })
})
