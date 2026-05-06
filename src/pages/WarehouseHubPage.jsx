import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { Warehouse, ChevronRight, Loader2, Package } from 'lucide-react'
import { db } from '../firebase/config'
import { useWarehouses } from '../hooks/useWarehouses'
import {
  useWarehouseTransferOrders,
  isOpenTransferStatus,
} from '../hooks/useWarehouseTransferOrders'
import { LAST_WAREHOUSE_KEY } from './WarehouseAppLayout'

export default function WarehouseHubPage() {
  const navigate = useNavigate()
  const { warehouses, loading, error } = useWarehouses()
  const { rows: transferOrders } = useWarehouseTransferOrders()
  const [statsById, setStatsById] = useState({})
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadStats() {
      if (!warehouses?.length) {
        setStatsById({})
        setStatsLoading(false)
        return
      }
      setStatsLoading(true)
      try {
        const entries = await Promise.all(
          warehouses.map(async (w) => {
            const snap = await getDocs(collection(db, 'warehouses', w.id, 'stock'))
            let lineCount = 0
            let unitSum = 0
            snap.docs.forEach((d) => {
              const q = Number(d.data()?.quantity) || 0
              if (q > 0) lineCount += 1
              unitSum += q
            })
            return [w.id, { lineCount, unitSum }]
          })
        )
        if (!cancelled) {
          const m = {}
          entries.forEach(([id, v]) => {
            m[id] = v
          })
          setStatsById(m)
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) setStatsById({})
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }
    loadStats()
    return () => {
      cancelled = true
    }
  }, [warehouses])

  let lastId = ''
  try {
    lastId = String(localStorage.getItem(LAST_WAREHOUSE_KEY) || '').trim()
  } catch {
    lastId = ''
  }

  const openWarehouse = (id) => {
    try {
      localStorage.setItem(LAST_WAREHOUSE_KEY, id)
    } catch {
      /* ignore */
    }
    navigate(`/warehouse/${id}`)
  }

  const pendingDoCountByWarehouse = useMemo(() => {
    const map = {}
    transferOrders.forEach((row) => {
      if (!isOpenTransferStatus(row.status)) return
      const wid = String(row.sourceWarehouseId || '').trim()
      if (!wid) return
      map[wid] = (map[wid] || 0) + 1
    })
    return map
  }, [transferOrders])

  const warehouseNameById = useMemo(() => {
    const map = {}
    ;(warehouses || []).forEach((w) => {
      map[String(w.id)] = w.name || w.code || w.id
    })
    return map
  }, [warehouses])

  const ongoingOrders = useMemo(() => {
    return transferOrders
      .filter((row) => isOpenTransferStatus(row.status))
      .slice(0, 15)
  }, [transferOrders])

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Pilih gudang
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Tampilan dioptimalkan untuk layar kecil dan besar. Terima barang dan ubah stok
          tetap lewat{' '}
          <Link
            to="/inventori"
            className="font-semibold text-blue-600 underline dark:text-blue-400"
          >
            Inventori
          </Link>{' '}
          (akses manajer).
        </p>
      </div>

      {lastId && warehouses.some((w) => w.id === lastId) ? (
        <button
          type="button"
          onClick={() => openWarehouse(lastId)}
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-900 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
        >
          Lanjutkan gudang terakhir →
        </button>
      ) : null}

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          {error?.message || 'Gagal memuat gudang'}
        </p>
      ) : null}

      {loading || statsLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          Memuat…
        </div>
      ) : !warehouses.length ? (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600">
          Belum ada gudang. Tambahkan di menu Inventori.
        </p>
      ) : (
        <>
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
            <p className="text-sm font-bold text-blue-900 dark:text-blue-100">
              Ongoing Delivery Orders ({ongoingOrders.length})
            </p>
            {ongoingOrders.length === 0 ? (
              <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
                Tidak ada DO yang sedang berjalan.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {ongoingOrders.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-2xl border border-blue-100 bg-white px-3 py-2 text-xs dark:border-blue-900/40 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {row.number || row.id}
                        </p>
                        <p className="text-slate-600 dark:text-slate-300">
                          {warehouseNameById[String(row.sourceWarehouseId)] || row.sourceWarehouseId} →{' '}
                          {warehouseNameById[String(row.destinationWarehouseId)] ||
                            row.destinationWarehouseId}
                        </p>
                        {String(row.destinationType || '') === 'customer_delivery' ? (
                          <p className="text-slate-500 dark:text-slate-400">
                            Antar pelanggan: {row.deliveryCustomerName || row.customerName || '-'}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                        {row.statusLabel || row.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {warehouses.map((w) => {
              const st = statsById[w.id] || { lineCount: 0, unitSum: 0 }
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => openWarehouse(w.id)}
                    className="flex w-full items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-900/50"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                      <Warehouse className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {w.name || w.code || w.id}
                      </p>
                      {w.code ? (
                        <p className="text-xs text-slate-500">{w.code}</p>
                      ) : null}
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                          <Package className="h-3 w-3" />
                          {st.lineCount} SKU berqty
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                          Σ {st.unitSum.toLocaleString('id-ID')} unit
                        </span>
                        {(pendingDoCountByWarehouse[w.id] || 0) > 0 ? (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                            DO pending {pendingDoCountByWarehouse[w.id]}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
