import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { 
  ChevronLeft, 
  Edit,
  Save,
  X,
  Loader2,
  MessageCircle,
  Plus,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Printer,
  MoreVertical
} from 'lucide-react'
import { useAccountDetail } from '../hooks/useAccountDetail'
import { useUserApproval } from '../hooks/useUserApproval'
import { useAuth } from '../contexts/AuthContext'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import FormattedNumberInput from '../components/FormattedNumberInput'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'

export default function AccountDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { account, balanceHistory, transactions, accountLogs, loading, error, updateBalance, updateAccount, addTransaction } = useAccountDetail(id)
  const { role } = useUserApproval()
  const { currentUser } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isEditingAccount, setIsEditingAccount] = useState(false)
  const [isEditingBalance, setIsEditingBalance] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showTransactionDropdown, setShowTransactionDropdown] = useState(false)
  const dropdownRef = useRef(null)

  // Edit account form state
  const [editAccountData, setEditAccountData] = useState({
    name: '',
    code: '',
    category: '',
    subAccountOf: '',
    newBalance: '' // optional: set new balance while editing akun
  })
  const [editBalance, setEditBalance] = useState('')
  const [editReason, setEditReason] = useState('')
  
  // Transaction form state
  const [transactionData, setTransactionData] = useState({
    type: 'debit', // debit or credit
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    number: '',
    reference: ''
  })

  const [saving, setSaving] = useState(false)

  // Check if user can edit (only admin or owner)
  const canEdit = role === 'admin' || role === 'owner'

  // Get user info for logging
  const getUserInfo = async () => {
    if (!currentUser) return { userId: '', userName: '' }
    try {
      const userRef = doc(db, 'users', currentUser.uid)
      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) {
        const userData = userSnap.data()
        return {
          userId: currentUser.uid,
          userName: userData.name || userData.email || 'Unknown User'
        }
      }
      return {
        userId: currentUser.uid,
        userName: currentUser.email || 'Unknown User'
      }
    } catch (err) {
      console.warn('Error fetching user info:', err)
      return {
        userId: currentUser.uid,
        userName: currentUser.email || 'Unknown User'
      }
    }
  }

  // Initialize edit form when account loads
  useEffect(() => {
    if (account && !isEditingAccount) {
      setEditAccountData({
        name: account.name || '',
        code: account.code || '',
        category: account.category || '',
        subAccountOf: account.subAccountOf || '',
        newBalance: ''
      })
    }
  }, [account, isEditingAccount])

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

  // Format date to DD/MM/YYYY HH:MM
  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  }

  // Format date to DD/MM/YYYY
  const formatDateShort = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Prepare chart data from balance history
  const chartData = balanceHistory.map((entry, index) => ({
    date: formatDateShort(entry.createdAt || entry.date),
    balance: parseFloat(entry.newBalance) || 0,
    change: parseFloat(entry.change) || 0,
    index: index
  }))

  // Add current balance to chart if no history
  if (chartData.length === 0 && account) {
    chartData.push({
      date: 'Sekarang',
      balance: parseFloat(account.saldo) || 0,
      change: 0,
      index: 0
    })
  }

  // Filter transactions
  const filteredTransactions = transactions.filter(trans => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      trans.number?.toLowerCase().includes(query) ||
      trans.description?.toLowerCase().includes(query) ||
      trans.reference?.toLowerCase().includes(query) ||
      trans.type?.toLowerCase().includes(query)
    )
  })

  // Filter logs
  const filteredLogs = accountLogs.filter(log => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      log.description?.toLowerCase().includes(query) ||
      log.userName?.toLowerCase().includes(query) ||
      log.type?.toLowerCase().includes(query)
    )
  })

  const handleEditAccountClick = () => {
    if (account) {
      setIsEditingAccount(true)
    }
  }

  const handleCancelEditAccount = () => {
    setIsEditingAccount(false)
    if (account) {
      setEditAccountData({
        name: account.name || '',
        code: account.code || '',
        category: account.category || '',
        subAccountOf: account.subAccountOf || '',
        newBalance: ''
      })
    }
  }

  const handleSaveAccount = async () => {
    if (!account) return

    try {
      setSaving(true)
      const userInfo = await getUserInfo()
      await updateAccount(editAccountData, userInfo.userId, userInfo.userName, editReason || 'Account details updated')

      // If optional new balance is provided, update balance too
      if (editAccountData.newBalance !== '' && !isNaN(parseFloat(editAccountData.newBalance))) {
        await updateBalance(
          parseFloat(editAccountData.newBalance) || 0,
          editReason || 'Manual balance adjustment',
          userInfo.userId,
          userInfo.userName
        )
      }

      setIsEditingAccount(false)
      setEditReason('')
      setEditAccountData(prev => ({ ...prev, newBalance: '' }))
      alert('Account updated successfully')
    } catch (err) {
      console.error('Error updating account:', err)
      alert('Failed to update account: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEditBalanceClick = () => {
    if (account) {
      setEditBalance(account.saldo?.toString() || '0')
      setEditReason('')
      setIsEditingBalance(true)
    }
  }

  const handleCancelEditBalance = () => {
    setIsEditingBalance(false)
    setEditBalance('')
    setEditReason('')
  }

  const handleSaveBalance = async () => {
    if (!account) return

    const newBalance = parseFloat(editBalance) || 0
    if (isNaN(newBalance)) {
      alert('Please enter a valid number')
      return
    }

    try {
      setSaving(true)
      const userInfo = await getUserInfo()
      await updateBalance(newBalance, editReason || 'Manual balance adjustment', userInfo.userId, userInfo.userName)
      setIsEditingBalance(false)
      setEditBalance('')
      setEditReason('')
      alert('Balance updated successfully')
    } catch (err) {
      console.error('Error updating balance:', err)
      alert('Failed to update balance: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddTransaction = async () => {
    if (!account) return

    if (!transactionData.amount || !transactionData.date) {
      alert('Amount and date are required')
      return
    }

    try {
      setSaving(true)
      const userInfo = await getUserInfo()
      
      // Convert amount based on type (debit decreases, credit increases)
      const amount = parseFloat(transactionData.amount) || 0
      const finalAmount = transactionData.type === 'debit' ? -amount : amount

      await addTransaction({
        ...transactionData,
        amount: finalAmount,
        type: transactionData.type === 'debit' ? 'debit' : 'credit'
      }, userInfo.userId, userInfo.userName)

      setShowTransactionModal(false)
      setTransactionData({
        type: 'debit',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        number: '',
        reference: ''
      })
      alert('Transaction added successfully')
    } catch (err) {
      console.error('Error adding transaction:', err)
      alert('Failed to add transaction: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Loading account details...</p>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <p className="text-red-800 dark:text-red-200">{error || 'Account not found'}</p>
                <button
                  onClick={() => navigate(-1)}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Go Back
                </button>
              </div>
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
            <div className="mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                    {account.name || account.code || 'Account'}
                  </h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    {account.code && (
                      <span className="px-3 py-1 text-sm rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {account.code}
                      </span>
                    )}
                    {account.category && (
                      <span className="px-3 py-1 text-sm rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                        {account.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/akun')}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Kembali
                  </button>
                  {canEdit && (
                    <>
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
                                setShowTransactionModal(true)
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <Plus className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                              <span>Transaksi Manual</span>
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleEditAccountClick}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Edit className="h-5 w-5" />
                        <span>Edit Akun</span>
                      </button>
                    </>
                  )}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                          {account.saldo >= 0 ? '✓' : '!'}
                        </span>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatNumber(account.saldo || 0)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Saldo</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                        <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                          {transactions.length}
                        </span>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {transactions.length}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Transaksi</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balance Movement Graph */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Perubahan Saldo
                  </h2>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartData.length > 0 ? (
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#6B7280"
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis 
                            stroke="#6B7280"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => formatNumber(value)}
                          />
                          <Tooltip 
                            formatter={(value) => formatNumber(value)}
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px'
                            }}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="balance" 
                            stroke="#3B82F6" 
                            strokeWidth={2}
                            name="Saldo"
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                          No balance history available
                        </div>
                      )}
                    </ResponsiveContainer>
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
                          className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
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
                          {filteredTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                Data Transaksi Kosong
                              </td>
                            </tr>
                          ) : (
                            filteredTransactions.map((trans) => (
                              <tr key={trans.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-4 py-3">
                                  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                  {formatDateShort(trans.date || trans.createdAt)}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className="text-blue-600 dark:text-blue-400">
                                    {trans.type === 'debit' ? 'Debit' : trans.type === 'credit' ? 'Kredit' : trans.type || 'Transaksi'} {trans.number || ''}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                  {trans.reference || '-'}
                                </td>
                                <td className={`px-4 py-3 text-sm font-semibold ${
                                  (trans.amount || 0) >= 0 
                                    ? 'text-green-600 dark:text-green-400' 
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {(trans.amount || 0) >= 0 ? '+' : ''}{formatNumber(trans.amount || 0)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Logs Section */}
                {filteredLogs.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Riwayat Perubahan</h2>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Tanggal
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Tipe
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Oleh
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Keterangan
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                  {formatDate(log.createdAt)}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`px-2 py-1 text-xs rounded ${
                                    log.type === 'account_edit' 
                                      ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                      : log.type === 'balance_edit'
                                      ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                                      : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                  }`}>
                                    {log.type === 'account_edit' ? 'Edit Akun' : log.type === 'balance_edit' ? 'Edit Saldo' : 'Transaksi'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                  {log.userName || 'Unknown'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                  {log.description || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Account Details */}
              <div className="space-y-6">
                {/* Account Details Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Detil Akun
                  </h2>
                  {isEditingAccount ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nama</label>
                        <input
                          type="text"
                          value={editAccountData.name}
                          onChange={(e) => setEditAccountData({ ...editAccountData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Kode</label>
                        <input
                          type="text"
                          value={editAccountData.code}
                          onChange={(e) => setEditAccountData({ ...editAccountData, code: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Kategori</label>
                        <select
                          value={editAccountData.category}
                          onChange={(e) => setEditAccountData({ ...editAccountData, category: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900 text-sm"
                        >
                          <option value="">Pilih Kategori</option>
                          <option value="Kas & Bank">Kas & Bank</option>
                          <option value="Akun Piutang">Akun Piutang</option>
                          <option value="Persediaan">Persediaan</option>
                          <option value="Aktiva Lancar Lainnya">Aktiva Lancar Lainnya</option>
                          <option value="Aktiva Tetap">Aktiva Tetap</option>
                          <option value="Kewajiban">Kewajiban</option>
                          <option value="Ekuitas">Ekuitas</option>
                          <option value="Pendapatan">Pendapatan</option>
                          <option value="Biaya">Biaya</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Saldo Baru (Opsional)</label>
                        <FormattedNumberInput
                          value={editAccountData.newBalance || 0}
                          onChange={(value) => setEditAccountData({ ...editAccountData, newBalance: value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900 text-sm"
                          placeholder="Biarkan kosong jika tidak mengubah saldo"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Keterangan (Opsional)</label>
                        <textarea
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900 text-sm"
                          placeholder="Masukkan keterangan perubahan..."
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={handleSaveAccount}
                          disabled={saving}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {saving ? 'Menyimpan...' : 'Simpan'}
                        </button>
                        <button
                          onClick={handleCancelEditAccount}
                          disabled={saving}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">Nama</label>
                        <p className="text-sm text-gray-900 dark:text-white mt-1">
                          {account.name || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">Kode</label>
                        <p className="text-sm text-gray-900 dark:text-white mt-1">
                          {account.code || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">Kategori</label>
                        <p className="text-sm text-gray-900 dark:text-white mt-1">
                          {account.category || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">Saldo</label>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                          {formatNumber(account.saldo || 0)}
                        </p>
                      </div>
                      {canEdit && (
                        <button
                          onClick={handleEditBalanceClick}
                          className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Edit Saldo
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Edit Balance Card */}
                {isEditingBalance && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Edit Saldo
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Saldo Baru</label>
                        <FormattedNumberInput
                          value={editBalance === '' ? 0 : parseFloat(editBalance) || 0}
                          onChange={(value) => setEditBalance(value === '' ? '' : value.toString())}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900 text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Keterangan (Opsional)</label>
                        <textarea
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900 text-sm"
                          placeholder="Masukkan keterangan perubahan saldo..."
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={handleSaveBalance}
                          disabled={saving}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {saving ? 'Menyimpan...' : 'Simpan'}
                        </button>
                        <button
                          onClick={handleCancelEditBalance}
                          disabled={saving}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
        
        <Footer />
      </div>

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowTransactionModal(false)}
          ></div>
          
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tambah Transaksi</h2>
              <button
                onClick={() => setShowTransactionModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipe <span className="text-red-500">*</span>
                </label>
                <select
                  value={transactionData.type}
                  onChange={(e) => setTransactionData({ ...transactionData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                >
                  <option value="debit">Debit (Kurangi Saldo)</option>
                  <option value="credit">Kredit (Tambah Saldo)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Jumlah <span className="text-red-500">*</span>
                </label>
                <FormattedNumberInput
                  value={transactionData.amount || 0}
                  onChange={(value) => setTransactionData({ ...transactionData, amount: value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tanggal <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={transactionData.date}
                  onChange={(e) => setTransactionData({ ...transactionData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nomor Transaksi
                </label>
                <input
                  type="text"
                  value={transactionData.number}
                  onChange={(e) => setTransactionData({ ...transactionData, number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                  placeholder="TRX/00001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Referensi
                </label>
                <input
                  type="text"
                  value={transactionData.reference}
                  onChange={(e) => setTransactionData({ ...transactionData, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                  placeholder="Referensi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Keterangan (Opsional)
                </label>
                <textarea
                  value={transactionData.description}
                  onChange={(e) => setTransactionData({ ...transactionData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                  placeholder="Masukkan keterangan transaksi..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowTransactionModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Batal
              </button>
              <button
                onClick={handleAddTransaction}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Tambah
                  </>
                )}
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
