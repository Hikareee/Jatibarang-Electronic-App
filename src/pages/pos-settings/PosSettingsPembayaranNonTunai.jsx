import { useMemo, useState } from 'react'
import {
  Loader2,
  PackageSearch,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
} from 'lucide-react'
import { usePosSettingsOutlet } from '../../contexts/PosSettingsOutletContext'
import { useNonCashPayments } from '../../hooks/useNonCashPayments'

export default function PosSettingsPembayaranNonTunai() {
  const { warehouses, settingsWarehouseId } = usePosSettingsOutlet()
  const outletName =
    warehouses.find((w) => w.id === settingsWarehouseId)?.name || 'Outlet'

  const { rows, loading, error, addMethod, updateMethod, removeMethod } =
    useNonCashPayments(settingsWarehouseId)

  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => {
      const blob = `${r?.name || ''} ${r?.accountName || ''} ${r?.accountNumber || ''}`.toLowerCase()
      return blob.includes(s)
    })
  }, [rows, q])

  const [modal, setModal] = useState(
    /** @type {null | { editId?: string, name?: string, accountName?: string, accountNumber?: string }} */
    null
  )
  const [saving, setSaving] = useState(false)

  async function saveModal() {
    if (!modal) return
    const name = String(modal.name || '').trim()
    if (!name) return
    try {
      setSaving(true)
      const payload = {
        name,
        accountName: modal.accountName ?? '',
        accountNumber: modal.accountNumber ?? '',
      }
      if (modal.editId) await updateMethod(modal.editId, payload)
      else await addMethod(payload)
      setModal(null)
    } catch (e) {
      alert(e?.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Pembayaran Non Tunai
          </h2>
          <p className="mt-1 text-sm text-slate-500">{outletName}</p>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:min-w-[18rem]">
          <label className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Cari nama / nomor akun…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={() =>
              setModal({
                name: '',
                accountName: '',
                accountNumber: '',
              })
            }
          >
            <Plus className="h-4 w-4" />
            Tambah
          </button>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
          {String(error.message || error)}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <th className="px-4 py-3">Nama pembayaran</th>
              <th className="px-4 py-3 hidden sm:table-cell">Atas nama akun</th>
              <th className="px-4 py-3 hidden md:table-cell">Nomor akun</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center text-slate-400">
                  <PackageSearch className="mx-auto h-14 w-14 opacity-50" aria-hidden />
                  <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                    {rows.length === 0
                      ? 'Belum ada metode — Tambah kartu bank, QRIS, dll.'
                      : 'Tidak cocok dengan pencarian.'}
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {r.name || '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 dark:text-slate-400 sm:table-cell">
                    {r.accountName || '—'}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs md:table-cell">
                    {r.accountNumber || '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      title="Edit"
                      className="inline-flex rounded-lg p-2 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
                      onClick={() =>
                        setModal({
                          editId: r.id,
                          name: r.name || '',
                          accountName: r.accountName || '',
                          accountNumber: r.accountNumber || '',
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Hapus"
                      className="inline-flex rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                      onClick={async () => {
                        if (!confirm(`Hapus "${r.name || 'ini'}"?`)) return
                        try {
                          await removeMethod(r.id)
                        } catch (e) {
                          alert(e?.message || 'Gagal hapus')
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {modal.editId ? 'Edit metode' : 'Metode baru'}
              </h3>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setModal(null)}
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mt-4 block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Nama metode <span className="text-red-500">*</span>
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={modal.name || ''}
                onChange={(e) => setModal({ ...modal, name: e.target.value })}
                placeholder="Mis. BCA VA / QRIS"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Atas nama
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={modal.accountName || ''}
                onChange={(e) => setModal({ ...modal, accountName: e.target.value })}
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Nomor rekening / VA
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
                value={modal.accountNumber || ''}
                onChange={(e) =>
                  setModal({ ...modal, accountNumber: e.target.value })
                }
              />
            </label>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border py-2.5 text-sm"
                onClick={() => setModal(null)}
                disabled={saving}
              >
                Batal
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-45"
                disabled={saving || !String(modal.name || '').trim()}
                onClick={saveModal}
              >
                {saving ? 'Menyimpan…' : 'Simpan ke Firestore'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
