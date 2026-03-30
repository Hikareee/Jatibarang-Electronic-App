import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
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
import { usePurchaseDeliveries } from '../hooks/usePurchaseDeliveries'

export default function PengirimanPembelian() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { deliveries, loading, error, updateDeliveryStatus } = usePurchaseDeliveries()
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDeliveries, setSelectedDeliveries] = useState([])
  const [editingStatus, setEditingStatus] = useState(null)
  const [statusMenuOpen, setStatusMenuOpen] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const statusMenuRef = useRef(null)
  const buttonRefs = useRef({})

  // Close status menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
        setStatusMenuOpen(null)
      }
    }

    if (statusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [statusMenuOpen])

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

  // Get status label based on delivery percentage and approval status
  const getStatusLabel = (invoice) => {
    const status = invoice.status || 'draft'
    const deliveryStatus = invoice.deliveryStatus || 0
    
    // Only show delivery status for approved invoices
    if (status === 'approved') {
      if (deliveryStatus === 100) return 'Selesai'
      if (deliveryStatus > 0) return 'Dikirim Sebagian'
      return 'Disetujui'
    }
    
    if (status === 'declined') return 'Ditolak'
    return 'Draft'
  }

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Selesai':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
      case 'Dalam Proses':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
      case 'Open':
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  // Filter deliveries based on status and search (only show approved invoices)
  const filteredDeliveries = deliveries.filter(delivery => {
    // Only show approved invoices in delivery tracking
    if (delivery.status !== 'approved') return false
    
    const status = getStatusLabel(delivery)
    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'open' && (status === 'Disetujui' || status === 'Dikirim Sebagian')) ||
      (selectedStatus === 'selesai' && status === 'Selesai')
    
    const matchesSearch = !searchQuery || 
      delivery.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.reference?.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesStatus && matchesSearch
  })

  const toggleSelectDelivery = (deliveryId) => {
    setSelectedDeliveries(prev => 
      prev.includes(deliveryId) 
        ? prev.filter(id => id !== deliveryId)
        : [...prev, deliveryId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedDeliveries.length === filteredDeliveries.length) {
      setSelectedDeliveries([])
    } else {
      setSelectedDeliveries(filteredDeliveries.map(d => d.id))
    }
  }

  const handleStatusUpdate = async (deliveryId, newStatus) => {
    try {
      await updateDeliveryStatus(deliveryId, newStatus)
      setStatusMenuOpen(null)
      alert(`Status pengiriman diperbarui menjadi ${newStatus}%`)
    } catch (err) {
      console.error('Error updating status:', err)
      alert('Gagal memperbarui status pengiriman')
    }
  }

  const statusOptions = [0, 25, 50, 75, 100]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Memuat data pengiriman pembelian...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Pengiriman Pembelian
        </h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <BarChart3 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">Laporan</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Upload className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">Ekspor</span>
          </button>
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
              placeholder="06/01/2025 → 06/01/2026"
              className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            />
            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
          </div>
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
          onClick={() => setSelectedStatus('open')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'open'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Open
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
      </div>

      {/* Delivery Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700" style={{ overflow: 'visible' }}>
        {filteredDeliveries.length === 0 ? (
          <div className="p-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="text-6xl mb-4">📁</div>
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">Data Kosong</p>
              <p className="text-gray-500 dark:text-gray-400 mb-4">Belum ada data pengiriman pembelian</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ overflowY: 'visible', position: 'relative' }}>
            <table className="w-full" style={{ position: 'relative' }}>
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedDeliveries.length === filteredDeliveries.length && filteredDeliveries.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Nomor
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Vendor
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Referensi
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDeliveries.map((delivery) => {
                  const status = getStatusLabel(delivery)
                  const deliveryPercentage = delivery.deliveryStatus || 0
                  const isMenuOpen = statusMenuOpen === delivery.id
                  
                  return (
                    <tr 
                      key={delivery.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedDeliveries.includes(delivery.id)}
                          onChange={() => toggleSelectDelivery(delivery.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {delivery.number || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {delivery.vendor || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {delivery.reference || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ position: 'relative' }}>
                        <div className="relative inline-block">
                          <button
                            ref={(el) => buttonRefs.current[delivery.id] = el}
                            onClick={(e) => {
                              if (isMenuOpen) {
                                setStatusMenuOpen(null)
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setMenuPosition({
                                  top: rect.bottom + window.scrollY + 8,
                                  left: rect.right + window.scrollX - 192
                                })
                                setStatusMenuOpen(delivery.id)
                              }
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}
                          >
                            {deliveryPercentage}% - {status}
                            <ChevronDown className="inline h-3 w-3 ml-1" />
                          </button>
                          {isMenuOpen && (
                            <div 
                              className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl" 
                              style={{ 
                                zIndex: 9999,
                                minWidth: '192px',
                                top: `${menuPosition.top}px`,
                                left: `${menuPosition.left}px`
                              }}
                              ref={statusMenuRef}
                            >
                              <div className="py-1">
                                {statusOptions.map((option) => (
                                  <button
                                    key={option}
                                    onClick={() => handleStatusUpdate(delivery.id, option)}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                      deliveryPercentage === option 
                                        ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/20' 
                                        : 'text-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    {option}%
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

