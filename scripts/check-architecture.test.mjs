import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findViolations, importsOf } from './check-architecture.mjs'

let root
const put = (file, text) => {
  mkdirSync(dirname(join(root, file)), { recursive: true })
  writeFileSync(join(root, file), text)
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'arch-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('importsOf', () => {
  it('finds static, dynamic and re-export imports', () => {
    const src = `import a from './a'\nimport { b } from "../b"\nexport * from './c'\nconst d = await import('./d')`
    expect(importsOf(src)).toEqual(['./a', '../b', './c', './d'])
  })
})

describe('findViolations', () => {
  it('passes when pages only use src/lib', () => {
    put('src/pages/Home.tsx', `import { fetchSummaries } from '../lib/projects'`)
    put('src/lib/projects.ts', `import { supabase } from './supabase'`)
    put('src/auth/AuthProvider.tsx', `import { supabase } from '../lib/supabase'`)
    expect(findViolations(root)).toEqual([])
  })
  it('flags a page, a component and a layout file that import the Supabase client', () => {
    put('src/pages/a/Deep.tsx', `import { supabase } from '../../lib/supabase'`)
    put('src/components/C.tsx', `import { supabase } from '../lib/supabase'`)
    put('src/layout/L.tsx', `import { createClient } from '@supabase/supabase-js'`)
    expect(findViolations(root).map((v) => v.file)).toEqual(
      expect.arrayContaining(['src/pages/a/Deep.tsx', 'src/components/C.tsx', 'src/layout/L.tsx']),
    )
    expect(findViolations(root)).toHaveLength(3)
  })
  it('flags src/App.tsx too', () => {
    put('src/App.tsx', `import { supabase } from './lib/supabase'`)
    expect(findViolations(root)).toHaveLength(1)
  })
  it('flags src/lib reaching up into the UI', () => {
    put('src/lib/x.ts', `import Dialog from '../components/Dialog'`)
    const [v] = findViolations(root)
    expect(v.file).toBe('src/lib/x.ts')
  })
  it('lets a lib folder use the folders it is allowed to', () => {
    put(
      'src/lib/approvals/a.ts',
      `import { x } from '../entries/e'\nimport { y } from '../core/c'\nimport { supabase } from '../supabase'`,
    )
    put('src/lib/supabase.ts', `import { f } from './net/fetch'`)
    expect(findViolations(root)).toEqual([])
  })
  it('flags a lib folder that reaches into one it may not use', () => {
    put('src/lib/entries/e.ts', `import { p } from '../projects/p'`)
    const [v] = findViolations(root)
    expect(v.message).toMatch(/"entries" may not depend on "projects"/)
  })
  it('flags a lib folder that is not listed', () => {
    put('src/lib/newthing/n.ts', `import { c } from '../core/c'`)
    expect(findViolations(root)[0].message).toMatch(/not listed/)
  })
  it('flags the Supabase client file using a feature folder', () => {
    put('src/lib/supabase.ts', `import { e } from './entries/e'`)
    expect(findViolations(root)[0].message).toMatch(/may not depend on "entries"/)
  })
  it('ignores test files', () => {
    put('src/pages/__tests__/p.ts', `import { supabase } from '../../lib/supabase'`)
    put('src/pages/p.test.tsx', `import { supabase } from '../lib/supabase'`)
    expect(findViolations(root)).toEqual([])
  })
  it('passes on a missing folder instead of crashing', () => {
    expect(findViolations(root)).toEqual([])
  })
})
