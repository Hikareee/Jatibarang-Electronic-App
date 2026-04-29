import { useState, useEffect } from 'react'
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase/config'

const SHIFTS = 'posShifts'

/**
 * Riwayat shift + shift terbuka per gudang (client-filter open).
 */
export function usePosShifts(warehouseId) {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, SHIFTS),
      orderBy('openedAt', 'desc'),
      limit(200)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        if (warehouseId) {
          rows = rows.filter((r) => (r.warehouseId || '') === warehouseId)
        }
        setShifts(rows)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[posShifts]', err)
        setError(err.message)
        setShifts([])
        setLoading(false)
      }
    )
    return () => unsub()
  }, [warehouseId])

  const openShift =
    shifts.find(
      (s) =>
        s.status === 'open' &&
        (!warehouseId || (s.warehouseId || '') === warehouseId)
    ) || null

  return { shifts, loading, error, openShift }
}

/**
 * @param {{
 *   warehouseId: string
 *   openingCash: number
 *   userUid: string
 *   userEmail?: string
 * }} p
 */
export async function createPosShiftOpen(p) {
  const { warehouseId, openingCash, userUid, userEmail } = p
  const openSnap = await getDocs(
    query(collection(db, SHIFTS), where('status', '==', 'open'), limit(50))
  )
  const clash = openSnap.docs.some((d) => (d.data().warehouseId || '') === warehouseId)
  if (clash) {
    throw new Error('Sudah ada shift terbuka untuk outlet ini.')
  }
  const now = new Date().toISOString()
  await addDoc(collection(db, SHIFTS), {
    status: 'open',
    warehouseId,
    openingCash: Math.round(Number(openingCash) || 0),
    openedAt: now,
    closedAt: '',
    closingCash: null,
    openedByUid: userUid || '',
    openedByEmail: userEmail || '',
    createdAt: now,
    updatedAt: now,
  })
}
