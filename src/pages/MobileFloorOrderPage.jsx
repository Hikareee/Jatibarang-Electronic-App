import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Search,
  Plus,
  Minus,
  Send,
  Store,
  Loader2,
  Camera,
  UserRound,
  UserRoundPlus,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  useProducts,
  productRequiresSerial,
  findProductByScan,
} from '../hooks/useProductsData'
import { useWarehouses } from '../hooks/useWarehouses'
import { createFloorOrder } from '../hooks/useFloorOrders'
import { useContacts, saveContact } from '../hooks/useContactsData'
import { useAllWarehousesStockRows } from '../hooks/useAllWarehousesStockRows'
import CameraScannerModal from '../components/Scanner/CameraScannerModal'
import {
  POS_FULFILLMENT_OPTIONS,
  labelForPosFulfillmentId,
} from '../constants/posFulfillmentModes'

function randomLineId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

const DEFAULT_FULFILL = POS_FULFILLMENT_OPTIONS[0]?.id || 'pickup_store'

export default function MobileFloorOrderPage() {
  const { currentUser } = useAuth()
  const { products, loading: productsLoading } = useProducts()
  const { warehouses, loading: warehousesLoading } = useWarehouses()
  const {
    contacts,
    loading: contactsLoading,
    refetch: refetchContacts,
  } = useContacts()
  const { rows: stockRowsAll, loading: stockRowsLoading } = useAllWarehousesStockRows()

  const [warehouseId, setWarehouseId] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  /** When no kontak dipilih — isi cepat nama / telp (tidak menyimpan kontak baru). */
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestAddress, setGuestAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [barcodeDraft, setBarcodeDraft] = useState('')
  const [draftLines, setDraftLines] = useState([])
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanForLineId, setScanForLineId] = useState(null)
  const [submitting, setSubmitting] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerSaving, setCustomerSaving] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  })
  const [defaultFulfillmentForNewLines, setDefaultFulfillmentForNewLines] =
    useState(DEFAULT_FULFILL)

  useEffect(() => {
    if (warehouses.length && !warehouseId) {
      setWarehouseId(warehouses[0].id)
    }
  }, [warehouses, warehouseId])

  const customerOptions = useMemo(
    () =>
      (contacts || []).filter((c) => {
        const types = Array.isArray(c.types) ? c.types : []
        return types.includes('Pelanggan') || !types.length
      }),
    [contacts]
  )

  const selectedCustomer = useMemo(
    () => customerOptions.find((c) => c.id === selectedCustomerId) || null,
    [customerOptions, selectedCustomerId]
  )

  const productById = useMemo(() => {
    const m = {}
    ;(products || []).forEach((p) => {
      m[p.id] = p
    })
    return m
  }, [products])

  const stockHintByProductId = useMemo(() => {
    const m = {}
    for (const r of stockRowsAll) {
      const pid = String(r.productId || '').trim()
      if (!pid) continue
      const q = Number(r.quantity) || 0
      if (q <= 0) continue
      const nm = r._warehouseName || r._warehouseId || '?'
      if (!m[pid]) m[pid] = []
      m[pid].push(`${nm} ${q}`)
    }
    Object.keys(m).forEach((k) => {
      m[k] = m[k].join(', ')
    })
    return m
  }, [stockRowsAll])

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
        nama.includes(raw) || sku === raw || bc === raw || hay.includes(raw)
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

  const customerLabelForSubmit = useMemo(() => {
    if (selectedCustomer) {
      return String(selectedCustomer.name || selectedCustomer.company || '').trim()
    }
    return ''
  }, [selectedCustomer])

  const addProduct = useCallback(
    (productId, fulfillmentModeArg) => {
      const fulfillMode =
        fulfillmentModeArg || defaultFulfillmentForNewLines || DEFAULT_FULFILL
      setError('')
      setMessage('')
      const p = productById[productId]
      if (!p) return
      setDraftLines((prev) => {
        const idx = prev.findIndex(
          (l) =>
            l.productId === productId &&
            String(l.fulfillmentMode || DEFAULT_FULFILL) ===
              String(fulfillMode || DEFAULT_FULFILL)
        )
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
            fulfillmentMode: fulfillMode,
            fulfillmentLabel: labelForPosFulfillmentId(fulfillMode),
          },
        ]
      })
    },
    [defaultFulfillmentForNewLines, productById]
  )

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

  const setLineFulfillment = useCallback((lineId, mode) => {
    setDraftLines((prev) =>
      prev.map((l) =>
        l.lineId === lineId
          ? {
              ...l,
              fulfillmentMode: mode,
              fulfillmentLabel: labelForPosFulfillmentId(mode),
            }
          : l
      )
    )
  }, [])

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
      const fulfillMode =
        draftLines.find((l) => l.lineId === lineIdIntent)?.fulfillmentMode ||
        defaultFulfillmentForNewLines

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
        const idx = prev.findIndex(
          (ln) =>
            ln.productId === productId &&
            String(ln.fulfillmentMode || DEFAULT_FULFILL) ===
              String(defaultFulfillmentForNewLines || DEFAULT_FULFILL)
        )
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
          return next
        }
        const mode = defaultFulfillmentForNewLines || DEFAULT_FULFILL
        return [
          ...prev,
          {
            lineId: randomLineId(),
            productId,
            qty: 1,
            nama: p.nama || p.kode || productId,
            hargaJual: Number(p.hargaJual ?? 0) || 0,
            requiresSerial: productRequiresSerial(p),
            fulfillmentMode: mode,
            fulfillmentLabel: labelForPosFulfillmentId(mode),
          },
        ]
      })
      setMessage(`Ditambah: ${p.nama || p.kode || productId}`)
    },
    [
      defaultFulfillmentForNewLines,
      draftLines,
      productById,
      resolveScanToProductId,
      scanForLineId,
    ]
  )

  const draftTotal = useMemo(
    () => draftLines.reduce((s, l) => s + l.hargaJual * l.qty, 0),
    [draftLines]
  )

  const resetNewCustomerForm = () => {
    setNewCustomerForm({
      name: '',
      phone: '',
      email: '',
      address: '',
    })
  }

  const handleSaveNewCustomer = async () => {
    const name = String(newCustomerForm.name || '').trim()
    const phone = String(newCustomerForm.phone || '').trim()
    const email = String(newCustomerForm.email || '').trim()
    const address = String(newCustomerForm.address || '').trim()
    if (!name) {
      setError('Nama pelanggan wajib diisi.')
      return
    }
    try {
      setCustomerSaving(true)
      const id = await saveContact({
        types: ['Pelanggan'],
        name,
        phone,
        email,
        address,
      })
      await refetchContacts()
      setSelectedCustomerId(id)
      setGuestName('')
      setGuestPhone('')
      setGuestAddress('')
      setCustomerModalOpen(false)
      resetNewCustomerForm()
      setMessage(`Pelanggan "${name}" disimpan dan dipilih.`)
      setError('')
    } catch (err) {
      setError(err?.message || 'Gagal menyimpan pelanggan baru')
    } finally {
      setCustomerSaving(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!warehouseId) {
      setError('Pilih outlet / gudang tujuan.')
      return
    }
    let customerName = ''
    let customerPhone = ''
    let customerAddress = ''
    let customerId = ''

    if (selectedCustomerId) {
      customerId = selectedCustomerId
      customerName = customerLabelForSubmit
      customerPhone = String(selectedCustomer?.phone || '').trim()
      customerAddress = String(selectedCustomer?.address || '').trim()
      if (!customerName) {
        setError('Kontak terpilih tanpa nama.')
        return
      }
    } else {
      const gn = guestName.trim()
      if (!gn) {
        setError('Pilih pelanggan dari daftar atau isi nama kunjungan / tamu.')
        return
      }
      customerName = gn
      customerPhone = guestPhone.trim()
      customerAddress = guestAddress.trim()
    }

    if (!draftLines.length) {
      setError('Tambahkan minimal satu produk.')
      return
    }
    try {
      setSubmitting('sending')
      const { number } = await createFloorOrder({
        warehouseId,
        customerId,
        customerName,
        customerPhone,
        customerAddress,
        notes: notes.trim(),
        lines: draftLines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          nama: l.nama,
          hargaJual: l.hargaJual,
          fulfillmentMode:
            String(l.fulfillmentMode || DEFAULT_FULFILL).trim() ||
            DEFAULT_FULFILL,
          fulfillmentLabel: labelForPosFulfillmentId(
            l.fulfillmentMode || DEFAULT_FULFILL
          ),
        })),
        createdByUid: currentUser?.uid || '',
        createdByEmail: currentUser?.email || '',
      })
      setMessage(`Pesanan ${number} dikirim. Tunggu pembayaran di POS.`)
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
          <UserRound className="h-4 w-4" />
          Pelanggan dan outlet
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
          Pelanggan
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <select
            value={selectedCustomerId}
            onChange={(e) => {
              setSelectedCustomerId(e.target.value)
              if (e.target.value) setError('')
            }}
            disabled={contactsLoading}
            className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">— Tamu tanpa kartu nama —</option>
            {customerOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.name || c.company || c.id) +
                  (c.phone ? ` · ${c.phone}` : '')}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setError('')
              setCustomerModalOpen(true)
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-2xl border border-blue-200 bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm dark:border-blue-900"
          >
            <UserRoundPlus className="h-4 w-4" />
            Baru
          </button>
        </div>
        {contactsLoading ? (
          <p className="mt-2 text-[11px] text-slate-500">Memuat kontak…</p>
        ) : null}

        {selectedCustomer ? (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            {selectedCustomer.phone ? `Tel. ${selectedCustomer.phone}` : ''}
            {selectedCustomer.address
              ? ` · ${selectedCustomer.address}`
              : ''}
          </p>
        ) : (
          <div className="mt-3 space-y-2 rounded-2xl border border-dashed border-slate-200 p-3 dark:border-slate-700">
            <p className="text-[11px] text-slate-500">
              Isi jika tidak memilih kontak tersimpan (tidak tersimpan ke daftar kontak).
            </p>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Nama kunjungan / tamu"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <input
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="Telepon (opsional)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <input
              value={guestAddress}
              onChange={(e) => setGuestAddress(e.target.value)}
              placeholder="Alamat untuk antar (opsional)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
        )}

        <label className="mt-3 block text-[11px] font-semibold uppercase text-slate-500">
          Catatan order (opsional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Keterangan pembungkusan, dll."
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
        <div className="mb-2 text-xs font-semibold text-slate-500">
          Default cara pengambilan untuk item baru (per baris bisa diubah)
        </div>
        <select
          value={defaultFulfillmentForNewLines}
          onChange={(e) => setDefaultFulfillmentForNewLines(e.target.value)}
          className="mb-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          {POS_FULFILLMENT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label} — {opt.hint}
            </option>
          ))}
        </select>

        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Search className="h-4 w-4" />
          Cari dan tambah produk
        </div>
        {stockRowsLoading ? (
          <p className="mb-2 text-[11px] text-amber-600">Memuat ringkasan lokasi stok…</p>
        ) : null}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ketik nama produk, SKU, atau barcode…"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
        />
        <p className="mt-1.5 text-[11px] text-slate-500">
          Beberapa kata mempersempit daftar (contoh:{' '}
          <span className="font-medium">kabel hdmi</span>).
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
                className="flex w-full flex-col gap-1 rounded-2xl border border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/80 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {p.nama || p.kode}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    Lokasi / stok:{' '}
                    {stockHintByProductId[p.id] || 'Tidak ada data stok (periksa gudang)'}
                  </span>
                </span>
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
          <ul className="mt-3 space-y-3">
            {draftLines.map((l) => (
              <li
                key={l.lineId}
                className="rounded-2xl border border-slate-100 px-3 py-2 dark:border-slate-800"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.nama}</p>
                    <p className="text-[11px] text-slate-500">
                      @ Rp {l.hargaJual.toLocaleString('id-ID')}
                      {l.requiresSerial ? ' · serial di-scan di POS' : ''}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                      Stok:{' '}
                      {stockHintByProductId[l.productId] || 'Lihat inventori'}
                    </p>
                    <label className="mt-2 block text-[10px] font-semibold uppercase text-slate-500">
                      Cara pengambilan
                    </label>
                    <select
                      value={
                        l.fulfillmentMode || defaultFulfillmentForNewLines || DEFAULT_FULFILL
                      }
                      onChange={(e) =>
                        setLineFulfillment(l.lineId, e.target.value)
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                    >
                      {POS_FULFILLMENT_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1 sm:justify-end">
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

      {customerModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Pelanggan baru
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Tersimpan ke Kontak seperti di POS — lalu bisa dipilih di daftar.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase text-slate-500">Nama</span>
                <input
                  value={newCustomerForm.name}
                  onChange={(e) =>
                    setNewCustomerForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="Nama pelanggan"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-slate-500">Telepon</span>
                <input
                  value={newCustomerForm.phone}
                  onChange={(e) =>
                    setNewCustomerForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="08xxxxxxxxxx"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-slate-500">
                  Email (opsional)
                </span>
                <input
                  type="email"
                  value={newCustomerForm.email}
                  onChange={(e) =>
                    setNewCustomerForm((p) => ({ ...p, email: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="nama@email.com"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-slate-500">Alamat</span>
                <textarea
                  value={newCustomerForm.address}
                  onChange={(e) =>
                    setNewCustomerForm((p) => ({ ...p, address: e.target.value }))
                  }
                  className="mt-1 min-h-[72px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="Alamat pengiriman / lokasi antar"
                />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={customerSaving}
                onClick={() => {
                  setCustomerModalOpen(false)
                  resetNewCustomerForm()
                }}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-sm dark:border-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={customerSaving}
                onClick={() => handleSaveNewCustomer()}
                className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {customerSaving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
          Kirim ke POS
        </button>
      </form>
    </div>
  )
}
