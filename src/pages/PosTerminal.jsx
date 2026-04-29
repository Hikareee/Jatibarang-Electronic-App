import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Trash2,
  ScanLine,
  Loader2,
  User,
  Calendar,
} from 'lucide-react'
import { db } from '../firebase/config'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { useProducts, findProductByScan } from '../hooks/useProductsData'
import { useWarehouses } from '../hooks/useWarehouses'
import { useAccounts } from '../hooks/useAccountsData'
import { useUsers } from '../hooks/useUsers'
import { useAuth } from '../contexts/AuthContext'
import { commitPosSale } from '../hooks/usePosSales'
import { normalizeSerialId } from '../utils/itemSerials'
import { usePosShifts, createPosShiftOpen } from '../hooks/usePosShifts'
import { usePosWarehouseSettings } from '../hooks/usePosWarehouseSettings'
import { useNonCashPayments } from '../hooks/useNonCashPayments'
import { useContacts, saveContact } from '../hooks/useContactsData'
import {
  POS_FULFILLMENT_OPTIONS,
  labelForPosFulfillmentId,
} from '../constants/posFulfillmentModes'

function parseIdDigits(s) {
  const d = String(s || '').replace(/\D/g, '')
  return d ? parseInt(d, 10) : 0
}

/** Pemisah ribuan dengan koma (en-US), memudahkan baca nominal Rp — nilai asli tetap dari parseIdDigits. */
function formatThousandsComma(n) {
  if (!Number.isFinite(n) || n < 0) return ''
  return Math.trunc(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

const PASTELS = [
  'bg-rose-100 dark:bg-rose-950/50',
  'bg-emerald-100 dark:bg-emerald-950/50',
  'bg-sky-100 dark:bg-sky-950/50',
  'bg-amber-100 dark:bg-amber-950/50',
  'bg-violet-100 dark:bg-violet-950/50',
  'bg-cyan-100 dark:bg-cyan-950/50',
]

function initialsFromName(n) {
  const w = String(n || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (w.length >= 2)
    return (w[0][0] + w[1][0]).replace(/[^a-zA-Z]/g, '').toUpperCase() || 'PR'
  if (w.length === 1 && w[0].length >= 2) return w[0].slice(0, 2).toUpperCase()
  return (n || 'PR').slice(0, 2).toUpperCase()
}

function randomId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export default function PosTerminal() {
  const { currentUser } = useAuth()

  const { products, loading: productsLoading } = useProducts()
  const { warehouses, loading: warehousesLoading } = useWarehouses()
  const { accounts } = useAccounts()
  const { users } = useUsers()
  const { contacts, loading: contactsLoading, refetch: refetchContacts } =
    useContacts()

  const [warehouseId, setWarehouseId] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Semua')

  /** @type {Array<{ lineId: string, productId: string, sku: string, nama: string, harga: number, serialNumber: string|null, stockDocIdForDecrement?: string }>} */
  const [cart, setCart] = useState([])
  const [scanValue, setScanValue] = useState('')
  const [salespersonUid, setSalespersonUid] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('tunai')
  const [accountId, setAccountId] = useState('')
  const [stockRows, setStockRows] = useState([])
  const [loadingStock, setLoadingStock] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const scanRef = useRef(null)
  /** Uang pembayaran tunai (input bebas nominal) */
  const [cashTenderedStr, setCashTenderedStr] = useState('')
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [openingCashStr, setOpeningCashStr] = useState('')
  const [shiftSaving, setShiftSaving] = useState(false)

  /** diskon pesanan tambahan — rupiah */
  const [orderDiscountStr, setOrderDiscountStr] = useState('')
  /** metode pembayaran non-tunai (dokumen `posNonCashPayments`) */
  const [nfcMethodId, setNfcMethodId] = useState('')
  /** @type {[string, function]} jenis pengambilan / bungkus / antar / booking */
  const [posFulfillmentMode, setPosFulfillmentMode] = useState(
    POS_FULFILLMENT_OPTIONS[0].id
  )
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerSaving, setCustomerSaving] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  })

  const { settings: posSettings } = usePosWarehouseSettings(warehouseId)
  const { rows: nfcRows } = useNonCashPayments(warehouseId)

  const { openShift } = usePosShifts(warehouseId)

  const secondaryWarehouseIdForPos = String(
    posSettings?.secondaryWarehouseIdForPos || ''
  ).trim()
  const secondaryWidEligible =
    secondaryWarehouseIdForPos && secondaryWarehouseIdForPos !== warehouseId
      ? secondaryWarehouseIdForPos
      : ''
  const eligibleWarehouseIds = useMemo(
    () =>
      secondaryWidEligible
        ? [warehouseId, secondaryWidEligible]
        : [warehouseId],
    [warehouseId, secondaryWidEligible]
  )
  const allowPartialCashPayment = posSettings?.allowPartialCashPayment === true

  const fulfillmentLabelActive = labelForPosFulfillmentId(posFulfillmentMode)
  const fulfillmentHint =
    POS_FULFILLMENT_OPTIONS.find((o) => o.id === posFulfillmentMode)?.hint || ''

  const welcomeName = currentUser?.email?.split('@')[0] || 'Kasir'
  const warehouseName =
    warehouses.find((w) => w.id === warehouseId)?.name || 'Outlet'

  useEffect(() => {
    if (warehouses.length && !warehouseId) {
      setWarehouseId(warehouses[0].id)
    }
  }, [warehouses, warehouseId])

  useEffect(() => {
    if (currentUser?.uid) {
      setSalespersonUid((u) => u || currentUser.uid)
    }
  }, [currentUser])

  const categories = useMemo(() => {
    const s = new Set(['Semua', 'Ada stok'])
    products.forEach((p) => {
      const k = (p.kategori || '').trim()
      if (k) s.add(k)
    })
    return Array.from(s)
  }, [products])

  const approvedUsers = useMemo(
    () => (users || []).filter((u) => u.approved !== false),
    [users]
  )
  const customerOptions = useMemo(
    () =>
      (contacts || []).filter((c) => {
        const hasType = Array.isArray(c.types) ? c.types.includes('Pelanggan') : false
        return hasType || !c.types || c.types.length === 0
      }),
    [contacts]
  )
  const selectedCustomer = useMemo(
    () => customerOptions.find((c) => c.id === selectedCustomerId) || null,
    [customerOptions, selectedCustomerId]
  )

  /** Dokumen stock pada gudang outlet utama (cetak dokumen / fallback serial di gudang ini). */
  const stockDocIdByPrimary = useMemo(() => {
    const m = {}
    stockRows.forEach((row) => {
      if (row._posWarehouseId === warehouseId && row.productId) {
        m[row.productId] = row.id
      }
    })
    return m
  }, [stockRows, warehouseId])

  /** Dokumen stock pada lokasi kedua (etalase), jika dikonfigurasi. */
  const stockDocIdBySecondary = useMemo(() => {
    const m = {}
    if (!secondaryWidEligible) return m
    stockRows.forEach((row) => {
      if (row._posWarehouseId === secondaryWidEligible && row.productId) {
        m[row.productId] = row.id
      }
    })
    return m
  }, [stockRows, secondaryWidEligible])

  useEffect(() => {
    async function loadStock() {
      if (!warehouseId) return
      setLoadingStock(true)
      try {
        const sec = secondaryWidEligible
        const [snapP, snapS] = await Promise.all([
          getDocs(collection(db, 'warehouses', warehouseId, 'stock')),
          sec
            ? getDocs(collection(db, 'warehouses', sec, 'stock'))
            : Promise.resolve(null),
        ])
        const rows = snapP.docs.map((d) => ({
          id: d.id,
          _posWarehouseId: warehouseId,
          ...d.data(),
        }))
        if (sec && snapS) {
          rows.push(
            ...snapS.docs.map((d) => ({
              id: d.id,
              _posWarehouseId: sec,
              ...d.data(),
            }))
          )
        }
        setStockRows(rows)
      } catch (e) {
        console.error(e)
        setStockRows([])
      } finally {
        setLoadingStock(false)
      }
    }
    loadStock()
  }, [warehouseId, secondaryWidEligible])

  const selectedSalesperson = useMemo(() => {
    return approvedUsers.find((x) => x.id === salespersonUid) || null
  }, [approvedUsers, salespersonUid])

  const effectiveSalespersonName = useMemo(() => {
    if (!salespersonUid) return ''
    return (
      selectedSalesperson?.email ||
      selectedSalesperson?.name ||
      salespersonUid
    )
  }, [salespersonUid, selectedSalesperson])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter === 'Semua') return true
      if (categoryFilter === 'Ada stok')
        return Boolean(
          stockDocIdByPrimary[p.id] || stockDocIdBySecondary[p.id]
        )
      return (p.kategori || '') === categoryFilter
    })
  }, [products, categoryFilter, stockDocIdByPrimary, stockDocIdBySecondary])

  const qtyByProduct = useMemo(() => {
    const m = {}
    cart.forEach((c) => {
      m[c.productId] = (m[c.productId] || 0) + 1
    })
    return m
  }, [cart])

  const subtotalCart = cart.reduce((s, l) => s + (l.harga || 0), 0)
  const orderDiscRaw =
    posSettings?.tambahanDiskonEnabled === true ? parseIdDigits(orderDiscountStr) : 0
  const orderDiscCappedPrep = Math.min(orderDiscRaw, subtotalCart)
  const baseAfterDiscount = Math.max(0, subtotalCart - orderDiscCappedPrep)
  const serviceChargeRp =
    posSettings?.serviceChargeEnabled === true
      ? Math.round(
          (baseAfterDiscount * Number(posSettings?.serviceChargePercent ?? 0)) / 100
        )
      : 0
  const taxableBase = Math.max(0, baseAfterDiscount + serviceChargeRp)

  const taxIsPph = posSettings?.selectedTax === 'pph'
  const taxRatePct = taxIsPph
    ? Number(posSettings?.pphPercent ?? 10)
    : Number(posSettings?.ppnPercent ?? 11)
  const taxLabelDisplay = taxIsPph ? 'PPH' : 'PPN'

  const taxAmountDisplay = Math.round((taxableBase * taxRatePct) / 100)
  const grandTotalDisplay = taxableBase + taxAmountDisplay

  useEffect(() => {
    if (!nfcRows?.length) {
      setNfcMethodId('')
      return
    }
    setNfcMethodId((prev) =>
      prev && nfcRows.some((r) => r.id === prev) ? prev : nfcRows[0].id
    )
  }, [nfcRows])

  /** Saat pilih mode tunai → set nominal acuan ke total saat itu (bukan setiap kali total berubah). */
  useEffect(() => {
    if (paymentMethod === 'tunai' || paymentMethod === 'cash') {
      setCashTenderedStr(formatThousandsComma(grandTotalDisplay))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat ganti metode bayar
  }, [paymentMethod])

  /** Keranjang bertambah sehingga total naik → sesuaikan nominal tunai (kecuali mode DP aktif). */
  useEffect(() => {
    if (paymentMethod !== 'tunai' && paymentMethod !== 'cash') return
    if (allowPartialCashPayment) return
    setCashTenderedStr((prev) => {
      const p = parseIdDigits(prev)
      if (!p || p < grandTotalDisplay)
        return formatThousandsComma(grandTotalDisplay)
      return prev
    })
  }, [
    grandTotalDisplay,
    cart.length,
    paymentMethod,
    allowPartialCashPayment,
  ])

  const cashTenderedAmount = parseIdDigits(cashTenderedStr)
  const cashChangeDisplay =
    paymentMethod === 'tunai' || paymentMethod === 'cash'
      ? Math.max(0, cashTenderedAmount - grandTotalDisplay)
      : 0
  const cashOutstandingDp =
    (paymentMethod === 'tunai' || paymentMethod === 'cash') &&
    allowPartialCashPayment &&
    cashTenderedAmount > 0 &&
    cashTenderedAmount < grandTotalDisplay
      ? grandTotalDisplay - cashTenderedAmount
      : 0

  const addProductToCart = useCallback(
    (productId) => {
      const p = products.find((x) => x.id === productId)
      if (!p) return
      const docPrimary = stockDocIdByPrimary[productId]
      const docSecondary = stockDocIdBySecondary[productId]
      const docDec = docPrimary || docSecondary || null
      if (!docDec) {
        setErr(
          'Produk belum ada di stok outlet / etalase — tambahkan di Inventori atau pilih lokasi stok kedua di Pengaturan.'
        )
        return
      }
      setErr('')
      const harga = Number(p.hargaJual ?? p.harga_jual ?? 0) || 0
      const sku = p.kode || p.sku || ''
      setCart((prev) => [
        ...prev,
        {
          lineId: randomId(),
          productId: p.id,
          sku,
          nama: p.nama || sku,
          harga,
          serialNumber: null,
          stockDocIdForDecrement: docDec,
        },
      ])
    },
    [products, stockDocIdByPrimary, stockDocIdBySecondary]
  )

  const removeLine = (lineId) => {
    setCart((prev) => prev.filter((l) => l.lineId !== lineId))
  }

  const updateLineHarga = useCallback((lineId, rawDigits) => {
    const n = Math.max(0, parseInt(String(rawDigits || '').replace(/\D/g, ''), 10) || 0)
    setCart((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, harga: n } : l))
    )
  }, [])

  const applySerialToLine = useCallback((lineId, normalizedSerial, stockDocIdDec) => {
    setCart((prev) =>
      prev.map((l) =>
        l.lineId === lineId
          ? {
              ...l,
              serialNumber: normalizedSerial,
              ...(stockDocIdDec
                ? { stockDocIdForDecrement: stockDocIdDec }
                : {}),
            }
          : l
      )
    )
  }, [])

  const handleScanSubmit = async (e) => {
    e.preventDefault()
    const raw = scanValue.trim()
    if (!raw) return
    setErr('')
    setMsg('')

    const productHit = findProductByScan(products, raw)
    if (productHit) {
      addProductToCart(productHit.id)
      setScanValue('')
      scanRef.current?.focus()
      return
    }

    const norm = normalizeSerialId(raw)
    const serialRef = doc(db, 'itemSerials', norm)
    const serialSnap = await getDoc(serialRef)
    if (!serialSnap.exists()) {
      setErr(
        `Serial "${norm}" tidak ditemukan. Scan SKU produk atau serial yang ada di gudang.`
      )
      setScanValue('')
      return
    }
    const sd = serialSnap.data()
    if (!eligibleWarehouseIds.includes(sd.warehouseId)) {
      setErr(
        secondaryWidEligible
          ? `Serial ada di lokasi lain (belokasi di outlet utama atau lokasi kedua Pengaturan).`
          : 'Serial tidak di gudang outlet ini.'
      )
      setScanValue('')
      return
    }
    if (sd.status !== 'in_stock') {
      setErr('Serial tidak tersedia.')
      setScanValue('')
      return
    }
    const target = cart.find(
      (l) => !l.serialNumber && l.productId === sd.productId
    )
    if (!target) {
      setErr('Tambah produk ke keranjang dulu, baru scan serial untuk baris tersebut.')
      setScanValue('')
      return
    }
    let docDec = ''
    if (sd.warehouseId === warehouseId) {
      docDec = stockDocIdByPrimary[sd.productId] || ''
    } else if (sd.warehouseId === secondaryWidEligible) {
      docDec = stockDocIdBySecondary[sd.productId] || ''
    }
    if (!docDec) {
      setErr(
        'Baris stok Inventori tidak ditemukan untuk produk di lokasi serial ini — sinkronkan stok atau terima masuk lagi.'
      )
      setScanValue('')
      return
    }
    applySerialToLine(target.lineId, norm, docDec)
    setScanValue('')
    setMsg(`Serial \"${norm}\" → ${target.nama}`)
    scanRef.current?.focus()
  }

  const allSerialsFilled =
    cart.length > 0 && cart.every((l) => l.serialNumber)

  const selectedCustomerName =
    selectedCustomer?.name || selectedCustomer?.company || ''
  const selectedCustomerPhone = selectedCustomer?.phone || ''
  const selectedCustomerAddress = selectedCustomer?.address || ''

  const resetNewCustomerForm = useCallback(() => {
    setNewCustomerForm({
      name: '',
      phone: '',
      email: '',
      address: '',
    })
  }, [])

  const handleSaveNewCustomer = useCallback(async () => {
    const name = String(newCustomerForm.name || '').trim()
    const phone = String(newCustomerForm.phone || '').trim()
    const email = String(newCustomerForm.email || '').trim()
    const address = String(newCustomerForm.address || '').trim()
    if (!name) {
      setErr('Nama pelanggan wajib diisi.')
      return
    }
    if (posFulfillmentMode === 'delivery' && !address) {
      setErr('Alamat wajib diisi untuk pesanan antar.')
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
      setCustomerModalOpen(false)
      resetNewCustomerForm()
      setMsg(`Pelanggan "${name}" ditambahkan dan dipilih.`)
    } catch (e) {
      setErr(e?.message || 'Gagal menyimpan pelanggan baru')
    } finally {
      setCustomerSaving(false)
    }
  }, [newCustomerForm, posFulfillmentMode, refetchContacts, resetNewCustomerForm])

  const handleCheckout = async () => {
    setErr('')
    setMsg('')
    if (!warehouseId) {
      setErr('Pilih gudang (outlet).')
      return
    }
    if (!cart.length) {
      setErr('Keranjang kosong.')
      return
    }
    if (!allSerialsFilled) {
      setErr('Setiap unit wajah scan serial lengkap.')
      return
    }
    if (!salespersonUid || !effectiveSalespersonName) {
      setErr('Pilih penjual di daftar.')
      return
    }
    if (paymentMethod === 'pay_later' && !selectedCustomerId) {
      setErr('Untuk bayar nanti, pilih pelanggan atau tambah pelanggan baru dulu.')
      return
    }
    if (posFulfillmentMode === 'delivery' && !selectedCustomerAddress) {
      setErr('Untuk pesanan antar, isi alamat pelanggan terlebih dahulu.')
      return
    }
    const spUid = salespersonUid
    const spName = effectiveSalespersonName
    if (
      (paymentMethod === 'tunai' || paymentMethod === 'cash') &&
      !accountId
    ) {
      setErr('Pilih akun kas untuk tunai.')
      return
    }

    let tenderedRounded = 0
    if (paymentMethod === 'tunai' || paymentMethod === 'cash') {
      tenderedRounded = cashTenderedAmount
      if (!Number.isFinite(tenderedRounded) || tenderedRounded < 1) {
        setErr('Masukkan nominal tunai yang valid (minimal Rp 1 untuk DP/tunai).')
        return
      }
      if (!allowPartialCashPayment && tenderedRounded < grandTotalDisplay) {
        setErr(
          `Uang tunai kurang: masukkan ≥ Rp ${grandTotalDisplay.toLocaleString(
            'id-ID'
          )} atau aktifkan DP di Pengaturan → Kasir.`
        )
        return
      }
    }

    const productById = {}
    products.forEach((p) => {
      productById[p.id] = p
    })

    if (paymentMethod === 'credit') {
      if (!nfcRows?.length) {
        setErr(
          'Belum ada metode non tunai — atur di Pengaturan → Pembayaran Non Tunai, atau pakai Bayar nanti.'
        )
        return
      }
      if (!nfcMethodId) {
        setErr('Pilih metode non tunai.')
        return
      }
    }

    const paymentCommitted =
      paymentMethod === 'pay_later'
        ? 'pay_later'
        : paymentMethod === 'credit' && nfcMethodId
          ? `nfc_${nfcMethodId}`
          : paymentMethod

    try {
      setSaving(true)
      const result = await commitPosSale({
        warehouseId,
        eligibleWarehouseIds,
        payLaterDueDays: 30,
        fulfillmentMode: posFulfillmentMode,
        fulfillmentLabel: fulfillmentLabelActive,
        allowPartialCash:
          allowPartialCashPayment &&
          (paymentMethod === 'tunai' || paymentMethod === 'cash'),
        lines: cart.map((l) => ({
          productId: l.productId,
          serialNumber: l.serialNumber,
          unitPrice: l.harga,
          ...(l.stockDocIdForDecrement
            ? { stockDocIdForDecrement: l.stockDocIdForDecrement }
            : {}),
        })),
        salespersonUid: spUid,
        salespersonName: spName,
        paymentMethod: paymentCommitted,
        cashierUid: currentUser?.uid || '',
        cashTendered:
          paymentMethod === 'tunai' || paymentMethod === 'cash'
            ? tenderedRounded
            : undefined,
        accountId:
          paymentMethod === 'tunai' || paymentMethod === 'cash' ? accountId : '',
        orderDiscountRp: orderDiscCappedPrep,
        serviceChargeRp,
        vatRatePercent: taxRatePct,
        taxLabel: taxLabelDisplay,
        productById,
        stockDocIdByProductId: stockDocIdByPrimary,
        customerId: selectedCustomerId,
        customerName: selectedCustomerName || 'POS Walk-in',
        customerPhone: selectedCustomerPhone,
        customerAddress: selectedCustomerAddress,
      })
      setMsg(
        paymentMethod === 'pay_later'
          ? `Tagihan ${result.number} tercatat (piutang) · jatuh tempo sesuai Tagihan · ${fulfillmentLabelActive} · Rp ${result.total?.toLocaleString(
              'id-ID'
            )}`
          : `Berhasil ${result.number} · ${fulfillmentLabelActive} · Total Rp ${result.total?.toLocaleString(
              'id-ID'
            )}`
      )
      setCart([])
      if (!selectedCustomerId) {
        setNewCustomerForm({ name: '', phone: '', email: '', address: '' })
      }
      const sec = secondaryWidEligible
      const [snapP, snapS] = await Promise.all([
        getDocs(collection(db, 'warehouses', warehouseId, 'stock')),
        sec
          ? getDocs(collection(db, 'warehouses', sec, 'stock'))
          : Promise.resolve(null),
      ])
      const rows = snapP.docs.map((d) => ({
        id: d.id,
        _posWarehouseId: warehouseId,
        ...d.data(),
      }))
      if (sec && snapS) {
        rows.push(
          ...snapS.docs.map((d) => ({
            id: d.id,
            _posWarehouseId: sec,
            ...d.data(),
          }))
        )
      }
      setStockRows(rows)
      scanRef.current?.focus()
    } catch (e) {
      console.error(e)
      setErr(e?.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const cashLikeAccounts = useMemo(
    () =>
      (accounts || []).filter(
        (a) =>
          a &&
          (a.type === 'cash' ||
            a.kas === true ||
            String(a.name || '').toLowerCase().includes('kas'))
      ),
    [accounts]
  )

  const todayLong = useMemo(
    () =>
      new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    []
  )

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#eef2f6] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {/* Top bar seperti terminal kasir */}
        <header className="shrink-0 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex flex-col min-w-[10rem]">
            <span className="text-sm font-semibold text-slate-800 dark:text-white">
              Selamat datang, {welcomeName}
            </span>
            <span className="inline-flex mt-1 items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 font-medium border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                <WarehouseIconLabel />
                {warehousesLoading ? '…' : warehouseName}
              </span>
              <select
                aria-label="Ganti outlet"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="text-xs underline-offset-2 bg-transparent border-none text-blue-700 dark:text-blue-400 cursor-pointer"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </span>
          </div>

          <form
            onSubmit={handleScanSubmit}
            className="flex flex-1 min-w-[220px] max-w-xl items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-inner dark:bg-slate-800 dark:border-slate-600"
          >
            <ScanLine className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              ref={scanRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              placeholder="Cari produk… / scan SKU · barcode · serial"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Proses
            </button>
          </form>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Calendar className="h-4 w-4" aria-hidden />
              {todayLong}
            </span>
            <button
              type="button"
              disabled={!warehouseId || Boolean(openShift) || shiftSaving}
              onClick={() => {
                setOpeningCashStr('')
                setShiftModalOpen(true)
              }}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-55 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
              title={openShift ? 'Shift sudah terbuka' : 'Mulai shift kasir'}
            >
              {openShift ? 'Shift aktif' : 'Buka Shift'}
            </button>
          </div>
        </header>

        {/* Shell terpisah: konten utama “melayang” di dalam bingkai */}
        <div className="flex min-h-0 flex-1 p-3 sm:p-5">
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-white/90 bg-white shadow-2xl shadow-slate-300/60 dark:border-slate-700/90 dark:bg-slate-900 dark:shadow-black/40">
            <div className="flex min-h-0 min-w-0 flex-1 divide-x divide-slate-100 overflow-hidden dark:divide-slate-800">
              {/* Kolom produk */}
              <section className="flex min-h-0 flex-[1.15] flex-col">
                <div className="shrink-0 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
                    {categories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategoryFilter(c)}
                        className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                          categoryFilter === c
                            ? 'bg-slate-900 text-white shadow dark:bg-blue-600'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  {productsLoading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-slate-500">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      Memuat produk…
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredProducts.map((p, idx) => {
                        const hasStock = Boolean(
                          stockDocIdByPrimary[p.id] || stockDocIdBySecondary[p.id]
                        )
                        const price = Number(p.hargaJual ?? 0) || 0
                        const pastel = PASTELS[idx % PASTELS.length]
                        const initials = initialsFromName(p.nama)
                        const qty = qtyByProduct[p.id] || 0

                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={!hasStock}
                            onClick={() => addProductToCart(p.id)}
                            className={`relative flex h-[8.75rem] flex-col rounded-3xl ${pastel} p-4 text-left shadow-sm transition hover:brightness-[1.03] hover:shadow-md disabled:opacity-45 dark:brightness-95 ${
                              qty ? 'ring-2 ring-slate-800/70 dark:ring-blue-400' : ''
                            }`}
                          >
                            <span className="absolute left-4 top-3 text-[11px] font-bold text-slate-800 dark:text-white">
                              {price.toLocaleString('id-ID')}
                            </span>
                            <div className="flex flex-1 flex-col justify-center pb-10">
                              <span className="text-center text-3xl font-bold tracking-wide text-slate-700/85 dark:text-slate-900 dark:brightness-150">
                                {initials}
                              </span>
                              <span className="mt-3 line-clamp-2 text-center text-xs font-medium leading-snug text-slate-800 dark:text-slate-950 dark:brightness-110">
                                {p.nama || 'Produk'}
                              </span>
                              <span className="mt-1 truncate text-center text-[10px] font-medium uppercase tracking-wide text-slate-600 opacity-75 dark:text-white/80">
                                {p.kode || p.sku || '—'}
                              </span>
                            </div>
                            {qty ? (
                              <span className="absolute bottom-2 right-3 flex h-7 min-w-[1.65rem] items-center justify-center rounded-full bg-white/95 px-2 text-xs font-bold text-slate-900 shadow-md dark:bg-slate-900 dark:text-white">
                                ×{qty}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* Keranjang */}
              <section className="flex w-full min-h-0 shrink-0 flex-col sm:w-[min(100%,24rem)] lg:w-[26rem]">
                <div className="shrink-0 space-y-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Rincian pesanan
                  </h2>
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label="Cara pengambilan pesanan"
                  >
                    {POS_FULFILLMENT_OPTIONS.map((opt) => {
                      const sel = opt.id === posFulfillmentMode
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPosFulfillmentMode(opt.id)}
                          title={opt.hint}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            sel
                              ? 'bg-emerald-600 text-white shadow dark:bg-emerald-600'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                  {fulfillmentHint ? (
                    <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      {fulfillmentLabelActive}: {fulfillmentHint}
                    </p>
                  ) : null}
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 shrink-0 text-slate-400" />
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        className="w-full bg-transparent text-sm outline-none dark:text-white"
                      >
                        <option value="">Umum / walk-in</option>
                        {customerOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {(c.name || c.company || 'Tanpa nama') +
                              (c.phone ? ` · ${c.phone}` : '')}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setErr('')
                          setCustomerModalOpen(true)
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-gradient-to-b from-blue-500 to-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-blue-600 hover:to-blue-700 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 dark:border-blue-800/70 dark:from-blue-600 dark:to-blue-700"
                        title="Tambah pelanggan baru"
                      >
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[12px] leading-none">
                          +
                        </span>
                        Pelanggan
                      </button>
                    </div>
                    {contactsLoading ? (
                      <p className="mt-1 text-[10px] text-slate-500">Memuat kontak pelanggan…</p>
                    ) : selectedCustomer ? (
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        {selectedCustomerName}
                        {selectedCustomerPhone ? ` · ${selectedCustomerPhone}` : ''}
                        {selectedCustomerAddress ? ` · ${selectedCustomerAddress}` : ''}
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        Walk-in tanpa data pelanggan.
                      </p>
                    )}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {loadingStock && (
                    <p className="mb-2 text-xs text-amber-600">Memuat stok…</p>
                  )}
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-400 dark:border-slate-700">
                      Belum ada pesanan · tap produk atau scan SKU.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {cart.map((line) => (
                        <li
                          key={line.lineId}
                          className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[11px] font-semibold uppercase text-slate-500">
                                {line.sku}
                              </div>
                              <div className="mt-1 font-semibold leading-tight text-slate-900 dark:text-white">
                                {line.nama}
                              </div>
                              <div className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                {posSettings?.hargaProdukManualEnabled ? (
                                  <span className="inline-flex flex-wrap items-center gap-1">
                                    <span className="text-[11px] font-medium text-slate-500">
                                      Rp
                                    </span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      className="max-w-[7rem] rounded border border-emerald-200 bg-white px-1.5 py-0.5 font-mono text-sm text-emerald-800 dark:border-emerald-800 dark:bg-slate-950 dark:text-emerald-300"
                                      value={formatThousandsComma(line.harga || 0)}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(/\D/g, '')
                                        updateLineHarga(line.lineId, raw)
                                      }}
                                      aria-label="Harga baris"
                                    />
                                  </span>
                                ) : (
                                  <>Rp {(line.harga || 0).toLocaleString('id-ID')}</>
                                )}
                              </div>
                              <div className="mt-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                Serial:{' '}
                                <span
                                  className={
                                    line.serialNumber
                                      ? 'text-emerald-600'
                                      : 'text-amber-600'
                                  }
                                >
                                  {line.serialNumber || '(scan…)'}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              aria-label="Hapus baris"
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                              onClick={() => removeLine(line.lineId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* Pembayaran — area tengah bisa di-scroll; tombol Bayar tetap menempel di bawah */}
              <section className="flex min-h-0 min-w-[min(100%,17rem)] max-w-[24rem] flex-1 flex-col overflow-hidden lg:w-[20rem] xl:w-[21rem]">
                <div className="shrink-0 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Penjual (komisi)
                  </label>
                  <select
                    value={salespersonUid}
                    onChange={(e) => setSalespersonUid(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    required
                  >
                    <option value="">Pilih penjual</option>
                    {approvedUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email || u.name || u.id}
                      </option>
                    ))}
                  </select>

                  <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Pembayaran
                  </label>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('tunai')}
                      className={`rounded-lg py-2 text-[11px] font-semibold leading-tight shadow-sm transition sm:text-xs ${
                        paymentMethod === 'tunai'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      Tunai
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pay_later')}
                      title="Tanpa pembayaran hari ini — lunas kemudian di halaman Tagihan"
                      className={`rounded-lg py-2 text-[11px] font-semibold leading-tight shadow-sm transition sm:text-xs ${
                        paymentMethod === 'pay_later'
                          ? 'bg-amber-600 text-white dark:bg-amber-600'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      Bayar nanti
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('credit')}
                      className={`rounded-lg py-2 text-[11px] font-semibold leading-tight shadow-sm transition sm:text-xs ${
                        paymentMethod === 'credit'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      Non tunai
                    </button>
                  </div>
                  {paymentMethod === 'pay_later' ? (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                      Total masuk sebagai <strong>piutang</strong> (belum dibayar). Jatuh tempo +30 hari.
                      Pelunasan di <strong>Penjualan → Tagihan</strong> di aplikasi utama.
                    </p>
                  ) : null}
                  {paymentMethod === 'credit' && nfcRows.length > 0 ? (
                    <div className="mt-2">
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Metode non-tunai
                      </label>
                      <select
                        value={nfcMethodId}
                        onChange={(e) => setNfcMethodId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      >
                        {(nfcRows || []).map((m) => (
                          <option key={m.id} value={m.id}>
                            {(m?.name || 'Metode') +
                              (m?.accountNumber
                                ? ` · ${String(m.accountNumber).slice(-4)}`
                                : '')}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : paymentMethod === 'credit' ? (
                    <p className="mt-2 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
                      Tambah metode di Pengaturan → Pembayaran Non Tunai.
                    </p>
                  ) : null}
                  {(paymentMethod === 'tunai' || paymentMethod === 'cash') && (
                    <div className="mt-2">
                      <label className="block text-[10px] font-medium text-slate-500">
                        Akun kas
                      </label>
                      <select
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="">— Akun kas —</option>
                        {(cashLikeAccounts.length ? cashLikeAccounts : accounts || []).map(
                          (a) => (
                            <option key={a.id} value={a.id}>
                              {(a.code ? `${a.code} ` : '') + (a.name || a.id)}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-2.5">
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-slate-600 dark:text-slate-400">Subtotal baris</span>
                      <span className="tabular-nums">
                        Rp {subtotalCart.toLocaleString('id-ID')}
                      </span>
                    </div>
                    {posSettings?.tambahanDiskonEnabled ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-2 dark:border-slate-700 dark:bg-slate-950/50">
                        <label className="text-[10px] font-semibold uppercase text-slate-500">
                          Diskon pesanan (Rp)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-900"
                          placeholder="0"
                          value={
                            orderDiscountStr
                              ? formatThousandsComma(
                                  parseInt(
                                    orderDiscountStr.replace(/\D/g, ''),
                                    10
                                  ) || 0
                                )
                              : ''
                          }
                          onChange={(e) =>
                            setOrderDiscountStr(e.target.value.replace(/\D/g, ''))
                          }
                        />
                      </div>
                    ) : null}
                    {posSettings?.tambahanDiskonEnabled &&
                    orderDiscCappedPrep > 0 ? (
                      <div className="flex justify-between text-sm font-medium text-slate-600 dark:text-slate-400">
                        <span>Setelah diskon</span>
                        <span className="tabular-nums">
                          Rp {baseAfterDiscount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    ) : null}
                    {posSettings?.serviceChargeEnabled === true &&
                    serviceChargeRp > 0 ? (
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-slate-600 dark:text-slate-400">
                          Service{' '}
                          {Number(posSettings.serviceChargePercent || 0) % 1 === 0
                            ? `( ${Number(posSettings.serviceChargePercent || 0)}% )`
                            : ''}
                        </span>
                        <span className="tabular-nums">
                          Rp {serviceChargeRp.toLocaleString('id-ID')}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-[13px] text-slate-500 dark:text-slate-400">
                      <span>Dasar + layanan</span>
                      <span className="tabular-nums font-medium">
                        Rp {taxableBase.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-slate-600 dark:text-slate-400">
                        {taxLabelDisplay} ({taxRatePct}%)
                      </span>
                      <span className="tabular-nums">
                        Rp {taxAmountDisplay.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <hr className="border-slate-200 dark:border-slate-700" />
                    <div className="flex items-baseline justify-between gap-2 font-bold tabular-nums">
                      <span className="text-sm">Total tagihan</span>
                      <span className="text-base text-emerald-600 dark:text-emerald-400">
                        Rp {grandTotalDisplay.toLocaleString('id-ID')}
                      </span>
                    </div>

                    {(paymentMethod === 'tunai' || paymentMethod === 'cash') && (
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/90 p-2.5 dark:border-slate-700 dark:bg-slate-950/50">
                        <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Nominal dibayarkan (tunai)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="Contoh 1,500,000"
                          title="Pemisah ribuan otomatis (koma)"
                          value={cashTenderedStr}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '')
                            if (raw === '') {
                              setCashTenderedStr('')
                              return
                            }
                            const n = parseInt(raw, 10)
                            setCashTenderedStr(Number.isFinite(n) ? formatThousandsComma(n) : '')
                          }}
                          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums outline-none ring-blue-400/60 focus:border-blue-400 focus:ring-1 dark:border-slate-600 dark:bg-slate-900"
                          aria-invalid={
                            !allowPartialCashPayment &&
                            cashTenderedAmount > 0 &&
                            cashTenderedAmount < grandTotalDisplay
                          }
                        />
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setCashTenderedStr(
                                formatThousandsComma(grandTotalDisplay)
                              )
                            }
                            className="rounded-md bg-white py-1.5 text-[10px] font-semibold leading-tight text-blue-700 shadow-sm ring-1 ring-slate-200 hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-300 dark:ring-slate-600"
                          >
                            Pas
                          </button>
                          {[50000, 100000, 200000, 500000].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() =>
                                setCashTenderedStr((prev) => {
                                  const current = parseIdDigits(prev)
                                  return formatThousandsComma(current + amt)
                                })
                              }
                              className="rounded-md bg-slate-100 py-1.5 text-[10px] font-semibold tabular-nums leading-tight text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                            >
                              {(amt / 1000).toFixed(0)}k
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1.5 text-xs dark:border-slate-700">
                          <span className="text-slate-600 dark:text-slate-400">
                            {cashOutstandingDp ? 'Sisa tagihan' : 'Kembalian'}
                          </span>
                          <span
                            className={
                              cashOutstandingDp || cashTenderedAmount < grandTotalDisplay
                                ? allowPartialCashPayment && cashOutstandingDp
                                  ? 'font-semibold text-amber-700 dark:text-amber-300'
                                  : 'font-semibold text-amber-600'
                                : 'font-semibold text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            Rp{' '}
                            {formatThousandsComma(
                              cashOutstandingDp ? cashOutstandingDp : cashChangeDisplay
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {msg ? (
                      <p className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                        {msg}
                      </p>
                    ) : null}
                    {err ? (
                      <p className="rounded-lg bg-red-50 p-2.5 text-xs text-red-800 dark:bg-red-950/60 dark:text-red-200">
                        {err}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0 border-t border-slate-200 bg-white/98 px-3 py-3 shadow-[0_-4px_12px_-4px_rgba(0,0,0,.08)] dark:border-slate-800 dark:bg-slate-900/98">
                  <button
                    type="button"
                    disabled={
                      saving ||
                      !cart.length ||
                      !allSerialsFilled ||
                      !salespersonUid
                    }
                    onClick={handleCheckout}
                    className="w-full rounded-xl bg-emerald-600 py-3 text-[15px] font-bold leading-tight text-white shadow-md shadow-emerald-600/30 transition hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-40"
                  >
                    {saving
                      ? 'Menyimpan…'
                      : paymentMethod === 'pay_later'
                        ? `Catat piutang — Rp ${grandTotalDisplay.toLocaleString('id-ID')}`
                        : `Bayar — Rp ${grandTotalDisplay.toLocaleString('id-ID')}`}
                  </button>
                  <button
                    type="button"
                    disabled
                    className="mt-2 w-full rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-400 dark:border-slate-700"
                    title="Segera — simpan sebagai pesanan tunda"
                  >
                    Simpan ke pesanan
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Footer POS minimal */}
        <footer className="shrink-0 border-t border-slate-200/70 bg-white/95 px-4 py-2 text-[11px] text-slate-500 dark:bg-slate-900/95 dark:border-slate-800 dark:text-slate-500 flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>
            Kasir pintar ·{' '}
            <Link to="/dashboard" className="text-blue-600 hover:underline dark:text-blue-400">
              Keluar POS ke aplikasi
            </Link>
          </span>
          <span>POS / serial &amp; SKU terlacak · {grandTotalDisplay > 0 ? `Total ± Rp ${grandTotalDisplay.toLocaleString('id-ID')}` : 'Belum ada item'}</span>
        </footer>

        {customerModalOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-modal-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <h2 id="customer-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Tambah pelanggan baru
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Data ini langsung bisa dipakai untuk antar atau bayar nanti.
              </p>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Nama</span>
                  <input
                    type="text"
                    value={newCustomerForm.name}
                    onChange={(e) =>
                      setNewCustomerForm((p) => ({ ...p, name: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    placeholder="Nama pelanggan"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Telepon</span>
                  <input
                    type="text"
                    value={newCustomerForm.phone}
                    onChange={(e) =>
                      setNewCustomerForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    placeholder="08xxxxxxxxxx"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Email (opsional)</span>
                  <input
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) =>
                      setNewCustomerForm((p) => ({ ...p, email: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
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
                    className="mt-1 min-h-[72px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    placeholder="Alamat pengiriman / catatan lokasi"
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
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={customerSaving}
                  onClick={handleSaveNewCustomer}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {customerSaving ? 'Menyimpan…' : 'Simpan pelanggan'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {shiftModalOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shift-modal-title"
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <h2 id="shift-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Buka shift
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Outlet: {warehouseName}. Catat nominal kas pembuka jika digunakan.
              </p>
              <label className="mt-4 block">
                <span className="text-xs font-semibold uppercase text-slate-500">
                  Kas awal (opsional)
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-950"
                  placeholder="0"
                  title="Pemisah ribuan otomatis (koma)"
                  value={openingCashStr}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '')
                    if (raw === '') {
                      setOpeningCashStr('')
                      return
                    }
                    const n = parseInt(raw, 10)
                    setOpeningCashStr(
                      Number.isFinite(n) ? formatThousandsComma(n) : ''
                    )
                  }}
                />
              </label>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                  onClick={() => setShiftModalOpen(false)}
                  disabled={shiftSaving}
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={shiftSaving || !warehouseId || !currentUser?.uid}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-45"
                  onClick={async () => {
                    try {
                      const openingParsed = parseIdDigits(openingCashStr)
                      if (
                        posSettings?.bukaKasirModal === true &&
                        (!openingParsed || openingParsed <= 0)
                      ) {
                        setErr(
                          'Outlet ini mengharuskan isi nominal kas pembuka (> 0) saat buka shift.'
                        )
                        return
                      }
                      setShiftSaving(true)
                      await createPosShiftOpen({
                        warehouseId,
                        openingCash: openingParsed,
                        userUid: currentUser.uid,
                        userEmail: currentUser.email || '',
                      })
                      setShiftModalOpen(false)
                      setOpeningCashStr('')
                      setMsg('Shift dibuka — siap menjual.')
                    } catch (e) {
                      setErr(e?.message || 'Gagal buka shift')
                    } finally {
                      setShiftSaving(false)
                    }
                  }}
                >
                  {shiftSaving ? '…' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
    </div>
  )
}

function WarehouseIconLabel() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />
    </svg>
  )
}
