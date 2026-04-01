import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useSidebarOpen } from '../hooks/useSidebarOpen'
import { 
  Filter,
  Search,
  FileText,
  HelpCircle,
  Plus,
  Download,
  Printer,
  MoreVertical,
  MessageCircle,
  Users,
  ChevronDown,
  Loader2,
  LayoutGrid,
  X,
  Camera,
  GripVertical,
  Trash2,
  Edit
} from 'lucide-react'
import { useContacts, saveContact, updateContact } from '../hooks/useContactsData'
import { useContactGroups, saveContactGroup, deleteContactGroup } from '../hooks/useContactGroupsData'
import { useUserApproval } from '../hooks/useUserApproval'

export default function Kontak() {
  const { sidebarOpen, toggleSidebar } = useSidebarOpen(true)
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { role } = useUserApproval()
  const canSeePayroll = role === 'owner'
  const { contacts, loading, error, refetch } = useContacts()
  const { groups, loading: groupsLoading, refetch: refetchGroups } = useContactGroups()
  const [selectedTab, setSelectedTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContacts, setSelectedContacts] = useState([])
  const [showMore, setShowMore] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [showGrupModal, setShowGrupModal] = useState(false)
  const [showTambahGrupModal, setShowTambahGrupModal] = useState(false)
  const [showMoreFields, setShowMoreFields] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [groupSearch, setGroupSearch] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupCode, setNewGroupCode] = useState('')
  const [selectedGroupForDelete, setSelectedGroupForDelete] = useState(null)
  
  const [formData, setFormData] = useState({
    types: [],
    group: '',
    salutation: '',
    name: '',
    number: '',
    company: '',
    phone: '',
    email: '',
    photo: null,
    payroll: {
      baseSalary: 0,
      ptkp: 'TK/0',
      npwp: '',
      bpjsEnabled: false,
      bank: { bankName: '', bankCode: '', accountNumber: '', accountName: '' },
    },
  })

  // Format number to Indonesian format
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0'
    return new Intl.NumberFormat('id-ID').format(num)
  }

  // Get contact type color
  const getContactTypeColor = (type) => {
    switch (type) {
      case 'Vendor':
        return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'Pelanggan':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'Pegawai':
        return 'bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  // Filter contacts based on tab and search
  const filteredContacts = contacts.filter(contact => {
    const matchesTab = selectedTab === 'all' || 
      (selectedTab === 'vendor' && contact.types?.includes('Vendor')) ||
      (selectedTab === 'pegawai' && contact.types?.includes('Pegawai')) ||
      (selectedTab === 'pelanggan' && contact.types?.includes('Pelanggan')) ||
      (selectedTab === 'investor' && contact.types?.includes('Investor')) ||
      (selectedTab === 'lainnya' && !['Vendor', 'Pegawai', 'Pelanggan', 'Investor'].some(t => contact.types?.includes(t)))
    
    const matchesSearch = !searchQuery || 
      contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone?.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesTab && matchesSearch
  })

  const toggleSelectContact = (contactId) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts(filteredContacts.map(contact => contact.id))
    }
  }

  // Calculate summary metrics
  const summaryMetrics = contacts.reduce((acc, contact) => {
    acc.andaHutang += contact.andaHutang || 0
    acc.merekaHutang += contact.merekaHutang || 0
    acc.pembayaranDiterima += contact.pembayaranDiterima || 0
    acc.hutangAndaJatuhTempo += contact.hutangAndaJatuhTempo || 0
    acc.hutangMereka += contact.hutangMereka || 0
    if (contact.andaHutang > 0) acc.countAndaHutang++
    if (contact.merekaHutang > 0) acc.countMerekaHutang++
    if (contact.pembayaranDiterima > 0) acc.countPembayaranDiterima++
    if (contact.hutangAndaJatuhTempo > 0) acc.countHutangAndaJatuhTempo++
    if (contact.hutangMereka > 0) acc.countHutangMereka++
    return acc
  }, {
    andaHutang: 0,
    merekaHutang: 0,
    pembayaranDiterima: 0,
    hutangAndaJatuhTempo: 0,
    hutangMereka: 0,
    countAndaHutang: 0,
    countMerekaHutang: 0,
    countPembayaranDiterima: 0,
    countHutangAndaJatuhTempo: 0,
    countHutangMereka: 0
  })

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={toggleSidebar} />
          <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Memuat data kontak...</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={toggleSidebar} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Kontak
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
                  onClick={() => setShowGrupModal(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">+ Grup</span>
                </button>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span> Tambah</span>
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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600 dark:text-yellow-400 font-bold text-lg">
                      {summaryMetrics.countAndaHutang}
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatNumber(summaryMetrics.andaHutang)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Anda Hutang</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                    <span className="text-red-600 dark:text-red-400 font-bold text-lg">
                      {summaryMetrics.countMerekaHutang}
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatNumber(summaryMetrics.merekaHutang)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Mereka Hutang</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 dark:text-orange-400 font-bold text-lg">
                      {summaryMetrics.countPembayaranDiterima}
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatNumber(summaryMetrics.pembayaranDiterima)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Pembayaran diterima</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                      {summaryMetrics.countHutangAndaJatuhTempo}
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatNumber(summaryMetrics.hutangAndaJatuhTempo)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Hutang Anda jatuh tempo</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/20 rounded-full flex items-center justify-center">
                    <span className="text-pink-600 dark:text-pink-400 font-bold text-lg">
                      {summaryMetrics.countHutangMereka}
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatNumber(summaryMetrics.hutangMereka)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Hutang mereka</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Selection Bar */}
            {selectedContacts.length > 0 && (
              <div className="mb-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-blue-700 dark:text-blue-300 font-medium">
                    Tampilkan {selectedContacts.length} baris dipilih
                  </span>
                  <button
                    onClick={() => setSelectedContacts([])}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {selectedContacts.length === 1 && (
                    <button
                      onClick={() => {
                        const contactToEdit = contacts.find(c => c.id === selectedContacts[0])
                        if (contactToEdit) {
                          // Parse name to extract salutation if present
                          let salutation = contactToEdit.salutation || ''
                          let name = contactToEdit.name || ''
                          
                          // If name starts with salutation, extract it
                          if (!salutation && name) {
                            const salutationMatch = name.match(/^(Mr|Mrs|Ms|Dr|PT|Toko|CV|UD|Koperasi)\s+/i)
                            if (salutationMatch) {
                              salutation = salutationMatch[1]
                              name = name.replace(/^(Mr|Mrs|Ms|Dr|PT|Toko|CV|UD|Koperasi)\s+/i, '').trim()
                            }
                          }
                          
                          setEditingContact(contactToEdit)
                          setFormData({
                            types: contactToEdit.types || [],
                            group: contactToEdit.group || '',
                            salutation: salutation,
                            name: name,
                            number: contactToEdit.number || '',
                            company: contactToEdit.company || '',
                            phone: contactToEdit.phone || '',
                            email: contactToEdit.email || '',
                            photo: null,
                          })
                          setShowEditModal(true)
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                      <span>Edit</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      // Handle delete action
                      if (window.confirm(`Hapus ${selectedContacts.length} kontak yang dipilih?`)) {
                        // TODO: Implement delete functionality
                        setSelectedContacts([])
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            )}

            {/* See More Link */}
            <div className="mb-4">
              <button
                onClick={() => setShowMore(!showMore)}
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
              >
                Lihat Selengkapnya
                <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Filters and Search */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 mb-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowFilterModal(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">Filter</span>
                </button>
                <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <LayoutGrid className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Q Cari"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Contact Type Tabs */}
            <div className="flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setSelectedTab('all')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  selectedTab === 'all'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setSelectedTab('vendor')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  selectedTab === 'vendor'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Vendor
              </button>
              <button
                onClick={() => setSelectedTab('pegawai')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  selectedTab === 'pegawai'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Pegawai
              </button>
              <button
                onClick={() => setSelectedTab('pelanggan')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  selectedTab === 'pelanggan'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Pelanggan
              </button>
              <button
                onClick={() => setSelectedTab('investor')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  selectedTab === 'investor'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Investor
              </button>
              <button
                onClick={() => setSelectedTab('lainnya')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  selectedTab === 'lainnya'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Lainnya
              </button>
            </div>

            {/* Contacts Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nama
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tipe Kontak
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Perusahaan
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Email
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Telepon
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Anda Hutang
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Mereka Hutang
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredContacts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          {error ? 'Error loading contacts' : 'No contacts found'}
                        </td>
                      </tr>
                    ) : (
                      filteredContacts.map((contact) => (
                        <tr 
                          key={contact.id} 
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          onClick={() => navigate(`/kontak/${contact.id}`)}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedContacts.includes(contact.id)}
                              onChange={() => toggleSelectContact(contact.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {contact.name || 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {contact.types?.map((type, index) => (
                                <span
                                  key={index}
                                  className={`px-2 py-1 text-xs rounded ${getContactTypeColor(type)}`}
                                >
                                  {type}
                                </span>
                              )) || <span className="text-sm text-gray-500 dark:text-gray-400">-</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {contact.company || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {contact.email || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {contact.phone || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatNumber(contact.andaHutang || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatNumber(contact.merekaHutang || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
        
        <Footer />
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop with dimming effect */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowFilterModal(false)}
          ></div>
          
          {/* Filter Panel */}
          <div className="relative bg-white dark:bg-gray-800 rounded-r-lg shadow-xl w-80 h-full overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Filter
              </h2>
              <button
                onClick={() => setShowFilterModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">

              <div className="space-y-4">
                {/* Grup Kontak */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Grup Kontak
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white">
                    <option value="">Semua Grup</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tampilkan Arsip */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tampilkan Arsip
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white">
                    <option value="no-archive">Tanpa arsip</option>
                    <option value="with-archive">Dengan arsip</option>
                    <option value="all">Semua</option>
                  </select>
                </div>

                {/* Foto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Foto
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white">
                    <option value="all">Semua</option>
                    <option value="with-photo">Dengan foto</option>
                    <option value="no-photo">Tanpa foto</option>
                  </select>
                </div>

                {/* Provinsi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Provinsi
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white">
                    <option value="">Provinsi</option>
                    {/* Add province options here if needed */}
                  </select>
                </div>

                {/* Kota */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kota
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white">
                    <option value="">Kota</option>
                    {/* Add city options here if needed */}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop with dimming effect */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowAddModal(false)}
          ></div>
          
          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Tambah Kontak
              </h2>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <HelpCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">{t('guide')}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Photo Section */}
              <button className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Tampilkan Foto
              </button>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tipe Kontak */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <span className="text-red-500">*</span> Tipe Kontak
                  </label>
                  <select
                    value={formData.types[0] || ''}
                    onChange={(e) => setFormData({ ...formData, types: e.target.value ? [e.target.value] : [] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Pilih tipe kontak</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Pelanggan">Pelanggan</option>
                    <option value="Pegawai">Pegawai</option>
                    <option value="Investor">Investor</option>
                  </select>
                </div>

                {/* Grup */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Grup
                  </label>
                  <select
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={groupsLoading}
                  >
                    <option value="">Semua Grup</option>
                    {groupsLoading ? (
                      <option value="" disabled>Memuat grup...</option>
                    ) : (
                      groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Nama - Salutation and Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <span className="text-red-500">*</span> Nama
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={formData.salutation}
                      onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Sapaan</option>
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Ms">Ms</option>
                      <option value="Dr">Dr</option>
                      <option value="PT">PT</option>
                      <option value="CV">CV</option>
                      <option value="UD">UD</option>
                      <option value="Toko">Toko</option>
                      <option value="Koperasi">Koperasi</option>
                    </select>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nama"
                      className="col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* Nomor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nomor
                  </label>
                  <input
                    type="text"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    placeholder="Nomor"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Perusahaan */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Perusahaan
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Perusahaan"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Telepon */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Telepon
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Telepon"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Email */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Email"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Show More Link */}
              <button
                onClick={() => setShowMoreFields(!showMoreFields)}
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Tampilkan selengkapnya
              </button>

              {/* Additional Fields (when showMoreFields is true) */}
              {showMoreFields && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {/* Add more fields here if needed */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Alamat
                    </label>
                    <textarea
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Alamat"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Catatan
                    </label>
                    <textarea
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Catatan"
                    />
                  </div>

                  {/* Payroll fields for Pegawai (owner-only) */}
                  {canSeePayroll && formData.types?.includes('Pegawai') && (
                    <div className="md:col-span-2">
                      <div className="mt-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Payroll</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Isi data payroll & bank transfer untuk pembayaran massal.
                        </p>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Gaji pokok (bulanan)
                            </label>
                            <input
                              type="number"
                              value={formData.payroll?.baseSalary ?? 0}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  payroll: { ...(prev.payroll || {}), baseSalary: e.target.value },
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">PTKP</label>
                            <select
                              value={formData.payroll?.ptkp || 'TK/0'}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  payroll: { ...(prev.payroll || {}), ptkp: e.target.value },
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                              <option value="TK/0">TK/0</option>
                              <option value="TK/1">TK/1</option>
                              <option value="TK/2">TK/2</option>
                              <option value="TK/3">TK/3</option>
                              <option value="K/0">K/0</option>
                              <option value="K/1">K/1</option>
                              <option value="K/2">K/2</option>
                              <option value="K/3">K/3</option>
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">NPWP</label>
                            <input
                              value={formData.payroll?.npwp || ''}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  payroll: { ...(prev.payroll || {}), npwp: e.target.value },
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                          </div>

                          <div className="md:col-span-2 flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/30">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">BPJS</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Aktifkan placeholder iuran (MVP).</p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  payroll: { ...(prev.payroll || {}), bpjsEnabled: !(prev.payroll || {}).bpjsEnabled },
                                }))
                              }
                              className={`relative w-12 h-6 rounded-full transition-colors ${
                                formData.payroll?.bpjsEnabled ? 'bg-blue-600' : 'bg-gray-300'
                              }`}
                            >
                              <div
                                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                                  formData.payroll?.bpjsEnabled ? 'translate-x-6' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          <div className="md:col-span-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-2">Bank transfer</p>
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Bank (nama)
                                </label>
                                <input
                                  value={formData.payroll?.bank?.bankName || ''}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      payroll: {
                                        ...(prev.payroll || {}),
                                        bank: { ...((prev.payroll || {}).bank || {}), bankName: e.target.value },
                                      },
                                    }))
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                  placeholder="BCA / BRI / Mandiri / BNI / ..."
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Kode bank (opsional)
                                </label>
                                <input
                                  value={formData.payroll?.bank?.bankCode || ''}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      payroll: {
                                        ...(prev.payroll || {}),
                                        bank: { ...((prev.payroll || {}).bank || {}), bankCode: e.target.value },
                                      },
                                    }))
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                  placeholder="014 (BCA), 002 (BRI), 008 (Mandiri)..."
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  No. rekening
                                </label>
                                <input
                                  value={formData.payroll?.bank?.accountNumber || ''}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      payroll: {
                                        ...(prev.payroll || {}),
                                        bank: { ...((prev.payroll || {}).bank || {}), accountNumber: e.target.value },
                                      },
                                    }))
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Nama pemilik rekening
                                </label>
                                <input
                                  value={formData.payroll?.bank?.accountName || ''}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      payroll: {
                                        ...(prev.payroll || {}),
                                        bank: { ...((prev.payroll || {}).bank || {}), accountName: e.target.value },
                                      },
                                    }))
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setFormData({
                    types: [],
                    group: '',
                    salutation: '',
                    name: '',
                    number: '',
                    company: '',
                    phone: '',
                    email: '',
                    photo: null,
                    payroll: {
                      baseSalary: 0,
                      ptkp: 'TK/0',
                      npwp: '',
                      bpjsEnabled: false,
                      bank: { bankName: '', bankCode: '', accountNumber: '', accountName: '' },
                    },
                  })
                  setShowMoreFields(false)
                }}
                className="flex items-center gap-2 px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <X className="h-5 w-5" />
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!formData.name || formData.types.length === 0) {
                    alert('Nama dan Tipe Kontak wajib diisi')
                    return
                  }
                  
                  try {
                    setSaving(true)
                    const contactData = {
                      ...formData,
                      fullName: formData.salutation ? `${formData.salutation} ${formData.name}` : formData.name,
                      andaHutang: 0,
                      merekaHutang: 0,
                      pembayaranDiterima: 0,
                      hutangAndaJatuhTempo: 0,
                      hutangMereka: 0,
                    }
                    await saveContact(contactData)
                    setShowAddModal(false)
                    setFormData({
                      types: [],
                      group: '',
                      salutation: '',
                      name: '',
                      number: '',
                      company: '',
                      phone: '',
                      email: '',
                      photo: null,
                      payroll: {
                        baseSalary: 0,
                        ptkp: 'TK/0',
                        npwp: '',
                        bpjsEnabled: false,
                        bank: { bankName: '', bankCode: '', accountNumber: '', accountName: '' },
                      },
                    })
                    setShowMoreFields(false)
                    // Refresh contacts list
                    await refetch()
                  } catch (error) {
                    console.error('Error saving contact:', error)
                    console.error('Error code:', error.code)
                    console.error('Error message:', error.message)
                    alert(`Gagal menyimpan kontak: ${error.message || 'Unknown error'}`)
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-5 w-5" />
                {saving ? 'Menyimpan...' : 'Tambah'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {showEditModal && editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop with dimming effect */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => {
              setShowEditModal(false)
              setEditingContact(null)
            }}
          ></div>
          
          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Edit Kontak
              </h2>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <HelpCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">{t('guide')}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingContact(null)
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Photo Section */}
              <button className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Tampilkan Foto
              </button>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tipe Kontak */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <span className="text-red-500">*</span> Tipe Kontak
                  </label>
                  <select
                    value={formData.types[0] || ''}
                    onChange={(e) => setFormData({ ...formData, types: e.target.value ? [e.target.value] : [] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Pilih tipe kontak</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Pelanggan">Pelanggan</option>
                    <option value="Pegawai">Pegawai</option>
                    <option value="Investor">Investor</option>
                  </select>
                </div>

                {/* Grup */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Grup
                  </label>
                  <select
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={groupsLoading}
                  >
                    <option value="">Semua Grup</option>
                    {groupsLoading ? (
                      <option value="" disabled>Memuat grup...</option>
                    ) : (
                      groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Nama - Salutation and Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <span className="text-red-500">*</span> Nama
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={formData.salutation}
                      onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Sapaan</option>
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Ms">Ms</option>
                      <option value="Dr">Dr</option>
                    </select>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nama"
                      className="col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* Nomor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nomor
                  </label>
                  <input
                    type="text"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    placeholder="Nomor"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Perusahaan */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Perusahaan
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Perusahaan"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Telepon */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Telepon
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Telepon"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Email */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Email"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Show More Link */}
              <button
                onClick={() => setShowMoreFields(!showMoreFields)}
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Tampilkan selengkapnya
              </button>

              {/* Additional Fields (when showMoreFields is true) */}
              {showMoreFields && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Alamat
                    </label>
                    <textarea
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Alamat"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Catatan
                    </label>
                    <textarea
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Catatan"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingContact(null)
                  setShowMoreFields(false)
                }}
                className="flex items-center gap-2 px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <X className="h-5 w-5" />
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!formData.name || formData.types.length === 0) {
                    alert('Nama dan Tipe Kontak wajib diisi')
                    return
                  }
                  
                  try {
                    setSaving(true)
                    const contactData = {
                      ...formData,
                      fullName: formData.salutation ? `${formData.salutation} ${formData.name}` : formData.name,
                    }
                    await updateContact(editingContact.id, contactData)
                    setShowEditModal(false)
                    setEditingContact(null)
                    setShowMoreFields(false)
                    setSelectedContacts([])
                    // Refresh contacts list
                    await refetch()
                  } catch (error) {
                    console.error('Error updating contact:', error)
                    console.error('Error code:', error.code)
                    console.error('Error message:', error.message)
                    alert(`Gagal mengupdate kontak: ${error.message || 'Unknown error'}`)
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Edit className="h-5 w-5" />
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grup Modal - List View */}
      {showGrupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop with dimming effect */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => {
              setShowGrupModal(false)
              setGroupSearch('')
              setSelectedGroupForDelete(null)
            }}
          ></div>
          
          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Grup
              </h2>
              <button
                onClick={() => {
                  setShowGrupModal(false)
                  setGroupSearch('')
                  setSelectedGroupForDelete(null)
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Search Bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Groups List */}
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 px-2">
                  Nama
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {groupsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  ) : groups.filter(group => 
                    groupSearch === '' || group.name.toLowerCase().includes(groupSearch.toLowerCase())
                  ).length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                      Tidak ada grup
                    </div>
                  ) : (
                    groups
                      .filter(group => 
                        groupSearch === '' || group.name.toLowerCase().includes(groupSearch.toLowerCase())
                      )
                      .map((group) => (
                        <div
                          key={group.id}
                          className={`flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg group ${
                            selectedGroupForDelete === group.id ? 'bg-red-50 dark:bg-red-900/20' : ''
                          }`}
                        >
                          <GripVertical className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          <span className="flex-1 text-blue-600 dark:text-blue-400 font-medium">
                            {group.name}
                          </span>
                          <button
                            onClick={() => {
                              if (selectedGroupForDelete === group.id) {
                                setSelectedGroupForDelete(null)
                              } else {
                                setSelectedGroupForDelete(group.id)
                              }
                            }}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-5 w-5 text-gray-400" />
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
              {selectedGroupForDelete && (
                <button
                  onClick={async () => {
                    if (window.confirm('Apakah Anda yakin ingin menghapus grup ini?')) {
                      try {
                        await deleteContactGroup(selectedGroupForDelete)
                        refetchGroups()
                        setSelectedGroupForDelete(null)
                      } catch (error) {
                        console.error('Error deleting group:', error)
                        alert('Gagal menghapus grup')
                      }
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                  Hapus
                </button>
              )}
              <button
                onClick={() => {
                  setShowTambahGrupModal(true)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ml-auto"
              >
                <Plus className="h-5 w-5" />
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tambah Grup Modal - Add Form */}
      {showTambahGrupModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop with dimming effect */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => {
              setShowTambahGrupModal(false)
              setNewGroupName('')
              setNewGroupCode('')
            }}
          ></div>
          
          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Tambah Grup
              </h2>
              <button
                onClick={() => {
                  setShowTambahGrupModal(false)
                  setNewGroupName('')
                  setNewGroupCode('')
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nama
                  </label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Nama"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kode
                  </label>
                  <input
                    type="text"
                    value={newGroupCode}
                    onChange={(e) => setNewGroupCode(e.target.value)}
                    placeholder="Kode"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Existing Groups List */}
              <div className="mt-6">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 px-2">
                  Nama
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {groupsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  ) : groups.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                      Tidak ada grup
                    </div>
                  ) : (
                    groups.map((group) => (
                      <div
                        key={group.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
                      >
                        <GripVertical className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <span className="flex-1 text-blue-600 dark:text-blue-400 font-medium">
                          {group.name}
                        </span>
                        <button className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                          <MoreVertical className="h-5 w-5 text-gray-400" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowTambahGrupModal(false)
                  setNewGroupName('')
                  setNewGroupCode('')
                }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <X className="h-5 w-5" />
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!newGroupName.trim()) {
                    alert('Nama grup wajib diisi')
                    return
                  }
                  try {
                    await saveContactGroup({ 
                      name: newGroupName.trim(),
                      code: newGroupCode.trim() || undefined
                    })
                    refetchGroups()
                    setShowTambahGrupModal(false)
                    setNewGroupName('')
                    setNewGroupCode('')
                  } catch (error) {
                    console.error('Error saving group:', error)
                    alert('Gagal menambahkan grup')
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

