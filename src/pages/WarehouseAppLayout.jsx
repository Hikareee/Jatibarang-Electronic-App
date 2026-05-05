import { Outlet, NavLink, useLocation, Link } from 'react-router-dom'
import { LogOut, Moon, Sun, Home, Package, ExternalLink, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useDarkMode } from '../contexts/DarkModeContext'

const LAST_WAREHOUSE_KEY = 'warehouseApp.lastWarehouseId'

function readLastWarehouseId() {
  try {
    return String(localStorage.getItem(LAST_WAREHOUSE_KEY) || '').trim()
  } catch {
    return ''
  }
}

export default function WarehouseAppLayout() {
  const location = useLocation()
  const { currentUser, logout } = useAuth()
  const { darkMode, toggleDarkMode } = useDarkMode()
  const lastId = readLastWarehouseId()
  const stockPath = lastId ? `/warehouse/${lastId}` : '/warehouse'
  const onWarehouseWorkspace = /^\/warehouse\/[^/]+$/.test(location.pathname)

  const navClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
      isActive
        ? 'bg-blue-600 text-white shadow-md'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
    }`

  const mobileNavClass = ({ isActive }) =>
    `flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
      isActive
        ? 'bg-blue-600 text-white shadow'
        : 'text-slate-500 dark:text-slate-400'
    }`

  return (
    <div className="flex min-h-[100dvh] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            App Gudang
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Stok dan pindai — mobile dan PC
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          <NavLink to="/warehouse" end className={navClass}>
            <Home className="h-4 w-4 shrink-0" />
            Beranda
          </NavLink>
          <NavLink
            to={stockPath}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive || onWarehouseWorkspace
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`
            }
          >
            <Package className="h-4 w-4 shrink-0" />
            Stok gudang
          </NavLink>
          <Link
            to="/dashboard"
            className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            Aplikasi utama
          </Link>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mx-auto flex max-w-5xl items-center gap-3 lg:max-w-none lg:px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-600 text-white shadow">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">App Gudang</p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {currentUser?.email || 'Staff'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleDarkMode()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
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

        <main className="mx-auto w-full max-w-md flex-1 px-4 py-4 lg:max-w-5xl lg:px-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="border-t border-slate-200 bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
          <div className="mx-auto flex max-w-md gap-2">
            <NavLink to="/warehouse" end className={mobileNavClass}>
              <Home className="h-5 w-5" />
              Beranda
            </NavLink>
            <NavLink
              to={lastId ? `/warehouse/${lastId}` : '/warehouse'}
              className={({ isActive }) =>
                mobileNavClass({
                  isActive: isActive || onWarehouseWorkspace,
                })
              }
            >
              <Package className="h-5 w-5" />
              Stok
            </NavLink>
            <Link
              to="/dashboard"
              className="flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold text-slate-500 no-underline dark:text-slate-400"
            >
              <ExternalLink className="h-5 w-5" />
              Utama
            </Link>
          </div>
        </nav>
      </div>
    </div>
  )
}

export { LAST_WAREHOUSE_KEY }
