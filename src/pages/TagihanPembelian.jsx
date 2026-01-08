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
import { usePurchaseInvoices } from '../hooks/usePurchaseInvoices'
import { doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { updateAccountBalance } from '../utils/accountBalance'

export default function TagihanPembelian() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { invoices, loading, error, refetch } = usePurchaseInvoices()
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInvoices, setSelectedInvoices] = useState([])
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const paymentMenuRef = useRef(null)
  const buttonRefs = useRef({})

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

  // Close payment menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (paymentMenuRef.current && !paymentMenuRef.current.contains(event.target)) {
        // Check if click is not on any button
        const clickedButton = Object.values(buttonRefs.current).find(ref => 
          ref && ref.contains(event.target)
        )
        if (!clickedButton) {
          setPaymentMenuOpen(null)
        }
      }
    }

    if (paymentMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [paymentMenuOpen])

  // Get payment percentage based on remaining amount
  const getPaymentPercentage = (invoice) => {
    const remaining = invoice.remaining !== undefined ? invoice.remaining : (invoice.total || 0)
    const total = invoice.total || 0
    
    if (total === 0) return 0
    if (remaining === 0 || remaining < 0.01) return 100
    
    const paid = total - remaining
    return Math.round((paid / total) * 100)
  }

  // Get payment status label based on remaining amount
  const getPaymentStatusLabel = (invoice) => {
    const percentage = getPaymentPercentage(invoice)
    
    if (percentage === 100) return 'Sudah Lunas'
    if (percentage === 0) return 'Belum Dibayar'
    return `Sudah Dibayar ${percentage}%`
  }

  // Get status color
  const getStatusColor = (status) => {
    if (status === 'Sudah Lunas') {
      return 'text-green-600 dark:text-green-400'
    }
    if (status.includes('Sudah Dibayar')) {
      return 'text-yellow-600 dark:text-yellow-400'
    }
    if (status === 'Belum Dibayar') {
      return 'text-red-600 dark:text-red-400'
    }
    return 'text-gray-600 dark:text-gray-400'
  }

  // Handle payment status update
  const handlePaymentUpdate = async (invoiceId, newPercentage) => {
    try {
      const invoice = invoices.find(inv => inv.id === invoiceId)
      if (!invoice) return

      // Get current invoice data from Firestore to ensure we have latest data
      const invoiceRef = doc(db, 'purchaseInvoices', invoiceId)
      const invoiceSnap = await getDoc(invoiceRef)
      
      if (!invoiceSnap.exists()) {
        alert('Invoice tidak ditemukan')
        return
      }

      const invoiceData = invoiceSnap.data()
      const total = parseFloat(invoiceData.total) || 0
      const currentRemaining = parseFloat(invoiceData.remaining) !== undefined ? parseFloat(invoiceData.remaining) : total
      const currentPaidPercentage = total > 0 ? Math.round(((total - currentRemaining) / total) * 100) : 0
      
      // Calculate the difference in payment amount
      const newRemaining = total * (1 - newPercentage / 100)
      const paymentDifference = currentRemaining - newRemaining // Amount being paid now
      
      // Only update if there's a change
      if (Math.abs(paymentDifference) < 0.01) {
        setPaymentMenuOpen(null)
        return
      }

      // Update invoice remaining amount
      await updateDoc(invoiceRef, {
        remaining: newRemaining,
        paidPercentage: newPercentage, // Store payment percentage for tracking
        updatedAt: new Date().toISOString()
      })

      // Update account balance based on payment amount (deduct the payment difference)
      const accountId = invoiceData.accountId || invoiceData.account
      if (accountId && paymentDifference > 0) {
        await updateAccountBalance(accountId, -paymentDifference, {
          type: 'invoice_purchase_payment',
          transactionId: invoiceId,
          number: invoiceData.number,
          date: new Date().toISOString(),
          description: `Pembayaran Tagihan Pembelian ${invoiceData.number} (${newPercentage}%)`
        })
      }

      // Also update the transaction if it exists
      // This would require querying transactions collection, but for now just update invoice
      
      setPaymentMenuOpen(null)
      refetch()
      
      const statusText = newPercentage === 100 ? 'Sudah Lunas' : `Sudah Dibayar ${newPercentage}%`
      alert(`Status pembayaran diperbarui menjadi ${statusText}. Saldo akun dikurangi ${new Intl.NumberFormat('id-ID').format(paymentDifference)}.`)
    } catch (err) {
      console.error('Error updating payment status:', err)
      alert('Gagal memperbarui status pembayaran')
    }
  }

  const paymentOptions = [
    { label: 'Belum Dibayar', percentage: 0 },
    { label: 'Sudah Dibayar 25%', percentage: 25 },
    { label: 'Sudah Dibayar 50%', percentage: 50 },
    { label: 'Sudah Dibayar 75%', percentage: 75 },
    { label: 'Sudah Lunas', percentage: 100 }
  ]

  // Filter invoices based on payment status and search
  const filteredInvoices = invoices.filter(invoice => {
    const status = getPaymentStatusLabel(invoice)
    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'unpaid' && status === 'Belum Dibayar') ||
      (selectedStatus === 'partial' && status.includes('Sudah Dibayar') && status !== 'Sudah Lunas') ||
      (selectedStatus === 'paid' && status === 'Sudah Lunas')
    
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Memuat data tagihan pembelian...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Tagihan Pembelian
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
            onClick={() => navigate('/pembelian/invoice/add')}
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
          <div className="relative">
            <select className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
              <option>Tagihan Pembelian</option>
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
          onClick={() => setSelectedStatus('unpaid')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'unpaid'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Belum Dibayar
        </button>
        <button
          onClick={() => setSelectedStatus('partial')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'partial'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Dibayar Sebagian
        </button>
        <button
          onClick={() => setSelectedStatus('paid')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'paid'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Lunas
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
                    Tanggal
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
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInvoices.map((invoice) => {
                  const status = getPaymentStatusLabel(invoice)
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
                      <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400 font-medium">
                        {invoice.number || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {invoice.vendor || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {invoice.reference || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {formatDate(invoice.transactionDate || invoice.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ position: 'relative' }}>
                        <div className="relative inline-block">
                          <button
                            ref={(el) => buttonRefs.current[invoice.id] = el}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (paymentMenuOpen === invoice.id) {
                                setPaymentMenuOpen(null)
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setMenuPosition({
                                  top: rect.bottom + window.scrollY + 8,
                                  left: rect.right + window.scrollX - 200
                                })
                                setPaymentMenuOpen(invoice.id)
                              }
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}
                          >
                            {status}
                            <ChevronDown className="inline h-3 w-3 ml-1" />
                          </button>
                          {paymentMenuOpen === invoice.id && (
                            <div 
                              className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl" 
                              style={{ 
                                zIndex: 9999,
                                minWidth: '200px',
                                top: `${menuPosition.top}px`,
                                left: `${menuPosition.left}px`
                              }}
                              ref={paymentMenuRef}
                            >
                              <div className="py-1">
                                {paymentOptions.map((option) => {
                                  const currentPercentage = getPaymentPercentage(invoice)
                                  const isSelected = currentPercentage === option.percentage
                                  return (
                                    <button
                                      key={option.percentage}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handlePaymentUpdate(invoice.id, option.percentage)
                                      }}
                                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                        isSelected 
                                          ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/20' 
                                          : 'text-gray-700 dark:text-gray-300'
                                      }`}
                                    >
                                      {option.label}
                                    </button>
                                  )
                                })}
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

