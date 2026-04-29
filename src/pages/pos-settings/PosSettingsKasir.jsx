import { useCallback, useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { usePosSettingsOutlet } from '../../contexts/PosSettingsOutletContext'
import { usePosWarehouseSettings } from '../../hooks/usePosWarehouseSettings'
import { SettingToggleRow } from '../../components/pos/pengaturan/SettingToggleRow'

export default function PosSettingsKasir() {
  const { warehouses, settingsWarehouseId } = usePosSettingsOutlet()
  const { settings: s, loading, savePartial, saveError } =
    usePosWarehouseSettings(settingsWarehouseId)
  const [savingKey, setSavingKey] = useState('')

  const outletName =
    warehouses.find((w) => w.id === settingsWarehouseId)?.name || 'Outlet'

  const persist = useCallback(
    async (key, partial) => {
      try {
        setSavingKey(key)
        await savePartial(partial)
      } catch (e) {
        alert(e?.message || 'Gagal menyimpan')
      } finally {
        setSavingKey('')
      }
    },
    [savePartial]
  )

  const [maxRpDraft, setMaxRpDraft] = useState('')
  const [svcDraft, setSvcDraft] = useState('')

  useEffect(() => {
    setMaxRpDraft(String(s?.kasKeluarMaxRp ?? 5000000))
  }, [settingsWarehouseId, s?.kasKeluarMaxRp])

  useEffect(() => {
    setSvcDraft(String(s?.serviceChargePercent ?? 5))
  }, [settingsWarehouseId, s?.serviceChargePercent])

  if (loading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        Memuat setelan outlet…
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Kasir
        </h2>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-medium uppercase text-slate-500">
            Outlet aktif (header Pengaturan)
          </span>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            {outletName}
          </span>
        </div>
      </div>

      {saveError ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Firestore: {saveError}
        </p>
      ) : null}

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-5 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/40">
        <SettingToggleRow
          title="Buka Kasir"
          subLabel="Tentukan Jumlah Kas Modal"
          description="Meminta nominal kas pembuka (> 0) setiap membuka shift di POS."
          on={Boolean(s?.bukaKasirModal)}
          disabled={savingKey !== ''}
          onChange={(v) => persist('bukaKasirModal', { bukaKasirModal: v })}
        />
        <SettingToggleRow
          title="Tutup Kasir"
          subLabel={s?.tutupKasirModal ? 'Konfirmasi tutup shift' : 'Off'}
          description="Preferensi untuk alur tutup shift (persistensi penyimpanan; UI tutup bisa ditambahkan nanti)."
          on={Boolean(s?.tutupKasirModal)}
          disabled={savingKey !== ''}
          onChange={(v) => persist('tutupKasirModal', { tutupKasirModal: v })}
        />
        <SettingToggleRow
          title="Kas Keluar"
          subLabel={
            s?.kasKeluarBatas
              ? `Batas maks Rp ${(s?.kasKeluarMaxRp || 0).toLocaleString('id-ID')}`
              : 'Tanpa batas'
          }
          description="Menyalakan pembatasan nominal kas keluar manual di POS Transaksi."
          on={Boolean(s?.kasKeluarBatas)}
          disabled={savingKey !== ''}
          onChange={(v) =>
            persist('kasKeluarBatas', { kasKeluarBatas: Boolean(v) })
          }
        />
        {s?.kasKeluarBatas ? (
          <label className="flex flex-wrap items-center justify-between gap-3 py-4">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Maksimum kas keluar (Rp / transaksi manual)
            </span>
            <input
              type="text"
              inputMode="numeric"
              disabled={savingKey !== ''}
              className="max-w-[10rem] rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
              value={maxRpDraft}
              onChange={(e) =>
                setMaxRpDraft(e.target.value.replace(/\D/g, ''))
              }
              onBlur={() =>
                persist('kasKeluarMaxRp', {
                  kasKeluarMaxRp: Math.max(0, Number(maxRpDraft) || 0),
                })
              }
            />
          </label>
        ) : null}
        <SettingToggleRow
          title="Service Charge"
          subLabel={s?.serviceChargeEnabled ? `${s?.serviceChargePercent ?? 5}%` : 'Off'}
          statusTone={s?.serviceChargeEnabled ? 'success' : 'error'}
          description="Menambahkan biaya layanan (%) dari subtotal setelah diskon pesanan."
          on={Boolean(s?.serviceChargeEnabled)}
          disabled={savingKey !== ''}
          onChange={(v) =>
            persist('serviceChargeEnabled', {
              serviceChargeEnabled: Boolean(v),
            })
          }
        />
        {s?.serviceChargeEnabled ? (
          <label className="flex flex-wrap items-center justify-between gap-3 py-4">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Persentase service charge (%)
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              disabled={savingKey !== ''}
              className="max-w-[8rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              value={svcDraft}
              onChange={(e) => setSvcDraft(e.target.value)}
              onBlur={() =>
                persist('serviceChargePercent', {
                  serviceChargePercent: Math.min(
                    100,
                    Math.max(0, Number(svcDraft) || 0)
                  ),
                })
              }
            />
          </label>
        ) : null}
        <SettingToggleRow
          title="Tambahan Diskon"
          subLabel={s?.tambahanDiskonEnabled ? 'On' : 'Off'}
          statusTone={s?.tambahanDiskonEnabled ? 'success' : 'error'}
          description="Menampilkan input diskon pesanan (rupiah) di layar pembayaran POS."
          on={Boolean(s?.tambahanDiskonEnabled)}
          disabled={savingKey !== ''}
          onChange={(v) =>
            persist('tambahanDiskonEnabled', {
              tambahanDiskonEnabled: Boolean(v),
            })
          }
        />
        <SettingToggleRow
          title="Harga Produk Manual"
          subLabel={s?.hargaProdukManualEnabled ? 'On' : 'Off'}
          statusTone={s?.hargaProdukManualEnabled ? 'success' : 'error'}
          description="Mengizinkan mengubah harga satuan di keranjang sebelum checkout."
          on={Boolean(s?.hargaProdukManualEnabled)}
          disabled={savingKey !== ''}
          onChange={(v) =>
            persist('hargaProdukManualEnabled', {
              hargaProdukManualEnabled: Boolean(v),
            })
          }
        />
        <SettingToggleRow
          title="Pembayaran tunai sebagian (DP)"
          subLabel={s?.allowPartialCashPayment ? 'On' : 'Off'}
          statusTone={s?.allowPartialCashPayment ? 'success' : 'error'}
          description="Mengizinkan uang tunai kurang dari total; sisa tercatat di tagihan / piutang (jatuh tempo default +30 hari)."
          on={Boolean(s?.allowPartialCashPayment)}
          disabled={savingKey !== ''}
          onChange={(v) =>
            persist('allowPartialCashPayment', {
              allowPartialCashPayment: Boolean(v),
            })
          }
        />
        <label className="flex flex-wrap items-start justify-between gap-3 py-4">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Lokasi stok kedua (etalase / toko){' '}
            <span className="block text-xs opacity-80">
              Produk yang stoknya hanya di sini tetap bisa dijual jika serial cocok.
            </span>
          </span>
          <select
            disabled={savingKey !== ''}
            className="max-w-[14rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={String(s?.secondaryWarehouseIdForPos || '')}
            onChange={(e) =>
              persist('secondaryWarehouseIdForPos', {
                secondaryWarehouseIdForPos: e.target.value,
              })
            }
          >
            <option value="">— Hanya gudang outlet ini —</option>
            {warehouses
              .filter((w) => w.id && w.id !== settingsWarehouseId)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name || w.id}
                </option>
              ))}
          </select>
        </label>
        <SettingToggleRow
          title="Approval Authorization"
          subLabel={s?.approvalAuthorizationEnabled ? 'On' : 'Off'}
          statusTone={s?.approvalAuthorizationEnabled ? 'success' : 'error'}
          description="Jika aktif: refund besar memerlukan otorisasi (aturan bisa dipasang di POS nanti)."
          on={Boolean(s?.approvalAuthorizationEnabled)}
          disabled={savingKey !== ''}
          onChange={(v) =>
            persist('approvalAuthorizationEnabled', {
              approvalAuthorizationEnabled: Boolean(v),
            })
          }
        />
        <SettingToggleRow
          title="Tampilkan Harga Produk"
          subLabel={s?.tampilkanHargaProdukStruk ? 'On' : 'Off'}
          statusTone={s?.tampilkanHargaProdukStruk ? 'success' : 'error'}
          description="Mengikutkan harga dan diskon per baris dalam data invoice/struk."
          on={s?.tampilkanHargaProdukStruk !== false}
          disabled={savingKey !== ''}
          onChange={(v) =>
            persist('tampilkanHargaProdukStruk', {
              tampilkanHargaProdukStruk: Boolean(v),
            })
          }
        />
      </div>
      <p className="mt-6 max-w-xl text-[13px] text-slate-500 dark:text-slate-400">
        Setelan tersimpan ke Firestore di{' '}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
          posWarehouseSettings/{'{'}warehouseId{'\u007d'}
        </code>
        . Outlet dipilih dari bilah atas halaman Pengaturan.
      </p>
    </div>
  )
}
