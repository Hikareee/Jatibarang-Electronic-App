/**
 * KPI penjualan per akun Firebase Auth UID (salesperson UID / penanggung jawab).
 * Gabungan invoice: salespersonUid + penanggungJawabId (dedupe per id dokumen).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../firebase/config'

const INV_LIMIT = 2000

/** Persentase komisi default jika tidak ada di profil user (angka 0–100). */
export const DEFAULT_EMPLOYEE_COMMISSION_PERCENT = 2

function parseInvoiceDate(inv) {
  const raw = inv.transactionDate || inv.createdAt || ''
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function isVoid(inv) {
  if (inv?.void === true || inv?.voided === true) return true
  if (String(inv?.status || '').toLowerCase() === 'void') return true
  return false
}

function dedupeById(rows) {
  const m = new Map()
  for (const r of rows) {
    if (!r?.id) continue
    m.set(r.id, r)
  }
  return Array.from(m.values())
}

/**
 * @param {string | undefined} uid
 * @param {number | undefined | null} commissionPercent - dari users/{uid}.commissionPercent
 */
export function useEmployeeDashboardStats(uid, commissionPercent) {
  const [bySalesperson, setBySalesperson] = useState([])
  const [byResponsible, setByResponsible] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const pct = useMemo(() => {
    const n = Number(commissionPercent)
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n
    return DEFAULT_EMPLOYEE_COMMISSION_PERCENT
  }, [commissionPercent])

  useEffect(() => {
    if (!uid) {
      setBySalesperson([])
      setByResponsible([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const q1 = query(
      collection(db, 'invoices'),
      where('salespersonUid', '==', uid),
      limit(INV_LIMIT)
    )
    const q2 = query(
      collection(db, 'invoices'),
      where('penanggungJawabId', '==', uid),
      limit(INV_LIMIT)
    )

    const unsub1 = onSnapshot(
      q1,
      (snap) => {
        setBySalesperson(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (e) => {
        console.error('[useEmployeeDashboardStats] q1', e)
        setError(e?.message || String(e))
        setLoading(false)
      }
    )

    const unsub2 = onSnapshot(
      q2,
      (snap) => {
        setByResponsible(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (e) => {
        console.error('[useEmployeeDashboardStats] q2', e)
        setError(e?.message || String(e))
        setLoading(false)
      }
    )

    return () => {
      unsub1()
      unsub2()
    }
  }, [uid])

  const invoices = useMemo(
    () => dedupeById([...bySalesperson, ...byResponsible]),
    [bySalesperson, byResponsible]
  )

  const stats = useMemo(() => {
    const now = new Date()
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    let totalAll = 0
    let totalMonth = 0
    let total30 = 0
    let countAll = 0
    let countMonth = 0

    const active = invoices.filter((inv) => !isVoid(inv))

    for (const inv of active) {
      const amount = Math.max(0, Number(inv.total) || 0)
      const d = parseInvoiceDate(inv)
      totalAll += amount
      countAll += 1
      if (d && d >= startMonth) {
        totalMonth += amount
        countMonth += 1
      }
      if (d && d >= since30) {
        total30 += amount
      }
    }

    const commissionMonth = Math.round((totalMonth * pct) / 100)
    const commissionAll = Math.round((totalAll * pct) / 100)
    const commission30 = Math.round((total30 * pct) / 100)

    const recent = [...active]
      .sort((a, b) => {
        const da = parseInvoiceDate(a)?.getTime() || 0
        const db = parseInvoiceDate(b)?.getTime() || 0
        return db - da
      })
      .slice(0, 10)

    return {
      totalAll,
      totalMonth,
      total30,
      countAll,
      countMonth,
      commissionMonth,
      commissionAll,
      commission30,
      recent,
    }
  }, [invoices, pct])

  return {
    loading,
    error,
    commissionPercent: pct,
    invoices,
    ...stats,
  }
}
