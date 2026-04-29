import { useState, useEffect } from 'react'
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase/config'

const LEDGER = 'posCashLedger'
const MAX_ROWS = 500

/**
 * Real-time POS kas ledger (penjualan tunai + kas masuk/keluar manual).
 * Filter per-outlet ditangani di UI agar pengambilan sampel terakhir konsisten.
 */
export function usePosCashLedger(_opts = {}) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, LEDGER),
      orderBy('createdAt', 'desc'),
      limit(MAX_ROWS)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setEntries(rows)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[posCashLedger]', err)
        setError(err.message)
        setEntries([])
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  return { entries, loading, error }
}

/**
 * @param {{
 *   warehouseId: string
 *   direction: 'in' | 'out'
 *   amount: number
 *   description: string
 *   userUid: string
 *   accountId?: string
 * }} payload
 */
export async function addPosManualCashEntry(payload) {
  const {
    warehouseId,
    direction,
    amount,
    description,
    userUid,
    accountId,
  } = payload
  const n = Math.round(Number(amount) || 0)
  if (n <= 0) throw new Error('Jumlah harus lebih dari 0')
  const now = new Date().toISOString()
  const terima = direction === 'in' ? n : 0
  const kirim = direction === 'out' ? n : 0

  await addDoc(collection(db, LEDGER), {
    source: 'manual',
    warehouseId: warehouseId || '',
    terima,
    kirim,
    description: String(description || '').trim() || '(tanpa keterangan)',
    userUid: userUid || '',
    accountId: accountId || '',
    createdAt: now,
    updatedAt: now,
  })
}
