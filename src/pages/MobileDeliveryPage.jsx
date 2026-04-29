import { Link } from 'react-router-dom'
import { ChevronRight, MapPin, Receipt, Truck } from 'lucide-react'
import { useMobileDeliveries } from '../hooks/useMobileDeliveries'

function toneClass(tone) {
  if (tone === 'emerald') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
  if (tone === 'rose') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
  return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
}

export default function MobileDeliveryPage() {
  const { rows, loading, groupedSummary } = useMobileDeliveries()

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-3xl bg-white p-3 text-center shadow-sm dark:bg-slate-900">
          <p className="text-[11px] text-slate-500">Aktif</p>
          <p className="mt-1 text-lg font-bold">{groupedSummary.active}</p>
        </div>
        <div className="rounded-3xl bg-white p-3 text-center shadow-sm dark:bg-slate-900">
          <p className="text-[11px] text-slate-500">Siap</p>
          <p className="mt-1 text-lg font-bold text-emerald-600">{groupedSummary.ready}</p>
        </div>
        <div className="rounded-3xl bg-white p-3 text-center shadow-sm dark:bg-slate-900">
          <p className="text-[11px] text-slate-500">Belum lunas</p>
          <p className="mt-1 text-lg font-bold text-rose-600">{groupedSummary.unpaid}</p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <Link
            key={row.id}
            to={`/mobile/delivery/${encodeURIComponent(row.invoiceId)}/${encodeURIComponent(row.serialNumber)}`}
            className="block rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{row.productName || row.sku || row.serialNumber}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Serial {row.serialNumber} · Invoice {row.invoiceNumber}
                </p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className={`rounded-full px-2 py-1 ${toneClass(row.readiness.tone)}`}>
                {row.readiness.label}
              </span>
              <span className={`rounded-full px-2 py-1 ${row.paidInFull ? toneClass('emerald') : toneClass('rose')}`}>
                {row.paidInFull ? 'Lunas' : 'Belum lunas'}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                {row.deliveryStatusLabel || row.deliveryStatus}
              </span>
            </div>

            <div className="mt-4 space-y-1 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Truck className="h-3.5 w-3.5" />
                {row.customerName || '-'}
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2">{row.customerAddress || 'Alamat belum ada'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Receipt className="h-3.5 w-3.5" />
                Sisa Rp {Number(row.remaining || 0).toLocaleString('id-ID')}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {!loading && rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700">
          Belum ada item delivery dari POS.
        </div>
      ) : null}

      {loading ? <p className="text-center text-[11px] text-slate-400">Memuat delivery queue...</p> : null}
    </div>
  )
}
