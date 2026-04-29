import { Printer as PrinterIcon } from 'lucide-react'

export default function PosSettingsPrinter() {
  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Printer
        </h2>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
          Dalam pengembangan
        </span>
      </div>
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <PrinterIcon className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
        <p className="mt-4 text-[15px] font-medium text-slate-700 dark:text-slate-300">
          Deteksi printer termal & tes cetak akan tersedia di rilis mendatang.
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Gunakan tombol cetak sistem / browser atau PDF dari halaman pesanan sampai API
          printer terhubung.
        </p>
      </div>
    </div>
  )
}
