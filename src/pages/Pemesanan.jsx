import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { useSalesOrders, createInvoiceFromOrder } from '../hooks/useSalesOrdersData'
import { useUserApproval } from '../hooks/useUserApproval'

export default function Pemesanan() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { orders, loading, error, updateOrderStatus } = useSalesOrders()
  const { role } = useUserApproval()
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrders, setSelectedOrders] = useState([])

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
  const getStatusLabel = (order) => {
    const status = order.status || 'draft'
    const deliveryStatus = order.deliveryStatus || 0
    
    if (status === 'approved' || status === 'disetujui') {
      if (deliveryStatus === 100) return 'Selesai'
      if (deliveryStatus > 0) return 'Dikirim Sebagian'
      return 'Disetujui'
    }
    
    if (status === 'declined' || status === 'ditolak') return 'Ditolak'
    return 'Draft'
  }

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Selesai':
        return 'text-green-600 dark:text-green-400'
      case 'Dikirim Sebagian':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'Disetujui':
        return 'text-blue-600 dark:text-blue-400'
      case 'Ditolak':
        return 'text-red-600 dark:text-red-400'
      case 'Draft':
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  // Filter orders based on status and search
  const filteredOrders = orders.filter(order => {
    const status = getStatusLabel(order)
    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'open' && (status === 'Draft' || status === 'Disetujui')) ||
      (selectedStatus === 'partial' && status === 'Dikirim Sebagian') ||
      (selectedStatus === 'selesai' && status === 'Selesai')
    
    const matchesSearch = !searchQuery || 
      order.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.reference?.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesStatus && matchesSearch
  })

  const toggleSelectOrder = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(filteredOrders.map(order => order.id))
    }
  }

  const handleCreateInvoice = async (orderId) => {
    try {
      const invoiceId = await createInvoiceFromOrder(orderId)
      alert('Tagihan berhasil dibuat dari pesanan')
      navigate(`/penjualan/tagihan/${invoiceId}`)
    } catch (err) {
      console.error('Error creating invoice:', err)
      alert('Gagal membuat tagihan dari pesanan')
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Memuat data pemesanan...</p>
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
              Beranda &gt; Penjualan &gt; Pemesanan
            </div>

            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Pemesanan
              </h1>
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
                <button 
                  onClick={() => navigate('/penjualan/pemesanan/tambah')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
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
                <div className="relative">
                  <select className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
                    <option>Pemesanan</option>
                  </select>
                  <FileText className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
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
                onClick={() => setSelectedStatus('partial')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  selectedStatus === 'partial'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Dikirim Sebagian
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
              <button className="px-4 py-2 font-medium text-sm border-b-2 border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                Lainnya
                <ChevronDown className="inline h-4 w-4 ml-1" />
              </button>
            </div>

            {/* Orders Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              {filteredOrders.length === 0 ? (
                <div className="p-12 text-center">
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
                            checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
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
                          DP
                          <MoreVertical className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Total
                          <MoreVertical className="inline h-3 w-3 ml-1" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredOrders.map((order) => {
                        const status = getStatusLabel(order)
                        const downPayment = order.downPayments?.reduce((sum, dp) => sum + (dp.value || 0), 0) || 0
                        return (
                          <tr 
                            key={order.id} 
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => navigate(`/penjualan/pemesanan/${order.id}`)}
                          >
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedOrders.includes(order.id)}
                                onChange={() => toggleSelectOrder(order.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {order.number || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {order.customer || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {order.reference || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {order.dueDate ? formatDate(order.dueDate) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={getStatusColor(status)}>
                                {status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {formatNumber(downPayment)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                              {formatNumber(order.total || 0)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Chat Bubble */}
            <div className="fixed bottom-6 right-6 z-50">
              <button className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg flex items-center gap-3 transition-colors">
                <MessageCircle className="h-6 w-6" />
                <span className="text-sm font-medium">Halo, ada yang bisa saya bantu?</span>
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}

