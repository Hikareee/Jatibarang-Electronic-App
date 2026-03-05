import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
import { saveInvoice, getNextInvoiceNumber } from '../hooks/useInvoiceData'
import { useContacts } from '../hooks/useContactsData'
import { useAccounts } from '../hooks/useAccountsData'
import { useWarehouses } from '../hooks/useWarehouses'
import { useProducts } from '../hooks/useProductsData'
import FormattedNumberInput from '../components/FormattedNumberInput'
import OptionalFieldPopup from '../components/OptionalFieldPopup'
import { formatNumberInput } from '../utils/numberFormatter'
import { uploadInvoiceAttachment } from '../firebase/supabaseClient'

export default function InvoiceAdd() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const { contacts, loading: contactsLoading } = useContacts()
  const { accounts, loading: accountsLoading } = useAccounts()
  const { warehouses, loading: warehousesLoading } = useWarehouses()
  const { products = [], loading: productsLoading } = useProducts()

  const [formData, setFormData] = useState({
    customer: '',
    customerId: '',
    customerName: '',
    customerAddress: '',
    attn: '',
    city: 'Cirebon',
    account: '', // Account to credit for cash sales
    paymentMethod: 'credit', // 'cash' or 'credit'
    number: '',
    transactionDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    term: 'Net 30',
    warehouse: '',
    reference: '',
    tag: '',
    salesPerson: '',
    shippingInfo: {},
    priceIncludesTax: false,
    // Fields needed for INV3 PERIZINAN template
    companyName: 'PT. INTEGRASI BANGUN PERKASA',
    companyAddress:
      'Jl. Raya Bandengan Mundu No. 09 Ds. Bandengan Kec. Mundu Kab. Cirebon Kode Pos 45173',
    companyPhone: '0818345654',
    companyEmail: 'integrasibangunperkasa@gmail.com',
    bankName: 'BANK MANDIRI',
    bankAccountNo: '134-00-5000001-6',
    bankAccountName: 'PT. INTEGRASI BANGUN PERKASA',
    signName: 'Wempi',
    signTitle: 'Direktur',
    jobTitle: '',
    workItems: '',
    sphNumber: '..................................',
    poNumber: '',
    poDate: '',
    vatRate: 11,
    pphRate: 1.75,
    pphValue: 0,
    pphValueManual: false,
    items: [
      {
        product: '',
        description: '',
        spek: '-',
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
    paymentConnect: false,
    additionalDiscount: { type: 'Rp', value: 0 },
    shippingCost: { type: 'Rp', value: 0 },
    transactionFee: { type: 'Rp', value: 0 },
    deductions: [],
    downPayments: [],
  })

  const [showSalesPerson, setShowSalesPerson] = useState(false)
  const [showShippingInfo, setShowShippingInfo] = useState(false)
  const [showMessage, setShowMessage] = useState(false)
  const [showAttachment, setShowAttachment] = useState(false)
  const [showPaymentConnect, setShowPaymentConnect] = useState(false)
  const [showAdditionalDiscount, setShowAdditionalDiscount] = useState(false)
  const [showShippingCost, setShowShippingCost] = useState(false)
  const [showTransactionFee, setShowTransactionFee] = useState(false)
  const [showDeduction, setShowDeduction] = useState(false)
  const [showDownPayment, setShowDownPayment] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingNumber, setLoadingNumber] = useState(true)
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')
  const poNumberUserEdited = useRef(false)

  const selectedCustomer = useMemo(() => {
    if (!formData.customer) return null
    return contacts.find((c) => c.id === formData.customer) || null
  }, [contacts, formData.customer])

  const MONTHS_ID = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER']
  const formatDateToInv3TglPo = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return ''
    return `${date.getDate()} ${MONTHS_ID[date.getMonth()]} ${date.getFullYear()}`
  }
  const parseInv3TglPo = (str) => {
    if (!str || typeof str !== 'string') return null
    const trimmed = str.trim()
    if (!trimmed) return null
    const parts = trimmed.split(/\s+/)
    if (parts.length < 3) return null
    const day = parseInt(parts[0], 10)
    const monthName = parts[1].toUpperCase()
    const year = parseInt(parts[2], 10)
    const mi = MONTHS_ID.indexOf(monthName)
    if (mi === -1 || isNaN(day) || isNaN(year)) return null
    const date = new Date(year, mi, day)
    return isNaN(date.getTime()) ? null : date
  }
  const poDateIso = useMemo(() => {
    const d = parseInv3TglPo(formData.poDate)
    if (!d) return ''
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [formData.poDate])

  // Auto-generate invoice number on mount
  useEffect(() => {
    const fetchNextNumber = async () => {
      try {
        setLoadingNumber(true)
        const nextNumber = await getNextInvoiceNumber()
        setFormData(prev => ({
          ...prev,
          number: nextNumber,
          poNumber: poNumberUserEdited.current ? prev.poNumber : (prev.poNumber || `001/PO/-/I/${new Date().getFullYear()}`)
        }))
      } catch (error) {
        console.error('Error fetching next invoice number:', error)
        setFormData(prev => ({
          ...prev,
          number: 'INV/00001',
          poNumber: poNumberUserEdited.current ? prev.poNumber : (prev.poNumber || `001/PO/-/I/${new Date().getFullYear()}`)
        }))
      } finally {
        setLoadingNumber(false)
      }
    }
    fetchNextNumber()
  }, [])

  // Prefill customer if coming from contact page (?contactId=...)
  useEffect(() => {
    const qs = new URLSearchParams(location.search || '')
    const contactId = qs.get('contactId')
    if (contactId) {
      setFormData((prev) => ({ ...prev, customer: contactId }))
    }
  }, [location.search])

  // When customer selected, prefill name and address from contact (user can change after)
  useEffect(() => {
    if (!selectedCustomer) return
    const address = selectedCustomer.billingAddress || selectedCustomer.address || ''
    setFormData((prev) => ({
      ...prev,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name || selectedCustomer.company || prev.customerName,
      customerAddress: address,
    }))
  }, [selectedCustomer])

  const calculateDpp = () =>
    formData.items.reduce((sum, item) => {
      const quantity = Number(item.quantity || 0)
      const price = Number(item.price || 0)
      const discount = Number(item.discount || 0)
      const itemSubtotal = quantity * price
      const itemDiscount = itemSubtotal * (discount / 100)
      return sum + (itemSubtotal - itemDiscount)
    }, 0)

  const calculateVat = () => {
    const dpp = calculateDpp()
    const rate = Number(formData.vatRate || 0)
    if (!Number.isFinite(rate) || rate <= 0) return 0
    return dpp * (rate / 100)
  }

  const calculateSubTotalPdf = () => calculateDpp() + calculateVat()

  const calculatePphValue = () => {
    if (formData.pphValueManual) return Number(formData.pphValue || 0)
    const dpp = calculateDpp()
    const rate = Number(formData.pphRate || 0)
    if (!Number.isFinite(rate) || rate <= 0) return 0
    return dpp * (rate / 100)
  }

  useEffect(() => {
    const next = calculatePphValue()
    setFormData((prev) => {
      if (prev.pphValueManual) return prev
      return { ...prev, pphValue: next }
    })
  }, [formData.pphRate, formData.items, formData.pphValueManual])

  const calculateTotal = () => {
    const subTotal = calculateSubTotalPdf()
    const pph = calculatePphValue()
    return subTotal - pph
  }

  const calculateRemaining = () => {
    const total = calculateTotal()
    const deductions = formData.deductions.reduce((sum, d) => sum + (d.value || 0), 0)
    const downPayments = formData.downPayments.reduce((sum, d) => sum + (d.value || 0), 0)
    return total - deductions - downPayments
  }

  const handleAttachmentFiles = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    try {
      setUploadingAttachments(true)
      setAttachmentError('')

      // Upload to Supabase attachments bucket as draft (no invoiceId yet)
      const uploads = await Promise.all(
        files.map(async (file) => {
          const meta = await uploadInvoiceAttachment(file, null, 'AttachmentInvoice')
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
      setAttachmentError(`Gagal mengunggah lampiran${err?.message ? `: ${err.message}` : ''}`)
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

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }

    // When product selected, auto-fill from produk tab
    if (field === 'product' && value) {
      const selectedProduct = products.find((p) => p.id === value)
      if (selectedProduct) {
        newItems[index].description = selectedProduct.nama || selectedProduct.description || newItems[index].description || ''
        newItems[index].spek = selectedProduct.spek || selectedProduct.spec || newItems[index].spek || '-'
        newItems[index].unit = selectedProduct.satuan || selectedProduct.unit || newItems[index].unit || ''
  // Ensure price is a plain number (not formatted string) so FormattedNumberInput receives a numeric value
  const p = selectedProduct.harga ?? selectedProduct.price ?? selectedProduct.hargaJual ?? selectedProduct.priceJual ?? newItems[index].price ?? ''
  const cleaned = p === '' ? '' : Number(String(p).replace(/[^\d.]/g, ''))
  newItems[index].price = cleaned === '' || Number.isNaN(cleaned) ? '' : cleaned

  // Recalculate amount immediately after autofill so UI updates
  const quantity = parseFloat(newItems[index].quantity || 0)
  const price = parseFloat(newItems[index].price || 0)
  const discount = parseFloat(newItems[index].discount || 0)
  const amount = (quantity * price) * (1 - (isNaN(discount) ? 0 : discount) / 100)
  newItems[index].amount = isNaN(amount) ? 0 : amount
      }
    }

    // Calculate amount
    if (field === 'quantity' || field === 'price' || field === 'discount') {
      const quantity = parseFloat(newItems[index].quantity || 0)
      const price = parseFloat(newItems[index].price || 0)
      const discount = parseFloat(newItems[index].discount || 0)
      const amount = (quantity * price) * (1 - discount / 100)
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
          spek: '-',
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
      // Basic required validation for INV3 PERIZINAN template fields
      const requiredFields = [
        { key: 'customer', label: 'Customer' },
        { key: 'customerAddress', label: 'Alamat Customer' },
        { key: 'attn', label: 'Attn.' },
        { key: 'number', label: 'No Invoice' },
        { key: 'transactionDate', label: 'Tanggal' },
        { key: 'companyName', label: 'Nama Perusahaan' },
        { key: 'companyAddress', label: 'Alamat Perusahaan' },
        { key: 'companyPhone', label: 'Telp Perusahaan' },
        { key: 'companyEmail', label: 'Email Perusahaan' },
        { key: 'bankName', label: 'Nama Bank' },
        { key: 'bankAccountNo', label: 'No. Rek' },
        { key: 'bankAccountName', label: 'A/N Rekening' },
        { key: 'signName', label: 'Nama Penandatangan' },
        { key: 'signTitle', label: 'Jabatan Penandatangan' },
        { key: 'jobTitle', label: 'Judul Pekerjaan' },
        { key: 'workItems', label: 'Item Pekerjaan' },
        { key: 'sphNumber', label: 'No SPH' },
        { key: 'poNumber', label: 'No PO' },
        { key: 'poDate', label: 'Tgl PO' },
      ]
      for (const f of requiredFields) {
        const v = formData[f.key]
        if (v === null || v === undefined || String(v).trim() === '') {
          alert(`${f.label} wajib diisi`)
          return
        }
      }
      if (!Array.isArray(formData.items) || formData.items.length === 0) {
        alert('Minimal 1 item wajib diisi')
        return
      }

  setSaving(true)
      const invoiceData = {
        ...formData,
        customerId: formData.customerId || formData.customer,
        customerName: formData.customerName || selectedCustomer?.name || selectedCustomer?.company || '',
        subTotal: calculateSubTotalPdf(),
        vatRate: Number(formData.vatRate || 0),
        pph: {
          rate: Number(formData.pphRate || 0),
          value: Number(calculatePphValue() || 0),
        },
        pphValue: Number(calculatePphValue() || 0),
        total: calculateTotal(),
        remaining: calculateRemaining(),
        createdAt: new Date().toISOString(),
      }
  // If save returns an id, navigate to the invoice detail so attachments are visible
  const savedId = await saveInvoice(invoiceData)
      if (savedId) {
        // If there were draft attachments uploaded before save, re-upload paths under final invoice folder for better structure
        if ((formData.attachments || []).length > 0) {
          try {
            setUploadingAttachments(true)
            const reuploaded = await Promise.all(
              (formData.attachments || []).map(async (att) => {
                // We don't have the original File here anymore, so just keep existing link.
                // In future enhancement, we could move objects via server-side keys.
                return att
              })
            )
            // Update Firestore attachments to ensure they are stored on the invoice with Supabase links
            // saveInvoice already stored attachments from invoiceData; no-op here.
          } catch (e) {
            console.warn('Post-save attachment handling skipped:', e)
          } finally {
            setUploadingAttachments(false)
          }
        }
        navigate(`/penjualan/tagihan/${savedId}`)
      } else {
        navigate('/penjualan/tagihan')
      }
    } catch (error) {
      console.error('Error saving invoice:', error)
      alert('Failed to save invoice')
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
              {t('home')} &gt; {t('sales')} &gt; {t('invoices')} &gt; {t('addInvoice')}
            </div>

            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t('addInvoice')}
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
                        {t('customer')} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.customer}
                        onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        disabled={contactsLoading}
                      >
                        <option value="">{t('selectContact')}</option>
                        {contacts.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {contact.name || contact.company || 'Unnamed Contact'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Akun
                      </label>
                      <select
                        value={formData.account}
                        onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        disabled={accountsLoading}
                      >
                        <option value="">Pilih akun (untuk penjualan tunai)</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Metode Pembayaran
                      </label>
                      <select
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="credit">Kredit</option>
                        <option value="cash">Tunai</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('number')}
                      </label>
                      <input
                        type="text"
                        value={loadingNumber ? 'Loading...' : formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="INV/00001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('transactionDate')} <span className="text-red-500">*</span>
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
                        {t('dueDate')}
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
                        {t('term')}
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
                        {t('warehouse')}
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('reference')}
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
                        {t('tag')}
                      </label>
                      <select
                        value={formData.tag}
                        onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">{t('selectTag')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Expandable Sections */}
                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => setShowSalesPerson(!showSalesPerson)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                    >
                      {showSalesPerson ? <ChevronDown className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {t('showSalesPerson')}
                    </button>
                    {showSalesPerson && (
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="Sales Person"
                          value={formData.salesPerson}
                          onChange={(e) => setFormData({ ...formData, salesPerson: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    )}

                    <button
                      onClick={() => setShowShippingInfo(!showShippingInfo)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                    >
                      {showShippingInfo ? <ChevronDown className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {t('showShippingInfo')}
                    </button>
                  </div>
                </div>

                {/* Barcode Input and Tax Toggle */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      placeholder={t('scanBarcode')}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{t('priceIncludesTax')}</span>
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
                            {t('product')} <ChevronDown className="inline h-3 w-3" />
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('description')} <ChevronDown className="inline h-3 w-3" />
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            Spek <ChevronDown className="inline h-3 w-3" />
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('quantity')} <ChevronDown className="inline h-3 w-3" />
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('unit')} <ChevronDown className="inline h-3 w-3" />
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('discount')} <ChevronDown className="inline h-3 w-3" />
                          </th>
                          <th className="text-right py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300 w-36 whitespace-nowrap">
                            {t('price')} <ChevronDown className="inline h-3 w-3" />
                          </th>
                          <th className="text-right py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300 w-40 whitespace-nowrap">
                            {t('amount')} <ChevronDown className="inline h-3 w-3" />
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
                                <option value="">{t('selectProduct')}</option>
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
                                type="text"
                                value={item.spek ?? ''}
                                onChange={(e) => handleItemChange(index, 'spek', e.target.value)}
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
                                <option value="">Pilih...</option>
                                {(() => {
                                  const productUnits = [...new Set(products.map((p) => p.satuan || p.unit).filter(Boolean))]
                                  const common = ['pcs', 'kg', 'm', 'L', '%']
                                  const all = [...new Set([...productUnits, ...common])].sort()
                                  return all.map((u) => <option key={u} value={u}>{u}</option>)
                                })()}
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
                            <td className="py-2 px-2 text-right align-top">
                              <div className="inline-block w-32 text-right">
                                <FormattedNumberInput
                                  value={item.price}
                                  onChange={(value) => handleItemChange(index, 'price', value)}
                                  placeholder="0"
                                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900 text-sm text-right"
                                />
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right align-top whitespace-nowrap w-40">
                              <input
                                type="text"
                                value={formatNumber(item.amount)}
                                readOnly
                                className="inline-block w-36 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 dark:text-white text-sm text-right"
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
                    {t('addRow')}
                  </button>
                </div>

                {/* Detail Invoice (INV3 PERIZINAN fields) */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Detail Invoice
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Alamat Customer <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={formData.customerAddress}
                        onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Alamat customer sesuai invoice"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Attn. <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.attn}
                        onChange={(e) => setFormData({ ...formData, attn: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Procurement Division"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Kota (KWITANSI) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Cirebon"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Judul Pekerjaan (baris header tabel) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="PEKERJAAN PERIZINAN"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        ITEM PEKERJAAN (satu per baris) <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={formData.workItems}
                        onChange={(e) => setFormData({ ...formData, workItems: e.target.value })}
                        rows={5}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder={'1. KAJIAN ANDALALIN\n2. PERSETUJUAN TEKNIS AIR LIMBAH (PRETEK AIR LIMBAH )'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        NO SPH * <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.sphNumber}
                        onChange={(e) => setFormData({ ...formData, sphNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        NO PO * <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.poNumber}
                        onChange={(e) => {
                          poNumberUserEdited.current = true
                          setFormData({ ...formData, poNumber: e.target.value })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="043/PO/-CY/X/2024"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        TGL PO * <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={poDateIso}
                            onChange={(e) => {
                              const val = e.target.value
                              if (!val) {
                                setFormData({ ...formData, poDate: '' })
                                return
                              }
                              setFormData({ ...formData, poDate: formatDateToInv3TglPo(new Date(val + 'T12:00:00')) })
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                          <Calendar className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        </div>
                        {formData.poDate && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Format PDF: {formData.poDate}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        VAT Rate (%) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.vatRate}
                        onChange={(e) => setFormData({ ...formData, vatRate: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        PPH Rate (%) <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.pphRate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              pphRate: e.target.value === '' ? '' : Number(e.target.value),
                              pphValueManual: false,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              pphValueManual: !prev.pphValueManual,
                            }))
                          }
                          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                          title="Toggle manual PPH value"
                        >
                          Manual
                        </button>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        PPH Value (Rp) <span className="text-red-500">*</span>
                      </label>
                      <FormattedNumberInput
                        value={formData.pphValue}
                        onChange={(value) => setFormData({ ...formData, pphValue: value, pphValueManual: true })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-2">
                        Header Perusahaan & Bank
                      </h3>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nama Perusahaan <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Telp <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.companyPhone}
                        onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Alamat Perusahaan <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={formData.companyAddress}
                        onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.companyEmail}
                        onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Bank <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        No. Rek <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.bankAccountNo}
                        onChange={(e) => setFormData({ ...formData, bankAccountNo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        A/N <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.bankAccountName}
                        onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nama Penandatangan <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.signName}
                        onChange={(e) => setFormData({ ...formData, signName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Jabatan <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.signTitle}
                        onChange={(e) => setFormData({ ...formData, signTitle: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Collapsible Sections */}
                <div className="space-y-2">
                  <button
                    onClick={() => setShowMessage(!showMessage)}
                    className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <span className="text-gray-700 dark:text-gray-300">{t('message')}</span>
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
                    <span className="text-gray-700 dark:text-gray-300">{t('attachment')}</span>
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

                  <button
                    onClick={() => setShowPaymentConnect(!showPaymentConnect)}
                    className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <span className="text-gray-700 dark:text-gray-300">{t('paymentConnect')}</span>
                    {showPaymentConnect ? <ChevronDown className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Right Column - Summary */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 dark:text-gray-300">TOTAL (DPP)</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatNumber(calculateDpp())}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 dark:text-gray-300">
                        VAT {Number(formData.vatRate || 0)}% (+)
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatNumber(calculateVat())}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 dark:text-gray-300">SUB TOTAL</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatNumber(calculateSubTotalPdf())}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 dark:text-gray-300">
                        PPH (-)
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatNumber(calculatePphValue())}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {!showAdditionalDiscount && (
                        <button
                          onClick={() => setShowAdditionalDiscount(true)}
                          className="w-full text-left text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                        >
                          <Plus className="h-4 w-4" />
                          {t('additionalDiscount')}
                        </button>
                      )}
                      {showAdditionalDiscount && (
                        <OptionalFieldPopup
                          label={t('additionalDiscount')}
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
                          {t('shippingCost')}
                        </button>
                      )}
                      {showShippingCost && (
                        <OptionalFieldPopup
                          label={t('shippingCost')}
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
                          {t('transactionFee')}
                        </button>
                      )}
                      {showTransactionFee && (
                        <OptionalFieldPopup
                          label={t('transactionFee')}
                          value={formData.transactionFee}
                          onChange={(value) => setFormData({ ...formData, transactionFee: value })}
                          onClose={() => setShowTransactionFee(false)}
                        />
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                      <span className="font-semibold text-gray-900 dark:text-white">GRAND TOTAL</span>
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
                          {t('deduction')}
                        </button>
                      )}
                      {showDeduction && (
                        <OptionalFieldPopup
                          label={t('deduction')}
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
                          {t('downPayment')}
                        </button>
                      )}
                      {showDownPayment && (
                        <OptionalFieldPopup
                          label={t('downPayment')}
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
                      <span className="font-semibold text-gray-900 dark:text-white">{t('remainingBill')}</span>
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
                  <span>{t('save')}</span>
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
