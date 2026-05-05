import { useEffect, useMemo, useState, useCallback } from 'react'
import { Search, Plus, Minus, Send, Store, UtensilsCrossed, Loader2, Camera } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  useProducts,
  productRequiresSerial,
  findProductByScan,
} from '../hooks/useProductsData'
import { useWarehouses } from '../hooks/useWarehouses'
import { createFloorOrder } from '../hooks/useFloorOrders'
import CameraScannerModal from '../components/Scanner/CameraScannerModal'

function randomLineId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export default function MobileFloorOrderPage() {
  const { currentUser } = useAuth()
  const { products, loading: productsLoading } = useProducts()
  const { warehouses, loading: warehousesLoading } = useWarehouses()

  const [warehouseId, setWarehouseId] = useState('')
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [barcodeDraft, setBarcodeDraft] = useState('')
  const [draftLines, setDraftLines] = useState([])
  const [scannerOpen, setScannerOpen] = useState(false)
  /** When set, the next scan must match this product (add +1 qty to that row only). */
  const [scanForLineId, setScanForLineId] = useState(null)
  const [submitting, setSubmitting] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (warehouses.length && !warehouseId) {
      setWarehouseId(warehouses[0].id)
    }
  }, [warehouses, warehouseId])

  const productById = useMemo(() => {
    const m = {}
    ;(products || []).forEach((p) => {
      m[p.id] = p
    })
    return m
  }, [products])

  const filteredProducts = useMemo(() => {
    const raw = search.trim().toLowerCase()
    const list = products || []
    if (!raw) return list.slice(0, 100)
    const tokens = raw.split(/\s+/).filter(Boolean)
    return list.filter((p) => {
      const nama = String(p.nama || p.name || '').toLowerCase()
      const sku = String(p.kode || p.sku || '').toLowerCase()
      const bc = String(p.barcode || '').toLowerCase()
      const hay = `${nama} ${sku} ${bc}`
      const singleMatch =
        nama.includes(raw) ||
        sku === raw ||
        bc === raw ||
        hay.includes(raw)
      const tokenMatch =
        tokens.length > 1 &&
        tokens.every((t) => hay.includes(t) || sku.includes(t) || bc.includes(t))
      return singleMatch || tokenMatch
    })
  }, [products, search])

  const resolveScanToProductId = useCallback(
    (raw) => {
      const code = String(raw || '').trim()
      if (!code) return ''
      const hit = findProductByScan(products, code)
      if (hit?.id) return hit.id
      const lower = code.toLowerCase()
      const byNameExact = (products || []).find(
        (p) => String(p.nama || p.name || '').trim().toLowerCase() === lower
      )
      return byNameExact?.id || ''
    },
    [products]
  )

  const addProduct = (productId) => {
    setError('')
    setMessage('')
    const p = productById[productId]
    if (!p) return
    setDraftLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === productId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        return next
      }
      return [
        ...prev,
        {
          lineId: randomLineId(),
          productId,
          qty: 1,
          nama: p.nama || p.kode || productId,
          hargaJual: Number(p.hargaJual ?? 0) || 0,
          requiresSerial: productRequiresSerial(p),
        },
      ]
    })
  }

  const bumpQty = (lineId, delta) => {
    setDraftLines((prev) =>
      prev
        .map((l) =>
          l.lineId === lineId ? { ...l, qty: Math.max(1, l.qty + delta) } : l
        )
        .filter((l) => l.qty > 0)
    )
  }

  const removeLine = (lineId) => {
    setDraftLines((prev) => prev.filter((l) => l.lineId !== lineId))
  }

  const handleScanDecoded = useCallback(
    (raw) => {
      const code = String(raw || '').trim()
      setScannerOpen(false)
      const lineIdIntent = scanForLineId
      setScanForLineId(null)
      if (!code) return
      setError('')
      setMessage('')
      const productId = resolveScanToProductId(code)

      if (lineIdIntent) {
        const line = draftLines.find((l) => l.lineId === lineIdIntent)
        if (!productId) {
          setError('Barcode/SKU tidak dikenali. Pastikan sama dengan baris ini.')
          return
        }
        if (!line || productId !== line.productId) {
          setError('Scan tidak cocok dengan item di baris ini.')
          return
        }
        setDraftLines((prev) =>
          prev.map((l) =>
            l.lineId === lineIdIntent ? { ...l, qty: l.qty + 1 } : l
          )
        )
        setMessage(`+1 untuk ${line.nama} (scan)`)
        return
      }

      if (!productId) {
        setError(`Tidak ada produk untuk: "${code}". Ketik nama di pencarian atau periksa master produk.`)
        return
      }

      const p = productById[productId]
      if (!p) {
        setError('Produk tidak ditemukan di cache.')
        return
      }

      setDraftLines((prev) => {
        const idx = prev.findIndex((l) => l.productId === productId)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
          return next
        }
        return [
          ...prev,
          {
            lineId: randomLineId(),
            productId,
            qty: 1,
            nama: p.nama || p.kode || productId,
            hargaJual: Number(p.hargaJual ?? 0) || 0,
            requiresSerial: productRequiresSerial(p),
          },
        ]
      })
      setMessage(`Ditambah: ${p.nama || p.kode || productId}`)
    },
    [draftLines, productById, resolveScanToProductId, scanForLineId]
  )

  const draftTotal = useMemo(
    () => draftLines.reduce((s, l) => s + l.hargaJual * l.qty, 0),
    [draftLines]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!warehouseId) {
      setError('Pilih outlet / gudang tujuan.')
      return
    }
    if (!label.trim()) {
      setError('Isi label meja atau nama pelanggan.')
      return
    }
    if (!draftLines.length) {
      setError('Tambahkan minimal satu produk.')
      return
    }
    try {
      setSubmitting('sending')
      const { number } = await createFloorOrder({
        warehouseId,
        label: label.trim(),
        notes: notes.trim(),
        lines: draftLines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          nama: l.nama,
          hargaJual: l.hargaJual,
        })),
        createdByUid: currentUser?.uid || '',
        createdByEmail: currentUser?.email || '',
      })
      setMessage(`Pesanan ${number} dikirim ke kasir. Tunggu pembayaran di POS.`)
      setDraftLines([])
      setNotes('')
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Gagal mengirim pesanan')
    } finally {
      setSubmitting('')
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <UtensilsCrossed className="h-4 w-4" />
          Pesanan sales → kasir (seperti restoran)
        </div>

        <label className="block text-[11px] font-semibold uppercase text-slate-500">
          Outlet / gudang POS
        </label>
        <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <Store className="h-4 w-4 shrink-0 text-slate-400" />
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            disabled={warehousesLoading}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white"
          >
            <option value="">— Pilih outlet —</option>
            {(warehouses || []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name || w.id}
              </option>
            ))}
          </select>
        </div>

        <label className="mt-3 block text-[11px] font-semibold uppercase text-slate-500">
          Meja / pelanggan
        </label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Contoh: Meja 7, Bapak Budi"
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />

        <label className="mt-3 block text-[11px] font-semibold uppercase text-slate-500">
          Catatan (opsional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Tanpa gula, bungkus, dll."
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </div>

      {message ? (
        <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Search className="h-4 w-4" />
          Cari dan tambah produk
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ketik nama produk, SKU, atau barcode…"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
        />
        <p className="mt-1.5 text-[11px] text-slate-500">
          Beberapa kata mempersempit daftar (contoh: <span className="font-medium">kabel hdmi</span>).
        </p>
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const code = barcodeDraft.trim()
            if (!code) return
            handleScanDecoded(code)
            setBarcodeDraft('')
          }}
        >
          <input
            value={barcodeDraft}
            onChange={(e) => setBarcodeDraft(e.target.value)}
            placeholder="Atau ketik barcode lalu Enter"
            inputMode="numeric"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            type="button"
            onClick={() => {
              setScanForLineId(null)
              setScannerOpen(true)
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-2xl bg-gradient-to-b from-blue-50 to-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100 dark:from-slate-800/70 dark:to-slate-900/40 dark:text-blue-300 dark:ring-blue-900/40"
            aria-label="Scan barcode dengan kamera"
          >
            <Camera className="h-4 w-4" />
            Kamera
          </button>
        </form>
        <p className="mt-2 text-[11px] text-slate-500">
          {!search.trim() && !productsLoading
            ? `Menampilkan ${filteredProducts.length} produk pertama. Ketik nama untuk menyaring.`
            : !productsLoading
              ? `Ditemukan ${filteredProducts.length} produk.`
              : null}
        </p>
        <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
          {productsLoading ? (
            <p className="py-6 text-center text-xs text-slate-500">Memuat produk…</p>
          ) : filteredProducts.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">Tidak ada produk.</p>
          ) : (
            filteredProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p.id)}
                className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/80"
              >
                <span className="min-w-0 truncate font-medium">{p.nama || p.kode}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-blue-600">
                  <Plus className="h-4 w-4" />
                  Tambah
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Ringkasan pesanan</h2>
        {draftLines.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            Belum ada item. Tap produk, scan barcode, atau ketik barcode lalu Enter.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {draftLines.map((l) => (
              <li
                key={l.lineId}
                className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 px-3 py-2 dark:border-slate-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{l.nama}</p>
                  <p className="text-[11px] text-slate-500">
                    @ Rp {l.hargaJual.toLocaleString('id-ID')}
                    {l.requiresSerial ? ' · serial di-scan kasir' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => bumpQty(l.lineId, -1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700"
                    aria-label="Kurangi jumlah"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
                  <button
                    type="button"
                    onClick={() => bumpQty(l.lineId, 1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700"
                    aria-label="Tambah jumlah"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScanForLineId(l.lineId)
                      setScannerOpen(true)
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
                    title="Scan barcode item ini (+1)"
                    aria-label="Scan barcode untuk baris ini"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLine(l.lineId)}
                    className="ml-1 text-xs text-rose-600"
                  >
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {draftLines.length > 0 ? (
          <p className="mt-3 text-right text-sm font-bold text-slate-900 dark:text-white">
            Estimasi: Rp {draftTotal.toLocaleString('id-ID')}
          </p>
        ) : null}
      </div>

      <CameraScannerModal
        open={scannerOpen}
        onScan={handleScanDecoded}
        onClose={() => {
          setScannerOpen(false)
          setScanForLineId(null)
        }}
        title={scanForLineId ? 'Scan item baris ini' : 'Scan SKU / barcode'}
        hint={
          scanForLineId
            ? 'Barcode harus sama dengan produk di baris ini untuk +1 qty.'
            : 'Arahkan kamera ke barcode pada kemasan atau etiket SKU.'
        }
      />

      <form onSubmit={handleSubmit} className="sticky bottom-0">
        <button
          type="submit"
          disabled={submitting === 'sending' || draftLines.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 disabled:opacity-50"
        >
          {submitting === 'sending' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          Kirim ke kasir
        </button>
      </form>
    </div>
  )
}
