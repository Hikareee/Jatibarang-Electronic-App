import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useAuth } from '../contexts/AuthContext'
import { useContacts } from '../hooks/useContactsData'
import { useAccounts } from '../hooks/useAccountsData'
import { useProjects } from '../hooks/useProjectsData'
import {
  saveEmployeeExpenseRequest,
  REQUEST_TYPES,
  WORKFLOW,
} from '../hooks/useExpensesData'
import { uploadExpenseAttachment } from '../firebase/supabaseClient'
import { ChevronLeft, Save, Calendar, ImagePlus, FileText, X, Loader2, Send } from 'lucide-react'
import FormattedNumberInput from '../components/FormattedNumberInput'

export default function EmployeeExpenseReportForm() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { contacts, loading: contactsLoading } = useContacts()
  const { accounts, loading: accountsLoading } = useAccounts()
  const { projects, loading: projectsLoading } = useProjects()
  const [saving, setSaving] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState('')

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    recipient: '',
    account: '',
    reference: '',
    title: '',
    description: '',
    total: 0,
    items: [],
    projectId: '',
    accountableContactId: '',
    accountabilityChain: '',
  })

  const handleExpenseImageChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const isImage = file.type?.startsWith('image/')
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
    if (!isImage && !isPdf) {
      setImageError('Pilih file gambar atau PDF')
      return
    }
    const maxMb = 8
    if (file.size > maxMb * 1024 * 1024) {
      setImageError(`Ukuran maksimal ${maxMb} MB`)
      return
    }
    try {
      setUploadingImage(true)
      setImageError('')
      const meta = await uploadExpenseAttachment(file, null)
      setAttachment(meta)
    } catch (err) {
      console.error(err)
      setImageError(err?.message ? String(err.message) : 'Gagal mengunggah lampiran')
    } finally {
      setUploadingImage(false)
    }
  }

  const buildPayload = () => {
    const recipientObj = contacts.find((c) => c.id === formData.recipient)
    const accountObj = accounts.find((a) => a.id === formData.account)
    const projectObj = projects.find((p) => p.id === formData.projectId)
    const accountableObj = contacts.find((c) => c.id === formData.accountableContactId)
    return {
      date: formData.date,
      dueDate: formData.dueDate || '',
      number: '',
      recipientId: formData.recipient || '',
      recipient: recipientObj?.name || recipientObj?.company || '',
      accountId: formData.account || '',
      account: accountObj?.name || '',
      reference: formData.reference || '',
      title: formData.title.trim(),
      description: formData.description.trim(),
      total: Number(formData.total) || 0,
      items: formData.items || [],
      projectId: formData.projectId || '',
      projectName: projectObj?.name || '',
      accountableContactId: formData.accountableContactId || '',
      accountablePerson: accountableObj?.name || accountableObj?.company || '',
      accountabilityChain: formData.accountabilityChain?.trim() || '',
      attachment: attachment || null,
      paid: false,
      remaining: Number(formData.total) || 0,
    }
  }

  const validateSubmit = () => {
    if (!formData.recipient) {
      alert('Penerima wajib diisi')
      return false
    }
    if (!formData.account) {
      alert('Akun wajib diisi')
      return false
    }
    if (!formData.title.trim()) {
      alert('Judul wajib diisi')
      return false
    }
    if (!formData.description.trim()) {
      alert('Deskripsi wajib diisi')
      return false
    }
    if (!Number(formData.total) || Number(formData.total) <= 0) {
      alert('Total wajib diisi dan harus lebih dari 0')
      return false
    }
    if (!attachment?.url) {
      alert(
        'Untuk pengajuan resmi, lampirkan bukti tagihan (invoice, kwitansi, atau foto nota) dalam bentuk gambar atau PDF.'
      )
      return false
    }
    return true
  }

  const validateDraft = () => {
    if (!formData.title.trim() && !formData.description.trim()) {
      alert('Isi minimal judul atau deskripsi untuk menyimpan draft')
      return false
    }
    return true
  }

  const save = async (workflowStatus) => {
    if (workflowStatus === WORKFLOW.DRAFT) {
      if (!validateDraft()) return
    } else if (!validateSubmit()) return

    try {
      setSaving(true)
      const payload = buildPayload()
      await saveEmployeeExpenseRequest(
        payload,
        workflowStatus,
        REQUEST_TYPES.EXPENSE_REPORT,
        { uid: currentUser?.uid, email: currentUser?.email }
      )
      navigate('/permintaan')
    } catch (err) {
      console.error(err)
      alert('Gagal menyimpan pengajuan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Beranda &gt; Permintaan &gt; Laporan biaya
            </div>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Laporan biaya</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Draft tidak memposting ke buku. Saat kirim pengajuan, wajib lampirkan bukti tagihan — admin/owner
                  mendapat notifikasi dan memproses di menu Biaya.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/permintaan')}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                <ChevronLeft className="h-5 w-5" />
                <span>Kembali</span>
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tanggal *
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                    <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Penerima (vendor) *
                  </label>
                  <select
                    value={formData.recipient}
                    onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                    disabled={contactsLoading}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Pilih kontak</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.company || 'Unnamed Contact'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Penanggung jawab internal
                  </label>
                  <select
                    value={formData.accountableContactId}
                    onChange={(e) =>
                      setFormData({ ...formData, accountableContactId: e.target.value })
                    }
                    disabled={contactsLoading}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Opsional</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.company || 'Unnamed Contact'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Akun *
                  </label>
                  <select
                    value={formData.account}
                    onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                    disabled={accountsLoading}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Pilih akun</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Proyek
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    disabled={projectsLoading}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Tanpa proyek</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code ? `${p.code} — ` : ''}
                        {p.name || p.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Referensi
                  </label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Total *
                  </label>
                  <FormattedNumberInput
                    value={formData.total}
                    onChange={(value) => setFormData({ ...formData, total: value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alur pertanggungjawaban (opsional)
                </label>
                <input
                  type="text"
                  value={formData.accountabilityChain}
                  onChange={(e) => setFormData({ ...formData, accountabilityChain: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Judul *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Deskripsi *
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Lampiran bukti (wajib saat kirim pengajuan)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Invoice, kwitansi, foto nota, atau PDF tagihan — diperlukan sebagai bukti untuk persetujuan dana.
                </p>
                {imageError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-2">{imageError}</p>
                )}
                <div className="flex flex-wrap items-start gap-4">
                  {attachment?.url && (
                    <div className="relative inline-block rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                      {attachment.type?.startsWith('image/') ? (
                        <img
                          src={attachment.url}
                          alt=""
                          className="max-h-40 max-w-full object-contain bg-gray-50 dark:bg-gray-900"
                        />
                      ) : (
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 flex flex-col gap-2">
                          <FileText className="h-8 w-8 text-gray-700 dark:text-gray-200" />
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {attachment.name || 'Lihat file'}
                          </a>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <label className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {uploadingImage ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-gray-500" />
                    )}
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {uploadingImage ? 'Mengunggah...' : 'Pilih lampiran'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={handleExpenseImageChange}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => save(WORKFLOW.DRAFT)}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <Save className="h-5 w-5" />
                Simpan draft
              </button>
              <button
                type="button"
                onClick={() => save(WORKFLOW.SUBMITTED)}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                <Send className="h-5 w-5" />
                Kirim untuk persetujuan
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}
