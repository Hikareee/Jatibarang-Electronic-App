import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { db } from '../firebase/config'
import { doc, getDoc } from 'firebase/firestore'
import { updateContact } from '../hooks/useContactsData'
import { ChevronLeft, Loader2, Pencil, Save } from 'lucide-react'
import { useSidebarOpen } from '../hooks/useSidebarOpen'

function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('id-ID').format(Number(num) || 0)
}

function normalizePayroll(contact) {
  const payroll = contact?.payroll && typeof contact.payroll === 'object' ? contact.payroll : {}
  const bank = payroll.bank && typeof payroll.bank === 'object' ? payroll.bank : {}
  return {
    baseSalary: payroll.baseSalary ?? 0,
    ptkp: payroll.ptkp || 'TK/0',
    npwp: payroll.npwp || '',
    bpjsEnabled: !!payroll.bpjsEnabled,
    bankName: bank.bankName || '',
    bankCode: bank.bankCode || '',
    accountNumber: bank.accountNumber || '',
    accountName: bank.accountName || '',
  }
}

export default function PayrollEmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sidebarOpen, toggleSidebar } = useSidebarOpen(true)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [contact, setContact] = useState(null)

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [baseline, setBaseline] = useState(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    ...normalizePayroll(null),
  })

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!id) return
      try {
        setLoading(true)
        setError(null)
        const snap = await getDoc(doc(db, 'contacts', id))
        if (!snap.exists()) {
          setError('Pegawai tidak ditemukan')
          setContact(null)
          return
        }
        const data = { id: snap.id, ...snap.data() }
        if (!alive) return
        setContact(data)
        const p = normalizePayroll(data)
        const next = {
          name: data.name || '',
          email: data.email || '',
          ...p,
        }
        setForm(next)
        setBaseline(next)
        setEditMode(false)
      } catch (err) {
        console.error(err)
        if (!alive) return
        setError('Gagal memuat detail pegawai')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  const fieldsLocked = !editMode

  const summary = useMemo(() => {
    return {
      baseSalary: Number(form.baseSalary || 0) || 0,
      ptkp: form.ptkp || 'TK/0',
      npwp: form.npwp || '',
      bankName: form.bankName || '',
      accountNumber: form.accountNumber || '',
    }
  }, [form])

  const handleCancel = () => {
    if (baseline) setForm(baseline)
    setEditMode(false)
  }

  const handleSave = async () => {
    if (!id) return
    if (!form.name.trim()) return alert('Nama wajib diisi')
    if (!Number(form.baseSalary) || Number(form.baseSalary) <= 0) return alert('Gaji pokok wajib > 0')
    try {
      setSaving(true)
      await updateContact(id, {
        name: form.name.trim(),
        email: (form.email || '').trim(),
        types: Array.isArray(contact?.types) && contact.types.length ? contact.types : ['Pegawai'],
        payroll: {
          baseSalary: Number(form.baseSalary) || 0,
          ptkp: form.ptkp || 'TK/0',
          npwp: (form.npwp || '').trim(),
          bpjsEnabled: !!form.bpjsEnabled,
          bank: {
            bankName: (form.bankName || '').trim(),
            bankCode: (form.bankCode || '').trim(),
            accountNumber: (form.accountNumber || '').trim(),
            accountName: (form.accountName || '').trim(),
          },
        },
      })
      const nextBaseline = { ...form, name: form.name.trim(), email: (form.email || '').trim() }
      setBaseline(nextBaseline)
      setForm(nextBaseline)
      setEditMode(false)
      alert('Detail pegawai tersimpan')
    } catch (err) {
      console.error(err)
      alert('Gagal menyimpan detail pegawai')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={toggleSidebar} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Beranda &gt; Payroll &gt; Pegawai
            </div>

            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/payroll')}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {contact?.name || 'Detail Pegawai'}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Data payroll pegawai berbasis Kontak (Pegawai).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {!editMode && (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                )}
                {editMode && (
                  <>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Menyimpan…' : 'Simpan'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : error ? (
              <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-200">
                {error}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: form sections */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Identitas</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Nama dan email pegawai.</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full ${
                        editMode
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {editMode ? 'Mode edit' : 'Mode lihat'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nama</label>
                        <input
                          value={form.name}
                          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                          disabled={fieldsLocked}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white disabled:opacity-70 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                        <input
                          value={form.email}
                          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                          disabled={fieldsLocked}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white disabled:opacity-70 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="mb-5">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white">Payroll</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gaji pokok, PTKP, NPWP, BPJS.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Gaji pokok (bulanan)
                        </label>
                        <input
                          type="number"
                          value={form.baseSalary}
                          onChange={(e) => setForm((p) => ({ ...p, baseSalary: e.target.value }))}
                          disabled={fieldsLocked}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white disabled:opacity-70 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">PTKP</label>
                        <select
                          value={form.ptkp}
                          onChange={(e) => setForm((p) => ({ ...p, ptkp: e.target.value }))}
                          disabled={fieldsLocked}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white disabled:opacity-70 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="TK/0">TK/0</option>
                          <option value="TK/1">TK/1</option>
                          <option value="TK/2">TK/2</option>
                          <option value="TK/3">TK/3</option>
                          <option value="K/0">K/0</option>
                          <option value="K/1">K/1</option>
                          <option value="K/2">K/2</option>
                          <option value="K/3">K/3</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">NPWP</label>
                        <input
                          value={form.npwp}
                          onChange={(e) => setForm((p) => ({ ...p, npwp: e.target.value }))}
                          disabled={fieldsLocked}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white disabled:opacity-70 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">BPJS</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Aktifkan placeholder iuran (MVP).</p>
                        </div>
                        <button
                          type="button"
                          disabled={fieldsLocked}
                          onClick={() => setForm((p) => ({ ...p, bpjsEnabled: !p.bpjsEnabled }))}
                          className={`relative w-12 h-6 rounded-full transition-colors ${
                            form.bpjsEnabled ? 'bg-blue-600' : 'bg-gray-300'
                          } disabled:opacity-60`}
                        >
                          <div
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                              form.bpjsEnabled ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="mb-5">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white">Bank transfer</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Dipakai untuk export KOPRA/transfer batch.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bank</label>
                        <input
                          value={form.bankName}
                          onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
                          disabled={fieldsLocked}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white disabled:opacity-70 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kode bank</label>
                        <input
                          value={form.bankCode}
                          onChange={(e) => setForm((p) => ({ ...p, bankCode: e.target.value }))}
                          disabled={fieldsLocked}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white disabled:opacity-70 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">No rekening</label>
                        <input
                          value={form.accountNumber}
                          onChange={(e) => setForm((p) => ({ ...p, accountNumber: e.target.value }))}
                          disabled={fieldsLocked}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white disabled:opacity-70 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nama pemilik</label>
                        <input
                          value={form.accountName}
                          onChange={(e) => setForm((p) => ({ ...p, accountName: e.target.value }))}
                          disabled={fieldsLocked}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white disabled:opacity-70 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: summary */}
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Ringkasan</h2>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">Gaji pokok</span>
                        <span className="text-gray-900 dark:text-white font-semibold">
                          {formatNumber(summary.baseSalary)}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">PTKP</span>
                        <span className="text-gray-900 dark:text-white">{summary.ptkp || '-'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">NPWP</span>
                        <span className="text-gray-900 dark:text-white text-right break-all">{summary.npwp || '-'}</span>
                      </div>
                      <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-gray-500 dark:text-gray-400">Bank</span>
                          <span className="text-gray-900 dark:text-white text-right">{summary.bankName || '-'}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-gray-500 dark:text-gray-400">Rekening</span>
                          <span className="text-gray-900 dark:text-white text-right break-all">{summary.accountNumber || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

