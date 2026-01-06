import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useContactDetail } from '../hooks/useContactDetail'
import { useContactGroups } from '../hooks/useContactGroupsData'
import { useContactTransactions } from '../hooks/useContactTransactions'
import {
  ArrowLeft,
  Plus,
  Printer,
  MoreVertical,
  MessageCircle,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Building2,
  Filter,
  Search,
  ChevronUp,
  ChevronDown,
  Building,
  FileText,
  Tag,
  Receipt,
  ShoppingCart,
  ShoppingBag,
  CreditCard
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { contact, financialData, loading, error } = useContactDetail(id)
  const { groups } = useContactGroups()
  const { transactions, piutang, hutang, penjualan, loading: transactionsLoading } = useContactTransactions(id)
  const [searchQuery, setSearchQuery] = useState('')
  const [showTransactionDropdown, setShowTransactionDropdown] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowTransactionDropdown(false)
      }
    }

    if (showTransactionDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTransactionDropdown])

  // Format number to Indonesian format
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0'
    return new Intl.NumberFormat('id-ID').format(num)
  }

  // Get contact type color
  const getContactTypeColor = (type) => {
    switch (type) {
      case 'Vendor':
        return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'Pelanggan':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'Pegawai':
        return 'bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400'
      case 'Investor':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  // Get group name by ID
  const getGroupName = (groupId) => {
    if (!groupId) return ''
    const group = groups.find(g => g.id === groupId)
    return group ? group.name : ''
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

  // Filter transactions based on search
  const filteredTransactions = transactions.filter(trans => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      trans.transaction?.toLowerCase().includes(query) ||
      trans.description?.toLowerCase().includes(query) ||
      trans.reference?.toLowerCase().includes(query) ||
      trans.number?.toLowerCase().includes(query)
    )
  })

  const filteredPiutang = piutang.filter(trans => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      trans.transaction?.toLowerCase().includes(query) ||
      trans.reference?.toLowerCase().includes(query) ||
      trans.number?.toLowerCase().includes(query)
    )
  })

  const filteredHutang = hutang.filter(trans => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      trans.transaction?.toLowerCase().includes(query) ||
      trans.reference?.toLowerCase().includes(query) ||
      trans.number?.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Memuat data kontak...</p>
            </div>
          </main>
          <Footer />
        </div>
      </div>
    )
  }

  if (error || !contact) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Kontak tidak ditemukan'}</p>
              <button
                onClick={() => navigate('/kontak')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Kembali ke Daftar Kontak
              </button>
            </div>
          </main>
          <Footer />
        </div>
      </div>
    )
  }

  const netHutang = financialData.merekaHutang - financialData.andaHutang
  const netHutangCount = netHutang > 0 ? 1 : netHutang < 0 ? -1 : 0

  // Prepare chart data
  const chartData = financialData.keluarMasukUang.length > 0 
    ? financialData.keluarMasukUang 
    : [
        { month: 'Jul', masuk: 0, keluar: 0 },
        { month: 'Agu', masuk: 0, keluar: 0 },
        { month: 'Sep', masuk: 0, keluar: 0 },
        { month: 'Okt', masuk: 0, keluar: 0 },
        { month: 'Nov', masuk: 0, keluar: 0 },
        { month: 'Des', masuk: 0, keluar: 0 },
      ]

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                    {contact.name || 'N/A'}
                  </h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Contact Type Tags */}
                    {contact.types?.map((type, index) => (
                      <span
                        key={index}
                        className={`px-3 py-1 text-sm rounded-full ${getContactTypeColor(type)}`}
                      >
                        {type}
                      </span>
                    ))}
                    {/* Group */}
                    {contact.group && (
                      <span className="text-gray-600 dark:text-gray-400">
                        | Grup: {getGroupName(contact.group)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/kontak')}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Kembali
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setShowTransactionDropdown(!showTransactionDropdown)}
                        className="flex items-center gap-2 px-4 py-2 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 bg-white dark:bg-gray-800 transition-colors"
                      >
                        <Plus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-blue-600 dark:text-blue-400 font-medium">Tambah Transaksi</span>
                        <ChevronDown className={`h-4 w-4 text-blue-600 dark:text-blue-400 transition-transform ${showTransactionDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showTransactionDropdown && (
                        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                          <button
                            onClick={() => {
                              setShowTransactionDropdown(false)
                              navigate(`/kontak/debt/add?contactId=${id}`)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Building className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <span>Hutang</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowTransactionDropdown(false)
                              navigate(`/kontak/receivable/add?contactId=${id}`)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <span>Piutang</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowTransactionDropdown(false)
                              navigate(`/sales/invoice/add?contactId=${id}`)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Tag className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <span>Tambah Tagihan</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowTransactionDropdown(false)
                              // Navigate to add order page
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Tag className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <span>Tambah Pemesanan</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowTransactionDropdown(false)
                              // Navigate to add offer page
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Tag className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <span>Tambah Penawaran</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowTransactionDropdown(false)
                              navigate(`/pembelian/invoice/add?contactId=${id}`)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Tag className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <span>Tambah Tagihan Pembelian</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowTransactionDropdown(false)
                              // Navigate to add purchase order page
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Tag className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <span>Tambah Pesanan Pembelian</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowTransactionDropdown(false)
                              // Navigate to add purchase offer page
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Tag className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <span>Tambah Penawaran Pembelian</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowTransactionDropdown(false)
                              // Navigate to add expense page
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Tag className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <span>Tambah Biaya</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                      <Printer className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      <span className="text-gray-700 dark:text-gray-300">Print</span>
                    </button>
                    <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                      <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                        <span className="text-orange-600 dark:text-orange-400 font-bold text-lg">
                          {financialData.andaHutang > 0 ? 1 : 0}
                        </span>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatNumber(financialData.andaHutang)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Anda Hutang</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                        <span className="text-red-600 dark:text-red-400 font-bold text-lg">
                          {financialData.merekaHutang > 0 ? 1 : 0}
                        </span>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatNumber(financialData.merekaHutang)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Mereka Hutang</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                        <span className="text-orange-600 dark:text-orange-400 font-bold text-lg">
                          {financialData.pembayaranDiterima > 0 ? 1 : 0}
                        </span>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatNumber(financialData.pembayaranDiterima)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Pembayaran diterima</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        netHutangCount > 0 
                          ? 'bg-red-100 dark:bg-red-900/20' 
                          : netHutangCount < 0 
                          ? 'bg-green-100 dark:bg-green-900/20'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <span className={`font-bold text-lg ${
                          netHutangCount > 0 
                            ? 'text-red-600 dark:text-red-400' 
                            : netHutangCount < 0 
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {netHutangCount > 0 ? 1 : netHutangCount < 0 ? -1 : 0}
                        </span>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatNumber(netHutang)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Net Hutang</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Keluar Masuk Uang Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Keluar Masuk Uang
                  </h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="masuk" fill="#14b8a6" name="Uang Masuk" />
                      <Bar dataKey="keluar" fill="#eab308" name="Uang keluar" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right Column - Contact Details */}
              <div className="space-y-6">
                {/* Detil Kontak */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Detil Kontak
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Nama</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">
                        {contact.name || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Perusahaan</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">
                        {contact.company || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Email</label>
                      {contact.email ? (
                        <a 
                          href={`mailto:${contact.email}`}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1 flex items-center gap-1"
                        >
                          <Mail className="h-4 w-4" />
                          {contact.email}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">-</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Telepon</label>
                      {contact.phone ? (
                        <a 
                          href={`tel:${contact.phone}`}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1 flex items-center gap-1"
                        >
                          <Phone className="h-4 w-4" />
                          {contact.phone}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">-</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Alamat Penagihan</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">
                        {contact.billingAddress || contact.address || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pemetaan Akun */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Pemetaan Akun
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Akun Hutang</label>
                      <input
                        type="text"
                        value={contact.akunHutang || ''}
                        readOnly
                        className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                        placeholder="-"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Akun Piutang</label>
                      <input
                        type="text"
                        value={contact.akunPiutang || ''}
                        readOnly
                        className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                        placeholder="-"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Kena pajak</label>
                      <input
                        type="text"
                        value={contact.kenaPajak || ''}
                        readOnly
                        className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                        placeholder="-"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Penjualan Section */}
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Penjualan</h2>
                <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Penjualan Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={penjualan.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="penjualan" fill="#14b8a6" name="Penjualan" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Penjualan Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                        {penjualan.hutangAndaJatuhTempo > 0 ? 1 : 0}
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatNumber(penjualan.hutangAndaJatuhTempo)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Hutang Anda jatuh tempo</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/20 rounded-full flex items-center justify-center">
                      <span className="text-pink-600 dark:text-pink-400 font-bold text-lg">
                        {penjualan.hutangMerekaJatuhTempo > 0 ? 1 : 0}
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatNumber(penjualan.hutangMerekaJatuhTempo)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Hutang mereka jatuh tempo</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                      <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                        {penjualan.pembayaranDikirim > 0 ? 1 : 0}
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatNumber(penjualan.pembayaranDikirim)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Pembayaran dikirim</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Piutang menunggu pembayaran Section */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Piutang menunggu pembayaran</h2>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">Filter</span>
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Printer className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">Print</span>
                  </button>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tanggal
                          <ChevronUp className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Transaksi
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Referensi
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredPiutang.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            {transactionsLoading ? 'Memuat data...' : 'Data Transaksi Kosong'}
                          </td>
                        </tr>
                      ) : (
                        filteredPiutang.map((trans) => (
                          <tr key={trans.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3">
                              <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {formatDate(trans.date || trans.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
                                {trans.transaction || trans.type || `Tagihan Penjualan ${trans.number || ''}`}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {trans.reference || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {formatNumber(trans.total || 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Hutang yang perlu Anda bayar Section */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Hutang yang perlu Anda bayar</h2>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">Filter</span>
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Printer className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">Print</span>
                  </button>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tanggal
                          <ChevronUp className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Transaksi
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Referensi
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredHutang.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <div className="text-6xl mb-4">📁</div>
                              <p className="text-lg font-bold text-gray-900 dark:text-white">Data Transaksi Kosong</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredHutang.map((trans) => (
                          <tr key={trans.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3">
                              <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {formatDate(trans.date || trans.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
                                {trans.transaction || trans.type || `Tagihan Pembelian ${trans.number || ''}`}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {trans.reference || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {formatNumber(trans.total || 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Transaksi Section */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Transaksi</h2>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">Filter</span>
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Printer className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">Print</span>
                  </button>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tanggal
                          <ChevronUp className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Transaksi
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Keterangan
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            {transactionsLoading ? 'Memuat data...' : 'Tidak ada transaksi'}
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((trans) => (
                          <tr key={trans.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {formatDate(trans.date || trans.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
                                {trans.transaction || trans.type || trans.number || 'Transaksi'}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {trans.description || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {formatNumber(trans.total || 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>

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

