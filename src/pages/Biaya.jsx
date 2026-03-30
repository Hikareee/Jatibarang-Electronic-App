import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { updateAccountBalance } from '../utils/accountBalance'
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
  ChevronDown,
  Image
} from 'lucide-react'
import { useExpenses } from '../hooks/useExpensesData'

export default function Biaya() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { expenses, loading, error, refetch } = useExpenses()
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExpenses, setSelectedExpenses] = useState([])
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const paymentMenuRef = useRef(null)
  const buttonRefs = useRef({})

  const paymentOptions = [
    { label: 'Belum Dibayar', percentage: 0 },
    { label: 'Sudah Dibayar 25%', percentage: 25 },
    { label: 'Sudah Dibayar 50%', percentage: 50 },
    { label: 'Sudah Dibayar 75%', percentage: 75 },
    { label: 'Sudah Lunas', percentage: 100 },
  ]

  useEffect(() => {
    function handleClickOutside(event) {
      if (paymentMenuRef.current && !paymentMenuRef.current.contains(event.target)) {
        const clickedButton = Object.values(buttonRefs.current).find(
          (ref) => ref && ref.contains(event.target)
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

  const formatAccountabilitySummary = (expense) => {
    const a = (expense.accountablePerson || '').trim()
    const c = (expense.accountabilityChain || '').trim()
    if (a && c) return `${a} · ${c}`
    if (a) return a
    if (c) return c
    return '-'
  }

  // Get status label
  const getStatusLabel = (expense) => {
    const remaining = expense.remaining !== undefined ? expense.remaining : (expense.total || 0)
    const total = expense.total || 0
    
    if (remaining === 0 || remaining < 0.01) return 'Lunas'
    if (remaining < total) return 'Dibayar Sebagian'
    return 'Belum Dibayar'
  }

  const getPaymentPercentage = (expense) => {
    const remaining = expense.remaining !== undefined ? expense.remaining : expense.total || 0
    const total = expense.total || 0
    if (total === 0) return 0
    if (remaining <= 0.01) return 100
    const paid = total - remaining
    return Math.round((paid / total) * 100)
  }

  const getExpensePaymentStatusLabel = (expense) => {
    const percentage = getPaymentPercentage(expense)
    if (percentage === 100) return 'Sudah Lunas'
    if (percentage === 0) return 'Belum Dibayar'
    return `Sudah Dibayar ${percentage}%`
  }

  const getPaymentStatusButtonClass = (label) => {
    if (label === 'Sudah Lunas') {
      return 'text-green-600 dark:text-green-400'
    }
    if (label.includes('Sudah Dibayar')) {
      return 'text-yellow-600 dark:text-yellow-400'
    }
    if (label === 'Belum Dibayar') {
      return 'text-red-600 dark:text-red-400'
    }
    return 'text-gray-600 dark:text-gray-400'
  }

  const handleExpensePaymentUpdate = async (expenseId, newPercentage) => {
    try {
      const expenseRef = doc(db, 'expenses', expenseId)
      const expenseSnap = await getDoc(expenseRef)

      if (!expenseSnap.exists()) {
        alert('Biaya tidak ditemukan')
        return
      }

      const expenseData = expenseSnap.data()
      const total = parseFloat(expenseData.total) || 0
      const rawRem = expenseData.remaining
      const currentRemaining =
        rawRem !== undefined && rawRem !== null && !Number.isNaN(Number(rawRem))
          ? parseFloat(rawRem)
          : total
      const newRemaining = total * (1 - newPercentage / 100)
      const paymentDifference = currentRemaining - newRemaining

      if (Math.abs(paymentDifference) < 0.01) {
        setPaymentMenuOpen(null)
        return
      }

      await updateDoc(expenseRef, {
        remaining: newRemaining,
        paidPercentage: newPercentage,
        paid: newRemaining < 0.01,
        updatedAt: new Date().toISOString(),
      })

      const accountId = expenseData.accountId || expenseData.account
      if (accountId && paymentDifference > 0) {
        await updateAccountBalance(accountId, -paymentDifference, {
          type: 'expense_payment',
          transactionId: expenseId,
          number: expenseData.number,
          date: new Date().toISOString(),
          description: `Pembayaran biaya ${expenseData.number || expenseId} (${newPercentage}%)`,
        })
      }

      setPaymentMenuOpen(null)
      refetch()

      const statusText =
        newPercentage === 100 ? 'Sudah Lunas' : `Sudah Dibayar ${newPercentage}%`
      alert(
        `Status pembayaran diperbarui menjadi ${newPercentage === 0 ? 'Belum Dibayar' : statusText}.` +
          (paymentDifference > 0
            ? ` Saldo akun dikurangi ${new Intl.NumberFormat('id-ID').format(paymentDifference)}.`
            : '')
      )
    } catch (err) {
      console.error('Error updating expense payment:', err)
      alert('Gagal memperbarui status pembayaran')
    }
  }

  // Calculate summary statistics
  const calculateSummary = () => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let bulanIni = 0
    let hariLalu = 0
    let belumDibayar = 0
    let belumDibayarTotal = 0
    let jatuhTempo = 0
    let jatuhTempoTotal = 0

    expenses.forEach(expense => {
      const expenseDate = expense.date ? new Date(expense.date) : (expense.createdAt ? new Date(expense.createdAt) : null)
      const remaining = expense.remaining !== undefined ? expense.remaining : (expense.total || 0)
      const total = expense.total || 0

      // Bulan Ini
      if (expenseDate && expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear) {
        bulanIni++
      }

      // 30 Hari Lalu
      if (expenseDate && expenseDate >= thirtyDaysAgo && expenseDate <= now) {
        hariLalu++
      }

      // Belum Dibayar
      if (remaining > 0.01) {
        belumDibayar++
        belumDibayarTotal += remaining
      }

      // Jatuh Tempo (expenses with due date that are unpaid)
      if (expense.dueDate) {
        const dueDate = new Date(expense.dueDate)
        if (dueDate <= now && remaining > 0.01) {
          jatuhTempo++
          jatuhTempoTotal += remaining
        }
      }
    })

    return {
      bulanIni,
      hariLalu,
      belumDibayar,
      belumDibayarTotal,
      jatuhTempo,
      jatuhTempoTotal
    }
  }

  // Filter expenses based on status and search
  const filteredExpenses = expenses.filter(expense => {
    const status = getStatusLabel(expense)
    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'unpaid' && status === 'Belum Dibayar') ||
      (selectedStatus === 'partial' && status === 'Dibayar Sebagian') ||
      (selectedStatus === 'paid' && status === 'Lunas')
    
    const matchesSearch = !searchQuery || 
      expense.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.recipient?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.accountablePerson?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.accountabilityChain?.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesStatus && matchesSearch
  })

  const toggleSelectExpense = (expenseId) => {
    setSelectedExpenses(prev => 
      prev.includes(expenseId) 
        ? prev.filter(id => id !== expenseId)
        : [...prev, expenseId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedExpenses.length === filteredExpenses.length) {
      setSelectedExpenses([])
    } else {
      setSelectedExpenses(filteredExpenses.map(exp => exp.id))
    }
  }

  const summary = calculateSummary()

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Memuat data biaya...</p>
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
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Biaya
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
            onClick={() => navigate('/biaya/tambah')}
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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Bulan Ini</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.bulanIni}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">📅</span>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">30 Hari Lalu</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.hariLalu}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Belum Dibayar</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{summary.belumDibayar}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{formatNumber(summary.belumDibayarTotal)}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Jatuh Tempo</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{summary.jatuhTempo}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{formatNumber(summary.jatuhTempoTotal)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">⏰</span>
            </div>
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
          <ChevronDown className="inline h-4 w-4 ml-1" />
        </button>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="text-6xl mb-4">📁</div>
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">Data Kosong</p>
              <p className="text-gray-500 dark:text-gray-400 mb-4">Belum ada data biaya</p>
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
                      checked={selectedExpenses.length === filteredExpenses.length && filteredExpenses.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tanggal
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Nomor
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Title
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Proyek
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Referensi
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Penerima (vendor)
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Penanggung jawab
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Sisa Tagihan
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                    <MoreVertical className="inline h-3 w-3 ml-1" />
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredExpenses.map((expense) => {
                  const paymentLabel = getExpensePaymentStatusLabel(expense)
                  return (
                    <tr 
                      key={expense.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => navigate(`/biaya/${expense.id}`)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedExpenses.includes(expense.id)}
                          onChange={() => toggleSelectExpense(expense.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {formatDate(expense.date || expense.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400 font-medium">
                        {expense.number || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {expense.title || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {expense.projectName || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {expense.reference || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {expense.recipient || 'N/A'}
                      </td>
                      <td
                        className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-[14rem] truncate"
                        title={formatAccountabilitySummary(expense)}
                      >
                        {formatAccountabilitySummary(expense)}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ position: 'relative' }}>
                        <div className="relative inline-block">
                          <button
                            ref={(el) => {
                              buttonRefs.current[expense.id] = el
                            }}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (paymentMenuOpen === expense.id) {
                                setPaymentMenuOpen(null)
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setMenuPosition({
                                  top: rect.bottom + window.scrollY + 8,
                                  left: rect.right + window.scrollX - 200,
                                })
                                setPaymentMenuOpen(expense.id)
                              }
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-medium border border-transparent hover:border-gray-300 dark:hover:border-gray-600 ${getPaymentStatusButtonClass(paymentLabel)}`}
                          >
                            {paymentLabel}
                            <ChevronDown className="inline h-3 w-3 ml-1" />
                          </button>
                          {paymentMenuOpen === expense.id && (
                            <div
                              className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
                              style={{
                                zIndex: 9999,
                                minWidth: '200px',
                                top: `${menuPosition.top}px`,
                                left: `${menuPosition.left}px`,
                              }}
                              ref={paymentMenuRef}
                            >
                              <div className="py-1">
                                {paymentOptions.map((option) => {
                                  const currentPercentage = getPaymentPercentage(expense)
                                  const isSelected = currentPercentage === option.percentage
                                  return (
                                    <button
                                      key={option.percentage}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleExpensePaymentUpdate(expense.id, option.percentage)
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
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {formatNumber(expense.remaining !== undefined ? expense.remaining : (expense.total || 0))}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                        {formatNumber(expense.total || 0)}
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
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}
