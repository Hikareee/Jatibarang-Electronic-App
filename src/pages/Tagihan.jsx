import { useMemo, useState } from 'react'
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
  Loader2
} from 'lucide-react'
import { useInvoices } from '../hooks/useInvoiceData'
import { useContacts } from '../hooks/useContactsData'

export default function Tagihan() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { invoices, loading, error } = useInvoices()
  const { contacts } = useContacts()
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInvoices, setSelectedInvoices] = useState([])

  const contactNameById = useMemo(() => {
    if (!Array.isArray(contacts)) return {}
    const map = {}
    for (const c of contacts) {
      if (!c || !c.id) continue
      map[c.id] = c.name || c.company || c.email || ''
    }
    return map
  }, [contacts])

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

  // Get status label
  const getStatusLabel = (invoice) => {
    const remaining = invoice.remaining || 0
    const total = invoice.total || 0
    
    if (remaining === 0) return 'Lunas'
    if (remaining < total) return 'Dibayar Sebagian'
    return 'Belum Dibayar'
  }

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Lunas':
        return 'text-green-600 dark:text-green-400'
      case 'Dibayar Sebagian':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'Belum Dibayar':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  // Filter invoices based on status and search
  const filteredInvoices = invoices.filter(invoice => {
    const status = getStatusLabel(invoice)
    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'unpaid' && status === 'Belum Dibayar') ||
      (selectedStatus === 'partial' && status === 'Dibayar Sebagian') ||
      (selectedStatus === 'paid' && status === 'Lunas')
    
    const name =
      invoice.contactName ||
      invoice.customerName ||
      (invoice.customer && contactNameById[invoice.customer]) ||
      invoice.customer ||
      ''

    const matchesSearch = !searchQuery || 
      invoice.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.reference?.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesStatus && matchesSearch
  })

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
          <p className="text-gray-600 dark:text-gray-400">Memuat data tagihan...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t('invoices')}
              </h1>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">{t('reports')}</span>
                  <MoreVertical className="h-4 w-4 text-gray-400" />
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <HelpCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">{t('guide')}</span>
                  <MoreVertical className="h-4 w-4 text-gray-400" />
                </button>
                <button 
                  onClick={() => navigate('/sales/invoice/add')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span>{t('addInvoice')}</span>
                  <MoreVertical className="h-4 w-4" />
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Download className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">Import</span>
                  <MoreVertical className="h-4 w-4 text-gray-400" />
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

            {/* Filters and Search */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 mb-4">
              <div className="flex items-center gap-4 flex-wrap">
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">Filter</span>
                </button>
                <div className="relative">
                  <select className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
                    <option>{t('invoices')}</option>
                  </select>
                  <FileText className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
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
                    placeholder="01/12/2024 → 01/12/2025"
                    className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
                <MoreVertical className="inline h-4 w-4 ml-1" />
              </button>
            </div>

            {/* Invoice Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nomor
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Pelanggan
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Referensi
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tgl. Jatuh Tempo
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
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          {error ? 'Error loading invoices' : 'No invoices found'}
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((invoice) => {
                        const status = getStatusLabel(invoice)
                        return (
                          <tr 
                            key={invoice.id} 
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => navigate(`/penjualan/tagihan/${invoice.id}`)}
                          >
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedInvoices.includes(invoice.id)}
                                onChange={() => toggleSelectInvoice(invoice.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {invoice.number || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {invoice.contactName ||
                                invoice.customerName ||
                                (invoice.customer && contactNameById[invoice.customer]) ||
                                invoice.customer ||
                                'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {invoice.reference || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {formatDate(invoice.dueDate)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={getStatusColor(status)}>
                                {status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {formatNumber(invoice.remaining || 0)}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                              {formatNumber(invoice.total || 0)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
    </div>
  )
}

