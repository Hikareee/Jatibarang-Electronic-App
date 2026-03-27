import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { 
  ChevronLeft, 
  ChevronDown, 
  HelpCircle, 
  Calendar,
  Plus,
  Trash2,
  Save,
  MessageCircle
} from 'lucide-react'
import { savePurchaseInvoice, getNextPurchaseInvoiceNumber } from '../hooks/usePurchaseInvoiceData'
import { useContacts } from '../hooks/useContactsData'
import { useAccounts } from '../hooks/useAccountsData'
import { useProducts } from '../hooks/useProductsData'
import { useProjects } from '../hooks/useProjectsData'
import { uploadToBucket } from '../firebase/supabaseClient'
import { useWarehouses } from '../hooks/useWarehouses'
import { useAuth } from '../contexts/AuthContext'
import FormattedNumberInput from '../components/FormattedNumberInput'
import OptionalFieldPopup from '../components/OptionalFieldPopup'
import { formatNumberInput } from '../utils/numberFormatter'

export default function PurchaseInvoiceAdd() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { contacts, loading: contactsLoading } = useContacts()
  const { accounts, loading: accountsLoading } = useAccounts()
  const { warehouses, loading: warehousesLoading } = useWarehouses()
  const { products = [], loading: productsLoading } = useProducts()
  const { projects = [], loading: projectsLoading } = useProjects()
  const { currentUser } = useAuth()
  
  const [formData, setFormData] = useState({
    vendor: '',
    account: '', // Account to debit for purchase
    number: '',
    transactionDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    term: 'Net 30',
    warehouse: '',
    projectId: '',
    projectName: '',
    reference: '',
    category: 'Pembelian',
    tag: '',
    shippingInfo: {},
    priceIncludesTax: false,
    items: [
      {
        product: '',
        description: '',
        quantity: 1,
        unit: '',
        discount: '',
        price: '',
        tax: '',
        amount: 0
      }
    ],
    message: '',
    attachments: [],
    additionalDiscount: { type: 'Rp', value: 0 },
    shippingCost: { type: 'Rp', value: 0 },
    transactionFee: { type: 'Rp', value: 0 },
    deductions: [],
    downPayments: [],
  })

  const [showShippingInfo, setShowShippingInfo] = useState(false)
  const [showMessage, setShowMessage] = useState(false)
  const [showAttachment, setShowAttachment] = useState(false)
  const [showAdditionalDiscount, setShowAdditionalDiscount] = useState(false)
  const [showShippingCost, setShowShippingCost] = useState(false)
  const [showTransactionFee, setShowTransactionFee] = useState(false)
  const [showDeduction, setShowDeduction] = useState(false)
  const [showDownPayment, setShowDownPayment] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingNumber, setLoadingNumber] = useState(true)
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')

  const handleAttachmentFiles = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    try {
      setUploadingAttachments(true)
      setAttachmentError('')

      const uploads = await Promise.all(
        files.map(async (file) => {
          // Upload to Supabase bucket 'AttachmentPembelian'
          const meta = await uploadToBucket(file, {
            bucket: 'AttachmentPembelian',
            prefix: 'purchase-invoices-draft',
          })
          return meta
        })
      )

      setFormData((prev) => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...uploads],
      }))

      event.target.value = ''
    } catch (err) {
      console.error('Error uploading attachments:', err)
      setAttachmentError('Gagal mengunggah lampiran')
    } finally {
      setUploadingAttachments(false)
    }
  }

  const handleRemoveAttachment = (index) => {
    setFormData((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== index),
    }))
  }

  // Auto-generate invoice number on component mount
  useEffect(() => {
    const fetchNextNumber = async () => {
      try {
        setLoadingNumber(true)
        const nextNumber = await getNextPurchaseInvoiceNumber()
        setFormData(prev => ({ ...prev, number: nextNumber }))
      } catch (error) {
        console.error('Error fetching next invoice number:', error)
        // Set default if error
        setFormData(prev => ({ ...prev, number: 'PI/00001' }))
      } finally {
        setLoadingNumber(false)
      }
    }
    
    fetchNextNumber()
  }, [])

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

    // When product selected, auto-fill from products collection
    if (field === 'product' && value) {
      const selectedProduct = products.find((p) => p.id === value)
      if (selectedProduct) {
        newItems[index].description =
          selectedProduct.nama ||
          selectedProduct.description ||
          newItems[index].description ||
          ''
        newItems[index].unit =
          selectedProduct.satuan ||
          selectedProduct.unit ||
          newItems[index].unit ||
          ''
        const rawPrice =
          selectedProduct.harga ??
          selectedProduct.price ??
          selectedProduct.hargaBeli ??
          selectedProduct.buyPrice ??
          selectedProduct.unitPrice ??
          ''
        const numericPrice =
          rawPrice === '' ? '' : Number(String(rawPrice).replace(/[^\d.]/g, ''))
        newItems[index].price = Number.isFinite(numericPrice) ? numericPrice : ''

        const quantity = parseFloat(newItems[index].quantity || 0)
        const discount = parseFloat(newItems[index].discount || 0)
        const tax = parseFloat(newItems[index].tax || 0)
        const amount =
          (quantity * (Number(newItems[index].price || 0))) *
          (1 - discount / 100) *
          (1 + tax / 100)
        newItems[index].amount = amount
      }
    }
    
    // Calculate amount
    if (field === 'quantity' || field === 'price' || field === 'discount' || field === 'tax') {
      const quantity = parseFloat(newItems[index].quantity || 0)
      const price = parseFloat(newItems[index].price || 0)
      const discount = parseFloat(newItems[index].discount || 0)
      const tax = parseFloat(newItems[index].tax || 0)
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
          discount: '',
          price: '',
          tax: '',
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
      const invoiceData = {
        ...formData,
        projectName:
          projects.find((p) => p.id === formData.projectId)?.name || formData.projectName || '',
        subTotal: calculateSubTotal(),
        total: calculateTotal(),
        remaining: calculateRemaining(),
        createdBy: currentUser?.uid || '',
        createdAt: new Date().toISOString(),
      }
      await savePurchaseInvoice(invoiceData, currentUser?.uid)
      navigate('/pembelian/pesanan')
    } catch (error) {
      console.error('Error saving purchase invoice:', error)
      alert('Failed to save purchase invoice')
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
            {/* Breadcrumbs */}
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Beranda &gt; Pembelian &gt; Tagihan Pembelian &gt; Tambah
            </div>

            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Tambah Tagihan Pembelian
              </h1>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <HelpCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">{t('guide')}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
                <button 
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span>{t('back')}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Form Fields */}
              <div className="lg:col-span-2 space-y-6">
                {/* Invoice Details */}
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
                        Gudang
                      </label>
                      <select
                        value={formData.warehouse}
                        onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        disabled={warehousesLoading}
                      >
                        <option value="">Tidak dipilih</option>
                        {warehouses.map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.name}{wh.code ? ` (${wh.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                        Nomor
                        <HelpCircle className="h-4 w-4 text-gray-400" />
                      </label>
                      <input
                        type="text"
                        value={loadingNumber ? 'Loading...' : formData.number}
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Proyek
                      </label>
                      <select
                        value={formData.projectId}
                        onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        disabled={projectsLoading}
                      >
                        <option value="">Tidak dipilih</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}{project.code ? ` (${project.code})` : ''}
                          </option>
                        ))}
                      </select>
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Kategori
                      </label>
                      <input
                        type="text"
                        list="purchase-category-options"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Kategori pembelian"
                      />
                      <datalist id="purchase-category-options">
                        <option value="Pembelian" />
                        <option value="Bahan Baku" />
                        <option value="Operasional" />
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                        Tag
                        <HelpCircle className="h-4 w-4 text-gray-400" />
                      </label>
                      <input
                        type="text"
                        list="purchase-tag-options"
                        value={formData.tag}
                        onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Pilih / ketik tag"
                      />
                      <datalist id="purchase-tag-options">
                        <option value="Urgent" />
                        <option value="Capex" />
                        <option value="Opex" />
                      </datalist>
                    </div>
                  </div>

                  {/* Expandable Sections */}
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

                {/* Barcode Input and Tax Toggle */}
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
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          formData.priceIncludesTax ? 'translate-x-6' : 'translate-x-0'
                        }`}></div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Product Table */}
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
                                disabled={productsLoading}
                              >
                                <option value="">Pilih Produk</option>
                                {products.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.nama || product.name || 'Unnamed Product'}
                                  </option>
                                ))}
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
                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
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
                                  onChange={(e) => handleItemChange(index, 'discount', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
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
                                  onChange={(e) => handleItemChange(index, 'tax', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
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

                {/* Collapsible Sections */}
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
                  {showAttachment && (
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Upload file (gambar / dokumen)
                        </label>
                        <input
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                          onChange={handleAttachmentFiles}
                          className="w-full text-sm text-gray-700 dark:text-gray-200 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300"
                        />
                        {uploadingAttachments && (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Mengunggah lampiran...
                          </p>
                        )}
                        {attachmentError && (
                          <p className="mt-2 text-xs text-red-500">
                            {attachmentError}
                          </p>
                        )}
                      </div>

                      {(formData.attachments || []).length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Lampiran saat ini
                          </p>
                          <ul className="space-y-1">
                            {formData.attachments.map((att, index) => (
                              <li
                                key={`${att.path || att.url || att.name}-${index}`}
                                className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="truncate max-w-xs">
                                    {att.name}
                                  </span>
                                  {att.url && (
                                    <a
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
                                    >
                                      Buka
                                    </a>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAttachment(index)}
                                  className="ml-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  Hapus
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Summary */}
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

                {/* Save Button */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Save className="h-5 w-5" />
                  <span>Simpan</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
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

// Format number helper
function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('id-ID').format(num)
}

