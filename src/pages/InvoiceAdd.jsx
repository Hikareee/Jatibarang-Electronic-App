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
  X,
  Plus,
  Trash2,
  Save,
  MessageCircle
} from 'lucide-react'
import { saveInvoice, getNextInvoiceNumber } from '../hooks/useInvoiceData'
import { useContacts } from '../hooks/useContactsData'
import { useAccounts } from '../hooks/useAccountsData'

export default function InvoiceAdd() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { contacts, loading: contactsLoading } = useContacts()
  const { accounts, loading: accountsLoading } = useAccounts()
  
  const [formData, setFormData] = useState({
    customer: '',
    account: '', // Account to credit for cash sales
    paymentMethod: 'credit', // 'cash' or 'credit'
    number: '',
    transactionDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    term: 'Net 30',
    warehouse: 'Unassigned',
    reference: '',
    tag: '',
    salesPerson: '',
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

  // Auto-generate invoice number on mount
  useEffect(() => {
    const fetchNextNumber = async () => {
      try {
        setLoadingNumber(true)
        const nextNumber = await getNextInvoiceNumber()
        setFormData(prev => ({ ...prev, number: nextNumber }))
      } catch (error) {
        console.error('Error fetching next invoice number:', error)
        setFormData(prev => ({ ...prev, number: 'INV/00001' }))
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
        subTotal: calculateSubTotal(),
        total: calculateTotal(),
        remaining: calculateRemaining(),
        createdAt: new Date().toISOString(),
      }
      await saveInvoice(invoiceData)
      navigate('/penjualan/tagihan')
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
                        {t('warehouse')} <span className="text-red-500">*</span>
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
                            {t('quantity')} <ChevronDown className="inline h-3 w-3" />
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('unit')} <ChevronDown className="inline h-3 w-3" />
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('discount')} <ChevronDown className="inline h-3 w-3" />
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('price')} <ChevronDown className="inline h-3 w-3" />
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('tax')} <ChevronDown className="inline h-3 w-3" />
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
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
                              >
                                <option value="">{t('selectProduct')}</option>
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
                                <option value="">Pilih...</option>
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
                              <input
                                type="number"
                                value={item.price === '' ? '' : item.price}
                                placeholder="0"
                                onChange={(e) => handleItemChange(index, 'price', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
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
                    {t('addRow')}
                  </button>
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
                      <span className="text-gray-700 dark:text-gray-300">{t('subTotal')}</span>
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
                      <span className="font-semibold text-gray-900 dark:text-white">{t('total')}</span>
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

// Optional Field Popup Component
function OptionalFieldPopup({ label, value, onChange, onClose }) {
  const [localValue, setLocalValue] = useState(value || { account: '', type: 'Rp', value: 0 })

  const handleSave = () => {
    onChange(localValue)
  }

  const handleClose = () => {
    handleSave()
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
          <input
            type="number"
            value={localValue.value}
            onChange={(e) => {
              const newValue = { ...localValue, value: parseFloat(e.target.value) || 0 }
              setLocalValue(newValue)
              onChange(newValue)
            }}
            className="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-white dark:text-gray-900 text-sm"
          />
          <span className="font-bold text-gray-900 dark:text-white">
            {new Intl.NumberFormat('id-ID').format(localValue.value || 0)}
          </span>
        </div>
      </div>
    </div>
  )
}

// Format number helper
function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('id-ID').format(num)
}

