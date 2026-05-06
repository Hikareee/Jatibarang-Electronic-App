import { Fragment, useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { db } from '../firebase/config'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore'
import { Plus, ChevronLeft, X, Warehouse as WarehouseIcon, Package, Camera } from 'lucide-react'
import { useProducts, productRequiresSerial } from '../hooks/useProductsData'
import { normalizeSerialId } from '../utils/itemSerials'
import CameraScannerModal from '../components/Scanner/CameraScannerModal'

export default function GudangDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [warehouse, setWarehouse] = useState(null)
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showTambahStock, setShowTambahStock] = useState(false)
  const [savingStock, setSavingStock] = useState(false)
  const [serialScannerOpen, setSerialScannerOpen] = useState(false)
  const [serialRows, setSerialRows] = useState([])
  const [expandedStockRowId, setExpandedStockRowId] = useState('')
  const [stockForm, setStockForm] = useState({
    source: 'list', // 'list' | 'manual'
    productId: '',
    productName: '',
    quantity: 1,
    unit: '',
    serialLines: ''
  })
  const { products, loading: productsLoading } = useProducts()

  const productById = useMemo(() => {
    const m = {}
    ;(products || []).forEach((p) => {
      m[p.id] = p
    })
    return m
  }, [products])

  const stockRowsDetailed = useMemo(() => {
    return (stock || []).map((row) => {
      const pid = String(row.productId || '').trim()
      const p = pid ? productById[pid] : null
      return {
        ...row,
        displayName:
          p?.nama || row.productName || row.nama || row.name || pid || '-',
        displaySku: p?.kode || p?.sku || row.sku || '-',
        displayBarcode: p?.barcode || row.barcode || '-',
        displayCategory: p?.kategori || row.kategori || '-',
        displayBrand: p?.merek || p?.brand || row.merek || row.brand || '-',
      }
    })
  }, [productById, stock])

  const serialsByProductId = useMemo(() => {
    const m = {}
    ;(serialRows || []).forEach((s) => {
      const pid = String(s.productId || '').trim()
      if (!pid) return
      if (!m[pid]) m[pid] = []
      m[pid].push(s)
    })
    Object.keys(m).forEach((pid) => {
      m[pid].sort((a, b) =>
        String(a.serialNumber || a.id || '').localeCompare(
          String(b.serialNumber || b.id || ''),
          'id'
        )
      )
    })
    return m
  }, [serialRows])

  useEffect(() => {
    if (!id) return
    const fetchWarehouse = async () => {
      try {
        setLoading(true)
        setError(null)
        const whRef = doc(db, 'warehouses', id)
        const whSnap = await getDoc(whRef)
        if (!whSnap.exists()) {
          setError('Gudang tidak ditemukan')
          setWarehouse(null)
          return
        }
        setWarehouse({ id: whSnap.id, ...whSnap.data() })

        const stockRef = collection(db, 'warehouses', id, 'stock')
        const serialRef = collection(db, 'itemSerials')
        const [stockSnap, serialSnap] = await Promise.all([
          getDocs(stockRef),
          getDocs(serialRef),
        ])
        const stockList = stockSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const serialList = serialSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter(
            (s) =>
              String(s.warehouseId || '').trim() === String(id || '').trim() &&
              String(s.status || '').trim() === 'in_stock'
          )
        setStock(stockList)
        setSerialRows(serialList)
      } catch (err) {
        console.error('Error fetching warehouse:', err)
        setError('Gagal memuat data gudang')
      } finally {
        setLoading(false)
      }
    }
    fetchWarehouse()
  }, [id])

  const handleOpenTambahStock = () => {
    setStockForm({
      source: 'list',
      productId: '',
      productName: '',
      quantity: 1,
      unit: '',
      serialLines: ''
    })
    setShowTambahStock(true)
  }

  const handleSaveStock = async () => {
    const productName = stockForm.source === 'list' && stockForm.productId
      ? (products.find(p => p.id === stockForm.productId)?.nama || stockForm.productName)
      : (stockForm.productName || '').trim()
    const quantity = Number(stockForm.quantity) || 0
    if (!productName) {
      alert('Nama produk wajib diisi atau pilih dari daftar Produk.')
      return
    }
    if (quantity <= 0) {
      alert('Kuantitas harus lebih dari 0.')
      return
    }

    try {
      setSavingStock(true)
      const productId = stockForm.source === 'list' ? stockForm.productId || null : null
      const selectedProduct =
        productId ? products.find((p) => p.id === productId) : null
      const sku = selectedProduct
        ? selectedProduct.kode || selectedProduct.sku || ''
        : ''
      const unit =
        stockForm.unit.trim() ||
        (productId ? products.find((p) => p.id === productId)?.satuan || '' : '')
      const inboundSerialNeeded =
        stockForm.source === 'list' &&
        Boolean(productId && selectedProduct && productRequiresSerial(selectedProduct))

      if (inboundSerialNeeded) {
        const lines = stockForm.serialLines
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
        if (lines.length !== quantity) {
          alert(
            `Produk dengan lacak serial: isi tepat ${quantity} nomor serial (satu baris per unit). Anda memasukkan ${lines.length}.`
          )
          setSavingStock(false)
          return
        }
        const norms = lines.map(normalizeSerialId)
        if (norms.some((n) => !n)) {
          alert('Ada nomor serial kosong/setelah dibersihkan tidak valid.')
          setSavingStock(false)
          return
        }
        const dup = new Set()
        for (const n of norms) {
          if (dup.has(n)) {
            alert('Ada serial duplikat dalam daftar.')
            setSavingStock(false)
            return
          }
          dup.add(n)
        }
        const nowInbound = new Date().toISOString()
        for (const n of norms) {
          const sref = doc(db, 'itemSerials', n)
          const ss = await getDoc(sref)
          if (ss.exists()) {
            alert(`Serial ${n} sudah terdaftar di sistem.`)
            setSavingStock(false)
            return
          }
        }
        const serialBatch = writeBatch(db)
        lines.forEach((rawLine, i) => {
          const nid = norms[i]
          const sref = doc(db, 'itemSerials', nid)
          serialBatch.set(sref, {
            serialNumber: rawLine.trim(),
            sku,
            productId,
            productName,
            warehouseId: id,
            status: 'in_stock',
            inboundAt: nowInbound,
            createdAt: nowInbound,
            updatedAt: nowInbound,
            lastMovementType: 'warehouse_receive',
          })
        })
        await serialBatch.commit()
      }

      const existing = stock.find(
        s => (productId && s.productId === productId) || (!productId && (s.productName || '').toLowerCase() === productName.toLowerCase())
      )

      if (existing) {
        const stockRef = doc(db, 'warehouses', id, 'stock', existing.id)
        const newQty = (Number(existing.quantity) || 0) + quantity
        await updateDoc(stockRef, {
          quantity: newQty,
          unit: unit || existing.unit,
          updatedAt: serverTimestamp()
        })
        setStock(prev => prev.map(s => s.id === existing.id ? { ...s, quantity: newQty, unit: unit || s.unit } : s))
      } else {
        const stockRef = collection(db, 'warehouses', id, 'stock')
        const docRef = await addDoc(stockRef, {
          productId: productId || null,
          productName,
          quantity,
          unit: unit || '',
          updatedAt: serverTimestamp()
        })
        setStock(prev => [...prev, { id: docRef.id, productId, productName, quantity, unit }])
      }

      setShowTambahStock(false)
    } catch (err) {
      console.error('Error saving stock:', err)
      alert('Gagal menambah stok')
    } finally {
      setSavingStock(false)
    }
  }

  const formatNumber = (num) => {
    if (num == null) return '0'
    return new Intl.NumberFormat('id-ID').format(num)
  }

  if (loading && !warehouse) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
            <p className="text-gray-600 dark:text-gray-400">Memuat gudang...</p>
          </main>
          <Footer />
        </div>
      </div>
    )
  }

  if (error || !warehouse) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto text-center">
              <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Gudang tidak ditemukan'}</p>
              <button
                onClick={() => navigate('/inventori')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Kembali ke Inventori
              </button>
            </div>
          </main>
          <Footer />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Beranda &gt; Inventori &gt; {warehouse.name}
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/inventori')}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <WarehouseIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {warehouse.name}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {warehouse.code && `Kode: ${warehouse.code}`}
                      {warehouse.description && ` · ${warehouse.description}`}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleOpenTambahStock}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Tambah Stok</span>
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <Package className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Stok di gudang ini
                </h2>
              </div>
              {stockRowsDetailed.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  Belum ada stok. Klik &quot;Tambah Stok&quot; untuk menambah produk dari daftar Produk atau isi nama produk secara manual.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          No
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Nama Produk
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          SKU
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Barcode
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Kategori
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Merek
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Kuantitas
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Satuan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {stockRowsDetailed.map((row, index) => (
                        <Fragment key={row.id}>
                          <tr
                            className={`bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                              row.productId ? 'cursor-pointer' : ''
                            }`}
                            onClick={() => {
                              if (!row.productId) return
                              setExpandedStockRowId((prev) =>
                                prev === row.id ? '' : row.id
                              )
                            }}
                            title={
                              row.productId
                                ? 'Klik untuk lihat serial individual'
                                : ''
                            }
                          >
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                              {index + 1}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                              {row.displayName}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                              {row.displaySku}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                              {row.displayBarcode}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                              {row.displayCategory}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                              {row.displayBrand}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                              {formatNumber(row.quantity)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                              {row.unit || '-'}
                            </td>
                          </tr>
                          {expandedStockRowId === row.id && row.productId ? (
                            <tr className="bg-slate-50 dark:bg-slate-900/40">
                              <td colSpan={8} className="px-6 py-3">
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                                  Individual products (Serial number as ID)
                                </p>
                                {(serialsByProductId[String(row.productId || '').trim()] || [])
                                  .length === 0 ? (
                                  <p className="text-xs text-slate-500">
                                    Tidak ada serial in-stock untuk produk ini.
                                  </p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {(
                                      serialsByProductId[
                                        String(row.productId || '').trim()
                                      ] || []
                                    ).map((s) => (
                                      <span
                                        key={s.id}
                                        className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-mono text-slate-700 dark:text-slate-200"
                                        title={`Serial ID: ${s.id}`}
                                      >
                                        {s.serialNumber || s.id}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {showTambahStock && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-3">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Tambah Stok
                  </h2>
                  <button
                    onClick={() => setShowTambahStock(false)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sumber produk
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="source"
                          checked={stockForm.source === 'list'}
                          onChange={() => setStockForm({ ...stockForm, source: 'list', productName: '' })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Dari daftar Produk</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="source"
                          checked={stockForm.source === 'manual'}
                          onChange={() => setStockForm({ ...stockForm, source: 'manual', productId: '' })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Nama produk manual</span>
                      </label>
                    </div>
                  </div>

                  {stockForm.source === 'list' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Pilih Produk <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={stockForm.productId}
                        onChange={(e) => {
                          const p = products.find(x => x.id === e.target.value)
                          setStockForm({
                            ...stockForm,
                            productId: e.target.value,
                            productName: p ? p.nama : '',
                            unit: p ? (p.satuan || '') : '',
                            serialLines: ''
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        disabled={productsLoading}
                      >
                        <option value="">— Pilih produk —</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nama || p.kode || p.id} {p.kode ? `(${p.kode})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nama Produk <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={stockForm.productName}
                        onChange={(e) => setStockForm({ ...stockForm, productName: e.target.value })}
                        placeholder="Ketik nama produk"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Kuantitas <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={stockForm.quantity}
                        onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Satuan
                      </label>
                      <input
                        type="text"
                        value={stockForm.unit}
                        onChange={(e) => setStockForm({ ...stockForm, unit: e.target.value })}
                        placeholder="pcs, box, dll"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>

                  {stockForm.source === 'list' &&
                    stockForm.productId &&
                    productRequiresSerial(
                      products.find((p) => p.id === stockForm.productId) ?? {
                        requiresSerial: false,
                      }
                    ) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Nomor serial per unit{' '}
                          <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          Satu baris satu serial. Harus tepat {Number(stockForm.quantity) || 0} baris (sesuai kuantitas).
                        </p>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => setSerialScannerOpen(true)}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                            title="Scan serial bulk dengan kamera (barcode/QR)"
                          >
                            <Camera className="h-4 w-4" />
                            Scan serial (bulk)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setStockForm((prev) => ({
                                ...prev,
                                serialLines: '',
                                quantity: 1,
                              }))
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                          >
                            Reset serial
                          </button>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Terisi: {(stockForm.serialLines || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).length}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                          Mode bulk: kamera tetap terbuka setelah scan agar bisa scan serial berikutnya.
                        </p>
                        <textarea
                          value={stockForm.serialLines}
                          onChange={(e) =>
                            setStockForm({ ...stockForm, serialLines: e.target.value })
                          }
                          placeholder="SERIAL001&#10;SERIAL002&#10;"
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowTambahStock(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveStock}
                    disabled={savingStock}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>

      <CameraScannerModal
        open={serialScannerOpen}
        onClose={() => setSerialScannerOpen(false)}
        title="Scan Serial"
        hint="Arahkan kamera ke barcode/QR serial. Setelah terbaca, kamera tetap siap untuk scan berikutnya."
        onScan={(code) => {
          const raw = String(code || '').trim()
          if (!raw) return
          const normalized = normalizeSerialId(raw)
          if (!normalized) return

          setStockForm((prev) => {
            const existing = String(prev.serialLines || '')
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean)
              .map(normalizeSerialId)
            if (existing.includes(normalized)) return prev
            const nextLines = (prev.serialLines ? `${prev.serialLines}\n` : '') + normalized
            const nextCount = String(nextLines)
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean).length
            return {
              ...prev,
              serialLines: nextLines,
              quantity: nextCount,
            }
          })
        }}
      />
    </div>
  )
}
