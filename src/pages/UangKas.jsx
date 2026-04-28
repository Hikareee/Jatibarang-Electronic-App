import { useMemo, useState } from 'react'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useSidebarOpen } from '../hooks/useSidebarOpen'
import { useContacts } from '../hooks/useContactsData'
import { useAuth } from '../contexts/AuthContext'
import { useUserApproval } from '../hooks/useUserApproval'
import FormattedNumberInput from '../components/FormattedNumberInput'
import { uploadExpenseAttachment } from '../firebase/supabaseClient'
import {
  CASH_ADVANCE_STATUS,
  approveCashAdvance,
  clearCashAdvance,
  createCashAdvanceRequest,
  rejectCashAdvance,
  useCashAdvances,
} from '../hooks/useCashAdvances'
import { Banknote, ClipboardList, Loader2, Save, Send, X } from 'lucide-react'

function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('id-ID').format(Number(num) || 0)
}

function statusLabel(s) {
  switch (s) {
    case CASH_ADVANCE_STATUS.REQUESTED:
      return 'Menunggu persetujuan'
    case CASH_ADVANCE_STATUS.ISSUED:
      return 'Belum dipertanggungjawabkan'
    case CASH_ADVANCE_STATUS.CLEARED:
      return 'Selesai'
    case CASH_ADVANCE_STATUS.REJECTED:
      return 'Ditolak'
    default:
      return s || '-'
  }
}

function statusPillClass(s) {
  switch (s) {
    case CASH_ADVANCE_STATUS.REQUESTED:
      return 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
    case CASH_ADVANCE_STATUS.ISSUED:
      return 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200'
    case CASH_ADVANCE_STATUS.CLEARED:
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200'
    case CASH_ADVANCE_STATUS.REJECTED:
      return 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
  }
}

