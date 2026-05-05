import { useEffect, useState } from 'react'
import {
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'

const OPEN_STATUSES = new Set(['pending', 'queued', 'picking', 'in_transit'])

export function useWarehouseTransferOrders() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, 'warehouseTransferOrders'),
      orderBy('createdAt', 'desc'),
      limit(150)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setRows(mapped)
        setLoading(false)
      },
      (e) => {
        console.error(e)
        setError(e)
        setRows([])
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  return { rows, loading, error }
}

export function isOpenTransferStatus(status) {
  return OPEN_STATUSES.has(String(status || '').trim())
}

export const WAREHOUSE_DO_FLOW = Object.freeze({
  pending: {
    next: 'picking',
    label: 'Picking',
    statusLabel: 'Sedang picking',
  },
  picking: {
    next: 'in_transit',
    label: 'Kirim ke toko',
    statusLabel: 'Dalam perjalanan ke toko',
  },
  in_transit: {
    next: 'received_store',
    label: 'Terima di toko',
    statusLabel: 'Diterima di toko',
  },
})

export async function advanceWarehouseTransferOrder(
  orderId,
  currentStatus,
  actor = {}
) {
  const id = String(orderId || '').trim()
  if (!id) return
  const cur = String(currentStatus || '').trim()
  const step = WAREHOUSE_DO_FLOW[cur]
  if (!step) return
  const nowIso = new Date().toISOString()
  await updateDoc(doc(db, 'warehouseTransferOrders', id), {
    status: step.next,
    statusLabel: step.statusLabel,
    updatedAt: nowIso,
    updatedAtServer: serverTimestamp(),
    timeline: arrayUnion({
      from: cur,
      to: step.next,
      label: step.statusLabel,
      at: nowIso,
      byUid: String(actor.uid || ''),
      byEmail: String(actor.email || ''),
    }),
  })
}
