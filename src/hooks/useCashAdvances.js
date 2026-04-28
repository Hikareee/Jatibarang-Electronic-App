import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export const CASH_ADVANCE_STATUS = {
  REQUESTED: 'requested',
  ISSUED: 'issued',
  CLEARED: 'cleared',
  REJECTED: 'rejected',
}

const COLLECTION = 'cashAdvances'

function nowIso() {
  return new Date().toISOString()
}

export function useCashAdvances() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('useCashAdvances:', err)
        setRows([])
        setLoading(false)
        setError(err?.message || String(err))
      }
    )
    return () => unsub()
  }, [])

  const outstandingByContactId = useMemo(() => {
    const map = {}
    for (const r of rows) {
      if (!r?.contactId) continue
      if (r.status !== CASH_ADVANCE_STATUS.ISSUED) continue
      const amt = Number(r.amount || 0)
      map[r.contactId] = (map[r.contactId] || 0) + (Number.isFinite(amt) ? amt : 0)
    }
    return map
  }, [rows])

  return { rows, loading, error, outstandingByContactId }
}

export function useCashAdvancesByContact(contactId) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const id = String(contactId || '').trim()
    if (!id) {
      setRows([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, COLLECTION),
      where('contactId', '==', id),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('useCashAdvancesByContact:', err)
        setRows([])
        setLoading(false)
        setError(err?.message || String(err))
      }
    )
    return () => unsub()
  }, [contactId])

  return { rows, loading, error }
}

export async function createCashAdvanceRequest({
  contactId,
  contactName,
  amount,
  purpose,
  evidence,
  requestedByUid,
  requestedByEmail,
}) {
  const payload = {
    contactId: String(contactId || '').trim(),
    contactName: String(contactName || '').trim(),
    amount: Number(amount || 0),
    purpose: String(purpose || '').trim(),
    evidence: evidence || null,
    status: CASH_ADVANCE_STATUS.REQUESTED,
    requestedByUid: requestedByUid || '',
    requestedByEmail: requestedByEmail || '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  const ref = await addDoc(collection(db, COLLECTION), payload)
  return ref.id
}

export async function approveCashAdvance(id, approverUid, approverEmail) {
  await updateDoc(doc(db, COLLECTION, id), {
    status: CASH_ADVANCE_STATUS.ISSUED,
    approvedAt: nowIso(),
    approvedByUid: approverUid || '',
    approvedByEmail: approverEmail || '',
    updatedAt: nowIso(),
  })
}

export async function rejectCashAdvance(id, approverUid, approverEmail, reason = '') {
  await updateDoc(doc(db, COLLECTION, id), {
    status: CASH_ADVANCE_STATUS.REJECTED,
    rejectedAt: nowIso(),
    rejectedByUid: approverUid || '',
    rejectedByEmail: approverEmail || '',
    rejectReason: String(reason || '').trim(),
    updatedAt: nowIso(),
  })
}

export async function clearCashAdvance(id, clearerUid, clearerEmail, settlementNote = '', linkedExpenseId = '') {
  await updateDoc(doc(db, COLLECTION, id), {
    status: CASH_ADVANCE_STATUS.CLEARED,
    clearedAt: nowIso(),
    clearedByUid: clearerUid || '',
    clearedByEmail: clearerEmail || '',
    settlementNote: String(settlementNote || '').trim(),
    linkedExpenseId: String(linkedExpenseId || '').trim(),
    updatedAt: nowIso(),
  })
}

export async function fetchOutstandingCashAdvancesForContact(contactId) {
  const id = String(contactId || '').trim()
  if (!id) return []
  const q = query(
    collection(db, COLLECTION),
    where('contactId', '==', id),
    where('status', '==', CASH_ADVANCE_STATUS.ISSUED),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

