import { Link } from 'react-router-dom'
import {
  Loader2,
  TrendingUp,
  Wallet,
  Receipt,
  ScanLine,
  Calendar,
  ClipboardList,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useUserApproval } from '../../hooks/useUserApproval'
import {
  useEmployeeDashboardStats,
  DEFAULT_EMPLOYEE_COMMISSION_PERCENT,
} from '../../hooks/useEmployeeDashboardStats'
import ExpenseRequestWorkflowPanel from './ExpenseRequestWorkflowPanel'

function formatRp(n) {
  const v = Number(n) || 0
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(v)
}

function formatDate(inv) {
  const raw = inv.transactionDate || inv.createdAt
  if (!raw) return '—'
  try {
    return new Date(raw).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export default function EmployeeDashboardContent() {
  const { currentUser } = useAuth()
  const { userData } = useUserApproval()
  const uid = currentUser?.uid
  const commissionFromProfile = userData?.commissionPercent

  const {
    loading,
    error,
    commissionPercent,
    totalMonth,
    total30,
    totalAll,
    countMonth,
    countAll,
    commissionMonth,
    commission30,
    commissionAll,
    recent,
  } = useEmployeeDashboardStats(uid, commissionFromProfile)

  const displayName =
    userData?.name ||
    userData?.email ||
    currentUser?.email?.split('@')[0] ||
    'Karyawan'

  const usingDefaultPct =
    commissionFromProfile == null ||
    commissionFromProfile === '' ||
    !Number.isFinite(Number(commissionFromProfile))

  return (
    <div className="space-y-6">
      <ExpenseRequestWorkflowPanel />

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/80 p-6 dark:border-slate-700 dark:from-slate-900 dark:to-slate-900/80">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Halo,</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Ringkasan penjualan yang diatribusikan ke Anda (tagihan dengan penjual / penanggung jawab
          ini). Pemilik dan manajer melihat dasbor keuangan penuh; Anda melihat performa penjualan
          pribadi.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/pos"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700"
          >
            <ScanLine className="h-4 w-4" />
            Buka POS
          </Link>
          <Link
            to="/penjualan/overview"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Penjualan
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/permintaan"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <ClipboardList className="h-4 w-4" />
            Permintaan
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex h-48 items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" />
          Memuat statistik penjualan…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase">Bulan ini</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                Rp {formatRp(totalMonth)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {countMonth} transaksi · omzet tercatat
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 p-5 dark:border-emerald-800 dark:bg-emerald-950/40">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <Wallet className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase">Komisi (perkiraan)</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                Rp {formatRp(commissionMonth)}
              </p>
              <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-300/90">
                {commissionPercent}% dari omzet bulan ini
                {usingDefaultPct ? (
                  <span className="block pt-1 text-[11px] opacity-90">
                    Default {DEFAULT_EMPLOYEE_COMMISSION_PERCENT}% — admin dapat set field{' '}
                    <code className="rounded bg-white/60 px-1 dark:bg-black/30">commissionPercent</code>{' '}
                    di Firestore users/{'{uid}'}.
                  </span>
                ) : null}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase">30 hari</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                Rp {formatRp(total30)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Est. komisi: Rp {formatRp(commission30)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Receipt className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase">Total sepanjang waktu</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                Rp {formatRp(totalAll)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {countAll} tagihan · est. komisi Rp {formatRp(commissionAll)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Tagihan terbaru (Anda sebagai penjual / PJ)
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Data dari koleksi tagihan yang mengacu pada akun Anda.
              </p>
            </div>
            {recent.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                Belum ada tagihan terkait. Jual melalui POS dan pilih nama Anda sebagai penjual
                (komisi), atau buat tagihan dengan Anda sebagai penanggung jawab.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900/50">
                      <th className="px-5 py-3">Tanggal</th>
                      <th className="px-5 py-3">No.</th>
                      <th className="px-5 py-3">Pelanggan</th>
                      <th className="px-5 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-b border-slate-50 last:border-0 dark:border-slate-800"
                      >
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                          {formatDate(inv)}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-800 dark:text-slate-200">
                          {inv.number || '—'}
                        </td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-200">
                          {inv.customerName || inv.customer || '—'}
                        </td>
                        <td className="px-5 py-3 text-right font-medium tabular-nums text-slate-900 dark:text-white">
                          Rp {formatRp(inv.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
