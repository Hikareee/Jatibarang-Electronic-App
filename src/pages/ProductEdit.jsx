import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useUserApproval } from '../hooks/useUserApproval'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import {
  ChevronLeft,
  ChevronDown,
  HelpCircle,
  Plus,
  Save,
  Image as ImageIcon,
} from 'lucide-react'
import { getProductById, updateProduct } from '../hooks/useProductsData'
import FormattedNumberInput from '../components/FormattedNumberInput'

const defaultForm = {
  nama: '',
  kategori: '',
  kode: '',
  satuan: 'Pcs',
  deskripsi: '',
  sayaBeli: true,
  hargaBeli: 0,
  sayaJual: true,
  hargaJual: 0,
  qty: 0,
  hpp: 0,
  accountSettings: {},
  taxSettings: {},
  wholesalePrices: [],
}

export default function ProductEdit() {
  const { id } = useParams()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { canEditApproved, loading: approvalLoading } = useUserApproval()
  const canEdit = canEditApproved && !approvalLoading

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [formData, setFormData] = useState(defaultForm)
  const skuRef = useRef(null)

  const [showImage, setShowImage] = useState(false)
  const [showAccountTax, setShowAccountTax] = useState(false)
  const [showWholesalePrice, setShowWholesalePrice] = useState(false)

  const autosizeSku = () => {
    const el = skuRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!id) {
        setLoadError('missing id')
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        setLoadError(null)
        const p = await getProductById(id)
        if (!alive) return
        if (!p) {
          setLoadError('notfound')
          setLoading(false)
          return
        }
        setFormData({
          nama: p.nama || '',
          kategori: p.kategori || '',
          kode: p.kode || p.sku || '',
          satuan: p.satuan || 'Pcs',
          deskripsi: p.deskripsi || '',
          sayaBeli: p.sayaBeli !== false,
          hargaBeli: p.hargaBeli ?? 0,
          sayaJual: p.sayaJual !== false,
          hargaJual: p.hargaJual ?? 0,
          qty: p.qty ?? 0,
          hpp: p.hpp ?? 0,
          accountSettings: p.accountSettings || {},
          taxSettings: p.taxSettings || {},
          wholesalePrices: p.wholesalePrices || [],
        })
      } catch (err) {
        console.error(err)
        if (alive) setLoadError('error')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    autosizeSku()
  }, [formData.kode])

  const handleSave = async () => {
    if (!canEdit) {
      alert('Hanya pemilik (owner) yang dapat mengedit produk.')
      return
    }
    if (!formData.nama || !formData.kategori || !formData.satuan) {
      alert('Nama Produk, Kategori, dan Satuan wajib diisi')
      return
    }

    try {
      setSaving(true)
      await updateProduct(id, {
        nama: formData.nama,
        kategori: formData.kategori,
        kode: formData.kode,
        sku: formData.kode,
        satuan: formData.satuan,
        deskripsi: formData.deskripsi,
        sayaBeli: formData.sayaBeli,
        hargaBeli: Number(formData.hargaBeli) || 0,
        sayaJual: formData.sayaJual,
        hargaJual: Number(formData.hargaJual) || 0,
        qty: Number(formData.qty) || 0,
        hpp: Number(formData.hpp) || 0,
        accountSettings: formData.accountSettings,
        taxSettings: formData.taxSettings,
        wholesalePrices: formData.wholesalePrices,
      })
      navigate('/produk')
    } catch (error) {
      console.error('Error updating product:', error)
      alert('Gagal menyimpan perubahan produk')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-gray-600 dark:text-gray-400">Memuat produk…</p>
          </main>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
            <p className="text-gray-700 dark:text-gray-300">Produk tidak ditemukan atau gagal dimuat.</p>
            <button
              type="button"
              onClick={() => navigate('/produk')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Kembali ke daftar
            </button>
          </main>
        </div>
      </div>
    )
  }

  const disabled = !canEdit

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Beranda &gt; Produk &gt; Edit
            </div>

            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Produk</h1>
              <div className="flex items-center gap-3">
                {!canEdit && !approvalLoading && (
                  <span className="text-sm text-amber-600 dark:text-amber-400">
                    Lihat saja — hanya owner yang dapat mengubah.
                  </span>
                )}
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <HelpCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">{t('guide')}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span>{t('back')}</span>
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 space-y-6">
              <div>
                <button
                  type="button"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nama Produk <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    disabled={disabled}
                    placeholder="Nama Produk"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.kategori}
                    onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
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
                  <textarea
                    ref={skuRef}
                    value={formData.kode}
                    onChange={(e) => setFormData({ ...formData, kode: e.target.value })}
                    onInput={autosizeSku}
                    rows={1}
                    disabled={disabled}
                    placeholder="SKU/00001"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none overflow-hidden disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Satuan <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.satuan}
                    onChange={(e) => setFormData({ ...formData, satuan: e.target.value })}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Kg">Kg</option>
                    <option value="Liter">Liter</option>
                    <option value="Meter">Meter</option>
                  </select>
                </div>

                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Qty stok
                    </label>
                    <FormattedNumberInput
                      value={formData.qty}
                      onChange={(value) => setFormData({ ...formData, qty: value })}
                      disabled={disabled}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      HPP
                    </label>
                    <FormattedNumberInput
                      value={formData.hpp}
                      onChange={(value) => setFormData({ ...formData, hpp: value })}
                      disabled={disabled}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Deskripsi
                  </label>
                  <textarea
                    value={formData.deskripsi}
                    onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                    rows={4}
                    disabled={disabled}
                    placeholder="Deskripsi"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowAccountTax(!showAccountTax)}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                >
                  {showAccountTax ? <ChevronDown className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  Tampilkan pengaturan akun dan pajak
                </button>
                {showAccountTax && (
                  <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Account and tax settings fields will go here
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Saya membeli item ini
                    </label>
                    <button
                      type="button"
                      onClick={() => canEdit && setFormData({ ...formData, sayaBeli: !formData.sayaBeli })}
                      disabled={disabled}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        formData.sayaBeli ? 'bg-blue-600' : 'bg-gray-300'
                      } disabled:opacity-60`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          formData.sayaBeli ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
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
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
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
                      type="button"
                      onClick={() => canEdit && setFormData({ ...formData, sayaJual: !formData.sayaJual })}
                      disabled={disabled}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        formData.sayaJual ? 'bg-blue-600' : 'bg-gray-300'
                      } disabled:opacity-60`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          formData.sayaJual ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
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
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowWholesalePrice(!showWholesalePrice)}
                    className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                  >
                    {showWholesalePrice ? <ChevronDown className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    Tampilkan Harga Grosir
                  </button>
                  {showWholesalePrice && (
                    <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Wholesale price settings will go here
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {canEdit && (
                <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    <Save className="h-5 w-5" />
                    <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}
