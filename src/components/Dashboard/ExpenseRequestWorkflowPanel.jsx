import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Bell } from 'lucide-react'
import { useUserApproval } from '../../hooks/useUserApproval'
import { useExpenses, WORKFLOW } from '../../hooks/useExpensesData'

export default function ExpenseRequestWorkflowPanel() {
  const navigate = useNavigate()
  const { role, canApprove } = useUserApproval()
  const { expenses, loading } = useExpenses()

  const pending = useMemo(
    () =>
      expenses.filter((e) => e.requestType && e.workflowStatus === WORKFLOW.SUBMITTED),
    [expenses]
  )

  if (role === 'employee') {
    return (
      <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/80 dark:bg-teal-900/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <ClipboardList className="h-5 w-5 text-teal-700 dark:text-teal-300 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Permintaan dana &amp; laporan biaya
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              Ajukan pembelian material atau biaya operasional dengan bukti invoice/tagihan. Admin
              menyetujui dari menu Biaya; Anda mendapat notifikasi saat disetujui atau ditolak.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/permintaan')}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 whitespace-nowrap"
        >
          Buka Permintaan
        </button>
      </div>
    )
  }

  if (!canApprove && role !== 'owner') return null
  if (!loading && pending.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3">
        <Bell className="h-5 w-5 text-amber-700 dark:text-amber-300 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Pengajuan karyawan</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            {loading
              ? 'Memuat…'
              : `${pending.length} pengajuan menunggu persetujuan. Notifikasi juga dikirim ke lonceng di header.`}
            {role === 'owner' && (
              <span className="block mt-1 text-amber-900/90 dark:text-amber-200/90">
                Owner: Anda melihat semua pengajuan baru, persetujuan, dan penolakan di notifikasi.
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate('/biaya')}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700"
        >
          Buka Biaya
        </button>
      </div>
    </div>
  )
}
