/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(process.cwd(), 'src')
const index = readFileSync(join(root, 'index.css'), 'utf8')
const imported = [...index.matchAll(/@import '\.\/styles\/([^']+)'/g)].map((m) => m[1])

// The cascade order in index.css matters: a later file overrides an earlier one.
// This pins the order so a reorder (or a forgotten file) is a conscious choice, not an accident.
const EXPECTED = [
  'tokens.css',
  'controls.css',
  'offline-bar.css',
  'shell.css',
  'tiles.css',
  'tables.css',
  'shell-desktop.css',
  'page-pieces.css',
  'dialog.css',
  'entries.css',
  'paper-reports.css',
  'permissions-approvals.css',
  'search-and-data-tables.css',
  'sign-in.css',
  'responsive-and-features.css',
  'look.css',
]

describe('css import order', () => {
  it('keeps the cascade order', () => {
    expect(imported).toEqual(EXPECTED)
  })
  it('imports every stylesheet in the styles folder', () => {
    expect(
      readdirSync(join(root, 'styles'))
        .filter((f: string) => f.endsWith('.css'))
        .sort(),
    ).toEqual([...imported].sort())
  })
})
