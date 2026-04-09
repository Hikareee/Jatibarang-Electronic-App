import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useSidebarOpen } from '../hooks/useSidebarOpen'
import { useAuth } from '../contexts/AuthContext'
import { useExpenses, REQUEST_TYPES, WORKFLOW } from '../hooks/useExpensesData'
import { ClipboardList, Plus, Loader2, FileText, Banknote } from 'lucide-react'

function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('id-ID').format(Number(num) || 0)
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function workflowLabel(exp) {
  if (!exp.requestType) return '—'
  switch (exp.workflowStatus) {
    case WORKFLOW.DRAFT:
      return 'Draft'
    case WORKFLOW.SUBMITTED:
      return 'Menunggu persetujuan'
    case WORKFLOW.APPROVED:
      return exp.ledgerPosted ? 'Disetujui & diposting' : 'Disetujui'
    case WORKFLOW.REJECTED:
      return 'Ditolak'
    default:
      return exp.workflowStatus || '—'
  }
}

function typeLabel(t) {
  if (t === REQUEST_TYPES.FUND_REQUEST) return 'Permintaan dana'
  if (t === REQUEST_TYPES.EXPENSE_REPORT) return 'Laporan biaya'
  return t || '—'
}

export default function EmployeeRequests() {
  const { sidebarOpen, toggleSidebar } = useSidebarOpen(true)
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { expenses, loading, error } = useExpenses()

  const mine = useMemo(() => {
    const uid = currentUser?.uid
    if (!uid) return []
    return expenses
      .filter((e) => e.requestType && e.createdBy === uid)
      .slice()
      .sort((a, b) => {
        const ta = new Date(b.createdAt || 0).getTime()
        const tb = new Date(a.createdAt || 0).getTime()
        return ta - tb
      })
  }, [expenses, currentUser?.uid])

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Beranda &gt; Permintaan
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200">
                  <ClipboardList className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Permintaan</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ajukan pembelian material atau biaya operasional dengan bukti tagihan. Admin menerima notifikasi
                    dan menyetujui pencairan; owner memantau semua aktivitas lewat notifikasi dan Biaya.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <button
                type="button"
                onClick={() => navigate('/permintaan/lapor-biaya')}
                className="flex items-start gap-4 p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-400 dark:hover:border-teal-600 text-left transition-colors"
              >
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Laporan biaya</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Unggah invoice/kwitansi saat kirim pengajuan. Admin dipanggil lewat lonceng notifikasi.
                  </p>
                  <span className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-teal-600 dark:text-teal-400">
                    <Plus className="h-4 w-4" /> Buat baru
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/permintaan/dana')}
                className="flex items-start gap-4 p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-400 dark:hover:border-teal-600 text-left transition-colors"
              >
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                  <Banknote className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Permintaan dana</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Ajukan kebutuhan dana (uang muka, operasional, dll.) dengan nominal dan
                    keterangan.
                  </p>
                  <span className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-teal-600 dark:text-teal-400">
                    <Plus className="h-4 w-4" /> Buat baru
                  </span>
                </div>
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">Pengajuan saya</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Atasan memproses di menu Biaya (Setujui & posting ke buku).
                </p>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Memuat…
                </div>
              ) : error ? (
                <p className="p-6 text-red-600 dark:text-red-400 text-sm">{error}</p>
              ) : mine.length === 0 ? (
                <p className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Belum ada pengajuan. Gunakan tombol di atas untuk membuat draft atau pengajuan.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/80">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300">
                          Tanggal
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300">
                          Jenis
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300">
                          Judul
                        </th>
                        <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-300">
                          Jumlah
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {mine.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {formatDate(row.date || row.createdAt)}
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                            {typeLabel(row.requestType)}
                          </td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white font-medium max-w-[12rem] truncate">
                            {row.title || row.description || '—'}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {formatNumber(row.total)}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                row.workflowStatus === WORKFLOW.SUBMITTED
                                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
                                  : row.workflowStatus === WORKFLOW.DRAFT
                                    ? 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100'
                                    : row.workflowStatus === WORKFLOW.REJECTED
                                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                                      : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200'
                              }`}
                            >
                              {workflowLabel(row)}
                            </span>
                          </td>
                        </tr>
                      ))}
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
