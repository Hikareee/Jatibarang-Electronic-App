import { useMemo, useState } from 'react'
import { Search, ScanLine, MapPin, Package2, Camera } from 'lucide-react'
import { useMobileStockLookup } from '../hooks/useMobileStockLookup'
import MobileBarcodeCameraScanner from '../components/mobile/MobileBarcodeCameraScanner'

function badgeClasses(color) {
  if (color === 'emerald') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300'
}

export default function MobileStockPage() {
  const { productCards, lookupByScan, loading } = useMobileStockLookup()
  const [scanInput, setScanInput] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [serialHit, setSerialHit] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [merekFilter, setMerekFilter] = useState('all')
  const [cameraOpen, setCameraOpen] = useState(false)

  const typeOptions = useMemo(
    () =>
      Array.from(new Set(productCards.map((p) => p.typeName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'id')
      ),
    [productCards]
  )
  const merekOptions = useMemo(
    () =>
      Array.from(new Set(productCards.map((p) => p.merekName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'id')
      ),
    [productCards]
  )

  const filteredCards = useMemo(() => {
    let rows = [...productCards]
    if (typeFilter !== 'all') rows = rows.filter((row) => row.typeName === typeFilter)
    if (merekFilter !== 'all') rows = rows.filter((row) => row.merekName === merekFilter)
    rows.sort((a, b) => (Number(b.qtyTotal) || 0) - (Number(a.qtyTotal) || 0))
    return rows
  }, [merekFilter, productCards, typeFilter])

  const selectedProduct =
    filteredCards.find((card) => card.id === selectedProductId) ||
    productCards.find((card) => card.id === selectedProductId) ||
    null

  async function runLookup(raw) {
    setError('')
    setMessage('')
    setSerialHit(null)
    const result = await lookupByScan(raw)
    if (!result.product && !result.serial) {
      setError('Barcode, SKU, atau serial tidak ditemukan.')
      return
    }
    if (result.product) {
      setSelectedProductId(result.product.id)
      setMessage(
        `Item ditemukan: ${result.product.nama || result.product.kode || result.product.id}`
      )
    }
    if (result.serial) setSerialHit(result.serial)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await runLookup(scanInput)
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <ScanLine className="h-4 w-4" />
          Scan SKU / barcode / serial
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-950">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            autoFocus
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="Scan dan langsung enter"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="rounded-xl bg-gradient-to-b from-blue-50 to-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100 hover:from-blue-100 hover:ring-blue-200 dark:from-slate-800/70 dark:to-slate-900/40 dark:text-blue-300 dark:ring-blue-900/40 dark:hover:from-slate-800/90 dark:hover:to-slate-900/60 dark:hover:ring-blue-800/60"
            aria-label="Scan dengan kamera"
          >
            <Camera className="inline-block mr-1 h-4 w-4" />
            Kamera
          </button>
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
          >
            Cari
          </button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <option value="all">Semua tipe</option>
          {typeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={merekFilter}
          onChange={(e) => setMerekFilter(e.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <option value="all">Semua merek</option>
          {merekOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {message ? <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
      {serialHit ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{serialHit.productName || serialHit.productId || 'Serial item'}</p>
          <p className="mt-1 text-xs">Serial: {serialHit.serialNumber || serialHit.id}</p>
          <p className="mt-1 text-xs">Status: {serialHit.status || '-'}</p>
          <p className="mt-1 text-xs">Lokasi: {serialHit.warehouseId || '-'}</p>
        </div>
      ) : null}

      {selectedProduct ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{selectedProduct.nama || selectedProduct.id}</p>
              <p className="mt-1 text-xs text-slate-500">
                SKU {selectedProduct.kode || selectedProduct.sku || '-'} · Barcode {selectedProduct.barcode || '-'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span className={`rounded-full px-2 py-1 ${badgeClasses('slate')}`}>
                  Tipe: {selectedProduct.typeName || '-'}
                </span>
                <span className={`rounded-full px-2 py-1 ${badgeClasses('slate')}`}>
                  Merek: {selectedProduct.merekName || '-'}
                </span>
                <span className={`rounded-full px-2 py-1 ${badgeClasses('emerald')}`}>
                  Stok total: {selectedProduct.qtyTotal || 0}
                </span>
              </div>
            </div>
            <div className="rounded-2xl bg-blue-50 px-3 py-2 text-right dark:bg-blue-950/40">
              <p className="text-[11px] text-blue-700 dark:text-blue-300">Harga jual</p>
              <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
                Rp {Number(selectedProduct.priceDisplay || 0).toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <MapPin className="h-4 w-4" />
              Tersimpan di
            </div>
            <div className="space-y-2">
              {selectedProduct.locations.length > 0 ? (
                selectedProduct.locations.map((row) => (
                  <div
                    key={`${row.warehouseId}:${row.id}`}
                    className="rounded-2xl border border-slate-200 px-3 py-3 text-sm dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{row.warehouseName}</p>
                        <p className="text-xs text-slate-500">{row.unit || 'Pcs'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-slate-500">Tersedia</p>
                        <p className="font-bold">{Number(row.quantity || 0).toLocaleString('id-ID')}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-500 dark:border-slate-700">
                  Belum ada stok untuk item ini.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
          <Package2 className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold">Scan item untuk lihat stok</p>
          <p className="mt-1 text-xs text-slate-500">Hasil akan menampilkan harga, detail, dan lokasi penyimpanan.</p>
        </div>
      )}

      <div className="pb-2 text-center text-[11px] text-slate-400">
        {loading ? 'Memuat data stok...' : `${filteredCards.length} item terdeteksi`}
      </div>

      <MobileBarcodeCameraScanner
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={async (code) => {
          setCameraOpen(false)
          setScanInput(code)
          await runLookup(code)
        }}
      />
    </div>
  )
}
