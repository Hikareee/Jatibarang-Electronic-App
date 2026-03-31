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
import { useProjects } from '../hooks/useProjectsData'
import { useContacts } from '../hooks/useContactsData'

export default function TagihanPembelian() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { invoices, loading, error, refetch } = usePurchaseInvoices()
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('all')
  const [selectedVendorId, setSelectedVendorId] = useState('all')
  const [selectedPenanggungId, setSelectedPenanggungId] = useState('all')
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [filterMenuPosition, setFilterMenuPosition] = useState({ top: 0, left: 0 })
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedInvoices, setSelectedInvoices] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: 'transactionDate', direction: 'desc' })
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const paymentMenuRef = useRef(null)
  const buttonRefs = useRef({})
  const filterMenuRef = useRef(null)
  const filterButtonRef = useRef(null)
  const { projects, loading: projectsLoading } = useProjects()
  const { contacts, loading: contactsLoading } = useContacts()
  const selectedProjectName =
    selectedProjectId === 'all'
      ? ''
      : projects.find((p) => p.id === selectedProjectId)?.name || ''
  const selectedVendorName =
    selectedVendorId === 'all'
      ? ''
      : contacts.find((c) => c.id === selectedVendorId)?.name ||
        contacts.find((c) => c.id === selectedVendorId)?.company ||
        ''
  const selectedPenanggungName =
    selectedPenanggungId === 'all'
      ? ''
      : contacts.find((c) => c.id === selectedPenanggungId)?.name ||
        contacts.find((c) => c.id === selectedPenanggungId)?.company ||
        ''

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

  const toCsvValue = (value) => {
    if (value === null || value === undefined) return ''
    const s = String(value)
    return `"${s.replace(/"/g, '""')}"`
  }

  const downloadCsv = (filename, headers, rows) => {
    const headerLine = headers.map(toCsvValue).join(',')
    const lines = rows.map((r) => r.map(toCsvValue).join(','))
    const csv = [headerLine, ...lines].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const getInvoiceDate = (invoice) => {
    const raw = invoice?.transactionDate || invoice?.createdAt
    if (!raw) return null
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d
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

  // Close filter menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (!filterMenuOpen) return
      if (filterMenuRef.current && filterMenuRef.current.contains(event.target)) return
      if (filterButtonRef.current && filterButtonRef.current.contains(event.target)) return
      setFilterMenuOpen(false)
    }

    if (filterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [filterMenuOpen])

  // Get payment percentage based on remaining amount
  const getPaymentPercentage = (invoice) => {
    if (invoice?.paymentStatus === 'reimburse') return 100
    const remaining = invoice.remaining !== undefined ? invoice.remaining : (invoice.total || 0)
    const total = invoice.total || 0
    
    if (total === 0) return 0
    if (remaining === 0 || remaining < 0.01) return 100
    
    const paid = total - remaining
    return Math.round((paid / total) * 100)
  }

  // Get payment status label based on remaining amount
  const getPaymentStatusLabel = (invoice) => {
    if (invoice?.paymentStatus === 'reimburse') return 'Reimburse'
    const percentage = getPaymentPercentage(invoice)
    
    if (percentage === 100) return 'Sudah Lunas'
    if (percentage === 0) return 'Belum Dibayar'
    return `Sudah Dibayar ${percentage}%`
  }

  // Get status color
  const getStatusColor = (status) => {
    if (status === 'Reimburse') {
      return 'text-blue-600 dark:text-blue-400'
    }
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
      const isReimburse = newPercentage === 'reimburse'
      const newRemaining = isReimburse ? 0 : total * (1 - Number(newPercentage || 0) / 100)
      const paymentDifference = currentRemaining - newRemaining // Amount being paid now
      const nextPaymentStatus = isReimburse ? 'reimburse' : ''
      const paymentStatusChanged = (invoiceData.paymentStatus || '') !== nextPaymentStatus
      
      // Only update if there's a change
      if (Math.abs(paymentDifference) < 0.01 && !paymentStatusChanged) {
        setPaymentMenuOpen(null)
        return
      }

      // Update invoice remaining amount
      await updateDoc(invoiceRef, {
        remaining: newRemaining,
        paidPercentage: isReimburse ? 100 : Number(newPercentage || 0), // Store payment percentage for tracking
        paymentStatus: nextPaymentStatus,
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
      
      const statusText = isReimburse
        ? 'Reimburse'
        : newPercentage === 100
          ? 'Sudah Lunas'
          : `Sudah Dibayar ${newPercentage}%`
      alert(`Status pembayaran diperbarui menjadi ${statusText}. Saldo akun dikurangi ${new Intl.NumberFormat('id-ID').format(paymentDifference)}.`)
    } catch (err) {
      console.error('Error updating payment status:', err)
      alert('Gagal memperbarui status pembayaran')
    }
  }

  const paymentOptions = [
    { label: 'Belum Dibayar', percentage: 0 },
    { label: 'Reimburse', percentage: 'reimburse' },
    { label: 'Sudah Dibayar 25%', percentage: 25 },
    { label: 'Sudah Dibayar 50%', percentage: 50 },
    { label: 'Sudah Dibayar 75%', percentage: 75 },
    { label: 'Sudah Lunas', percentage: 100 },
  ]

  const sortInvoices = (rows, config) => {
    if (!config?.key) return rows
    const dir = config.direction === 'asc' ? 1 : -1
    const toLower = (v) => String(v || '').toLowerCase()
    const toDate = (v) => {
      if (!v) return 0
      const d = new Date(v)
      return Number.isNaN(d.getTime()) ? 0 : d.getTime()
    }
    const getSortable = (inv) => {
      switch (config.key) {
        case 'number':
          return toLower(inv.number)
        case 'vendor':
          return toLower(inv.vendor)
        case 'reference':
          return toLower(inv.reference)
        case 'transactionDate':
          return toDate(inv.transactionDate || inv.createdAt)
        case 'dueDate':
          return toDate(inv.dueDate)
        case 'createdByName':
          return toLower(inv.createdByName)
        case 'penanggungJawab':
          return toLower(inv.penanggungJawab)
        case 'total':
          return Number(inv.total) || 0
        case 'status':
          return toLower(getPaymentStatusLabel(inv))
        default:
          return 0
      }
    }
    return [...rows].sort((a, b) => {
      const av = getSortable(a)
      const bv = getSortable(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  // Filter invoices based on payment status, search, and filters
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

    const invDate = getInvoiceDate(invoice)
    const fromOk = !dateFrom || (invDate && invDate >= new Date(`${dateFrom}T00:00:00`))
    const toOk = !dateTo || (invDate && invDate <= new Date(`${dateTo}T23:59:59.999`))

    const matchesProject =
      selectedProjectId === 'all' ||
      invoice.projectId === selectedProjectId ||
      (selectedProjectName && invoice.projectName === selectedProjectName)

    const matchesVendor =
      selectedVendorId === 'all' ||
      invoice.vendorId === selectedVendorId ||
      invoice.vendor === selectedVendorName

    const matchesPenanggung =
      selectedPenanggungId === 'all' ||
      invoice.penanggungJawabId === selectedPenanggungId ||
      invoice.penanggungJawab === selectedPenanggungName

    return matchesStatus && matchesSearch && matchesProject && matchesVendor && matchesPenanggung && fromOk && toOk
  })

  const sortedInvoices = sortInvoices(filteredInvoices, sortConfig)

  const handleExportFilteredCsv = () => {
    const headers = [
      'ID',
      'Nomor',
      'Vendor',
      'Referensi',
      'Tanggal',
      'Tgl Jatuh Tempo',
      'Diusulkan Oleh',
      'Penanggung jawab',
      'Total',
      'Remaining',
      'Status Pembayaran',
    ]
    const rows = filteredInvoices.map((inv) => {
      const status = getPaymentStatusLabel(inv)
      return [
        inv.id || '',
        inv.number || '',
        inv.vendorName || inv.vendor || '',
        inv.reference || '',
        formatDate(inv.transactionDate || inv.createdAt) || '',
        formatDate(inv.dueDate) || '',
        inv.createdByName || '',
        inv.penanggungJawab || '',
        Number(inv.total || 0),
        Number(inv.remaining !== undefined ? inv.remaining : (inv.total || 0)),
        status,
      ]
    })
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`tagihan-pembelian-${stamp}.csv`, headers, rows)
  }


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
          {t('purchaseInvoices')}
        </h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <BarChart3 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">{t('report')}</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <HelpCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">{t('guide')}</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
          <button 
            onClick={() => navigate('/pembelian/invoice/add')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>{t('add')}</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Upload className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">{t('import')}</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Printer className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">{t('print')}</span>
          </button>
          <button
            onClick={handleExportFilteredCsv}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">Export CSV</span>
          </button>
          <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            ref={filterButtonRef}
            type="button"
            onClick={(e) => {
              if (filterMenuOpen) {
                setFilterMenuOpen(false)
                return
              }
              const rect = e.currentTarget.getBoundingClientRect()
              setFilterMenuPosition({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX,
              })
              setFilterMenuOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">{t('filter')}</span>
          </button>
          <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="relative">
            <select className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900">
              <option>{t('purchaseInvoices')}</option>
            </select>
            <FileText className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              />
              <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">→</span>
            <div className="relative">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              />
              <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {filterMenuOpen && (
        <div
          ref={filterMenuRef}
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4"
          style={{
            zIndex: 9999,
            minWidth: '320px',
            top: `${filterMenuPosition.top}px`,
            left: `${filterMenuPosition.left}px`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">Filter</div>
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId('all')
                setSelectedVendorId('all')
                setSelectedPenanggungId('all')
                setFilterMenuOpen(false)
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Reset
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
              Proyek
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={projectsLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-60"
            >
              <option value="all">Semua Proyek</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} — ` : ''}
                  {p.name || p.id}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
              Vendor
            </label>
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              disabled={contactsLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-60"
            >
              <option value="all">Semua Vendor</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.company || c.email || c.id}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
              Penanggung jawab
            </label>
            <select
              value={selectedPenanggungId}
              onChange={(e) => setSelectedPenanggungId(e.target.value)}
              disabled={contactsLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-60"
            >
              <option value="all">Semua Penanggung jawab</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.company || c.email || c.id}
                </option>
              ))}
            </select>
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
          {t('all')}
        </button>
        <button
          onClick={() => setSelectedStatus('unpaid')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'unpaid'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {t('unpaid')}
        </button>
        <button
          onClick={() => setSelectedStatus('partial')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'partial'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {t('partiallyPaid')}
        </button>
        <button
          onClick={() => setSelectedStatus('paid')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedStatus === 'paid'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {t('paid')}
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
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('emptyData')}</p>
              <p className="text-gray-500 dark:text-gray-400 mb-4">{t('startCreating')}</p>
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
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('number')}
                  >
                    Nomor <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('vendor')}
                  >
                    Vendor
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('reference')}
                  >
                    Referensi
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('transactionDate')}
                  >
                    Tanggal
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('dueDate')}
                  >
                    Tgl. Jatuh Tempo
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('createdByName')}
                  >
                    {t('proposedBy')}
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('penanggungJawab')}
                  >
                    Penanggung jawab
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('total')}
                  >
                    TOTAL
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('status')}
                  >
                    Status
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedInvoices.map((invoice) => {
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
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {invoice.createdByName || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {invoice.penanggungJawab || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right font-medium">
                        {formatNumber(invoice.total || 0)}
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
                                  const isReimburse = invoice?.paymentStatus === 'reimburse'
                                  const isSelected =
                                    option.percentage === 'reimburse'
                                      ? isReimburse
                                      : !isReimburse && currentPercentage === option.percentage
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
    </div>
  )
}

