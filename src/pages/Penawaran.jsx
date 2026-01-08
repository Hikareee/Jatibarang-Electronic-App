import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { 
  Filter,
  Search,
  Calendar,
  FileText,
  HelpCircle,
  Plus,
  Printer,
  MoreVertical,
  MessageCircle,
  BarChart3,
  Upload,
  ChevronDown,
  List,
  X,
  ArrowUp
} from 'lucide-react'

export default function Penawaran() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOffers, setSelectedOffers] = useState([])
  const [showProModal, setShowProModal] = useState(true)
  const [offers] = useState([]) // Empty for now

  // Format number to Indonesian format
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0'
    return new Intl.NumberFormat('id-ID').format(num)
  }

  // Format date to DD/MM/YYYY
  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Get status label
  const getStatusLabel = (offer) => {
    const status = offer.status || 'draft'
    
    switch (status) {
      case 'sent':
      case 'terkirim':
        return 'Terkirim'
      case 'rejected':
      case 'ditolak':
        return 'Ditolak Pelanggan'
      case 'approved':
      case 'disetujui':
        return 'Disetujui Pelanggan'
      case 'completed':
      case 'selesai':
        return 'Selesai'
      case 'partially_ordered':
      case 'dipesan_sebagian':
        return 'Dipesan Sebagian'
      default:
        return 'Draft'
    }
  }

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Selesai':
        return 'text-green-600 dark:text-green-400'
      case 'Disetujui Pelanggan':
        return 'text-blue-600 dark:text-blue-400'
      case 'Terkirim':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'Ditolak Pelanggan':
        return 'text-red-600 dark:text-red-400'
      case 'Dipesan Sebagian':
        return 'text-purple-600 dark:text-purple-400'
      case 'Draft':
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  // Filter offers based on status and search
  const filteredOffers = offers.filter(offer => {
    const status = getStatusLabel(offer)
    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'draft' && status === 'Draft') ||
      (selectedStatus === 'terkirim' && status === 'Terkirim') ||
      (selectedStatus === 'ditolak' && status === 'Ditolak Pelanggan') ||
      (selectedStatus === 'disetujui' && status === 'Disetujui Pelanggan') ||
      (selectedStatus === 'selesai' && status === 'Selesai') ||
      (selectedStatus === 'dipesan_sebagian' && status === 'Dipesan Sebagian')
    
    const matchesSearch = !searchQuery || 
      offer.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offer.customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offer.reference?.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesStatus && matchesSearch
  })

  const toggleSelectOffer = (offerId) => {
    setSelectedOffers(prev => 
      prev.includes(offerId) 
        ? prev.filter(id => id !== offerId)
        : [...prev, offerId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedOffers.length === filteredOffers.length) {
      setSelectedOffers([])
    } else {
      setSelectedOffers(filteredOffers.map(offer => offer.id))
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Breadcrumbs */}
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Beranda &gt; Penjualan &gt; Penawaran
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Penawaran
        </h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">Filter</span>
          </button>
          <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <List className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="relative">
            <select className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
              <option>Penawaran</option>
            </select>
            <FileText className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
          </div>
          <button 
            onClick={() => setShowProModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Tambah</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          <div className="relative">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              <Upload className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">Import</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Printer className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">Print</span>
          </button>
          <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="relative">
            <input
              type="text"
              placeholder="08/01/2025 → 08/01/2026"
              className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            />
            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setSelectedStatus('all')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'all'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Semua
        </button>
        <button
          onClick={() => setSelectedStatus('draft')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'draft'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Draft
        </button>
        <button
          onClick={() => setSelectedStatus('terkirim')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'terkirim'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Terkirim
        </button>
        <button
          onClick={() => setSelectedStatus('ditolak')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'ditolak'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Ditolak Pelanggan
        </button>
        <button
          onClick={() => setSelectedStatus('disetujui')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'disetujui'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Disetujui Pelanggan
        </button>
        <button
          onClick={() => setSelectedStatus('selesai')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'selesai'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Selesai
        </button>
        <button
          onClick={() => setSelectedStatus('dipesan_sebagian')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'dipesan_sebagian'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Dipesan Sebagian
        </button>
      </div>

      {/* Offers Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredOffers.length === 0 ? (
          <div className="p-12 text-center relative">
            <div className="flex flex-col items-center justify-center">
              <div className="text-6xl mb-4">📁</div>
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">Data Kosong</p>
              <p className="text-gray-500 dark:text-gray-400 mb-4">Yuk mulai buat pertamamu!</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedOffers.length === filteredOffers.length && filteredOffers.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Nomor
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pelanggan
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Referensi
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tgl. Jatuh Tempo
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredOffers.map((offer) => {
                  const status = getStatusLabel(offer)
                  return (
                    <tr 
                      key={offer.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => navigate(`/penjualan/penawaran/${offer.id}`)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedOffers.includes(offer.id)}
                          onChange={() => toggleSelectOffer(offer.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {offer.number || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {offer.customer || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {offer.reference || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {offer.dueDate ? formatDate(offer.dueDate) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={getStatusColor(status)}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                        {formatNumber(offer.total || 0)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRO Package Modal */}
      {showProModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-4 relative">
            <button
              onClick={() => setShowProModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Fitur Penawaran tersedia di paket PRO
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Upgrade ke paket PRO untuk mengakses fitur penawaran dan fitur premium lainnya.
              </p>
              <button
                onClick={() => {
                  // Handle upgrade action
                  setShowProModal(false)
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowUp className="h-5 w-5" />
                Upgrade Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Bubble */}
      <div className="fixed bottom-6 right-6 z-50">
        <button className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg flex items-center gap-3 transition-colors">
          <MessageCircle className="h-6 w-6" />
          <span className="text-sm font-medium">Halo, ada yang bisa saya bantu?</span>
        </button>
      </div>
    </div>
  )
}
