import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Plus,
  Loader2,
  ChevronDown,
  Building2,
  Clock,
  Inbox,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ShoppingCart,
  Wallet,
  PackageSearch,
} from 'lucide-react'
import { useSalesOrders } from '../hooks/useSalesOrdersData'
import { useInvoices } from '../hooks/useInvoiceData'
import { useContacts } from '../hooks/useContactsData'
import { useWarehouses } from '../hooks/useWarehouses'
import { useAuth } from '../contexts/AuthContext'
import { usePosCashLedger, addPosManualCashEntry } from '../hooks/usePosCashLedger'
import { usePosShifts } from '../hooks/usePosShifts'
import { usePosWarehouseSettings } from '../hooks/usePosWarehouseSettings'

/** @typedef {'pemesanan' | 'tagihan' | 'shift' | 'kas'} TransaksiSection */

const COL_PANEL = 'border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'

function EmptyInboxHero() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center text-slate-400">
      <Inbox className="h-14 w-14 opacity-40" aria-hidden />
      <p className="text-sm font-medium">Data Kosong</p>
    </div>
  )
}

function InvoiceStatusLabel(inv) {
  const remaining = inv.remaining ?? inv.total ?? 0
  const total = inv.total ?? 0
  const voided =
    inv.void === true ||
    inv.voided === true ||
    String(inv.status || '').toLowerCase() === 'void'
  if (voided) return 'Void'
  if (remaining === 0 && total !== 0) return 'Lunas'
  if (remaining < total && remaining > 0) return 'Dibayar Sebagian'
  return 'Belum Dibayar'
}

function isSalesReturnInvoice(inv) {
  const src = String(inv.sourceType || '')
  const doc = String(inv.documentType || '').toLowerCase()
  if (inv.isSalesReturn === true || doc === 'return' || src === 'sales_return')
    return true
  const t = Number(inv.total)
  return Number.isFinite(t) && t < 0
}

function ledgerDate(row) {
  const raw = row.createdAt || row.updatedAt || ''
  if (!raw) return '—'
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('id-ID', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return '—'
  }
}

