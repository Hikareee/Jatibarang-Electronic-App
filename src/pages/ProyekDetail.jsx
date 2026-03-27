import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { db } from '../firebase/config'
import { doc, getDoc } from 'firebase/firestore'
import { ChevronLeft } from 'lucide-react'

export default function ProyekDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return
      try {
        setLoading(true)
        setError(null)
        const snap = await getDoc(doc(db, 'projects', id))
        if (!snap.exists()) {
          setError('Proyek tidak ditemukan')
          setProject(null)
          return
        }
        setProject({ id: snap.id, ...snap.data() })
      } catch (err) {
        console.error('Error fetching project detail:', err)
        setError('Gagal memuat detail proyek')
      } finally {
        setLoading(false)
      }
    }
    fetchProject()
  }, [id])

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">Beranda &gt; Proyek &gt; Detail</div>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => navigate('/proyek')} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Detail Proyek</h1>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              {loading ? (
                <p className="text-gray-600 dark:text-gray-400">Memuat detail proyek...</p>
              ) : error ? (
                <p className="text-red-600 dark:text-red-400">{error}</p>
              ) : (
                <div className="space-y-3">
                  <div><span className="text-sm text-gray-500">Nama Proyek:</span> <span className="text-gray-900 dark:text-white font-medium">{project?.name || '-'}</span></div>
                  <div><span className="text-sm text-gray-500">Kode:</span> <span className="text-gray-900 dark:text-white">{project?.code || '-'}</span></div>
                  <div><span className="text-sm text-gray-500">Customer:</span> <span className="text-gray-900 dark:text-white">{project?.customer || '-'}</span></div>
                  <div><span className="text-sm text-gray-500">Deskripsi:</span> <span className="text-gray-900 dark:text-white">{project?.description || '-'}</span></div>
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

