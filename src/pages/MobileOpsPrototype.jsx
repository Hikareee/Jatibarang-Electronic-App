import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, updateDoc, addDoc } from 'firebase/firestore'
import { ScanLine, RefreshCw } from 'lucide-react'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useSidebarOpen } from '../hooks/useSidebarOpen'
import { useProducts, findProductByScan } from '../hooks/useProductsData'
import { useWarehouses } from '../hooks/useWarehouses'
import { useUserApproval } from '../hooks/useUserApproval'
import { db } from '../firebase/config'
import { normalizeSerialId } from '../utils/itemSerials'

function toInt(v, fallback = 0) {
  const n = parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) ? n : fallback
}

export default function MobileOpsPrototype() {
  const { sidebarOpen, toggleSidebar } = useSidebarOpen(true)
  const { products, loading: productsLoading } = useProducts()
  const { warehouses, loading: warehousesLoading } = useWarehouses()
  const { role } = useUserApproval()
  const canUpdateStock = ['owner', 'manager', 'admin'].includes(role)

  const [loadingRows, setLoadingRows] = useState(false)
  const [stockRows, setStockRows] = useState([])
  const [scanInput, setScanInput] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [serialHit, setSerialHit] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [merekFilter, setMerekFilter] = useState('all')
  const [sortBy, setSortBy] = useState('qty_desc')
  const [qtyDraft, setQtyDraft] = useState({})
  const [savingKey, setSavingKey] = useState('')
  const [addWarehouseId, setAddWarehouseId] = useState('')
  const [addQty, setAddQty] = useState('1')

  const productById = useMemo(() => {
    const m = {}
    ;(products || []).forEach((p) => {
      m[p.id] = p
    })
    return m
  }, [products])

  useEffect(() => {
    async function loadAllStockRows() {
      if (!warehouses.length) {
        setStockRows([])
        return
      }
      setLoadingRows(true)
      try {
        const chunks = await Promise.all(
          warehouses.map(async (w) => {
            const snap = await getDocs(collection(db, 'warehouses', w.id, 'stock'))
            return snap.docs.map((d) => ({
              id: d.id,
              warehouseId: w.id,
              warehouseName: w.name || w.id,
              ...d.data(),
            }))
          })
        )
        setStockRows(chunks.flat())
      } catch (e) {
        console.error(e)
        setError('Gagal memuat stok lintas gudang.')
      } finally {
        setLoadingRows(false)
      }
    }
    loadAllStockRows()
  }, [warehouses])

  const productsWithTotals = useMemo(() => {
    const merged = (products || []).map((p) => {
      const rows = stockRows.filter((r) => r.productId === p.id)
      const qtyTotal = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
      const merek = String(p.merek || p.brand || p.merk || '').trim()
      return {
        ...p,
        qtyTotal,
        typeName: String(p.kategori || '').trim(),
        merekName: merek,
      }
    })

    let filtered = merged
    if (typeFilter !== 'all') filtered = filtered.filter((p) => p.typeName === typeFilter)
    if (merekFilter !== 'all') filtered = filtered.filter((p) => p.merekName === merekFilter)

    filtered.sort((a, b) => {
      if (sortBy === 'nama_asc') return String(a.nama || '').localeCompare(String(b.nama || ''), 'id')
      if (sortBy === 'nama_desc') return String(b.nama || '').localeCompare(String(a.nama || ''), 'id')
      if (sortBy === 'type_asc') return String(a.typeName || '').localeCompare(String(b.typeName || ''), 'id')
      if (sortBy === 'merek_asc') return String(a.merekName || '').localeCompare(String(b.merekName || ''), 'id')
      return (Number(b.qtyTotal) || 0) - (Number(a.qtyTotal) || 0)
    })
    return filtered
  }, [products, stockRows, typeFilter, merekFilter, sortBy])

  const typeOptions = useMemo(() => {
    return Array.from(
      new Set((products || []).map((p) => String(p.kategori || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'id'))
  }, [products])

  const merekOptions = useMemo(() => {
    return Array.from(
      new Set(
        (products || [])
          .map((p) => String(p.merek || p.brand || p.merk || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'id'))
  }, [products])

  const selectedProduct = selectedProductId ? productById[selectedProductId] : null
  const selectedStockRows = useMemo(
    () => stockRows.filter((r) => selectedProduct && r.productId === selectedProduct.id),
    [stockRows, selectedProduct]
  )

  async function handleScanSubmit(e) {
    e.preventDefault()
    const q = scanInput.trim()
    if (!q) return
    setError('')
    setMessage('')
    setSerialHit(null)

    const p = findProductByScan(products, q)
    if (p) {
      setSelectedProductId(p.id)
      setMessage(`Produk ditemukan: ${p.nama || p.kode || p.id}`)
      return
    }

    const norm = normalizeSerialId(q)
    const sRef = doc(db, 'itemSerials', norm)
    const sSnap = await getDoc(sRef)
    if (sSnap.exists()) {
      const data = { id: sSnap.id, ...sSnap.data() }
      setSerialHit(data)
      if (data.productId) setSelectedProductId(data.productId)
      setMessage(`Serial ${data.serialNumber || norm} ditemukan.`)
      return
    }

    setError('Barcode/SKU/serial tidak ditemukan.')
  }

  async function saveRowQuantity(row) {
    const key = `${row.warehouseId}:${row.id}`
    const nextQty = Math.max(0, toInt(qtyDraft[key], Number(row.quantity) || 0))
    setSavingKey(key)
    setError('')
    setMessage('')
    try {
      await updateDoc(doc(db, 'warehouses', row.warehouseId, 'stock', row.id), {
        quantity: nextQty,
        updatedAt: new Date().toISOString(),
      })
      setStockRows((prev) =>
        prev.map((r) => (r.id === row.id && r.warehouseId === row.warehouseId ? { ...r, quantity: nextQty } : r))
      )
      setMessage('Stok berhasil diperbarui.')
    } catch (e) {
      console.error(e)
      setError('Gagal memperbarui stok.')
    } finally {
      setSavingKey('')
    }
  }

  async function addProductToWarehouse() {
    if (!selectedProduct || !addWarehouseId) return
    const qty = Math.max(0, toInt(addQty, 0))
    if (qty < 1) {
      setError('Qty minimal 1.')
      return
    }
    setError('')
    setMessage('')
    setSavingKey(`new:${addWarehouseId}`)
    try {
      const existing = stockRows.find(
        (r) => r.productId === selectedProduct.id && r.warehouseId === addWarehouseId
      )
      if (existing) {
        await updateDoc(doc(db, 'warehouses', addWarehouseId, 'stock', existing.id), {
          quantity: (Number(existing.quantity) || 0) + qty,
          updatedAt: new Date().toISOString(),
        })
        setStockRows((prev) =>
          prev.map((r) =>
            r.id === existing.id && r.warehouseId === addWarehouseId
              ? { ...r, quantity: (Number(existing.quantity) || 0) + qty }
              : r
          )
        )
      } else {
        const warehouseName = warehouses.find((w) => w.id === addWarehouseId)?.name || addWarehouseId
        const addRef = await addDoc(collection(db, 'warehouses', addWarehouseId, 'stock'), {
          productId: selectedProduct.id,
          productName: selectedProduct.nama || selectedProduct.kode || selectedProduct.id,
          quantity: qty,
          unit: selectedProduct.satuan || 'Pcs',
          updatedAt: new Date().toISOString(),
        })
        setStockRows((prev) => [
          ...prev,
          {
            id: addRef.id,
            warehouseId: addWarehouseId,
            warehouseName,
            productId: selectedProduct.id,
            productName: selectedProduct.nama || selectedProduct.kode || selectedProduct.id,
            quantity: qty,
            unit: selectedProduct.satuan || 'Pcs',
          },
        ])
      }
      setAddQty('1')
      setMessage('Stok item berhasil ditambah di gudang terpilih.')
    } catch (e) {
      console.error(e)
      setError('Gagal menambah stok ke gudang.')
    } finally {
      setSavingKey('')
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-6xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mobile Stock App (Prototype)</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Scan barcode/SKU/serial -> stok muncul. Filter per tipe/merek, update per item.
                </p>
              </div>
              <Link
                to="/mobile/delivery"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Delivery Tracker
              </Link>
            </div>

            <form
              onSubmit={handleScanSubmit}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <ScanLine className="h-5 w-5 text-gray-400" />
              <input
                autoFocus
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Scan barcode / SKU / serial"
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <button className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                Cari
              </button>
            </form>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800"
              >
                <option value="all">Semua tipe</option>
                {typeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <select
                value={merekFilter}
                onChange={(e) => setMerekFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800"
              >
                <option value="all">Semua merek</option>
                {merekOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800"
              >
                <option value="qty_desc">Stok terbanyak</option>
                <option value="nama_asc">Nama A-Z</option>
                <option value="nama_desc">Nama Z-A</option>
                <option value="type_asc">Tipe A-Z</option>
                <option value="merek_asc">Merek A-Z</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('all')
                  setMerekFilter('all')
                  setSortBy('qty_desc')
                }}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>

            {message ? <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">{message}</p> : null}
            {error ? <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}

            {serialHit ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Serial: <span className="font-semibold">{serialHit.serialNumber || serialHit.id}</span> · Status:{' '}
                <span className="font-semibold">{serialHit.status || '-'}</span> · Lokasi:{' '}
                <span className="font-semibold">{serialHit.warehouseId || '-'}</span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_.9fr]">
              <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                <h2 className="mb-2 text-sm font-semibold">Daftar item</h2>
                <div className="max-h-[26rem] space-y-2 overflow-y-auto">
                  {(productsWithTotals || []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProductId(p.id)}
                      className={`w-full rounded-lg border p-2 text-left text-xs ${
                        selectedProductId === p.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                      }`}
                    >
                      <div className="font-semibold">{p.nama || p.kode || p.id}</div>
                      <div className="text-gray-500">
                        SKU: {p.kode || p.sku || '-'} · Tipe: {p.typeName || '-'} · Merek:{' '}
                        {p.merekName || '-'}
                      </div>
                      <div className="font-semibold text-emerald-700">Total stok: {p.qtyTotal || 0}</div>
                    </button>
                  ))}
                  {!productsLoading && productsWithTotals.length === 0 ? (
                    <p className="text-xs text-gray-500">Tidak ada item sesuai filter.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                <h2 className="mb-2 text-sm font-semibold">Detail item & update</h2>
                {!selectedProduct ? (
                  <p className="text-xs text-gray-500">Pilih item atau scan barcode/serial.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-gray-50 p-2 text-xs dark:bg-gray-900/40">
                      <div className="font-semibold">{selectedProduct.nama || selectedProduct.id}</div>
                      <div className="text-gray-500">
                        SKU: {selectedProduct.kode || selectedProduct.sku || '-'} · Tipe:{' '}
                        {selectedProduct.kategori || '-'} · Merek:{' '}
                        {selectedProduct.merek || selectedProduct.brand || selectedProduct.merk || '-'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {selectedStockRows.map((row) => {
                        const key = `${row.warehouseId}:${row.id}`
                        return (
                          <div key={key} className="rounded-lg border border-gray-200 p-2 text-xs dark:border-gray-700">
                            <div className="font-medium">{row.warehouseName}</div>
                            <div className="text-gray-500">
                              Qty: {Number(row.quantity) || 0} {row.unit || ''}
                            </div>
                            {canUpdateStock ? (
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={qtyDraft[key] ?? row.quantity ?? 0}
                                  onChange={(e) =>
                                    setQtyDraft((prev) => ({ ...prev, [key]: e.target.value }))
                                  }
                                  className="w-24 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
                                />
                                <button
                                  type="button"
                                  disabled={savingKey === key}
                                  onClick={() => saveRowQuantity(row)}
                                  className="rounded bg-blue-600 px-2 py-1 font-semibold text-white disabled:opacity-50"
                                >
                                  Simpan
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                      {selectedStockRows.length === 0 ? (
                        <p className="text-xs text-gray-500">Item belum ada stok di gudang mana pun.</p>
                      ) : null}
                    </div>

                    {canUpdateStock ? (
                      <div className="rounded-lg border border-dashed border-gray-300 p-2 text-xs dark:border-gray-600">
                        <div className="mb-1 font-medium">Tambah item ke gudang</div>
                        <div className="flex gap-2">
                          <select
                            value={addWarehouseId}
                            onChange={(e) => setAddWarehouseId(e.target.value)}
                            className="flex-1 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
                          >
                            <option value="">Pilih gudang</option>
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            value={addQty}
                            onChange={(e) => setAddQty(e.target.value)}
                            className="w-20 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
                          />
                          <button
                            type="button"
                            disabled={!addWarehouseId || savingKey === `new:${addWarehouseId}`}
                            onClick={addProductToWarehouse}
                            className="rounded bg-emerald-600 px-2 py-1 font-semibold text-white disabled:opacity-50"
                          >
                            Tambah
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600">
                        Akun staf hanya lihat stok. Update stok untuk manager/admin/owner.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(productsLoading || warehousesLoading || loadingRows) && (
              <p className="text-xs text-gray-500">Memuat data produk/stok...</p>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}