export default function UangKas() {
  const { sidebarOpen, toggleSidebar } = useSidebarOpen(true)
  const { currentUser } = useAuth()
  const { role, canApprove } = useUserApproval()
  const { contacts, loading: contactsLoading } = useContacts()
  const { rows, loading, error, outstandingByContactId } = useCashAdvances()

  const isEmployee = role === 'employee'

  const employees = useMemo(() => {
    return (contacts || [])
      .filter((c) => c?.types?.includes('Pegawai'))
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id'))
  }, [contacts])

  const [tab, setTab] = useState(isEmployee ? 'my' : 'requests') // requests | outstanding | cleared | my
  const [selectedContactId, setSelectedContactId] = useState('')

  const [form, setForm] = useState({
    contactId: '',
    amount: 0,
    purpose: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [evidence, setEvidence] = useState(null)
  const [fileError, setFileError] = useState('')

  const myContactOptions = employees
  const myRows = useMemo(() => {
    // Without an explicit mapping from auth user -> contact, we let employees choose a contact.
    const cid = selectedContactId || form.contactId
    if (!cid) return []
    return rows.filter((r) => r.contactId === cid)
  }, [rows, selectedContactId, form.contactId])

  const filtered = useMemo(() => {
    const cid = selectedContactId
    const base = cid ? rows.filter((r) => r.contactId === cid) : rows
    if (tab === 'requests') return base.filter((r) => r.status === CASH_ADVANCE_STATUS.REQUESTED)
    if (tab === 'outstanding') return base.filter((r) => r.status === CASH_ADVANCE_STATUS.ISSUED)
    if (tab === 'cleared') return base.filter((r) => r.status === CASH_ADVANCE_STATUS.CLEARED)
    if (tab === 'my') return myRows
    return base
  }, [rows, selectedContactId, tab, myRows])

  const outstandingSummary = useMemo(() => {
    const list = employees
      .map((c) => ({
        contactId: c.id,
        contactName: c.name || c.company || c.id,
        outstanding: Number(outstandingByContactId[c.id] || 0),
      }))
      .filter((r) => r.outstanding > 0.01)
      .sort((a, b) => b.outstanding - a.outstanding)
    return list
  }, [employees, outstandingByContactId])

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const isImage = file.type?.startsWith('image/')
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
    if (!isImage && !isPdf) {
      setFileError('Pilih file gambar atau PDF')
      return
    }
    const maxMb = 8
    if (file.size > maxMb * 1024 * 1024) {
      setFileError(`Ukuran maksimal ${maxMb} MB`)
      return
    }
    try {
      setUploading(true)
      setFileError('')
      const meta = await uploadExpenseAttachment(file, null)
      setEvidence(meta)
    } catch (err) {
      console.error(err)
      setFileError(err?.message ? String(err.message) : 'Gagal mengunggah')
    } finally {
      setUploading(false)
    }
  }

  const submitRequest = async (mode) => {
    const contactId = form.contactId || selectedContactId
    const contact = employees.find((c) => c.id === contactId)
    if (!contactId || !contact) {
      alert('Pilih pegawai (kontak) terlebih dahulu')
      return
    }
    if (!Number(form.amount) || Number(form.amount) <= 0) {
      alert('Nominal wajib diisi dan harus lebih dari 0')
      return
    }
    if (!form.purpose.trim()) {
      alert('Keperluan wajib diisi')
      return
    }
    if (!evidence?.url) {
      alert('Lampiran bukti wajib (nota, invoice, atau dokumen pendukung)')
      return
    }

    try {
      setSaving(true)
      await createCashAdvanceRequest({
        contactId,
        contactName: contact.name || contact.company || '',
        amount: Number(form.amount) || 0,
        purpose: form.purpose.trim(),
        evidence,
        requestedByUid: currentUser?.uid || '',
        requestedByEmail: currentUser?.email || '',
      })
      setForm({ contactId, amount: 0, purpose: '' })
      setEvidence(null)
      setFileError('')
      if (!isEmployee) setTab('requests')
      alert(mode === 'submit' ? 'Pengajuan uang kas terkirim.' : 'Tersimpan.')
    } catch (err) {
      console.error(err)
      alert('Gagal mengirim pengajuan')
    } finally {
      setSaving(false)
    }
  }

  const actApprove = async (row) => {
    if (!row?.id) return
    try {
      await approveCashAdvance(row.id, currentUser?.uid, currentUser?.email)
      alert('Disetujui. Uang kas dicatat sebagai outstanding pegawai.')
    } catch (err) {
      console.error(err)
      alert('Gagal menyetujui')
    }
  }

  const actReject = async (row) => {
    if (!row?.id) return
    const reason = window.prompt('Alasan penolakan (opsional):') ?? null
    if (reason === null) return
    try {
      await rejectCashAdvance(row.id, currentUser?.uid, currentUser?.email, reason || '')
      alert('Pengajuan ditolak.')
    } catch (err) {
      console.error(err)
      alert('Gagal menolak')
    }
  }

  const actClear = async (row) => {
    if (!row?.id) return
    const note = window.prompt('Catatan penyelesaian (misal: nomor biaya / laporan):') ?? null
    if (note === null) return
    try {
      await clearCashAdvance(row.id, currentUser?.uid, currentUser?.email, note || '', '')
      alert('Ditandai selesai.')
    } catch (err) {
      console.error(err)
      alert('Gagal menyelesaikan')
    }
  }

  const activeTab = isEmployee ? tab : tab

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">Beranda &gt; Uang Kas</div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                  <Banknote className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Uang Kas</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Catat uang muka operasional karyawan (outstanding) dan selesaikan saat laporan biaya masuk.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                    <h2 className="font-semibold text-gray-900 dark:text-white">Ajukan uang kas</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Pegawai (Kontak)
                      </label>
                      <select
                        value={form.contactId}
                        onChange={(e) => setForm((p) => ({ ...p, contactId: e.target.value }))}
                        disabled={contactsLoading}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Pilih pegawai</option>
                        {myContactOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || c.company || c.id}
                          </option>
                        ))}
                      </select>
                      {isEmployee && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Pilih kontak pegawai Anda (tipe Pegawai) di menu Kontak.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nominal diminta
                      </label>
                      <FormattedNumberInput
                        value={form.amount}
                        onChange={(v) => setForm((p) => ({ ...p, amount: v }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Keperluan
                      </label>
                      <input
                        type="text"
                        value={form.purpose}
                        onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                        placeholder="Contoh: survey lokasi, bensin, makan client, dll."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Lampiran bukti (wajib)
                    </label>
                    {fileError && (
                      <p className="text-sm text-red-600 dark:text-red-400 mb-2">{fileError}</p>
                    )}
                    <div className="flex flex-wrap items-start gap-4">
                      {evidence?.url && (
                        <div className="relative inline-block rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                          {evidence.type?.startsWith('image/') ? (
                            <img
                              src={evidence.url}
                              alt=""
                              className="max-h-32 max-w-full object-contain bg-gray-50 dark:bg-gray-900"
                            />
                          ) : (
                            <div className="p-4 bg-gray-50 dark:bg-gray-900">
                              <a
                                href={evidence.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                              >
                                {evidence.name || 'Lihat file'}
                              </a>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setEvidence(null)}
                            className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      <label className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        {uploading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        ) : (
                          <Save className="h-5 w-5 text-gray-500" />
                        )}
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {uploading ? 'Mengunggah…' : evidence ? 'Ganti lampiran' : 'Pilih lampiran'}
                        </span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          disabled={uploading}
                          onChange={handleFile}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => submitRequest('submit')}
                      disabled={saving || uploading}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Send className="h-5 w-5" />
                      Kirim pengajuan
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Outstanding per pegawai</h3>
                  {contactsLoading ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
                    </div>
                  ) : outstandingSummary.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada outstanding.</p>
                  ) : (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="max-h-60 overflow-y-auto">
                        {outstandingSummary.map((r) => (
                          <button
                            key={r.contactId}
                            type="button"
                            onClick={() => {
                              setSelectedContactId(r.contactId)
                              setTab(isEmployee ? 'my' : 'outstanding')
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <span className="text-gray-900 dark:text-white truncate">{r.contactName}</span>
                            <span className="text-gray-700 dark:text-gray-200 tabular-nums">
                              {formatNumber(r.outstanding)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Outstanding berkurang saat uang kas ditandai “Selesai” setelah laporan biaya masuk.
                  </p>
                </div>
              </div>
            </div>

            {!isEmployee && (
              <div className="flex flex-wrap items-center gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setTab('requests')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === 'requests'
                      ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300'
                      : 'border-transparent text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Pengajuan
                </button>
                <button
                  type="button"
                  onClick={() => setTab('outstanding')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === 'outstanding'
                      ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300'
                      : 'border-transparent text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Outstanding
                </button>
                <button
                  type="button"
                  onClick={() => setTab('cleared')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === 'cleared'
                      ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300'
                      : 'border-transparent text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Selesai
                </button>

                <div className="ml-auto">
                  <select
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    disabled={contactsLoading}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">Semua pegawai</option>
                    {employees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.company || c.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Memuat…
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Belum ada data.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/80">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                          Pegawai
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                          Keperluan
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                          Nominal
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                          Status
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                          Bukti
                        </th>
                        {!isEmployee && (
                          <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                            Aksi
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filtered.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                          <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                            {r.contactName || '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[24rem] truncate" title={r.purpose || ''}>
                            {r.purpose || '—'}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">
                            {formatNumber(r.amount || 0)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusPillClass(r.status)}`}>
                              {statusLabel(r.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {r.evidence?.url ? (
                              <a
                                href={r.evidence.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                              >
                                Lihat
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          {!isEmployee && (
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {r.status === CASH_ADVANCE_STATUS.REQUESTED && canApprove && (
                                <div className="inline-flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => actApprove(r)}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                  >
                                    Setujui
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => actReject(r)}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 text-red-700 dark:border-red-800 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    Tolak
                                  </button>
                                </div>
                              )}
                              {r.status === CASH_ADVANCE_STATUS.ISSUED && canApprove && (
                                <button
                                  type="button"
                                  onClick={() => actClear(r)}
                                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  Tandai selesai
                                </button>
                              )}
                            </td>
                          )}
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

