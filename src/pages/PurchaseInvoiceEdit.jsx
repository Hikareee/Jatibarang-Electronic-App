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
import FormattedNumberInput from '../components/FormattedNumberInput'

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
  const [showShippingInfo, setShowShippingInfo] = useState(false)
  const [showMessage, setShowMessage] = useState(false)
  const [showAttachment, setShowAttachment] = useState(false)
  const [showAdditionalDiscount, setShowAdditionalDiscount] = useState(false)
  const [showShippingCost, setShowShippingCost] = useState(false)
  const [showTransactionFee, setShowTransactionFee] = useState(false)
  const [showDeduction, setShowDeduction] = useState(false)
  const [showDownPayment, setShowDownPayment] = useState(false)

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
    shippingInfo: {},
    priceIncludesTax: false,
    items: [],
    message: '',
    attachments: [],
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
        shippingInfo: invoice.shippingInfo || {},
        priceIncludesTax: invoice.priceIncludesTax || false,
        items: invoice.items || [],
        message: invoice.message || '',
        attachments: invoice.attachments || [],
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Vendor <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={contactsLoading}
                >
                  <option value="">Pilih kontak</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name || contact.company || 'Unnamed Contact'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Akun <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.account}
                  onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={accountsLoading}
                >
                  <option value="">Pilih akun</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tgl. Transaksi <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.transactionDate}
                    onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gudang <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.warehouse}
                  onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="Unassigned">Unassigned</option>
                </select>
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
                  placeholder="PI/00001"
                />
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
                  <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Termin
                </label>
                <select
                  value={formData.term}
                  onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="Net 30">Net 30</option>
                  <option value="Net 15">Net 15</option>
                  <option value="Net 60">Net 60</option>
                </select>
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
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <button
                onClick={() => setShowShippingInfo(!showShippingInfo)}
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
              >
                {showShippingInfo ? <ChevronDown className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                Tampilkan Informasi Pengiriman
              </button>
              {showShippingInfo && (
                <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <input
                    type="text"
                    placeholder="Shipping information"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <input
                type="text"
                placeholder="Scan Barcode/SKU"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm text-gray-700 dark:text-gray-300">Harga termasuk pajak</span>
                <button
                  onClick={() => setFormData({ ...formData, priceIncludesTax: !formData.priceIncludesTax })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    formData.priceIncludesTax ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      formData.priceIncludesTax ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  ></div>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Produk <ChevronDown className="inline h-3 w-3" />
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Deskripsi <ChevronDown className="inline h-3 w-3" />
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Kuantitas <ChevronDown className="inline h-3 w-3" />
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Satuan <ChevronDown className="inline h-3 w-3" />
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Discount <ChevronDown className="inline h-3 w-3" />
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Harga <ChevronDown className="inline h-3 w-3" />
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Pajak <ChevronDown className="inline h-3 w-3" />
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Jumlah <ChevronDown className="inline h-3 w-3" />
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-2 px-2">
                        <select
                          value={item.product}
                          onChange={(e) => handleItemChange(index, 'product', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        >
                          <option value="">Pilih Produk</option>
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={item.quantity === '' ? '' : item.quantity}
                          placeholder="0"
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              'quantity',
                              e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        >
                          <option value="">Pilih Satu...</option>
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={item.discount === '' ? '' : item.discount}
                            placeholder="0"
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                'discount',
                                e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-300">%</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <FormattedNumberInput
                          value={item.price}
                          onChange={(value) => handleItemChange(index, 'price', value)}
                          placeholder="0"
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900 text-sm"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={item.tax === '' ? '' : item.tax}
                            placeholder="0"
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                'tax',
                                e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-300">%</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={formatNumber(item.amount)}
                          readOnly
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => removeItem(index)}
                          className="p-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={addItem}
              className="mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Tambah baris
            </button>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => setShowMessage(!showMessage)}
              className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <span className="text-gray-700 dark:text-gray-300">Pesan</span>
              {showMessage ? <ChevronDown className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
            {showMessage && (
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter message..."
                />
              </div>
            )}

            <button
              onClick={() => setShowAttachment(!showAttachment)}
              className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <span className="text-gray-700 dark:text-gray-300">Attachment</span>
              {showAttachment ? <ChevronDown className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">Sub Total</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(calculateSubTotal())}
                </span>
              </div>

              <div className="space-y-2">
                {!showAdditionalDiscount && (
                  <button
                    onClick={() => setShowAdditionalDiscount(true)}
                    className="w-full text-left text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Tambahan Diskon
                  </button>
                )}
                {showAdditionalDiscount && (
                  <OptionalFieldPopup
                    label="Tambahan Diskon"
                    value={formData.additionalDiscount}
                    onChange={(value) => setFormData({ ...formData, additionalDiscount: value })}
                    onClose={() => setShowAdditionalDiscount(false)}
                  />
                )}

                {!showShippingCost && (
                  <button
                    onClick={() => setShowShippingCost(true)}
                    className="w-full text-left text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Biaya pengiriman
                  </button>
                )}
                {showShippingCost && (
                  <OptionalFieldPopup
                    label="Biaya pengiriman"
                    value={formData.shippingCost}
                    onChange={(value) => setFormData({ ...formData, shippingCost: value })}
                    onClose={() => setShowShippingCost(false)}
                  />
                )}

                {!showTransactionFee && (
                  <button
                    onClick={() => setShowTransactionFee(true)}
                    className="w-full text-left text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Biaya Transaksi
                  </button>
                )}
                {showTransactionFee && (
                  <OptionalFieldPopup
                    label="Biaya Transaksi"
                    value={formData.transactionFee}
                    onChange={(value) => setFormData({ ...formData, transactionFee: value })}
                    onClose={() => setShowTransactionFee(false)}
                  />
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="font-bold text-lg text-gray-900 dark:text-white">
                  {formatNumber(calculateTotal())}
                </span>
              </div>

              <div className="space-y-2">
                {!showDeduction && (
                  <button
                    onClick={() => setShowDeduction(true)}
                    className="w-full text-left text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Pemotongan
                  </button>
                )}
                {showDeduction && (
                  <OptionalFieldPopup
                    label="Pemotongan"
                    value={formData.deductions[0] || { account: '', type: 'Rp', value: 0 }}
                    onChange={(value) => {
                      const newDeductions = [...formData.deductions]
                      newDeductions[0] = value
                      setFormData({ ...formData, deductions: newDeductions })
                    }}
                    onClose={() => setShowDeduction(false)}
                  />
                )}

                {!showDownPayment && (
                  <button
                    onClick={() => setShowDownPayment(true)}
                    className="w-full text-left text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Uang muka
                  </button>
                )}
                {showDownPayment && (
                  <OptionalFieldPopup
                    label="Uang muka"
                    value={formData.downPayments[0] || { account: '', type: 'Rp', value: 0 }}
                    onChange={(value) => {
                      const newDownPayments = [...formData.downPayments]
                      newDownPayments[0] = value
                      setFormData({ ...formData, downPayments: newDownPayments })
                    }}
                    onClose={() => setShowDownPayment(false)}
                  />
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <span className="font-semibold text-gray-900 dark:text-white">Sisa Tagihan</span>
                <span className="font-bold text-lg text-gray-900 dark:text-white">
                  {formatNumber(calculateRemaining())}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <Save className="h-5 w-5" />
            <span>Simpan Perubahan</span>
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function OptionalFieldPopup({ label, value, onChange, onClose }) {
  const [localValue, setLocalValue] = useState(value || { account: '', type: 'Rp', value: 0 })

  const handleClose = () => {
    onChange(localValue)
    onClose()
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-gray-900 dark:text-white">{label}</span>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <select
            value={localValue.account}
            onChange={(e) => {
              const newValue = { ...localValue, account: e.target.value }
              setLocalValue(newValue)
              onChange(newValue)
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-white dark:text-gray-900 text-sm"
          >
            <option value="">Select account...</option>
            <option value="1-10001">1-10001 Kas</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => {
                const newValue = { ...localValue, type: '%' }
                setLocalValue(newValue)
                onChange(newValue)
              }}
              className={`px-3 py-1 text-sm ${
                localValue.type === '%'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              %
            </button>
            <button
              onClick={() => {
                const newValue = { ...localValue, type: 'Rp' }
                setLocalValue(newValue)
                onChange(newValue)
              }}
              className={`px-3 py-1 text-sm ${
                localValue.type === 'Rp'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Rp
            </button>
          </div>
          <FormattedNumberInput
            value={localValue.value}
            onChange={(val) => {
              const newValue = { ...localValue, value: val }
              setLocalValue(newValue)
              onChange(newValue)
            }}
            className="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-white dark:text-gray-900 bg-white text-gray-900 text-sm"
          />
          <span className="font-bold text-gray-900 dark:text-white">
            {new Intl.NumberFormat('id-ID').format(localValue.value || 0)}
          </span>
        </div>
      </div>
    </div>
  )
}

function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('id-ID').format(num)
}

