import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { 
  ChevronLeft, 
  HelpCircle, 
  Calendar,
  X,
  Plus,
  Trash2,
  Save
} from 'lucide-react'
import { saveReceivable, getNextReceivableNumber } from '../hooks/useReceivableData'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAccounts } from '../hooks/useAccountsData'

export default function ReceivableAdd() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const contactId = searchParams.get('contactId')
  const { accounts: accountOptions, loading: accountsLoading } = useAccounts()
  const [contactName, setContactName] = useState('')
  const [loadingContact, setLoadingContact] = useState(false)
  
  const [formData, setFormData] = useState({
    contactId: contactId || '',
    transactionDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    number: 'DM/00001',
    reference: '',
    tag: '',
    accounts: [
      {
        account: '',
        description: '',
        amount: 0
      }
    ],
    message: ''
  })
  
  const [saving, setSaving] = useState(false)
  // Fetch next receivable number
  useEffect(() => {
    const fetchNextNumber = async () => {
      try {
        const nextNumber = await getNextReceivableNumber()
        setFormData(prev => ({ ...prev, number: nextNumber }))
      } catch (error) {
        console.error('Error fetching next receivable number:', error)
      }
    }
    fetchNextNumber()
  }, [])


  // Fetch contact name if contactId is provided
  useEffect(() => {
    if (contactId) {
      setLoadingContact(true)
      const fetchContact = async () => {
        try {
          const contactRef = doc(db, 'contacts', contactId)
          const contactSnap = await getDoc(contactRef)
          if (contactSnap.exists()) {
            setContactName(contactSnap.data().name || '')
            setFormData(prev => ({ ...prev, contactId }))
          }
        } catch (error) {
          console.error('Error fetching contact:', error)
        } finally {
          setLoadingContact(false)
        }
      }
      fetchContact()
    }
  }, [contactId])

  // Calculate total
  const calculateTotal = () => {
    return formData.accounts.reduce((sum, account) => {
      return sum + (parseFloat(account.amount) || 0)
    }, 0)
  }

  // Handle account row changes
  const handleAccountChange = (index, field, value) => {
    const newAccounts = [...formData.accounts]
    newAccounts[index] = { ...newAccounts[index], [field]: value }
    setFormData({ ...formData, accounts: newAccounts })
  }

  // Add new account row
  const addAccountRow = () => {
    setFormData({
      ...formData,
      accounts: [
        ...formData.accounts,
        {
          account: '',
          description: '',
          amount: 0
        }
      ]
    })
  }

  // Remove account row
  const removeAccountRow = (index) => {
    if (formData.accounts.length > 1) {
      const newAccounts = formData.accounts.filter((_, i) => i !== index)
      setFormData({ ...formData, accounts: newAccounts })
    }
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.transactionDate) {
      alert('Tanggal Transaksi harus diisi')
      return
    }

    if (!contactId) {
      alert('Pelanggan harus dipilih')
      return
    }

    const sanitizedAccounts = formData.accounts.map(account => ({
      ...account,
      amount: parseFloat(account.amount) || 0
    }))

    const hasInvalidAccount = sanitizedAccounts.some(account => !account.account || account.amount <= 0)
    if (hasInvalidAccount) {
      alert('Setiap baris akun harus memiliki akun dan jumlah yang valid (> 0)')
      return
    }

    try {
      setSaving(true)
      await saveReceivable({
        ...formData,
        accounts: sanitizedAccounts,
        total: calculateTotal(),
        contactName
      })
      alert('Piutang berhasil disimpan')
      navigate(-1)
    } catch (error) {
      console.error('Error saving receivable:', error)
      alert('Gagal menyimpan piutang: ' + error.message)
    } finally {
      setSaving(false)
    }
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
                Tambah Piutang
              </h1>
              <button 
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
                <span>Kembali</span>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Main Form */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Customer Section */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Pelanggan
                    </label>
                    {loadingContact ? (
                      <div className="text-gray-500">Memuat...</div>
                    ) : (
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {contactName || 'Tidak ada pelanggan dipilih'}
                      </div>
                    )}
                  </div>

                  {/* Transaction Details */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Tanggal Transaksi <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            value={formData.transactionDate}
                            onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            required
                          />
                          <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Tgl. Jatuh Tempo
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            value={formData.dueDate}
                            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                          {formData.dueDate && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, dueDate: '' })}
                              className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 hover:text-gray-600"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                          Nomor
                          <HelpCircle className="h-4 w-4 text-gray-400" />
                        </label>
                        <input
                          type="text"
                          value={formData.number}
                          onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                          Referensi
                          <HelpCircle className="h-4 w-4 text-gray-400" />
                        </label>
                        <input
                          type="text"
                          value={formData.reference}
                          onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                          placeholder="Referensi"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                          Tag
                          <HelpCircle className="h-4 w-4 text-gray-400" />
                        </label>
                        <select
                          value={formData.tag}
                          onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">Pilih Tag</option>
                          {/* Add tag options here */}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Account/Itemized Details */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                              Akun
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                              Deskripsi
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                              Jumlah
                            </th>
                            <th className="w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.accounts.map((account, index) => (
                            <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                              <td className="py-3 px-4">
                                <select
                                  value={account.account}
                                  onChange={(e) => handleAccountChange(index, 'account', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                >
                                  <option value="">Pilih akun</option>
                                  {accountsLoading ? (
                                    <option value="" disabled>Memuat akun...</option>
                                  ) : (
                                    accountOptions.map((acct) => (
                                      <option key={acct.id} value={acct.id}>
                                        {acct.code || acct.number || ''} - {acct.name || 'Tanpa Nama'}
                                      </option>
                                    ))
                                  )}
                                </select>
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={account.description}
                                  onChange={(e) => handleAccountChange(index, 'description', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="number"
                                  value={account.amount}
                                  onChange={(e) => handleAccountChange(index, 'amount', parseFloat(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <button
                                  type="button"
                                  onClick={() => removeAccountRow(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button
                        type="button"
                        onClick={addAccountRow}
                        className="mt-4 flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Plus className="h-4 w-4" />
                        <span>+ Tambah baris</span>
                      </button>
                    </div>
                  </div>

                  {/* Message Section */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Pesan
                    </label>
                    {/* Simple textarea for now - can be replaced with rich text editor later */}
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Pesan"
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* Right Column - Summary */}
                <div className="lg:col-span-1">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 sticky top-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-lg font-semibold text-gray-900 dark:text-white">
                        <span>Total</span>
                        <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(calculateTotal())}</span>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                      >
                        <Save className="h-5 w-5" />
                        <span>{saving ? 'Menyimpan...' : 'Simpan'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </main>
        
        <Footer />
      </div>
    </div>
  )
}

