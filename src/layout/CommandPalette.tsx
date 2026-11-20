import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { NAV, visibleItems } from './nav'
import { usePaletteData } from './usePaletteData'

const GROUP_TITLE = {
  pages: 'صفحات',
  projects: 'مشاريع',
  advances: 'عهد',
  contractors: 'مقاولين',
  banks: 'بنوك',
  entries: 'قيود',
} as const

type Row = { group: keyof typeof GROUP_TITLE; label: string; meta?: string; path: string }

const PER_GROUP = 6

/** Arabic search that ignores marks and spelling variants (أ إ آ ا · ة ه · ى ي) and Arabic digits. */
const plain = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

/** Ctrl+K: type part of a name and jump straight to that page, project, custody, contractor or bank. */
export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const auth = useAuth()
  const places = usePaletteData()
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = dialog.current
    if (el && !el.open) el.showModal()
  }, [])

  const rows = useMemo<Row[]>(() => {
    const words = plain(q).split(/\s+/).filter(Boolean)
    const hit = (label: string) => words.every((w) => plain(label).includes(w))
    const pages: Row[] = NAV.flatMap((g) => visibleItems(g.items, auth))
      .filter((i) => hit(i.label))
      .map((i) => ({ group: 'pages', label: i.label, path: i.path }))
    const named = (['projects', 'advances', 'contractors', 'banks'] as const).flatMap((g) =>
      words.length === 0 ? [] : places.filter((p) => p.group === g && hit(p.label)).slice(0, PER_GROUP),
    )
    const search: Row[] =
      q.trim() && auth.can('tools')
        ? [
            {
              group: 'entries',
              label: `ابحث في القيود عن «${q.trim()}»`,
              path: `search?q=${encodeURIComponent(q.trim())}`,
            },
          ]
        : []
    return [...pages.slice(0, words.length === 0 ? 12 : PER_GROUP), ...named, ...search]
  }, [q, places, auth])

  useEffect(() => {
    list.current?.querySelector('[data-on="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [at, rows])

  function go(row: Row | undefined) {
    if (!row) return
    window.location.hash = `#/${row.path}`
    onClose()
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAt((i) => (rows.length ? (i + 1) % rows.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAt((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(rows[at])
    }
  }

  return (
    <dialog
      ref={dialog}
      className="palette"
      aria-label="بحث سريع"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="palette-input">
        <Search size={18} aria-hidden="true" />
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setAt(0)
          }}
          onKeyDown={onKey}
          placeholder="اكتب اسم مشروع أو عهدة أو مقاول أو بنك أو صفحة"
          aria-label="بحث سريع"
          autoComplete="off"
        />
      </div>
      <div className="palette-list" ref={list} role="listbox">
        {rows.length === 0 && <p className="palette-empty muted">مفيش نتيجة.</p>}
        {rows.map((r, i) => (
          <div key={`${r.group}:${r.path}`}>
            {(i === 0 || rows[i - 1].group !== r.group) && <p className="palette-group">{GROUP_TITLE[r.group]}</p>}
            <button
              type="button"
              role="option"
              aria-selected={i === at}
              data-on={i === at}
              className={`palette-row ${i === at ? 'palette-on' : ''}`}
              onMouseMove={() => setAt(i)}
              onClick={() => go(r)}
            >
              <span>{r.label}</span>
              {r.meta && <span className="palette-meta">{r.meta}</span>}
            </button>
          </div>
        ))}
      </div>
      <p className="palette-foot muted">↑↓ للتنقل · Enter للفتح · Esc للإغلاق</p>
    </dialog>
  )
}
