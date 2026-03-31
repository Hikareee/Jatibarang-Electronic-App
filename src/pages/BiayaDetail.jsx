import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { db } from '../firebase/config'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { useContacts } from '../hooks/useContactsData'
import { useAccounts } from '../hooks/useAccountsData'
import { useProjects } from '../hooks/useProjectsData'
import { useUserApproval } from '../hooks/useUserApproval'
import { uploadExpenseAttachment } from '../firebase/supabaseClient'
import { ChevronLeft, Save, Calendar, Loader2, ImagePlus, FileText, X } from 'lucide-react'
import FormattedNumberInput from '../components/FormattedNumberInput'

export default function BiayaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { contacts, loading: contactsLoading } = useContacts()
  const { accounts, loading: accountsLoading } = useAccounts()
  const { projects, loading: projectsLoading } = useProjects()
  const { canEditApproved, loading: approvalLoading } = useUserApproval()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [loadedFormData, setLoadedFormData] = useState(null)
  const [error, setError] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState('')

  const [formData, setFormData] = useState({
    date: '',
    dueDate: '',
    number: '',
    recipient: '',
    account: '',
    reference: '',
    title: '',
    description: '',
    total: 0,
    projectId: '',
    items: [],
    accountableContactId: '',
    accountabilityChain: '',
    attachment: null,
  })

  useEffect(() => {
    const load = async () => {
      if (!id) return
      try {
        setLoading(true)
        setError(null)
        const snap = await getDoc(doc(db, 'expenses', id))
        if (!snap.exists()) {
          setError('Biaya tidak ditemukan')
          return
        }
        const data = snap.data()
        const dateStr = data.date
          ? typeof data.date === 'string'
            ? data.date.split('T')[0]
            : new Date(data.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
        const dueStr = data.dueDate
          ? typeof data.dueDate === 'string'
            ? data.dueDate.split('T')[0]
            : new Date(data.dueDate).toISOString().split('T')[0]
          : ''
        setFormData({
          date: dateStr,
          dueDate: dueStr,
          number: data.number || '',
          recipient: data.recipientId || '',
          account: data.accountId || '',
          reference: data.reference || '',
          title: data.title || '',
          description: data.description || '',
          total: data.total ?? 0,
          projectId: data.projectId || '',
          items: data.items || [],
          accountableContactId: data.accountableContactId || '',
          accountabilityChain: data.accountabilityChain || '',
          attachment: data.attachment && data.attachment.url ? data.attachment : null,
        })
        setLoadedFormData({
          date: dateStr,
          dueDate: dueStr,
          number: data.number || '',
          recipient: data.recipientId || '',
          account: data.accountId || '',
          reference: data.reference || '',
          title: data.title || '',
          description: data.description || '',
          total: data.total ?? 0,
          projectId: data.projectId || '',
          items: data.items || [],
          accountableContactId: data.accountableContactId || '',
          accountabilityChain: data.accountabilityChain || '',
          attachment: data.attachment && data.attachment.url ? data.attachment : null,
        })
        setIsEditing(false)
      } catch (err) {
        console.error(err)
        setError('Gagal memuat biaya')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleExpenseImageChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !id) return
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
      const meta = await uploadExpenseAttachment(file, id)
      await updateDoc(doc(db, 'expenses', id), {
        attachment: meta,
        updatedAt: new Date().toISOString(),
      })
      setFormData((prev) => ({ ...prev, attachment: meta }))
    } catch (err) {
      console.error(err)
      setImageError(err?.message ? String(err.message) : 'Gagal mengunggah gambar')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleRemoveAttachment = async () => {
    if (!id) return
    try {
      setImageError('')
      await updateDoc(doc(db, 'expenses', id), {
        attachment: null,
        updatedAt: new Date().toISOString(),
      })
      setFormData((prev) => ({ ...prev, attachment: null }))
    } catch (err) {
      console.error(err)
      alert('Gagal menghapus lampiran')
    }
  }

  const handleSave = async () => {
    if (!canEditApproved) {
      alert('Hanya owner yang bisa mengedit biaya ini')
      return
    }
    if (!formData.recipient) {
      alert('Penerima wajib diisi')
      return
    }
    if (!formData.account) {
      alert('Akun wajib diisi')
      return
    }
    if (!formData.title.trim()) {
      alert('Title wajib diisi')
      return
    }
    if (!formData.description.trim()) {
      alert('Description wajib diisi')
      return
    }
    if (!Number(formData.total) || Number(formData.total) <= 0) {
      alert('Total wajib diisi dan harus lebih dari 0')
      return
    }

    try {
      setSaving(true)
      const expenseRef = doc(db, 'expenses', id)
      const prevSnap = await getDoc(expenseRef)
      if (!prevSnap.exists()) {
        alert('Biaya tidak ditemukan')
        return
      }
      const prev = prevSnap.data()
      const oldTotal = parseFloat(prev.total) || 0
      const oldRemaining =
        prev.remaining !== undefined ? parseFloat(prev.remaining) : oldTotal
      const paidAmount = Math.max(0, oldTotal - oldRemaining)
      const newTotal = Number(formData.total)
      const newRemaining = Math.max(0, newTotal - paidAmount)

      const recipientObj = contacts.find((c) => c.id === formData.recipient)
      const accountObj = accounts.find((a) => a.id === formData.account)
      const projectObj = projects.find((p) => p.id === formData.projectId)
      const accountableObj = contacts.find((c) => c.id === formData.accountableContactId)

      await updateDoc(expenseRef, {
        date: formData.date,
        dueDate: formData.dueDate || '',
        number: formData.number,
        recipientId: formData.recipient,
        recipient: recipientObj?.name || recipientObj?.company || '',
        accountId: formData.account,
        account: accountObj?.name || '',
        reference: formData.reference || '',
        title: formData.title.trim(),
        description: formData.description.trim(),
        total: newTotal,
        remaining: newRemaining,
        projectId: formData.projectId || '',
        projectName: projectObj?.name || '',
        accountableContactId: formData.accountableContactId || '',
        accountablePerson: accountableObj?.name || accountableObj?.company || '',
        accountabilityChain: formData.accountabilityChain?.trim() || '',
        attachment: formData.attachment || null,
        updatedAt: new Date().toISOString(),
      })
      navigate('/biaya')
    } catch (err) {
      console.error('Error saving expense:', err)
      alert('Gagal menyimpan perubahan')
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
              Beranda &gt; Biaya &gt; Detail
            </div>

            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Detail Biaya</h1>
              <div className="flex items-center gap-3">
                {canEditApproved && !approvalLoading && !isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <span>Edit</span>
                  </button>
                )}
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      if (loadedFormData) setFormData(loadedFormData)
                      setIsEditing(false)
                      setImageError('')
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                  >
                    <span>Batal</span>
                  </button>
                )}
                <button
                  onClick={() => navigate('/biaya')}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span>Kembali</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : error ? (
              <p className="text-red-600 dark:text-red-400">{error}</p>
            ) : (
              <>
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
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        />
                        <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        No. Biaya
                      </label>
                      <input
                        type="text"
                        value={formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Penerima (vendor / PT) *
                      </label>
                      <select
                        value={formData.recipient}
                        onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                        disabled={!isEditing || contactsLoading}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Pilih kontak</option>
                        {contacts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || c.company || 'Unnamed Contact'}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Pihak yang menerima pembayaran atas jasa atau barang.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Penanggung jawab internal
                      </label>
                      <select
                        value={formData.accountableContactId}
                        onChange={(e) => setFormData({ ...formData, accountableContactId: e.target.value })}
                        disabled={!isEditing || contactsLoading}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Tanpa penanggung jawab (opsional)</option>
                        {contacts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || c.company || 'Unnamed Contact'}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Orang di perusahaan Anda yang bertanggung jawab atas penggunaan dana.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Akun *
                      </label>
                      <select
                        value={formData.account}
                        onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                        disabled={!isEditing || accountsLoading}
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
                        disabled={!isEditing || projectsLoading}
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
                        disabled={!isEditing}
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
                        disabled={!isEditing}
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
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder="Contoh: Perusahaan → saya → PT Victory"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description *
                    </label>
                    <textarea
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Lampiran (opsional: gambar atau PDF)
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Diunggah ke Supabase. Unggah atau hapus langsung tersimpan; field lain tetap memakai tombol Simpan
                      Perubahan.
                    </p>
                    {imageError && (
                      <p className="text-sm text-red-600 dark:text-red-400 mb-2">{imageError}</p>
                    )}
                    <div className="flex flex-wrap items-start gap-4">
                      {formData.attachment?.url && (
                        <div className="relative inline-block rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                          {formData.attachment.type?.startsWith('image/') ? (
                            <a href={formData.attachment.url} target="_blank" rel="noreferrer">
                              <img
                                src={formData.attachment.url}
                                alt={formData.attachment.name || 'Lampiran'}
                                className="max-h-40 max-w-full object-contain bg-gray-50 dark:bg-gray-900"
                              />
                            </a>
                          ) : (formData.attachment.type === 'application/pdf' ||
                            formData.attachment.name?.toLowerCase().endsWith('.pdf')) ? (
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 h-full flex flex-col items-start gap-2">
                              <FileText className="h-8 w-8 text-gray-700 dark:text-gray-200" />
                              <a
                                href={formData.attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                              >
                                {formData.attachment.name || 'Lihat PDF'}
                              </a>
                            </div>
                          ) : (
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 h-full flex flex-col items-start gap-2">
                              <FileText className="h-8 w-8 text-gray-700 dark:text-gray-200" />
                              <a
                                href={formData.attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                              >
                                {formData.attachment.name || 'Lihat Lampiran'}
                              </a>
                            </div>
                          )}
                          {isEditing && (
                            <button
                              type="button"
                              onClick={handleRemoveAttachment}
                              className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white hover:bg-black/80"
                              aria-label="Hapus lampiran"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                      <label className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        {uploadingImage ? (
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        ) : (
                          <ImagePlus className="h-5 w-5 text-gray-500" />
                        )}
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {uploadingImage
                            ? 'Mengunggah...'
                            : formData.attachment
                              ? 'Ganti lampiran'
                              : 'Pilih lampiran'}
                        </span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          disabled={!isEditing || uploadingImage}
                          onChange={handleExpenseImageChange}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="h-5 w-5" />
                      <span>Simpan Perubahan</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}
