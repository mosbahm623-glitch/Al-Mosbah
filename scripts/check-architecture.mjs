// Keeps the layers apart:
//   pages / components / layout  ->  talk to the data only through src/lib (never to Supabase directly)
//   src/lib                      ->  never imports from pages / components / layout / auth
//   every source file             ->  at most MAX_LINES lines (split a long file by what it does, not by line count)
//   src/lib/<feature>/           ->  may only import the features listed in LIB_DEPENDENCIES (one direction, no cycles)
// (src/auth is the one place besides lib that may use the Supabase client: it is the sign-in layer.)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const UI_DIRS = ['src/pages', 'src/components', 'src/layout']
const UI_FILES = ['src/App.tsx', 'src/main.tsx']

/** A file longer than this is doing too much: it gets hard to read, review and test. */
export const MAX_LINES = 350

/**
 * Which folders of src/lib may use which. Read it as "left needs right". The files directly in src/lib
 * (the Supabase client) may be used by everyone and may only use net. Add a line here when a new folder is born,
 * and keep the arrows pointing the same way: a lower layer never imports a higher one.
 */
export const LIB_DEPENDENCIES = {
  net: [],
  core: [],
  notifications: [],
  banks: ['core'],
  contractors: ['core'],
  users: ['core'],
  entries: ['core'],
  approvals: ['core', 'entries'],
  advances: ['core', 'entries'],
  projects: ['core', 'entries', 'approvals'],
  reports: ['core', 'projects'],
  export: ['core', 'entries', 'projects'],
  offline: ['core', 'entries', 'net'],
}

export function listSourceFiles(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  return entries.flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : listSourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

/** Every module specifier a file imports (static, dynamic or re-export). */
export function importsOf(source) {
  const specs = []
  for (const m of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) specs.push(m[1])
  return specs
}

const isSupabase = (spec) => /(^|\/)lib\/supabase$/.test(spec) || spec.startsWith('@supabase/')
const isUiLayer = (spec) => /(^|\/)(pages|components|layout)(\/|$)/.test(spec) && spec.startsWith('.')

export function findViolations(root = '.') {
  const violations = []
  const uiFiles = [...UI_DIRS.flatMap((d) => listSourceFiles(join(root, d))), ...UI_FILES.map((f) => join(root, f))]
  for (const file of uiFiles) {
    let source
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const spec of importsOf(source)) {
      if (isSupabase(spec)) {
        violations.push({
          file: relative(root, file),
          spec,
          message: 'talks to Supabase directly: add a function to src/lib and call that instead',
        })
      }
    }
  }
  for (const file of listSourceFiles(join(root, 'src/lib'))) {
    for (const spec of importsOf(readFileSync(file, 'utf8'))) {
      if (isUiLayer(spec)) {
        violations.push({
          file: relative(root, file),
          spec,
          message: 'src/lib must not depend on pages, components or layout',
        })
      }
    }
  }
  for (const file of listSourceFiles(join(root, 'src'))) {
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
    if (lines > MAX_LINES) {
      violations.push({
        file: relative(root, file),
        spec: `${lines} lines`,
        message: `longer than ${MAX_LINES} lines: split it by what it does`,
      })
    }
  }
  const libRoot = join(root, 'src/lib')
  const folderOf = (path) => {
    const parts = relative(libRoot, path).split(sep)
    return parts.length > 1 ? parts[0] : '.'
  }
  for (const file of listSourceFiles(libRoot)) {
    const from = folderOf(file)
    for (const spec of importsOf(readFileSync(file, 'utf8'))) {
      if (!spec.startsWith('.')) continue
      const target = normalize(join(dirname(file), spec))
      if (target === join(root, 'src/auth') || target.startsWith(join(root, 'src/auth') + sep)) {
        violations.push({
          file: relative(root, file),
          spec,
          message: 'src/lib must not depend on src/auth: pass what it needs in',
        })
        continue
      }
      if (relative(libRoot, target).startsWith('..')) continue
      const to = folderOf(target)
      if (to === from || (to === '.' && from !== '.')) continue
      const allowed = from === '.' ? ['net'] : LIB_DEPENDENCIES[from]
      if (!allowed) {
        violations.push({
          file: relative(root, file),
          spec,
          message: `folder "${from}" is not listed in LIB_DEPENDENCIES`,
        })
      } else if (!allowed.includes(to)) {
        violations.push({
          file: relative(root, file),
          spec,
          message: `"${from}" may not depend on "${to}" (see LIB_DEPENDENCIES)`,
        })
      }
    }
  }
  return violations
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const violations = findViolations(root)
  if (violations.length === 0) {
    console.log('Architecture check passed.')
  } else {
    console.error(`Architecture check failed (${violations.length}):`)
    for (const v of violations) console.error(`  ${v.file}: imports "${v.spec}" - ${v.message}`)
    process.exit(1)
  }
}
