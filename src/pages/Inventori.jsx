import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useLanguage } from '../contexts/LanguageContext'
import { useSidebarOpen } from '../hooks/useSidebarOpen'
import { db } from '../firebase/config'
import { 
  collection,
  getDocs,
  addDoc,
  serverTimestamp
} from 'firebase/firestore'
import {
  Plus,
  Filter,
  Printer,
  Warehouse as WarehouseIcon,
  X,
  ChevronRight
} from 'lucide-react'

async function getNextWarehouseCode() {
  const ref = collection(db, 'warehouses')
  const snap = await getDocs(ref)
  let maxNum = 0
  snap.docs.forEach(d => {
    const code = (d.data().code || '').toString()
    const match = code.match(/^GDNG-(\d+)$/i)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > maxNum) maxNum = n
    }
  })
  return `GDNG-${String(maxNum + 1).padStart(2, '0')}`
}

export default function Inventori() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { sidebarOpen, toggleSidebar } = useSidebarOpen(true)
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddWarehouse, setShowAddWarehouse] = useState(false)
  const [savingWarehouse, setSavingWarehouse] = useState(false)
  const [warehouseForm, setWarehouseForm] = useState({
    name: '',
    code: '',
    description: ''
  })

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        setLoading(true)
        setError(null)
        const ref = collection(db, 'warehouses')
        const snap = await getDocs(ref)
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setWarehouses(data)
      } catch (err) {
        console.error('Error fetching warehouses:', err)
        setError('Gagal memuat data gudang')
      } finally {
        setLoading(false)
      }
    }

    fetchWarehouses()
  }, [])

  const handleOpenAddWarehouse = async () => {
    const nextCode = await getNextWarehouseCode()
    setWarehouseForm({ name: '', code: nextCode, description: '' })
    setShowAddWarehouse(true)
  }

  const handleSaveWarehouse = async () => {
    if (!warehouseForm.name.trim()) {
      alert('Nama gudang wajib diisi')
      return
    }

    try {
      setSavingWarehouse(true)
      const code = warehouseForm.code.trim() || await getNextWarehouseCode()
      const ref = collection(db, 'warehouses')
      const docRef = await addDoc(ref, {
        name: warehouseForm.name.trim(),
        code,
        description: (warehouseForm.description || '').trim(),
        createdAt: serverTimestamp()
      })

      setWarehouses(prev => [
        ...prev,
        { id: docRef.id, name: warehouseForm.name.trim(), code, description: warehouseForm.description }
      ])

      setShowAddWarehouse(false)
    } catch (err) {
      console.error('Error adding warehouse:', err)
      alert('Gagal menambah gudang')
    } finally {
      setSavingWarehouse(false)
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
              Beranda &gt; Inventori
            </div>

            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Inventori
              </h1>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t('filter')}</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Printer className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t('print')}</span>
                </button>
                <button
                  onClick={handleOpenAddWarehouse}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span>Tambah Gudang</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Stok</p>
                <p className="text-2xl font-bold text-green-500">0</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Nilai Produk</p>
                <p className="text-2xl font-bold text-blue-500">0</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total HPP</p>
                <p className="text-2xl font-bold text-pink-500">0</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <WarehouseIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Daftar Gudang
                  </h2>
                </div>
              </div>

              {loading ? (
                <p className="text-gray-600 dark:text-gray-400 text-sm">Memuat data gudang...</p>
              ) : error ? (
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              ) : warehouses.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Belum ada gudang. Klik &quot;Tambah Gudang&quot; untuk menambah gudang pertama Anda.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {warehouses.map((wh) => (
                    <button
                      key={wh.id}
                      type="button"
                      onClick={() => navigate(`/inventori/gudang/${wh.id}`)}
                      className="text-left bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all flex items-center justify-between group"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                          {wh.name}
                        </p>
                        {wh.code && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Kode: {wh.code}
                          </p>
                        )}
                        {wh.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                            {wh.description}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 flex-shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {showAddWarehouse && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Tambah Inventori
                  </h2>
                  <button
                    onClick={() => setShowAddWarehouse(false)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nama Gudang <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={warehouseForm.name}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Kode (otomatis)
                    </label>
                    <input
                      type="text"
                      value={warehouseForm.code}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Deskripsi
                    </label>
                    <textarea
                      rows={3}
                      value={warehouseForm.description}
                      onChange={(e) =>
                        setWarehouseForm({ ...warehouseForm, description: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowAddWarehouse(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveWarehouse}
                    disabled={savingWarehouse}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        <Footer />
      </div>
    </div>
  )
}

