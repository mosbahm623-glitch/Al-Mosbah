// Keeps the layers apart:
//   pages / components / layout  ->  talk to the data only through src/lib (never to Supabase directly)
//   src/lib                      ->  never imports from pages / components / layout
// (src/auth is the one place besides lib that may use the Supabase client: it is the sign-in layer.)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const UI_DIRS = ['src/pages', 'src/components', 'src/layout']
const UI_FILES = ['src/App.tsx', 'src/main.tsx']

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
