import { useState } from 'react'
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
  MessageCircle
} from 'lucide-react'
import { useAccountDetail } from '../hooks/useAccountDetail'
import { useUserApproval } from '../hooks/useUserApproval'
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
  const { account, balanceHistory, loading, error, updateBalance } = useAccountDetail(id)
  const { role } = useUserApproval()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editBalance, setEditBalance] = useState('')
  const [editReason, setEditReason] = useState('')
  const [saving, setSaving] = useState(false)

  // Check if user can edit (only admin or owner)
  const canEdit = role === 'admin' || role === 'owner'

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

  // Prepare chart data from balance history
  const chartData = balanceHistory.map((entry, index) => ({
    date: formatDate(entry.createdAt || entry.date),
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

  const handleEditClick = () => {
    if (account) {
      setEditBalance(account.saldo?.toString() || '0')
      setEditReason('')
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
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
      await updateBalance(newBalance, editReason || 'Manual balance adjustment')
      setIsEditing(false)
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
            {/* Breadcrumbs */}
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('home')} &gt; {t('dashboard')} &gt; {account.name || account.code || 'Account'}
            </div>

            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {account.name || account.code || 'Account'}
                </h1>
                {account.code && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {account.code}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {canEdit && !isEditing && (
                  <button
                    onClick={handleEditClick}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="h-5 w-5" />
                    <span>Edit Balance</span>
                  </button>
                )}
                <button 
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span>{t('back')}</span>
                </button>
              </div>
            </div>

            {/* Current Balance Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Current Balance
                  </h2>
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          New Balance
                        </label>
                        <input
                          type="number"
                          value={editBalance}
                          onChange={(e) => setEditBalance(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Reason (Optional)
                        </label>
                        <textarea
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Enter reason for balance adjustment..."
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleSaveBalance}
                          disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Save className="h-5 w-5" />
                          <span>{saving ? 'Saving...' : 'Save'}</span>
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <X className="h-5 w-5" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-4xl font-bold text-gray-900 dark:text-white">
                      {formatNumber(account.saldo || 0)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Balance Movement Graph */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Balance Movement
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
                        name="Balance"
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

            {/* Balance History Table */}
            {balanceHistory.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Balance History
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Old Balance
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Change
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          New Balance
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {balanceHistory.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatDate(entry.createdAt || entry.date)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatNumber(entry.oldBalance || 0)}
                          </td>
                          <td className={`px-4 py-3 text-sm font-semibold ${
                            (entry.change || 0) >= 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {(entry.change || 0) >= 0 ? '+' : ''}{formatNumber(entry.change || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                            {formatNumber(entry.newBalance || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {entry.description || entry.transactionNumber || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
