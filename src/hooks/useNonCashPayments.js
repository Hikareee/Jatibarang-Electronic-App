/**
 * Pembayaran non-tunai per gudang — subkoleksi `warehouses/{id}/posNonCashPayments`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * @param {string | null | undefined} warehouseId
 */
export function useNonCashPayments(warehouseId) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const colRef = useMemo(() => {
    if (!warehouseId) return null
    return collection(db, 'warehouses', warehouseId, 'posNonCashPayments')
  }, [warehouseId])

  useEffect(() => {
    if (!colRef) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = onSnapshot(
      query(colRef, orderBy('createdAt', 'asc')),
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setError(null)
        setLoading(false)
      },
      (e) => {
        setError(e)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [colRef])

  const addMethod = useCallback(
    async ({ name, accountNumber, accountName } = {}) => {
      if (!colRef) throw new Error('Outlet (gudang) wajib dipilih.')
      const n = String(name || '').trim()
      if (!n) throw new Error('Nama metode wajib')
      await addDoc(colRef, {
        name: n,
        accountNumber: String(accountNumber || '').trim() || null,
        accountName: String(accountName || '').trim() || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    },
    [colRef]
  )

  const updateMethod = useCallback(
    async (id, patch) => {
      if (!warehouseId || !id) return
      const ref = doc(db, 'warehouses', warehouseId, 'posNonCashPayments', id)
      await updateDoc(ref, {
        ...patch,
        updatedAt: serverTimestamp(),
      })
    },
    [warehouseId]
  )

  const removeMethod = useCallback(
    async (id) => {
      if (!warehouseId || !id) return
      await deleteDoc(
        doc(db, 'warehouses', warehouseId, 'posNonCashPayments', id)
      )
    },
    [warehouseId]
  )

  return {
    rows,
    loading,
    error,
    addMethod,
    updateMethod,
    removeMethod,
  }
}
