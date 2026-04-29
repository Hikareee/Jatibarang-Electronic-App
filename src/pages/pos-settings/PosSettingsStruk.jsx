import { useCallback, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { usePosSettingsOutlet } from '../../contexts/PosSettingsOutletContext'
import { usePosWarehouseSettings } from '../../hooks/usePosWarehouseSettings'

function fmtRpDots(n) {
  return Number(n || 0).toLocaleString('id-ID')
}

export default function PosSettingsStruk() {
  const { warehouses, settingsWarehouseId } = usePosSettingsOutlet()
  const { settings: s, loading, savePartial } =
    usePosWarehouseSettings(settingsWarehouseId)
  const [savingKey, setSavingKey] = useState('')

  const outlet =
    warehouses.find((w) => w.id === settingsWarehouseId)?.name || 'Default Outlet'

  const modeCetak = Boolean(s?.receiptPrintPreviewMode)

  const persist = useCallback(
    async (partial) => {
      try {
        setSavingKey('struk')
        await savePartial(partial)
      } catch (e) {
        alert(e?.message || 'Gagal menyimpan')
      } finally {
        setSavingKey('')
      }
    },
    [savePartial]
  )

  const now = new Date()
  const tanggal = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  if (loading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        Memuat setelan struk…
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
        Pengaturan Layout Cetak Struk
      </h2>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Tampilan Struk
          </span>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>Mode pratinjau cetak</span>
            <button
              type="button"
              role="switch"
              aria-checked={modeCetak}
              disabled={savingKey !== ''}
              onClick={() =>
                persist({
                  receiptPrintPreviewMode: !modeCetak,
                })
              }
              className={`relative h-7 w-[2.75rem] shrink-0 rounded-full transition-colors disabled:opacity-45 ${modeCetak ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'}`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left] ${modeCetak ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'}`}
              />
            </button>
          </label>
        </div>
        <p className="mb-4 text-[13px] text-slate-500 dark:text-slate-400">
          Jika menyala, layar POS bisa memakai alur pratinjau sebelum mencetak (bila
          Anda menambahkan cetak nanti). Preferensi tersimpan untuk outlet yang
          dipilih di header Pengaturan.
        </p>

        <div className="mx-auto max-w-sm rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-950">
          <p className="text-center text-xs text-slate-500">Logo Struk</p>
          <div className="mt-2 flex justify-center gap-2">
            <span className="rounded border border-blue-200 bg-white px-3 py-1 text-[10px] font-medium text-blue-700">
              Unggah
            </span>
            <span className="rounded border border-slate-200 bg-white px-3 py-1 text-[10px] text-slate-600">
              Lihat
            </span>
          </div>

          <div className="mt-4 space-y-1 text-center font-mono text-[11px] leading-relaxed text-slate-900 dark:text-slate-100">
            <p className="font-bold uppercase">PT Kledo Berhati Nyaman</p>
            <p>{outlet}</p>
            <p className="text-[10px] text-slate-600 dark:text-slate-400">
              FundFishers — pratinjau struk POS
            </p>
            <p>Jln. Contoh Alam 123, Jakarta Selatan 12790</p>
            <p>Email: support@toko.id · Telp. 0812-XXXX-XXX</p>
          </div>

          <hr className="my-3 border-dashed border-slate-300 dark:border-slate-700" />

          <div className="space-y-1 font-mono text-[10px] text-slate-800 dark:text-slate-200">
            <div className="flex justify-between">
              <span>No. Order</span>
              <span>INV-2024-001</span>
            </div>
            <div className="flex justify-between">
              <span>Waktu</span>
              <span>{tanggal}</span>
            </div>
            <div className="flex justify-between">
              <span>Kasir</span>
              <span>Budi Santoso</span>
            </div>
            <div className="flex justify-between">
              <span>Pelanggan</span>
              <span>Customer A</span>
            </div>
            <div className="flex justify-between">
              <span>Jenis Order</span>
              <span>Dine In</span>
            </div>
          </div>

          <hr className="my-3 border-dashed border-slate-300 dark:border-slate-700" />

          <div className="space-y-2 font-mono text-[10px] text-slate-800 dark:text-slate-200">
            <div>
              <div className="flex justify-between">
                <span className="font-semibold">Nasi Goreng Special</span>
                <span>{fmtRpDots(50000)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>2 × {fmtRpDots(25000)}</span>
                <span>{fmtRpDots(50000)}</span>
              </div>
              <p className="text-[9px] text-slate-500">&gt; Extra pedas</p>
            </div>
            <div>
              <div className="flex justify-between">
                <span className="font-semibold">Es Teh Manis</span>
                <span>{fmtRpDots(10000)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>2 × {fmtRpDots(5000)}</span>
                <span>{fmtRpDots(10000)}</span>
              </div>
            </div>
          </div>

          <hr className="my-3 border-dashed border-slate-300 dark:border-slate-700" />

          <div className="space-y-1 font-mono text-[10px]">
            <div className="flex justify-between">
              <span>Subtotal 2 Produk</span>
              <span>{fmtRpDots(60000)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{fmtRpDots(60000)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tunai</span>
              <span>{fmtRpDots(60000)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total Pembayaran</span>
              <span>{fmtRpDots(60000)}</span>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-4">
            <div className="flex h-12 w-20 items-center justify-center rounded border border-dashed border-slate-300 text-[8px] text-slate-400 dark:border-slate-600">
              {'{BARCODE}'}
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-slate-300 text-[8px] text-slate-400 dark:border-slate-600">
              {'{QR}'}
            </div>
          </div>

          <p className="mt-3 text-center font-mono text-[9px] text-slate-500">
            Catatan · Footer
            <br />
            ###{tanggal}###
          </p>
        </div>
      </div>
    </div>
  )
}
