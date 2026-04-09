import { useMemo, useState } from 'react'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useSidebarOpen } from '../hooks/useSidebarOpen'
import { useUsers } from '../hooks/useUsers'
import {
  useAttendance,
  ATTENDANCE_STATUS,
  displayNameForUser,
} from '../hooks/useAttendance'
import { useAuth } from '../contexts/AuthContext'
import { CalendarCheck, Loader2, Users as UsersIcon } from 'lucide-react'

function localDateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const STATUS_OPTIONS = [
  { value: '', label: 'Belum ditandai' },
  { value: ATTENDANCE_STATUS.HADIR, label: 'Hadir' },
  { value: ATTENDANCE_STATUS.TIDAK_HADIR, label: 'Tidak hadir' },
  { value: ATTENDANCE_STATUS.IZIN, label: 'Izin' },
  { value: ATTENDANCE_STATUS.SAKIT, label: 'Sakit' },
]

function statusBadgeClass(status) {
  switch (status) {
    case ATTENDANCE_STATUS.HADIR:
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
    case ATTENDANCE_STATUS.TIDAK_HADIR:
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
    case ATTENDANCE_STATUS.IZIN:
      return 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
    case ATTENDANCE_STATUS.SAKIT:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
}

export default function Attendance() {
  const { sidebarOpen, toggleSidebar } = useSidebarOpen(true)
  const { currentUser } = useAuth()
  const [dateKey, setDateKey] = useState(() => localDateKey())
  const { users, loading: usersLoading, error: usersError } = useUsers()
  const { byUserId, loading: attLoading, error: attError, setStatus, markAllPresent } =
    useAttendance(dateKey)

  const [rowSaving, setRowSaving] = useState(null)
  const [bulkSaving, setBulkSaving] = useState(false)

  const team = useMemo(() => {
    return users
      .filter((u) => u.approved === true)
      .slice()
      .sort((a, b) => {
        const na = displayNameForUser(a).toLowerCase()
        const nb = displayNameForUser(b).toLowerCase()
        return na.localeCompare(nb, 'id')
      })
  }, [users])

  const presentCount = useMemo(() => {
    return team.filter((u) => byUserId[u.id]?.status === ATTENDANCE_STATUS.HADIR).length
  }, [team, byUserId])

  const handleStatusChange = async (user, value) => {
    const uid = user.id
    setRowSaving(uid)
    try {
      await setStatus(uid, displayNameForUser(user), value || '', currentUser?.uid)
    } catch (err) {
      console.error(err)
      alert('Gagal menyimpan absensi')
    } finally {
      setRowSaving(null)
    }
  }

  const handleMarkAllPresent = async () => {
    if (!team.length) return
    if (!window.confirm(`Tandai semua ${team.length} pengguna sebagai hadir untuk tanggal ini?`)) return
    setBulkSaving(true)
    try {
      await markAllPresent(team, currentUser?.uid)
    } catch (err) {
      console.error(err)
      alert('Gagal menandai semua hadir')
    } finally {
      setBulkSaving(false)
    }
  }

  const loading = usersLoading || attLoading
  const error = usersError || attError

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Beranda &gt; Absensi
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                  <CalendarCheck className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Absensi</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tandai kehadiran tim per hari.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 flex-wrap">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={dateKey}
                    onChange={(e) => setDateKey(e.target.value || localDateKey())}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <UsersIcon className="h-4 w-4" />
                  <span>
                    Hadir:{' '}
                    <strong className="text-gray-900 dark:text-white">
                      {presentCount}/{team.length}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  disabled={bulkSaving || !team.length || loading}
                  className="sm:ml-auto px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkSaving ? 'Menyimpan…' : 'Tandai semua hadir'}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Memuat…
                </div>
              ) : team.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  Belum ada pengguna disetujui. Setujui pengguna di menu Users terlebih dahulu.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/80">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                          Nama
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                          Email
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                          Peran
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                          Status hari ini
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                          Diperbarui
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {team.map((user) => {
                        const rec = byUserId[user.id]
                        const current = rec?.status || ''
                        const saving = rowSaving === user.id
                        return (
                          <tr
                            key={user.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/40"
                          >
                            <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                              {displayNameForUser(user)}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                              {user.email || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 capitalize">
                                {user.role || 'employee'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  value={current}
                                  disabled={saving}
                                  onChange={(e) => handleStatusChange(user, e.target.value)}
                                  className="min-w-[11rem] px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
                                >
                                  {STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value || 'empty'} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full ${statusBadgeClass(current)}`}
                                >
                                  {STATUS_OPTIONS.find((o) => o.value === current)?.label ||
                                    'Belum ditandai'}
                                </span>
                                {saving && (
                                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {rec?.updatedAt
                                ? new Date(rec.updatedAt).toLocaleString('id-ID', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })
                                : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}
