import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from 'firebase/firestore'
import {
  Camera,
  Loader2,
  Search,
  ExternalLink,
  Warehouse,
} from 'lucide-react'
import { db } from '../firebase/config'
import { useProducts, findProductByScan } from '../hooks/useProductsData'
import CameraScannerModal from '../components/Scanner/CameraScannerModal'
import { LAST_WAREHOUSE_KEY } from './WarehouseAppLayout'
import {
  useWarehouseTransferOrders,
  WAREHOUSE_DO_FLOW,
  advanceWarehouseTransferOrder,
  isOpenTransferStatus,
} from '../hooks/useWarehouseTransferOrders'
import { useAuth } from '../contexts/AuthContext'

export default function WarehouseWorkspacePage() {
  const { warehouseId } = useParams()
  const { currentUser } = useAuth()
  const { products, loading: productsLoading } = useProducts()
  const { rows: transferOrders } = useWarehouseTransferOrders()
  const [warehouse, setWarehouse] = useState(null)
  const [stockRows, setStockRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [doBusyId, setDoBusyId] = useState('')
  const [doError, setDoError] = useState('')

  useEffect(() => {
    if (!warehouseId) return
    try {
      localStorage.setItem(LAST_WAREHOUSE_KEY, warehouseId)
    } catch {
      /* ignore */
    }
  }, [warehouseId])

  useEffect(() => {
    if (!warehouseId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const whRef = doc(db, 'warehouses', warehouseId)
        const whSnap = await getDoc(whRef)
        if (!whSnap.exists()) {
          if (!cancelled) {
            setWarehouse(null)
            setStockRows([])
            setLoadError('Gudang tidak ditemukan')
          }
          return
        }
        if (!cancelled) setWarehouse({ id: whSnap.id, ...whSnap.data() })

        const stockRef = collection(db, 'warehouses', warehouseId, 'stock')
        const stockSnap = await getDocs(stockRef)
        const list = stockSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        if (!cancelled) setStockRows(list)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setLoadError(e?.message || 'Gagal memuat stok')
          setStockRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [warehouseId])

  const productById = useMemo(() => {
    const m = {}
    ;(products || []).forEach((p) => {
      m[p.id] = p
    })
    return m
  }, [products])

  const enrichedRows = useMemo(() => {
    return stockRows.map((row) => {
      const pid = String(row.productId || '').trim()
      const p = pid ? productById[pid] : null
      const nama =
        p?.nama ||
        row.productName ||
        row.nama ||
        row.name ||
        pid ||
        'Produk'
      const sku = p?.kode || p?.sku || row.sku || ''
      const barcode = p?.barcode || row.barcode || ''
      return {
        ...row,
        _nama: nama,
        _sku: sku,
        _barcode: barcode,
        _pid: pid,
      }
    })
  }, [stockRows, productById])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = [...enrichedRows]
    rows.sort(
      (a, b) =>
        (Number(b.quantity) || 0) - (Number(a.quantity) || 0)
    )
    if (!q) return rows
    return rows.filter((r) => {
      const hay = `${r._nama} ${r._sku} ${r._barcode} ${r._pid}`.toLowerCase()
      return hay.includes(q)
    })
  }, [enrichedRows, search])

  const onScan = useCallback(
    (raw) => {
      const code = String(raw || '').trim()
      setScannerOpen(false)
      if (!code) return
      const hit = findProductByScan(products, code)
      if (hit?.id) {
        setSearch(hit.kode || hit.nama || hit.id)
        return
      }
      setSearch(code)
    },
    [products]
  )

  const pendingTransferOrders = useMemo(() => {
    return transferOrders
      .filter(
        (row) =>
          isOpenTransferStatus(row.status) &&
          String(row.sourceWarehouseId || '').trim() === String(warehouseId || '').trim()
      )
      .slice(0, 20)
  }, [transferOrders, warehouseId])

  const incomingTransferOrders = useMemo(() => {
    return transferOrders
      .filter(
        (row) =>
          isOpenTransferStatus(row.status) &&
          String(row.destinationWarehouseId || '').trim() === String(warehouseId || '').trim()
      )
      .slice(0, 20)
  }, [transferOrders, warehouseId])

  const handleAdvanceDo = useCallback(
    async (row) => {
      if (!row?.id) return
      const canAdvance =
        String(row.sourceWarehouseId || '').trim() === String(warehouseId || '').trim() ||
        (String(row.status || '').trim() === 'in_transit' &&
          String(row.destinationWarehouseId || '').trim() === String(warehouseId || '').trim())
      if (!canAdvance) return
      const step = WAREHOUSE_DO_FLOW[String(row.status || '').trim()]
      if (!step) return
      try {
        setDoError('')
        setDoBusyId(row.id)
        await advanceWarehouseTransferOrder(row.id, row.status, {
          uid: currentUser?.uid || '',
          email: currentUser?.email || '',
        })
      } catch (e) {
        console.error(e)
        setDoError(e?.message || 'Gagal update status DO')
      } finally {
        setDoBusyId('')
      }
    },
    [currentUser?.email, currentUser?.uid, warehouseId]
  )

  if (!warehouseId) {
    return (
      <p className="text-sm text-slate-500">Gudang tidak valid.</p>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Warehouse className="h-5 w-5" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {warehouse?.name || warehouse?.code || warehouseId}
            </h1>
          </div>
          {warehouse?.code ? (
            <p className="text-xs text-slate-500">{warehouse.code}</p>
          ) : null}
          <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Cari dan pindai SKU untuk cek qty di lokasi ini. Untuk terima barang, serial,
            dan penyesuaian penuh gunakan inventori.
          </p>
        </div>
        <Link
          to={`/inventori/gudang/${warehouseId}`}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
        >
          <ExternalLink className="h-4 w-4" />
          Kelola di Inventori
        </Link>
      </div>

      {loadError ? (
        <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          {loadError}
        </p>
      ) : null}
      {doError ? (
        <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          {doError}
        </p>
      ) : null}

      {pendingTransferOrders.length > 0 ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/60 dark:bg-rose-950/30">
          <p className="text-sm font-bold text-rose-800 dark:text-rose-200">
            DO keluar dari gudang ini ({pendingTransferOrders.length})
          </p>
          <ul className="mt-2 space-y-2">
            {pendingTransferOrders.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-rose-100 bg-white px-3 py-2 text-xs text-rose-900 dark:border-rose-900/40 dark:bg-slate-900 dark:text-rose-100"
              >
                <p className="font-semibold">
                  {row.number || row.id} · tujuan outlet {row.destinationWarehouseId || '-'}
                </p>
                <p className="mt-0.5">
                  Dari transaksi {row?.sourceRef?.number || '-'} · {row.itemCount || 0} item
                </p>
                <p className="mt-0.5">
                  Status: {row.statusLabel || row.status || '-'}
                </p>
                <ul className="mt-1 space-y-0.5 text-[11px]">
                  {(Array.isArray(row.items) ? row.items : []).slice(0, 4).map((it, idx) => (
                    <li key={`${row.id}:itm:${idx}`}>
                      • {it.productName || it.productId} {it.serialNumber ? `(${it.serialNumber})` : ''}
                    </li>
                  ))}
                </ul>
                {Array.isArray(row.timeline) && row.timeline.length > 0 ? (
                  <div className="mt-2 border-t border-rose-100 pt-1.5 dark:border-rose-900/40">
                    <p className="text-[11px] font-semibold">Timeline</p>
                    <ul className="mt-1 space-y-0.5 text-[10px]">
                      {[...row.timeline]
                        .slice(-4)
                        .reverse()
                        .map((ev, idx) => (
                          <li key={`${row.id}:tl:${idx}`}>
                            • {ev.label || `${ev.from}→${ev.to}`} · {ev.byEmail || ev.byUid || '-'}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
                {WAREHOUSE_DO_FLOW[String(row.status || '').trim()] ? (
                  <button
                    type="button"
                    disabled={doBusyId === row.id}
                    onClick={() => handleAdvanceDo(row)}
                    className="mt-2 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    {doBusyId === row.id
                      ? 'Memproses…'
                      : WAREHOUSE_DO_FLOW[String(row.status || '').trim()]?.label || 'Lanjut'}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {incomingTransferOrders.length > 0 ? (
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/60 dark:bg-blue-950/30">
          <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
            DO masuk ke gudang/toko ini ({incomingTransferOrders.length})
          </p>
          <ul className="mt-2 space-y-2">
            {incomingTransferOrders.map((row) => (
              <li
                key={`in:${row.id}`}
                className="rounded-2xl border border-blue-100 bg-white px-3 py-2 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-slate-900 dark:text-blue-100"
              >
                <p className="font-semibold">
                  {row.number || row.id} · dari gudang {row.sourceWarehouseId || '-'}
                </p>
                <p className="mt-0.5">
                  Status: {row.statusLabel || row.status || '-'}
                </p>
                {String(row.status || '').trim() === 'in_transit' ? (
                  <button
                    type="button"
                    disabled={doBusyId === row.id}
                    onClick={() => handleAdvanceDo(row)}
                    className="mt-2 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    {doBusyId === row.id ? 'Memproses…' : 'Terima di toko'}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nama, SKU, barcode…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            <Camera className="h-4 w-4" />
            Pindai
          </button>
        </div>
      </div>

      {loading || productsLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          Memuat stok…
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3">Satuan</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      Tidak ada baris stok cocok.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {r._nama}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {r._sku || '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {Number(r.quantity || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {r.unit || r.satuan || 'Pcs'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 lg:hidden">
            {filteredRows.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600">
                Tidak ada baris stok cocok.
              </li>
            ) : (
              filteredRows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {r._nama}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    SKU {r._sku || '—'}
                  </p>
                  <p className="mt-2 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {Number(r.quantity || 0).toLocaleString('id-ID')}{' '}
                    <span className="text-sm font-normal text-slate-500">
                      {r.unit || r.satuan || 'Pcs'}
                    </span>
                  </p>
                </li>
              ))
            )}
          </ul>
        </>
      )}

      <CameraScannerModal
        open={scannerOpen}
        onScan={onScan}
        onClose={() => setScannerOpen(false)}
        title="Pindai SKU / barcode"
        hint="Arahkan ke etiket produk untuk menyaring daftar."
      />
    </div>
  )
}
