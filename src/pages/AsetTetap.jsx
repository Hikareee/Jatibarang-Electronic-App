import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import {
  Filter,
  Search,
  Calendar,
  FileText,
  HelpCircle,
  Plus,
  Download,
  Printer,
  MoreVertical,
  MessageCircle,
  Loader2,
  BarChart3,
  Upload,
  ChevronDown
} from 'lucide-react'

// Simple placeholder data hook – later can be replaced with real Firestore hook
function useFixedAssets() {
  const [assets] = useState([])
  const loading = false
  const error = null
  return { assets, loading, error }
}

export default function AsetTetap() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { t } = useLanguage()
  const { assets, loading, error } = useFixedAssets()
  const [selectedTab, setSelectedTab] = useState('registered')
  const [searchQuery, setSearchQuery] = useState('')

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0'
    return new Intl.NumberFormat('id-ID').format(num)
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Summary metrics (placeholder – will be 0 until assets exist)
  const totalAssetValue = assets.reduce((sum, a) => sum + (a.bookValue || 0), 0)

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      !searchQuery ||
      asset.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.reference?.toLowerCase().includes(searchQuery.toLowerCase())

    // Tabs logic can be expanded later; for now all show same list
    return matchesSearch
  })

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Memuat data aset tetap...</p>
            </div>
          </main>
          <Footer />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Breadcrumbs */}
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Beranda &gt; Aset Tetap
            </div>

            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Aset Tetap</h1>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <BarChart3 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">Laporan</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <HelpCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">Panduan</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus className="h-5 w-5" />
                  <span>Tambah</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Upload className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">Import</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Printer className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">Print</span>
                </button>
                <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Nilai Aset</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(totalAssetValue)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Depresiasi Aset</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Laba/Rugi Pelepasan Aset</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Aset Baru</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 mb-4">
              <div className="flex items-center gap-4 flex-wrap">
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">Filter</span>
                </button>
                <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="07/01/2025 → 07/01/2026"
                    className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                  <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
              {['draft', 'registered', 'sold'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    selectedTab === tab
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {tab === 'draft' ? 'Draft' : tab === 'registered' ? 'Terdaftar' : 'Terjual/Dilepaskan'}
                </button>
              ))}
            </div>

            {/* Assets Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              {filteredAssets.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="text-6xl mb-4">📁</div>
                    <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">Data Kosong</p>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Belum ada data aset tetap
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Nama Aset
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Nomor
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Referensi
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tanggal Pembelian
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Harga Beli
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Nilai Buku
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredAssets.map((asset) => (
                        <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {asset.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {asset.number || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {asset.reference || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatDate(asset.purchaseDate)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatNumber(asset.purchasePrice || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatNumber(asset.bookValue || 0)}
                          </td>
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

        {/* Chat Bubble */}
        <div className="fixed bottom-6 right-6 z-50">
          <button className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg flex items-center gap-3 transition-colors">
            <MessageCircle className="h-6 w-6" />
            <span className="text-sm font-medium">Halo, ada yang bisa saya bantu?</span>
          </button>
        </div>
      </div>
    </div>
  )
}


