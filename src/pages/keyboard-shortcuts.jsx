import { Link, useLocation } from 'wouter'
import { ArrowLeft, Keyboard } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { APP_SHORTCUT_GROUPS, KEYBOARD_SHORTCUTS_PATH } from '@/lib/appShortcuts'

function ShortcutKeyBadge({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-1 rounded-md border border-slate-200 bg-slate-50 font-mono text-[11px] font-semibold text-slate-700 shadow-sm">
      {children}
    </kbd>
  )
}

function ShortcutKeys({ keys }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {keys.map((key, index) => (
        <span key={`${key}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? <span className="text-slate-400 text-xs">+</span> : null}
          <ShortcutKeyBadge>{key}</ShortcutKeyBadge>
        </span>
      ))}
    </span>
  )
}

export default function KeyboardShortcutsPage() {
  const [, setLocation] = useLocation()

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-100/80">
      <PageHeader title="Keyboard shortcuts">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-blue-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
      </PageHeader>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-5">
          <section className="rounded-xl border border-blue-100 bg-gradient-to-r from-white via-blue-50/40 to-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-800 text-white shadow-sm">
                <Keyboard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Quick navigation</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Use these shortcuts from any page after login (not while typing in an input). For
                  two-step shortcuts (e.g. Ctrl+G then C), press the second key within about half a
                  second after releasing the first.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  On Mac, use Cmd instead of Ctrl. This page:{' '}
                  <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">
                    {KEYBOARD_SHORTCUTS_PATH}
                  </code>
                </p>
              </div>
            </div>
          </section>

          {APP_SHORTCUT_GROUPS.map((group) => (
            <section
              key={group.id}
              className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
            >
              <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/80">
                <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{shortcut.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{shortcut.path}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <ShortcutKeys keys={shortcut.keys} />
                      <button
                        type="button"
                        onClick={() => setLocation(shortcut.path)}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-blue-800 text-white text-xs font-semibold cursor-pointer hover:bg-blue-900"
                      >
                        Go to page
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
