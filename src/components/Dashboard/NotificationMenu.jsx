import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, Loader2 } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'

function formatNotifTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

export default function NotificationMenu() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const navigate = useNavigate()
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications(40)

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const goExpense = async (n) => {
    if (n.expenseId) {
      try {
        await markRead(n.id)
      } catch {
        // ignore
      }
      setOpen(false)
      navigate(`/biaya/${n.expenseId}`)
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors relative"
        aria-label="Notifikasi"
      >
        <Bell className="h-5 w-5 text-gray-700 dark:text-white" />
        <ChevronDown className="h-4 w-4 text-gray-700 dark:text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-[60] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifikasi</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead()}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Tandai dibaca semua
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-gray-500 text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                Memuat…
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Belum ada notifikasi. Setelah Anda mengirim permintaan dari menu Permintaan, atau saat ada update
                persetujuan, pesan akan tampil di sini.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      disabled={!n.expenseId}
                      onClick={() => goExpense(n)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors ${
                        n.read ? 'opacity-75' : 'bg-blue-50/50 dark:bg-blue-900/10'
                      } ${!n.expenseId ? 'cursor-default' : ''}`}
                    >
                      <p className="text-xs font-medium text-gray-900 dark:text-white">{n.title}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-3">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">{formatNotifTime(n.createdAt)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Admin/owner: tinjau & setujui di menu Biaya → tab Permintaan karyawan.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
