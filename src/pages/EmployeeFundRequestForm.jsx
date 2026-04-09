import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useAuth } from '../contexts/AuthContext'
import {
  saveEmployeeExpenseRequest,
  REQUEST_TYPES,
  WORKFLOW,
} from '../hooks/useExpensesData'
import { uploadExpenseAttachment } from '../firebase/supabaseClient'
import { ChevronLeft, Save, Calendar, ImagePlus, FileText, X, Loader2, Send } from 'lucide-react'
import FormattedNumberInput from '../components/FormattedNumberInput'

export default function EmployeeFundRequestForm() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState('')

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    title: '',
    description: '',
    total: 0,
    reference: '',
  })

  const handleFile = async (event) => {
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
      setImageError(err?.message ? String(err.message) : 'Gagal mengunggah')
    } finally {
      setUploadingImage(false)
    }
  }

  const buildPayload = () => ({
    date: formData.date,
    dueDate: '',
    number: '',
    recipientId: '',
    recipient: 'Permintaan dana (internal)',
    accountId: '',
    account: '',
    reference: formData.reference || '',
    title: formData.title.trim(),
    description: formData.description.trim(),
    total: Number(formData.total) || 0,
    items: [],
    projectId: '',
    projectName: '',
    accountableContactId: '',
    accountablePerson: '',
    accountabilityChain: '',
    attachment: attachment || null,
    paid: false,
    remaining: Number(formData.total) || 0,
  })

  const validateSubmit = () => {
    if (!formData.title.trim()) {
      alert('Judul / keperluan wajib diisi')
      return false
    }
    if (!formData.description.trim()) {
      alert('Keterangan wajib diisi')
      return false
    }
    if (!Number(formData.total) || Number(formData.total) <= 0) {
      alert('Nominal wajib diisi dan harus lebih dari 0')
      return false
    }
    if (!attachment?.url) {
      alert(
        'Lampirkan bukti pendukung (penawaran, invoice perkiraan, atau dokumen operasional) sebagai gambar atau PDF sebelum mengirim permintaan dana.'
      )
      return false
    }
    return true
  }

  const validateDraft = () => {
    if (!formData.title.trim() && !formData.description.trim()) {
      alert('Isi minimal judul atau keterangan untuk draft')
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
      await saveEmployeeExpenseRequest(
        buildPayload(),
        workflowStatus,
        REQUEST_TYPES.FUND_REQUEST,
        { uid: currentUser?.uid, email: currentUser?.email }
      )
      navigate('/permintaan')
    } catch (err) {
      console.error(err)
      alert('Gagal menyimpan permintaan')
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
          <div className="max-w-2xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Beranda &gt; Permintaan &gt; Permintaan dana
            </div>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Permintaan dana</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Kirim dengan lampiran bukti. Admin mendapat notifikasi untuk menyetujui dan mencatat pencairan;
                  owner ikut mendapat laporan di notifikasi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/permintaan')}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                <ChevronLeft className="h-5 w-5" />
                Kembali
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 space-y-4">
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
                  Judul / keperluan *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Contoh: Uang muka proyek X"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Keterangan *
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Jelaskan rincian kebutuhan dana"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nominal diminta *
                </label>
                <FormattedNumberInput
                  value={formData.total}
                  onChange={(value) => setFormData({ ...formData, total: value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Referensi (opsional)
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
                  Lampiran bukti (wajib saat kirim)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Dokumen pendukung permintaan dana (foto nota, penawaran, dll.).
                </p>
                {imageError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-2">{imageError}</p>
                )}
                <div className="flex flex-wrap gap-4">
                  {attachment?.url && (
                    <div className="relative inline-block rounded-lg border dark:border-gray-600 overflow-hidden">
                      {attachment.type?.startsWith('image/') ? (
                        <img src={attachment.url} alt="" className="max-h-32" />
                      ) : (
                        <div className="p-3 flex items-center gap-2">
                          <FileText className="h-6 w-6" />
                          <a href={attachment.url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm">
                            File
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
                  <label className="inline-flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer">
                    {uploadingImage ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-gray-500" />
                    )}
                    <span className="text-sm">Unggah</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={handleFile}
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
                className="flex items-center gap-2 px-5 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <Save className="h-5 w-5" />
                Simpan draft
              </button>
              <button
                type="button"
                onClick={() => save(WORKFLOW.SUBMITTED)}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                <Send className="h-5 w-5" />
                Kirim permintaan
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}
