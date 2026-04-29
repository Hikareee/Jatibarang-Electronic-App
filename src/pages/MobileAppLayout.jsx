import { Outlet, useLocation } from 'react-router-dom'
import { LogOut, ScanLine } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import MobileBottomNav from '../components/mobile/MobileBottomNav'

function titleForPath(pathname) {
  if (pathname.startsWith('/mobile/delivery')) return 'Delivery'
  return 'Stock Lookup'
}

export default function MobileAppLayout() {
  const location = useLocation()
  const { currentUser, logout } = useAuth()

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow">
            <ScanLine className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{titleForPath(location.pathname)}</p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {currentUser?.email || 'Approved staff'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            title="Keluar"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-4">
        <Outlet />
      </main>

      <MobileBottomNav />
    </div>
  )
}
