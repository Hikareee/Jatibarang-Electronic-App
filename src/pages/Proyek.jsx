import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { db } from '../firebase/config'
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore'
import { Plus, FolderOpen, X } from 'lucide-react'
import { useContacts } from '../hooks/useContactsData'

export default function Proyek() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const { contacts, loading: contactsLoading } = useContacts()
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    customerId: '',
    customer: '',
  })

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true)
        setError(null)
        const snap = await getDocs(collection(db, 'projects'))
        setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('Error fetching projects:', err)
        setError('Gagal memuat data proyek')
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [])

  const openAddModal = async () => {
    // Generate simple next project code: PRJ-01, PRJ-02...
    const maxNum = projects.reduce((max, p) => {
      const m = String(p.code || '').match(/^PRJ-(\d+)$/i)
      return m ? Math.max(max, parseInt(m[1], 10)) : max
    }, 0)
    setForm({
      name: '',
      code: `PRJ-${String(maxNum + 1).padStart(2, '0')}`,
      description: '',
      customerId: '',
      customer: ''
    })
    setShowAdd(true)
  }

  const saveProject = async () => {
    if (!form.name.trim()) {
      alert('Nama proyek wajib diisi')
      return
    }
    try {
      setSaving(true)
      const payload = {
        name: form.name.trim(),
        code: (form.code || '').trim() || 'PRJ-01',
        description: (form.description || '').trim(),
        customerId: form.customerId || '',
        customer: (form.customer || '').trim(),
        createdAt: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, 'projects'), payload)
      setProjects((prev) => [...prev, { id: ref.id, ...payload }])
      setShowAdd(false)
    } catch (err) {
      console.error('Error saving project:', err)
      alert('Gagal menyimpan proyek')
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
          <div className="max-w-7xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">Beranda &gt; Proyek</div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proyek</h1>
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-5 w-5" />
                <span>Tambah Proyek</span>
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              {loading ? (
                <p className="text-gray-600 dark:text-gray-400">Memuat proyek...</p>
              ) : error ? (
                <p className="text-red-600 dark:text-red-400">{error}</p>
              ) : projects.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">Belum ada proyek.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate(`/proyek/${p.id}`)}
                      className="text-left bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-500 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FolderOpen className="h-4 w-4 text-blue-600" />
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                      </div>
                      {p.code && <p className="text-xs text-gray-500 dark:text-gray-400">Kode: {p.code}</p>}
                      {p.customer && <p className="text-xs text-gray-500 dark:text-gray-400">Customer: {p.customer}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Proyek</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Proyek *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kode</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
                <select
                  value={form.customerId}
                  onChange={(e) => {
                    const selected = contacts.find((c) => c.id === e.target.value)
                    setForm({
                      ...form,
                      customerId: e.target.value,
                      customer: selected ? (selected.name || selected.company || '') : ''
                    })
                  }}
                  disabled={contactsLoading}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                >
                  <option value="">Pilih kontak</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name || contact.company || 'Unnamed Contact'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm">Batal</button>
              <button onClick={saveProject} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

