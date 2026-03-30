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
  Download,
  Printer,
  MoreVertical,
  MessageCircle,
  Loader2,
  LayoutGrid,
  List,
  CheckCircle,
  XCircle,
  Trash2
} from 'lucide-react'
import { usePurchaseInvoices } from '../hooks/usePurchaseInvoices'
import { useUserApproval } from '../hooks/useUserApproval'
import { doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

export default function PesananPembelian() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { invoices, loading, error, refetch } = usePurchaseInvoices()
  const { role } = useUserApproval()
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInvoices, setSelectedInvoices] = useState([])
  const [processing, setProcessing] = useState(false)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  
  // Check if user can approve (only owner or manager)
  const canApproveInvoices = () => {
    return role === 'owner' || role === 'manager'
  }

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

  // Get status label for purchase invoices
  const getStatusLabel = (invoice) => {
    // Check explicit status first
    if (invoice.status) {
      if (invoice.status === 'approved' || invoice.status === 'disetujui') {
        const deliveryStatus = invoice.deliveryStatus || 0
        if (deliveryStatus === 100) return 'Selesai'
        if (deliveryStatus > 0) return 'Dikirim Sebagian'
        return 'Disetujui'
      }
      if (invoice.status === 'declined' || invoice.status === 'ditolak') return 'Ditolak'
      if (invoice.status === 'draft') return 'Draft'
    }
    
    // Default to draft
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
        return 'text-gray-600 dark:text-gray-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  // Filter invoices based on status and search
  const filteredInvoices = invoices.filter(invoice => {
    const status = getStatusLabel(invoice)
    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'draft' && status === 'Draft') ||
      (selectedStatus === 'approved' && (status === 'Disetujui' || status === 'Dikirim Sebagian')) ||
      (selectedStatus === 'partial' && status === 'Dikirim Sebagian') ||
      (selectedStatus === 'completed' && status === 'Selesai') ||
      (selectedStatus === 'declined' && status === 'Ditolak')
    
    const matchesSearch = !searchQuery || 
      invoice.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.reference?.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesStatus && matchesSearch
  })

  const toggleSelectInvoice = (invoiceId) => {
    setSelectedInvoices(prev => 
      prev.includes(invoiceId) 
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv.id))
    }
  }

  const handleBulkApprove = async () => {
    if (selectedInvoices.length === 0) {
      alert('Pilih setidaknya satu pesanan pembelian')
      return
    }

    // Only allow approving draft invoices
    const draftInvoices = filteredInvoices.filter(inv => 
      selectedInvoices.includes(inv.id) && inv.status === 'draft'
    )

    if (draftInvoices.length === 0) {
      alert('Tidak ada pesanan draft yang dipilih')
      return
    }

    try {
      setProcessing(true)
      
      for (const invoice of draftInvoices) {
        const invoiceRef = doc(db, 'purchaseInvoices', invoice.id)
        const invoiceSnap = await getDoc(invoiceRef)
        
        if (!invoiceSnap.exists()) continue
        
        const invoiceData = invoiceSnap.data()
        
        // Update invoice status
        await updateDoc(invoiceRef, {
          status: 'approved',
          approvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })

        // Account balance will be updated when payment is made, not when invoice is approved
        // This allows for partial payments and better cash flow tracking
      }

      alert(`${draftInvoices.length} pesanan pembelian telah disetujui`)
      setSelectedInvoices([])
      refetch()
    } catch (err) {
      console.error('Error approving invoices:', err)
      alert('Gagal menyetujui pesanan pembelian')
    } finally {
      setProcessing(false)
    }
  }

  const handleBulkReject = async () => {
    if (selectedInvoices.length === 0) {
      alert('Pilih setidaknya satu pesanan pembelian')
      return
    }

    if (!declineReason.trim()) {
      alert('Harap masukkan alasan penolakan')
      return
    }

    // Only allow rejecting draft invoices
    const draftInvoices = filteredInvoices.filter(inv => 
      selectedInvoices.includes(inv.id) && inv.status === 'draft'
    )

    if (draftInvoices.length === 0) {
      alert('Tidak ada pesanan draft yang dipilih')
      return
    }

    try {
      setProcessing(true)
      
      for (const invoice of draftInvoices) {
        const invoiceRef = doc(db, 'purchaseInvoices', invoice.id)
        await updateDoc(invoiceRef, {
          status: 'declined',
          declinedAt: new Date().toISOString(),
          declineReason: declineReason,
          updatedAt: new Date().toISOString()
        })
      }

      alert(`${draftInvoices.length} pesanan pembelian telah ditolak`)
      setSelectedInvoices([])
      setShowDeclineModal(false)
      setDeclineReason('')
      refetch()
    } catch (err) {
      console.error('Error rejecting invoices:', err)
      alert('Gagal menolak pesanan pembelian')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Memuat data pesanan pembelian...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Pesanan Pembelian
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate('/pembelian/invoice/add')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Tambah</span>
            <MoreVertical className="h-4 w-4" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Download className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">Import</span>
            <MoreVertical className="h-4 w-4 text-gray-400" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Printer className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">Print</span>
            <MoreVertical className="h-4 w-4 text-gray-400" />
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
            <LayoutGrid className="h-5 w-5 text-gray-600 dark:text-gray-400" />
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

      {/* Selection Bar - Show when invoices are selected and user is owner/manager */}
      {selectedInvoices.length > 0 && canApproveInvoices() && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                {selectedInvoices.length} pesanan dipilih
              </span>
              <span className="text-xs text-blue-700 dark:text-blue-400">
                (Hanya pesanan Draft yang dapat disetujui/ditolak)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkApprove}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {processing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
                <span>Setujui</span>
              </button>
              <button
                onClick={() => setShowDeclineModal(true)}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <XCircle className="h-5 w-5" />
                <span>Tolak</span>
              </button>
              <button
                onClick={() => setSelectedInvoices([])}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <span>Batal</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
          onClick={() => setSelectedStatus('approved')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'approved'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Disetujui
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
          onClick={() => setSelectedStatus('completed')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'completed'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Selesai
        </button>
        <button
          onClick={() => setSelectedStatus('declined')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'declined'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Ditolak
        </button>
        <button className="px-4 py-2 font-medium text-sm border-b-2 border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          Lainnya
          <MoreVertical className="inline h-4 w-4 ml-1" />
        </button>
      </div>

      {/* Invoice Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredInvoices.length === 0 ? (
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
                      checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
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
                {filteredInvoices.map((invoice) => {
                  const status = getStatusLabel(invoice)
                  return (
                    <tr 
                      key={invoice.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => navigate(`/pembelian/pesanan/${invoice.id}`)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedInvoices.includes(invoice.id)}
                          onChange={() => toggleSelectInvoice(invoice.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {invoice.number || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {invoice.vendor || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {invoice.reference || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={getStatusColor(status)}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {formatNumber(invoice.total || 0)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Tolak Pesanan Pembelian
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Harap masukkan alasan penolakan untuk {selectedInvoices.length} pesanan yang dipilih:
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white mb-4"
              rows={4}
              placeholder="Masukkan alasan penolakan..."
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleBulkReject}
                disabled={processing || !declineReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Memproses...' : 'Tolak'}
              </button>
              <button
                onClick={() => {
                  setShowDeclineModal(false)
                  setDeclineReason('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

