import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { 
  ChevronLeft, 
  ChevronDown, 
  HelpCircle, 
  X,
  Plus,
  Save,
  MessageCircle,
  Image as ImageIcon
} from 'lucide-react'
import { saveProduct } from '../hooks/useProductsData'
import FormattedNumberInput from '../components/FormattedNumberInput'

export default function ProductAdd() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    nama: '',
    kategori: '',
    kode: 'SKU/00001',
    satuan: 'Pcs',
    deskripsi: '',
    sayaBeli: true,
    hargaBeli: 0,
    sayaJual: true,
    hargaJual: 0,
    accountSettings: {},
    taxSettings: {},
    wholesalePrices: [],
  })

  const [showImage, setShowImage] = useState(false)
  const [showAccountTax, setShowAccountTax] = useState(false)
  const [showWholesalePrice, setShowWholesalePrice] = useState(false)

  const handleSave = async () => {
    if (!formData.nama || !formData.kategori || !formData.satuan) {
      alert('Nama Produk, Kategori, dan Satuan wajib diisi')
      return
    }

    try {
      setSaving(true)
      const productData = {
        ...formData,
        qty: 0, // Default quantity
        hpp: 0, // Default HPP
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await saveProduct(productData)
      navigate('/produk')
    } catch (error) {
      console.error('Error saving product:', error)
      alert('Gagal menyimpan produk')
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
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumbs */}
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Beranda &gt; Produk &gt; Tambah
            </div>

            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Tambah Produk
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

            {/* Form */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 space-y-6">
              {/* Image Section */}
              <div>
                <button
                  onClick={() => setShowImage(!showImage)}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                >
                  {showImage ? <ChevronDown className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  Tampilkan Gambar Produk
                </button>
                {showImage && (
                  <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                      <div className="text-center">
                        <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">Upload gambar produk</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nama Produk <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    placeholder="Nama Produk"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.kategori}
                    onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Pilih Kategori</option>
                    <option value="Shoes">Shoes</option>
                    <option value="Office Asset">Office Asset</option>
                    <option value="Dress">Dress</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    Kode/SKU
                    <HelpCircle className="h-4 w-4 text-gray-400" />
                  </label>
                  <input
                    type="text"
                    value={formData.kode}
                    onChange={(e) => setFormData({ ...formData, kode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Satuan <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.satuan}
                    onChange={(e) => setFormData({ ...formData, satuan: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Kg">Kg</option>
                    <option value="Liter">Liter</option>
                    <option value="Meter">Meter</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Deskripsi
                  </label>
                  <textarea
                    value={formData.deskripsi}
                    onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                    rows={4}
                    placeholder="Deskripsi"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Account and Tax Settings */}
              <div>
                <button
                  onClick={() => setShowAccountTax(!showAccountTax)}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                >
                  {showAccountTax ? <ChevronDown className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  Tampilkan pengaturan akun dan pajak
                </button>
                {showAccountTax && (
                  <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Account and tax settings fields will go here</p>
                  </div>
                )}
              </div>

              {/* Purchase and Sale Settings */}
              <div className="space-y-4">
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Saya membeli item ini
                    </label>
                    <button
                      onClick={() => setFormData({ ...formData, sayaBeli: !formData.sayaBeli })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        formData.sayaBeli ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        formData.sayaBeli ? 'translate-x-6' : 'translate-x-0'
                      }`}></div>
                    </button>
                  </div>
                  {formData.sayaBeli && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Harga
                      </label>
                      <FormattedNumberInput
                        value={formData.hargaBeli}
                        onChange={(value) => setFormData({ ...formData, hargaBeli: value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Saya menjual item ini
                    </label>
                    <button
                      onClick={() => setFormData({ ...formData, sayaJual: !formData.sayaJual })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        formData.sayaJual ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        formData.sayaJual ? 'translate-x-6' : 'translate-x-0'
                      }`}></div>
                    </button>
                  </div>
                  {formData.sayaJual && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Harga
                      </label>
                      <FormattedNumberInput
                        value={formData.hargaJual}
                        onChange={(value) => setFormData({ ...formData, hargaJual: value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <button
                    onClick={() => setShowWholesalePrice(!showWholesalePrice)}
                    className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                  >
                    {showWholesalePrice ? <ChevronDown className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    Tampilkan Harga Grosir
                  </button>
                  {showWholesalePrice && (
                    <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Wholesale price settings will go here</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Save className="h-5 w-5" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan'}</span>
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

