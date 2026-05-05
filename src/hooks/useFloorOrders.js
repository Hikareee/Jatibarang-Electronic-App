import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export const FLOOR_ORDER_STATUS = {
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  CANCELLED: 'cancelled',
}

/**
 * Floor order placed by sales — cashier completes payment in POS.
 * @param {{ warehouseId: string, notes?: string, customerId?: string, customerName: string, customerPhone?: string, customerAddress?: string, lines: Array<{ productId: string, qty: number, nama?: string, hargaJual?: number, fulfillmentMode?: string, fulfillmentLabel?: string }>, createdByUid: string, createdByEmail?: string }} payload
 */
export async function createFloorOrder(payload) {
  const warehouseId = String(payload.warehouseId || '').trim()
  if (!warehouseId) throw new Error('Gudang wajib dipilih')
  const customerName = String(payload.customerName || '').trim()
  if (!customerName) throw new Error('Pelanggan wajib diisi — pilih kontak atau isi nama')
  const customerId = String(payload.customerId || '').trim()
  const lines = Array.isArray(payload.lines) ? payload.lines : []
  if (!lines.length) throw new Error('Tambahkan minimal satu item')

  const normalized = lines
    .map((row) => {
      const fulfillmentMode = String(row.fulfillmentMode || '')
        .trim()
        .replace(/[^a-z0-9_-]/gi, '')
        .slice(0, 32)
      const fulfillmentLabel = String(row.fulfillmentLabel || '').trim().slice(0, 80)
      return {
        productId: String(row.productId || '').trim(),
        qty: Math.max(1, Math.round(Number(row.qty) || 1)),
        nama: String(row.nama || '').trim(),
        hargaJual: Math.max(0, Number(row.hargaJual) || 0),
        ...(fulfillmentMode ? { fulfillmentMode } : {}),
        ...(fulfillmentLabel ? { fulfillmentLabel } : {}),
      }
    })
    .filter((r) => r.productId)

  if (!normalized.length) throw new Error('Item tidak valid')

  const number = `FO-${Date.now().toString(36).toUpperCase()}`

  const ref = await addDoc(collection(db, 'floorOrders'), {
    number,
    status: FLOOR_ORDER_STATUS.AWAITING_PAYMENT,
    warehouseId,
    customerId: customerId || '',
    customerName,
    customerPhone: String(payload.customerPhone || '').trim(),
    customerAddress: String(payload.customerAddress || '').trim(),
    notes: String(payload.notes || '').trim(),
    lines: normalized,
    createdByUid: String(payload.createdByUid || '').trim(),
    createdByEmail: String(payload.createdByEmail || '').trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { id: ref.id, number }
}

export async function markFloorOrderPaid(floorOrderId, { invoiceId, invoiceNumber } = {}) {
  const id = String(floorOrderId || '').trim()
  if (!id) return
  await updateDoc(doc(db, 'floorOrders', id), {
    status: FLOOR_ORDER_STATUS.PAID,
    paidAt: new Date().toISOString(),
    invoiceId: String(invoiceId || ''),
    invoiceNumber: String(invoiceNumber || ''),
    updatedAt: new Date().toISOString(),
  })
}

export async function cancelFloorOrder(floorOrderId) {
  const id = String(floorOrderId || '').trim()
  if (!id) return
  await updateDoc(doc(db, 'floorOrders', id), {
    status: FLOOR_ORDER_STATUS.CANCELLED,
    cancelledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Live list of orders waiting for cashier (same outlet warehouse).
 */
export function useFloorOrdersAwaitingPayment(warehouseId) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!warehouseId) {
      setOrders([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const q = query(
      collection(db, 'floorOrders'),
      orderBy('createdAt', 'desc'),
      limit(80)
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const wid = String(warehouseId)
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter(
            (o) =>
              o.status === FLOOR_ORDER_STATUS.AWAITING_PAYMENT &&
              String(o.warehouseId || '') === wid
          )
        setOrders(rows)
        setLoading(false)
      },
      (e) => {
        console.error(e)
        setError(e?.message || String(e))
        setOrders([])
        setLoading(false)
      }
    )

    return () => unsub()
  }, [warehouseId])

  return { orders, loading, error }
}