export default function PosTransaksi() {
  const navigate = useNavigate()
  const [section, setSection] = useState(
    /** @type {TransaksiSection} */ ('pemesanan')
  )
  const [salesOpen, setSalesOpen] = useState(true)
  const [shiftOpen, setShiftOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [tagihanTab, setTagihanTab] = useState('tagihan')
  const [invoiceFilter, setInvoiceFilter] = useState(
    /** @type {'semua' | 'belum' | 'lunas' | 'void'} */ ('semua')
  )

  /** @type {[null | { kind: string, row: Record<string, unknown> }, function]} */
  const [selected, setSelected] = useState(null)

  const { currentUser } = useAuth()
  const { warehouses } = useWarehouses()
  const [warehouseOutletId, setWarehouseOutletId] = useState('')
  const { settings: outletPosSettings } = usePosWarehouseSettings(warehouseOutletId)
  const [kasModalOpen, setKasModalOpen] = useState(false)
  const [kasDirection, setKasDirection] = useState(
    /** @type {'in' | 'out'} */ ('in')
  )
  const [manualAmtStr, setManualAmtStr] = useState('')
  const [manualDesc, setManualDesc] = useState('')
  const [manualSaving, setManualSaving] = useState(false)

  useEffect(() => {
    if (warehouses?.length && !warehouseOutletId) {
      setWarehouseOutletId(warehouses[0].id)
    }
  }, [warehouses, warehouseOutletId])

  const { orders, loading: ordersLoading, error: ordersError } = useSalesOrders()
  const { invoices, loading: invLoading } = useInvoices()
  const { contacts } = useContacts()

  const { entries: ledgerRowsRaw, loading: ledgerLoading } = usePosCashLedger()
  const ledgerRows = useMemo(
    () =>
      ledgerRowsRaw.filter(
        (r) =>
          !warehouseOutletId || (r.warehouseId || '') === warehouseOutletId
      ),
    [ledgerRowsRaw, warehouseOutletId]
  )
  const { shifts, loading: shiftsLoading } = usePosShifts(warehouseOutletId)

  const contactNameById = useMemo(() => {
    const map = {}
    for (const c of contacts || []) {
      if (c?.id) map[c.id] = c.name || c.company || c.email || ''
    }
    return map
  }, [contacts])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((o) => {
      const num = String(o.number || o.reference || '')
      const cust = String(o.customer || '')
      const id = String(o.id || '')
      if (!q) return true
      return (
        num.toLowerCase().includes(q) ||
        cust.toLowerCase().includes(q) ||
        id.toLowerCase().includes(q)
      )
    })
  }, [orders, search])

  const filteredInvoicesMain = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invoices.filter((inv) => {
      const cust =
        inv.customer ||
        inv.contactName ||
        contactNameById[inv.customerId] ||
        ''
      const lbl = InvoiceStatusLabel(inv)
      let matchFilter = true
      if (invoiceFilter === 'belum')
        matchFilter = lbl === 'Belum Dibayar' || lbl === 'Dibayar Sebagian'
      else if (invoiceFilter === 'lunas') matchFilter = lbl === 'Lunas'
      else if (invoiceFilter === 'void') matchFilter = lbl === 'Void'
      const matchSearch =
        !q ||
        String(inv.number || '')
          .toLowerCase()
          .includes(q) ||
        String(cust || '')
          .toLowerCase()
          .includes(q)
      return matchFilter && matchSearch
    })
  }, [invoices, search, invoiceFilter, contactNameById])

  const filteredReturInvoices = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invoices.filter((inv) => {
      if (!isSalesReturnInvoice(inv)) return false
      const cust =
        inv.customer ||
        inv.contactName ||
        contactNameById[inv.customerId] ||
        contactNameById[inv.customer] ||
        ''
      if (!q) return true
      return (
        String(inv.number || '')
          .toLowerCase()
          .includes(q) ||
        String(cust || '')
          .toLowerCase()
          .includes(q)
      )
    })
  }, [invoices, search, contactNameById])

  const ledgerFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = ledgerRows
    return rows.filter((r) => {
      if (!q) return true
      const hay = `${r.description || ''} ${r.invoiceNumber || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [ledgerRows, search])

  const kasStats = useMemo(() => {
    let penjualan = 0
    let masukManual = 0
    let kirimTotal = 0
    let refundLike = 0
    const refundHint = /refund|retur|pengembalian/i

    for (const e of ledgerRows) {
      const terima = Number(e.terima) || 0
      const kirim = Number(e.kirim) || 0
      if (e.source === 'pos_sale') {
        penjualan += terima
      } else if (terima > 0) {
        masukManual += terima
      }
      if (kirim > 0) {
        kirimTotal += kirim
        const desc = String(e.description || '')
        if (
          refundHint.test(desc) ||
          String(e.source || '').includes('refund')
        )
          refundLike += kirim
      }
    }

    let returInvoiceAbs = 0
    invoices.forEach((inv) => {
      if (!isSalesReturnInvoice(inv)) return
      returInvoiceAbs += Math.abs(Number(inv.total) || 0)
    })

    const totalKasKasir = penjualan + masukManual - kirimTotal

    return {
      penjualan,
      masukManual,
      kasKeluar: kirimTotal,
      refundGuess: refundLike || returInvoiceAbs,
      totalKasKasir,
    }
  }, [ledgerRows, invoices])

  const warehouseName =
    warehouses.find((w) => w.id === warehouseOutletId)?.name || 'Outlet'

  const panelTitle =
    section === 'pemesanan'
      ? 'Pemesanan'
      : section === 'tagihan'
        ? 'Tagihan'
        : section === 'shift'
          ? 'Riwayat Shift'
          : 'Kas Masuk/Keluar'

  const accentNav = (sel) =>
    section === sel
      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200'
      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'

  function selectRow(kind, row) {
    setSelected({ kind, row })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f5f7fa] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
        <span className="font-medium text-slate-600 dark:text-slate-400">Outlet POS</span>
        <select
          value={warehouseOutletId}
          onChange={(e) => {
            setWarehouseOutletId(e.target.value)
            setSelected(null)
          }}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
        >
          {(warehouses || []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <span className="hidden text-slate-400 md:inline">{warehouseName}</span>
      </div>
      <div className="flex min-h-0 flex-1 divide-x divide-slate-200 dark:divide-slate-800">
        {/* Kolom navigasi Transaksi */}
        <nav
          className={`flex w-[13.5rem] shrink-0 flex-col overflow-y-auto ${COL_PANEL}`}
          aria-label="Transaksi"
        >
          <div className="border-b border-slate-100 px-4 py-5 dark:border-slate-800">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Transaksi
            </h1>
          </div>

          <div className="px-2 py-2">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 dark:text-white"
              onClick={() => setSalesOpen((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-500" aria-hidden />
                Penjualan
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition ${salesOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {salesOpen && (
              <div className="mt-1 space-y-0.5 pb-3 pl-2">
                <button
                  type="button"
                  onClick={() => {
                    setSection('pemesanan')
                    setSelected(null)
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-sm ${accentNav('pemesanan')}`}
                >
                  Pemesanan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSection('tagihan')
                    setSelected(null)
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-sm ${accentNav('tagihan')}`}
                >
                  Tagihan
                </button>
              </div>
            )}

            <button
              type="button"
              className="mt-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 dark:text-white"
              onClick={() => setShiftOpen((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" aria-hidden />
                Shift
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition ${shiftOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {shiftOpen && (
              <div className="mt-1 space-y-0.5 pb-2 pl-2">
                <button
                  type="button"
                  onClick={() => {
                    setSection('shift')
                    setSelected(null)
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-sm ${accentNav('shift')}`}
                >
                  Riwayat Shift
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSection('kas')
                    setSelected(null)
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-sm ${accentNav('kas')}`}
                >
                  Kas Masuk/Keluar
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Daftar */}
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${COL_PANEL}`}>
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-4 py-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {panelTitle}
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              {section === 'pemesanan' && (
                <Link
                  to="/penjualan/pemesanan/tambah"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700"
                  title="Buat pemesanan"
                >
                  <Plus className="h-5 w-5" />
                </Link>
              )}
              {(section === 'tagihan' && tagihanTab === 'tagihan') && (
                <Link
                  to="/sales/invoice/add"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700"
                  title="Buat tagihan"
                >
                  <Plus className="h-5 w-5" />
                </Link>
              )}
              {section === 'kas' && (
                <button
                  type="button"
                  disabled={!warehouseOutletId || !currentUser?.uid}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-45"
                  title="Kas masuk / keluar manual"
                  onClick={() => {
                    setManualAmtStr('')
                    setManualDesc('')
                    setKasDirection('in')
                    setKasModalOpen(true)
                  }}
                >
                  + Tambah
                </button>
              )}
            </div>
          </div>

          {section !== 'kas' && (
            <div className="shrink-0 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>
          )}

          {section === 'tagihan' && tagihanTab === 'tagihan' && (
            <div className="shrink-0 border-b border-slate-100 px-4 pb-3 dark:border-slate-800">
              <div className="flex gap-4 border-b border-transparent text-sm font-medium">
                <button
                  type="button"
                  onClick={() => setTagihanTab('tagihan')}
                  className={`border-b-2 pb-2 ${tagihanTab === 'tagihan' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
                >
                  Tagihan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTagihanTab('retur')
                    setSelected(null)
                  }}
                  className={`border-b-2 pb-2 ${tagihanTab === 'retur' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
                >
                  Retur
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ['semua', 'Semua'],
                  ['belum', 'Belum Lunas'],
                  ['lunas', 'Lunas'],
                  ['void', 'Void'],
                ].map(([key, lab]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setInvoiceFilter(/** @type {typeof invoiceFilter} */ (key))
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      invoiceFilter === key
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {lab}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {section === 'pemesanan' && (
              <>
                {ordersError && (
                  <p className="px-4 py-3 text-sm text-red-600">{ordersError}</p>
                )}
                {ordersLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <EmptyInboxHero />
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredOrders.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() =>
                            selectRow('salesOrder', /** @type {Record<string, unknown>} */ (o))
                          }
                          className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                            selected?.kind === 'salesOrder' && selected?.row?.id === o.id
                              ? 'bg-blue-50/80 dark:bg-blue-950/40'
                              : ''
                          }`}
                        >
                          <span className="font-medium text-slate-900 dark:text-white">
                            {o.number || o.reference || o.id}
                          </span>
                          <span className="text-xs text-slate-500">{o.customer}</span>
                          <span className="text-xs tabular-nums text-slate-600">
                            Rp {(o.total ?? 0).toLocaleString('id-ID')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {section === 'tagihan' && tagihanTab === 'tagihan' && (
              <>
                {invLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : filteredInvoicesMain.length === 0 ? (
                  <EmptyInboxHero />
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredInvoicesMain.map((inv) => (
                      <li key={inv.id}>
                        <button
                          type="button"
                          onClick={() =>
                            selectRow(
                              'invoice',
                              /** @type {Record<string, unknown>} */ (inv)
                            )
                          }
                          className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                            selected?.kind === 'invoice' && selected?.row?.id === inv.id
                              ? 'bg-blue-50/80 dark:bg-blue-950/40'
                              : ''
                          }`}
                        >
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-slate-900 dark:text-white">
                            {inv.number}
                            {(inv.paymentMethod === 'pay_later' ||
                              inv.posPayLater === true) &&
                            inv.sourceType === 'pos' ? (
                              <span className="rounded bg-amber-100 px-1.5 py-0 text-[10px] font-semibold uppercase text-amber-900 dark:bg-amber-950/70 dark:text-amber-100">
                                Bayar nanti
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs text-slate-500">
                            {inv.customer ||
                              inv.contactName ||
                              contactNameById[inv.customerId] ||
                              contactNameById[inv.customer] ||
                              '—'}
                          </span>
                          <span className="text-xs text-slate-500">
                            {InvoiceStatusLabel(inv)} · Rp {(inv.total ?? 0).toLocaleString('id-ID')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {section === 'tagihan' && tagihanTab === 'retur' && (
              <>
                {invLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : filteredReturInvoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-slate-400">
                    <PackageSearch className="h-12 w-12 opacity-40" />
                    <p className="mt-3 text-sm font-medium">Data Kosong</p>
                    <p className="mt-1 text-xs">
                      Retur (tagihan dengan total negatif / tipe retur) dari Firestore.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredReturInvoices.map((inv) => (
                      <li key={inv.id}>
                        <button
                          type="button"
                          onClick={() =>
                            selectRow(
                              'invoice',
                              /** @type {Record<string, unknown>} */ (inv)
                            )
                          }
                          className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                            selected?.kind === 'invoice' &&
                            selected?.row?.id === inv.id
                              ? 'bg-blue-50/80 dark:bg-blue-950/40'
                              : ''
                          }`}
                        >
                          <span className="font-medium text-slate-900 dark:text-white">
                            {inv.number}
                          </span>
                          <span className="text-xs text-red-700 dark:text-red-400">
                            Rp {(inv.total ?? 0).toLocaleString('id-ID')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {section === 'shift' && (
              <>
                {shiftsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : shifts.length === 0 ? (
                  <EmptyInboxHero />
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {shifts.map((sh) => (
                      <li key={sh.id}>
                        <button
                          type="button"
                          onClick={() =>
                            selectRow(
                              'shift',
                              /** @type {Record<string, unknown>} */ (sh)
                            )
                          }
                          className={`flex w-full flex-col gap-1 px-4 py-3 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                            selected?.kind === 'shift' && selected?.row?.id === sh.id
                              ? 'bg-blue-50/80 dark:bg-blue-950/40'
                              : ''
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                sh.status === 'open'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {sh.status === 'open' ? 'Terbuka' : 'Selesai'}
                            </span>
                          </span>
                          <span className="tabular-nums text-xs text-slate-500">
                            Dibuka: {ledgerDate({ createdAt: sh.openedAt })}
                          </span>
                          <span className="tabular-nums text-xs text-slate-600 dark:text-slate-400">
                            Kas awal: Rp {(sh.openingCash ?? 0).toLocaleString('id-ID')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {section === 'kas' && (
              <>
                <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-4 lg:grid-cols-5 dark:border-slate-800">
                  {[
                    {
                      label: 'Kas Masuk',
                      val: kasStats.masukManual,
                      Icon: TrendingUp,
                      cls: 'bg-emerald-50 text-emerald-700',
                    },
                    {
                      label: 'Kas Keluar',
                      val: kasStats.kasKeluar,
                      Icon: TrendingDown,
                      cls: 'bg-red-50 text-red-700',
                    },
                    {
                      label: 'Refund / retur',
                      val: kasStats.refundGuess,
                      Icon: RefreshCw,
                      cls: 'bg-amber-50 text-amber-800',
                    },
                    {
                      label: 'Penjualan POS',
                      val: kasStats.penjualan,
                      Icon: ShoppingCart,
                      cls: 'bg-violet-50 text-violet-800',
                    },
                    {
                      label: 'Net (perkiraan)',
                      val: kasStats.totalKasKasir,
                      Icon: Wallet,
                      cls: 'bg-sky-50 text-sky-800',
                    },
                  ].map(({ label, Icon, cls, val }) => (
                    <div
                      key={label}
                      className={`flex flex-col gap-1 rounded-xl px-3 py-3 ${cls} dark:bg-opacity-20`}
                    >
                      <Icon className="h-5 w-5 opacity-90" aria-hidden />
                      <span className="text-[11px] font-medium opacity-90">{label}</span>
                      <span className="text-lg font-bold tabular-nums">
                        {Number.isFinite(val) ? val.toLocaleString('id-ID') : '0'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="shrink-0 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
                  <label className="relative block max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </label>
                </div>

                <div className="min-h-0 flex-1 overflow-x-auto px-2 py-4">
                  {ledgerLoading ? (
                    <div className="flex justify-center gap-2 py-12">
                      <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
                    </div>
                  ) : ledgerFiltered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                      <PackageSearch className="h-14 w-14 text-amber-300 opacity-90" aria-hidden />
                      <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Data Kas Masuk/Keluar Kosong
                      </p>
                      <p className="mt-2 max-w-xs text-xs text-slate-500">
                        Firestore koleksi{' '}
                        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                          posCashLedger
                        </code>
                        — penjualan tunai akan muncul setelah Anda menyelesaikan transaksi POS.
                      </p>
                      <table className="mt-6 w-full max-w-xl text-left text-[11px] text-slate-500">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="pb-2 pr-2 font-medium">Tanggal</th>
                            <th className="pb-2 pr-2 font-medium">Deskripsi</th>
                            <th className="pb-2 text-right font-medium">Terima</th>
                            <th className="pb-2 pl-2 text-right font-medium">Kirim</th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                  ) : (
                    <table className="w-full min-w-[22rem] text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 font-medium text-slate-500 dark:border-slate-700">
                          <th className="pb-3 pr-2">Tanggal</th>
                          <th className="pb-3 pr-2">Deskripsi</th>
                          <th className="pb-3 text-right tabular-nums">Terima</th>
                          <th className="pb-3 pl-2 text-right tabular-nums">Kirim</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {ledgerFiltered.map((row) => (
                          <tr
                            key={row.id}
                            className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                              selected?.kind === 'ledger' &&
                              selected?.row?.id === row.id
                                ? 'bg-blue-50/90 dark:bg-blue-950/50'
                                : ''
                            }`}
                            onClick={() =>
                              selectRow(
                                'ledger',
                                /** @type {Record<string, unknown>} */ (row)
                              )
                            }
                          >
                            <td className="py-3 pr-2 align-top">{ledgerDate(row)}</td>
                            <td className="py-3 pr-2 align-top">
                              <span className="block font-medium text-slate-800 dark:text-slate-100">
                                {row.description || '—'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {row.source === 'pos_sale' ? 'POS' : row.source === 'manual' ? 'Manual' : ''}
                              </span>
                            </td>
                            <td className="py-3 text-right align-top tabular-nums">
                              {(Number(row.terima) || 0) > 0
                                ? `Rp ${Number(row.terima).toLocaleString('id-ID')}`
                                : '—'}
                            </td>
                            <td className="py-3 pl-2 text-right align-top tabular-nums">
                              {(Number(row.kirim) || 0) > 0
                                ? `Rp ${Number(row.kirim).toLocaleString('id-ID')}`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Detail */}
        <aside
          className="hidden min-h-0 min-w-0 flex-[1.05] flex-col bg-white lg:flex dark:bg-slate-900"
          aria-live="polite"
        >
          {!selected ? (
            <div className="flex min-h-[18rem] flex-1 flex-col items-center justify-center gap-4 px-8 text-center text-slate-400">
              <Inbox className="h-20 w-20 opacity-30" aria-hidden />
              <p className="max-w-sm text-sm leading-relaxed">
                Belum ada data yang dipilih, silahkan pilih dulu untuk menampilkan detail
              </p>
            </div>
          ) : selected.kind === 'invoice' ? (
            <div className="flex flex-col gap-4 overflow-y-auto p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selected.row.number}
              </h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Pelanggan</dt>
                  <dd>
                    {selected.row.customer ||
                      selected.row.contactName ||
                      contactNameById[selected.row.customer] ||
                      '—'}
                  </dd>
                </div>
                {selected.row.sourceType === 'pos' &&
                (selected.row.posFulfillmentLabel ||
                  selected.row.posFulfillmentMode) ? (
                  <div>
                    <dt className="text-xs uppercase text-slate-500">
                      Pengambilan / layanan
                    </dt>
                    <dd>
                      {selected.row.posFulfillmentLabel ||
                        String(selected.row.posFulfillmentMode)}
                    </dd>
                  </div>
                ) : null}
                {selected.row.sourceType === 'pos' &&
                (selected.row.paymentMethod === 'pay_later' ||
                  selected.row.posPayLater === true) ? (
                  <div>
                    <dt className="text-xs uppercase text-slate-500">
                      Pembayaran
                    </dt>
                    <dd className="font-medium text-amber-700 dark:text-amber-300">
                      Bayar nanti (piutang) — lunasi di Tagihan
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs uppercase text-slate-500">Total</dt>
                  <dd className="font-semibold tabular-nums">
                    Rp {(selected.row.total ?? 0).toLocaleString('id-ID')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Status</dt>
                  <dd>{InvoiceStatusLabel(selected.row)}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() =>
                  navigate(`/penjualan/tagihan/${selected.row.id}`)
                }
                className="mt-2 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Buka detail lengkap
              </button>
            </div>
          ) : selected.kind === 'salesOrder' ? (
            <div className="flex flex-col gap-4 overflow-y-auto p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selected.row.number || selected.row.reference || selected.row.id}
              </h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Pelanggan</dt>
                  <dd>{selected.row.customer || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Total</dt>
                  <dd className="font-semibold tabular-nums">
                    Rp {(selected.row.total ?? 0).toLocaleString('id-ID')}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => navigate(`/penjualan/pemesanan`)}
                className="mt-2 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
              >
                Buka pemesanan di aplikasi
              </button>
            </div>
          ) : selected.kind === 'ledger' ? (
            <div className="flex flex-col gap-4 overflow-y-auto p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {String(selected.row.description || 'Gerakan kas')}
              </h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Sumber</dt>
                  <dd>{String(selected.row.source || '—')}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Terima / Kirim</dt>
                  <dd className="tabular-nums">
                    Terima Rp {(Number(selected.row.terima) || 0).toLocaleString('id-ID')} · Kirim
                    Rp {(Number(selected.row.kirim) || 0).toLocaleString('id-ID')}
                  </dd>
                </div>
                {selected.row.source === 'pos_sale' && selected.row.invoiceId ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/penjualan/tagihan/${selected.row.invoiceId}`)
                    }
                    className="mt-2 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Buka invoice terkait
                  </button>
                ) : null}
              </dl>
            </div>
          ) : selected.kind === 'shift' ? (
            <div className="flex flex-col gap-4 overflow-y-auto p-6 text-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Shift kasir</h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Status</dt>
                  <dd>{selected.row.status === 'open' ? 'Terbuka' : 'Selesai'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Dibuka</dt>
                  <dd>{ledgerDate({ createdAt: selected.row.openedAt })}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Kas awal</dt>
                  <dd className="tabular-nums">
                    Rp {(Number(selected.row.openingCash) || 0).toLocaleString('id-ID')}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </aside>
      </div>

      {kasModalOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Tambah gerakan kas
            </h2>
            <p className="mt-2 text-xs text-slate-500">{warehouseName}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                  kasDirection === 'in'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
                onClick={() => setKasDirection('in')}
              >
                Kas Masuk
              </button>
              <button
                type="button"
                className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                  kasDirection === 'out'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
                onClick={() => setKasDirection('out')}
              >
                Kas Keluar
              </button>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-slate-500">Nominal</span>
              <input
                type="text"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono dark:border-slate-600 dark:bg-slate-950"
                placeholder="Rp"
                value={manualAmtStr}
                onChange={(e) => setManualAmtStr(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-slate-500">Deskripsi</span>
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                placeholder="Mis. Pengeluaran ATK"
              />
            </label>
            {kasDirection === 'out' && outletPosSettings?.kasKeluarBatas ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                Pembatasan kas keluar aktif — maks{' '}
                <span className="font-semibold tabular-nums">
                  Rp {(Number(outletPosSettings.kasKeluarMaxRp) || 0).toLocaleString(
                    'id-ID'
                  )}
                </span>{' '}
                (POS Pengaturan → Kasir).
              </p>
            ) : null}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border py-2.5 text-sm disabled:opacity-50"
                onClick={() => setKasModalOpen(false)}
                disabled={manualSaving}
              >
                Batal
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-45"
                disabled={
                  manualSaving || !manualAmtStr.trim() || !currentUser?.uid
                }
                onClick={async () => {
                  const amtFull = parseInt(manualAmtStr.replace(/\D/g, ''), 10)
                  if (!amtFull || amtFull <= 0) {
                    alert('Nominal tidak valid.')
                    return
                  }
                  if (
                    kasDirection === 'out' &&
                    outletPosSettings?.kasKeluarBatas
                  ) {
                    const maxRp = Math.round(Number(outletPosSettings.kasKeluarMaxRp) || 0)
                    if (maxRp > 0 && amtFull > maxRp) {
                      alert(
                        `Kas keluar untuk outlet ini dibatasi maksimal Rp ${maxRp.toLocaleString(
                          'id-ID'
                        )}. Ubah limit di Pengaturan → Kasir.`
                      )
                      return
                    }
                  }
                  try {
                    setManualSaving(true)
                    await addPosManualCashEntry({
                      warehouseId: warehouseOutletId,
                      direction: kasDirection,
                      amount: amtFull,
                      description: manualDesc.trim() || `Kas ${kasDirection}`,
                      userUid: currentUser.uid,
                    })
                    setKasModalOpen(false)
                    setManualAmtStr('')
                    setManualDesc('')
                  } catch (e) {
                    console.error(e)
                    alert(e?.message || 'Gagal menyimpan')
                  } finally {
                    setManualSaving(false)
                  }
                }}
              >
                {manualSaving ? 'Menyimpan…' : 'Simpan ke Firestore'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
