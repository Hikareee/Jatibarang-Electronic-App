import { Globe, Link as LinkIcon, QrCode } from 'lucide-react'

export default function PosSettingsWebOrder() {
  const demoUrl =
    'https://weborder.contoh.app?v=1&key=demoKeyPosWebOrderLinkSample'

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Web Order</h2>
      <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
        Dengan fitur Web Order, Anda dapat menjual produk secara online menggunakan kode
        QR dan tautan web. Koneksi ke domain publik dan kunci API dapat diatur saat Anda
        menerbitkan tautan aktual.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <Globe className="h-10 w-10 text-blue-600 dark:text-blue-400" aria-hidden />
          <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Preview Web Order
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Lihat Web Order
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 md:col-span-2 dark:border-slate-800 dark:bg-slate-900/80">
          <LinkIcon className="h-10 w-10 text-blue-600 dark:text-blue-400" aria-hidden />
          <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Tautan Web Order
          </p>
          <p className="mt-2 break-all font-mono text-xs text-blue-700 dark:text-blue-300">
            {demoUrl}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <QrCode className="h-10 w-10 text-blue-600 dark:text-blue-400" aria-hidden />
          <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Kode QR Web Order
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Lihat Kode QR
          </button>
        </div>
      </div>
    </div>
  )
}
