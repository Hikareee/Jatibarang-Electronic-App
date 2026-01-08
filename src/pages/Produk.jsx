import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
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
  Loader2,
  LayoutGrid,
  Package,
  TrendingUp,
  Box,
  Layers,
  Settings
} from 'lucide-react'
import { useProducts } from '../hooks/useProductsData'

export default function Produk() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { products, loading, error } = useProducts()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProducts, setSelectedProducts] = useState([])
  const [showStockPerWarehouse, setShowStockPerWarehouse] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showTambahDropdown, setShowTambahDropdown] = useState(false)

  // Format number to Indonesian format
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0'
    return new Intl.NumberFormat('id-ID').format(num)
  }

  // Calculate summary metrics
  const summaryMetrics = products.reduce((acc, product) => {
    const qty = product.qty || 0
    const hargaBeli = product.hargaBeli || 0
    const totalValue = qty * hargaBeli

    acc.totalStock += qty
    acc.totalValue += totalValue

    if (qty > 0) {
      acc.stokTersedia++
    } else {
      acc.stokHabis++
    }

    // Assuming "hampir habis" means stock is between 1-10
    if (qty > 0 && qty <= 10) {
      acc.stokHampirHabis++
    }

    return acc
  }, {
    stokTersedia: 0,
    stokHampirHabis: 0,
    stokHabis: 0,
    totalStock: 0,
    totalValue: 0
  })

  // Filter products based on search
  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchQuery || 
      product.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.kode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.kategori?.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesSearch
  })

  const toggleSelectProduct = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id))
    }
  }

  // Get product icon based on category or type
  const getProductIcon = (product) => {
    const category = product.kategori?.toLowerCase() || ''
    if (category.includes('shoe') || category.includes('boot')) {
      return '👢'
    } else if (category.includes('computer') || category.includes('office')) {
      return '💻'
    } else if (category.includes('dress')) {
      return '👗'
    }
    return '📦'
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Memuat data produk...</p>
            </div>
          </main>
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
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Produk
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
                <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                  <TrendingUp className="h-5 w-5" />
                  <span>Aturan Harga</span>
                </button>
                <div className="relative">
                  <button 
                    onClick={() => setShowTambahDropdown(!showTambahDropdown)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    <span>Tambah</span>
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {showTambahDropdown && (
                    <>
                      <div 
                        className="fixed inset-0 z-10"
                        onClick={() => setShowTambahDropdown(false)}
                      ></div>
                      <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-20">
                        <button
                          onClick={() => {
                            setShowTambahDropdown(false)
                            navigate('/produk/tambah')
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          <Box className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          <span>Tambah Produk</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowTambahDropdown(false)
                            // Navigate to package product add page
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          <Layers className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          <span>Tambah Produk Paket</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowTambahDropdown(false)
                            // Navigate to manufacturing product add page
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          <span>Tambah Produk Manufaktur</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Download className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">Import</span>
                  <MoreVertical className="h-4 w-4 text-gray-400" />
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Printer className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">Print</span>
                  <MoreVertical className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                    <span className="text-green-600 dark:text-green-400 font-bold text-2xl">
                      {summaryMetrics.stokTersedia}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Produk Stok Tersedia</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600 dark:text-yellow-400 font-bold text-2xl">
                      {summaryMetrics.stokHampirHabis}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Produk Stok Hampir Habis</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                    <span className="text-red-600 dark:text-red-400 font-bold text-2xl">
                      {summaryMetrics.stokHabis}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Produk Stok Habis</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 dark:text-orange-400 font-bold text-lg">
                      {formatNumber(summaryMetrics.totalStock)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Stok</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">
                      {formatNumber(summaryMetrics.totalValue)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Nilai Proc</p>
                  </div>
                </div>
              </div>
            </div>

            {/* See More Link */}
            <div className="mb-4">
              <button
                onClick={() => setShowMore(!showMore)}
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
              >
                Lihat Selengkapnya
                <MoreVertical className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Filters and Search */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 mb-4">
              <div className="flex items-center gap-4 flex-wrap">
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">Filter</span>
                </button>
                <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <LayoutGrid className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Tampilkan stok per gudang</span>
                  <button
                    onClick={() => setShowStockPerWarehouse(!showStockPerWarehouse)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      showStockPerWarehouse ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      showStockPerWarehouse ? 'translate-x-6' : 'translate-x-0'
                    }`}></div>
                  </button>
                </div>
                <div className="relative flex-1 max-w-md ml-auto">
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Q Cari"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <MoreVertical className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nama
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Kode/SKU
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Kategori
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Satuan
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Harga Beli
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Harga Jual
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Qty
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        HPP
                        <MoreVertical className="inline h-3 w-3 ml-1" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          {error ? 'Error loading products' : 'No products found'}
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => (
                        <tr 
                          key={product.id} 
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(product.id)}
                              onChange={() => toggleSelectProduct(product.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {product.nama || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span>{product.kode || product.sku || '-'}</span>
                              <span className="text-lg">{getProductIcon(product)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {product.kategori || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {product.satuan || 'Pcs'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatNumber(product.hargaBeli || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatNumber(product.hargaJual || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatNumber(product.qty || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatNumber(product.hpp || 0)}
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

