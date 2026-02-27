import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { 
  ChevronLeft, 
  ChevronDown, 
  HelpCircle, 
  Calendar,
  X,
  Plus,
  Trash2,
  Save,
  MessageCircle
} from 'lucide-react'
import { usePurchaseInvoiceDetail } from '../hooks/usePurchaseInvoiceDetail'
import { useContacts } from '../hooks/useContactsData'
import { useAccounts } from '../hooks/useAccountsData'
import { useAuth } from '../contexts/AuthContext'
import { useUserApproval } from '../hooks/useUserApproval'

export default function PurchaseInvoiceEdit() {
  const { id } = useParams()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { contacts, loading: contactsLoading } = useContacts()
  const { accounts, loading: accountsLoading } = useAccounts()
  const { currentUser } = useAuth()
  const { canEditApproved, role } = useUserApproval()
  const { invoice, loading, error, updateInvoice } = usePurchaseInvoiceDetail(id)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    vendor: '',
    account: '',
    number: '',
    transactionDate: '',
    dueDate: '',
    term: 'Net 30',
    warehouse: 'Unassigned',
    reference: '',
    tag: '',
    items: [],
    message: '',
    additionalDiscount: { type: 'Rp', value: 0 },
    shippingCost: { type: 'Rp', value: 0 },
    transactionFee: { type: 'Rp', value: 0 },
    deductions: [],
    downPayments: [],
  })

  // Load invoice data when available
  useEffect(() => {
    if (invoice) {
      // Check if user can edit
      const canEdit = () => {
        if (invoice.status === 'draft') {
          return role === 'owner' || role === 'manager' || (role === 'employee' && invoice.createdBy === currentUser?.uid)
        }
        if (invoice.status === 'approved') {
          return canEditApproved
        }
        return false
      }

      if (!canEdit()) {
        alert('Anda tidak memiliki izin untuk mengedit pesanan ini')
        navigate('/pembelian/pesanan')
        return
      }

      setFormData({
        vendor: invoice.vendor || invoice.vendorId || '',
        account: invoice.account || invoice.accountId || '',
        number: invoice.number || '',
        transactionDate: invoice.transactionDate || invoice.createdAt?.split('T')[0] || '',
        dueDate: invoice.dueDate || '',
        term: invoice.term || 'Net 30',
        warehouse: invoice.warehouse || 'Unassigned',
        reference: invoice.reference || '',
        tag: invoice.tag || '',
        items: invoice.items || [],
        message: invoice.message || '',
        additionalDiscount: invoice.additionalDiscount || { type: 'Rp', value: 0 },
        shippingCost: invoice.shippingCost || { type: 'Rp', value: 0 },
        transactionFee: invoice.transactionFee || { type: 'Rp', value: 0 },
        deductions: invoice.deductions || [],
        downPayments: invoice.downPayments || [],
      })
    }
  }, [invoice, role, currentUser, canEditApproved, navigate])

  const calculateSubTotal = () => {
    return formData.items.reduce((sum, item) => {
      const quantity = item.quantity || 0
      const price = item.price || 0
      const discount = item.discount || 0
      const tax = item.tax || 0
      const itemTotal = (quantity * price) * (1 - discount / 100) * (1 + tax / 100)
      return sum + itemTotal
    }, 0)
  }

  const calculateTotal = () => {
    const subTotal = calculateSubTotal()
    const additionalDiscount = formData.additionalDiscount?.value || 0
    const shippingCost = formData.shippingCost?.value || 0
    const transactionFee = formData.transactionFee?.value || 0
    return subTotal - additionalDiscount + shippingCost + transactionFee
  }

  const calculateRemaining = () => {
    const total = calculateTotal()
    const deductions = formData.deductions.reduce((sum, d) => sum + (d.value || 0), 0)
    const downPayments = formData.downPayments.reduce((sum, d) => sum + (d.value || 0), 0)
    return total - deductions - downPayments
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    if (field === 'quantity' || field === 'price' || field === 'discount' || field === 'tax') {
      const quantity = field === 'quantity' ? value : newItems[index].quantity || 0
      const price = field === 'price' ? value : newItems[index].price || 0
      const discount = field === 'discount' ? value : newItems[index].discount || 0
      const tax = field === 'tax' ? value : newItems[index].tax || 0
      const amount = (quantity * price) * (1 - discount / 100) * (1 + tax / 100)
      newItems[index].amount = amount
    }
    
    setFormData({ ...formData, items: newItems })
  }

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          product: '',
          description: '',
          quantity: 1,
          unit: '',
          discount: 0,
          price: 0,
          tax: 0,
          amount: 0
        }
      ]
    })
  }

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index)
    setFormData({ ...formData, items: newItems })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      // Track changes for edit history
      const changes = {}
      if (invoice) {
        if (invoice.vendor !== formData.vendor) changes.vendor = { from: invoice.vendor, to: formData.vendor }
        if (invoice.total !== calculateTotal()) changes.total = { from: invoice.total, to: calculateTotal() }
        // Add more change tracking as needed
      }

      const invoiceData = {
        ...formData,
        subTotal: calculateSubTotal(),
        total: calculateTotal(),
        remaining: calculateRemaining(),
        editedBy: currentUser?.uid || '',
        changes: changes,
        updatedAt: new Date().toISOString(),
      }

      await updateInvoice(invoiceData)
      alert('Pesanan pembelian berhasil diperbarui')
      navigate(`/pembelian/pesanan/${id}`)
    } catch (error) {
      console.error('Error updating purchase invoice:', error)
      alert('Gagal memperbarui pesanan pembelian')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Memuat...</p>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="text-center">
        <p className="text-red-600 dark:text-red-400">{error || 'Pesanan pembelian tidak ditemukan'}</p>
        <button
          onClick={() => navigate('/pembelian/pesanan')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Kembali
        </button>
      </div>
    )
  }

  // Use the same form structure as PurchaseInvoiceAdd
  // This is a simplified version - you can copy the full form from PurchaseInvoiceAdd.jsx
  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Beranda &gt; Pembelian &gt; Pesanan Pembelian &gt; Edit
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Edit Pesanan Pembelian
        </h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(`/pembelian/pesanan/${id}`)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
            <span>Kembali</span>
          </button>
        </div>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800 dark:text-yellow-300">
          <strong>Catatan:</strong> Perubahan akan dicatat dalam riwayat edit sebagai "edited by {currentUser?.email}"
        </p>
      </div>

      {/* Copy the full form from PurchaseInvoiceAdd.jsx here */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <p className="text-gray-600 dark:text-gray-400">
          Form editing akan menggunakan struktur yang sama dengan PurchaseInvoiceAdd.
          Untuk implementasi lengkap, salin seluruh form dari PurchaseInvoiceAdd.jsx
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate(`/pembelian/pesanan/${id}`)}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Batal
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="h-5 w-5" />
          <span>Simpan Perubahan</span>
        </button>
      </div>
    </div>
  )
}

