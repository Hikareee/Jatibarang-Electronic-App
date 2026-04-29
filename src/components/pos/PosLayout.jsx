import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  Store,
  FileText,
  Settings,
  Maximize2,
  Moon,
  Sun,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useDarkMode } from '../../contexts/DarkModeContext'

const railBtn =
  'flex h-11 w-11 items-center justify-center rounded-xl transition-colors'

function userInitials(email) {
  const e = String(email || '').split('@')[0] || 'U'
  if (e.length >= 2) return e.slice(0, 2).toUpperCase()
  return (e.slice(0, 2) || 'DO').toUpperCase()
}

export default function PosLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const settingsActive = pathname.startsWith('/pos/pengaturan')
  const { currentUser, logout } = useAuth()
  const { darkMode, toggleDarkMode } = useDarkMode()
  const initials = userInitials(currentUser?.email)

  async function handleLogout() {
    try {
      await logout()
      navigate('/login')
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#f5f7fa] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="flex w-[3.75rem] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-slate-200/90 bg-white py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:w-[4rem] sm:gap-2 sm:py-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-md"
          title={currentUser?.email || 'Pengguna'}
        >
          {initials}
        </div>

        <nav
          className="mt-2 flex w-full flex-col items-center gap-1 px-2"
          aria-label="Modul POS"
        >
          <NavLink
            to="/pos"
            end
            title="Kasir POS"
            className={({ isActive }) =>
              `${railBtn} ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`
            }
          >
            <Store className="h-5 w-5 shrink-0" />
          </NavLink>
          <NavLink
            to="/pos/transaksi"
            title="Transaksi"
            className={({ isActive }) =>
              `${railBtn} relative ${isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'} ${isActive ? 'before:absolute before:left-0 before:top-1/2 before:h-7 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-blue-600' : ''}`
            }
          >
            <FileText className="h-5 w-5 shrink-0" />
          </NavLink>
        </nav>

        <div className="my-1 w-8 border-t border-slate-200 dark:border-slate-700" />

        <NavLink
          to="/dashboard"
          title="Beranda aplikasi"
          className={({ isActive }) =>
            `${railBtn} ${isActive ? 'bg-slate-200 dark:bg-slate-700' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`
          }
        >
          <Home className="h-5 w-5 shrink-0" />
        </NavLink>
        <NavLink
          to="/pos/pengaturan/kasir"
          title="Pengaturan POS"
          className={() =>
            `${railBtn} ${
              settingsActive
                ? 'relative bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200 before:absolute before:left-0 before:top-1/2 before:h-7 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-blue-600'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`
          }
        >
          <Settings className="h-5 w-5 shrink-0" />
        </NavLink>
        <button
          type="button"
          title="Layar penuh"
          className={`${railBtn} text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800`}
          onClick={() => {
            try {
              if (!document.fullscreenElement)
                document.documentElement.requestFullscreen()
              else document.exitFullscreen()
            } catch {
              /* ignore */
            }
          }}
        >
          <Maximize2 className="h-5 w-5" />
        </button>

        <div className="min-h-[4px] flex-1" />

        <button
          type="button"
          onClick={() => toggleDarkMode()}
          className={`${railBtn} text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800`}
          title={darkMode ? 'Tema terang' : 'Tema gelap'}
        >
          {darkMode ? (
            <Sun className="h-5 w-5 shrink-0" />
          ) : (
            <Moon className="h-5 w-5 shrink-0" />
          )}
        </button>
        <button
          type="button"
          title="Keluar"
          onClick={handleLogout}
          className={`${railBtn} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40`}
        >
          <LogOut className="h-5 w-5 shrink-0" />
        </button>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
