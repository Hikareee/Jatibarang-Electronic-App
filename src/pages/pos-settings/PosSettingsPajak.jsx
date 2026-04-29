import { useCallback, useEffect, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { usePosSettingsOutlet } from '../../contexts/PosSettingsOutletContext'
import { usePosWarehouseSettings } from '../../hooks/usePosWarehouseSettings'

export default function PosSettingsPajak() {
  const { settingsWarehouseId } = usePosSettingsOutlet()
  const { settings: s, loading, savePartial } =
    usePosWarehouseSettings(settingsWarehouseId)
  const [pajak, setPajak] = useState(/** @type {'ppn' | 'pph'} */ ('ppn'))
  const [ppnDraft, setPpnDraft] = useState('11')
  const [pphDraft, setPphDraft] = useState('10')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPajak(s?.selectedTax === 'pph' ? 'pph' : 'ppn')
  }, [settingsWarehouseId, s?.selectedTax])

  useEffect(() => {
    setPpnDraft(String(s?.ppnPercent ?? 11))
    setPphDraft(String(s?.pphPercent ?? 10))
  }, [settingsWarehouseId, s?.ppnPercent, s?.pphPercent])

  const saveSelection = useCallback(
    async (tax) => {
      setBusy(true)
      try {
        await savePartial({ selectedTax: tax })
        setPajak(tax)
      } catch (e) {
        alert(e?.message || 'Gagal menyimpan')
      } finally {
        setBusy(false)
      }
    },
    [savePartial]
  )

  const savePercents = useCallback(async () => {
    setBusy(true)
    try {
      await savePartial({
        ppnPercent: Math.min(100, Math.max(0, Number(ppnDraft) || 0)),
        pphPercent: Math.min(100, Math.max(0, Number(pphDraft) || 0)),
      })
    } catch (e) {
      alert(e?.message || 'Gagal menyimpan')
    } finally {
      setBusy(false)
    }
  }, [savePartial, ppnDraft, pphDraft])

  if (loading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        Memuat pajak…
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pajak</h2>
        <button
          type="button"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          onClick={async () => {
            if (!confirm('Kembalikan nilai pajak ke standar (PPN 11% / PPH 10%, aktif PPN)?'))
              return
            setBusy(true)
            try {
              await savePartial({
                selectedTax: 'ppn',
                ppnPercent: 11,
                pphPercent: 10,
              })
              setPpnDraft('11')
              setPphDraft('10')
              setPajak('ppn')
            } catch (e) {
              alert(e?.message || 'Gagal reset')
            } finally {
              setBusy(false)
            }
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Nilai pajak standar
        </button>
      </div>

      <p className="mb-6 max-w-2xl text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
        Pajak aktif dan persentase disimpan per outlet. Layar POS menggunakan pilihan ini
        menghitung total tagihan (uang yang ditagih = dasar + pajak).
      </p>

      <div className="grid max-w-2xl gap-4 md:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => saveSelection('ppn')}
          className={`rounded-2xl border-2 p-5 text-left transition disabled:opacity-45 ${
            pajak === 'ppn'
              ? 'border-blue-500 bg-blue-50/80 shadow-sm dark:bg-blue-950/50'
              : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 rounded-full border-2 ${
                  pajak === 'ppn'
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-slate-300 bg-white dark:bg-slate-800'
                }`}
                aria-hidden
              >
                {pajak === 'ppn' ? (
                  <span className="m-auto block h-2 w-2 rounded-full bg-white" />
                ) : null}
              </span>
              <div>
                <span className="font-bold text-slate-900 dark:text-white">PPN</span>
                <p className="mt-3 text-[13px] text-slate-600 dark:text-slate-400">
                  Nilai Pajak (%) · digunakan di POS sebagai label PPN
                </p>
              </div>
            </div>
            <label className="flex flex-col items-end gap-1 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700 dark:text-slate-300">%</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-bold text-blue-700 dark:border-slate-600 dark:bg-slate-950 dark:text-blue-400"
                value={ppnDraft}
                onChange={(e) => setPpnDraft(e.target.value)}
                onBlur={savePercents}
                onClick={(e) => e.stopPropagation()}
              />
            </label>
          </div>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => saveSelection('pph')}
          className={`rounded-2xl border-2 p-5 text-left transition disabled:opacity-45 ${
            pajak === 'pph'
              ? 'border-blue-500 bg-blue-50/80 shadow-sm dark:bg-blue-950/50'
              : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 rounded-full border-2 ${
                  pajak === 'pph'
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-slate-300 bg-white dark:bg-slate-800'
                }`}
                aria-hidden
              >
                {pajak === 'pph' ? (
                  <span className="m-auto block h-2 w-2 rounded-full bg-white" />
                ) : null}
              </span>
              <div>
                <span className="font-bold text-slate-900 dark:text-white">PPH</span>
                <p className="mt-3 text-[13px] text-slate-600 dark:text-slate-400">
                  Pemotongan — label PPH pada struk/transaksi POS
                </p>
              </div>
            </div>
            <label className="flex flex-col items-end gap-1 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700 dark:text-slate-300">%</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-bold text-blue-700 dark:border-slate-600 dark:bg-slate-950 dark:text-blue-400"
                value={pphDraft}
                onChange={(e) => setPphDraft(e.target.value)}
                onBlur={savePercents}
                onClick={(e) => e.stopPropagation()}
              />
            </label>
          </div>
        </button>
      </div>
    </div>
  )
}
