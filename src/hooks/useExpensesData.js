import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, doc, getDoc, addDoc, limit, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { updateAccountBalance } from '../utils/accountBalance'
import {
  notifyExpenseRequestSubmitted,
  notifyExpenseRequestApproved,
  notifyExpenseRequestRejected,
} from '../firebase/expenseRequestNotifications'

export const REQUEST_TYPES = {
  EXPENSE_REPORT: 'expense_report',
  FUND_REQUEST: 'fund_request',
}

export const WORKFLOW = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

/** Legacy & direct-posted expenses (no requestType) count as posted. */
export function isExpensePostedToLedger(data) {
  if (!data?.requestType) return true
  return data.workflowStatus === WORKFLOW.APPROVED && data.ledgerPosted === true
}

export async function getNextExpenseNumber() {
  try {
    const expensesRef = collection(db, 'expenses')
    const q = query(expensesRef, orderBy('number', 'desc'), limit(50))
    const snapshot = await getDocs(q)

    let maxNum = 0
    snapshot.forEach((d) => {
      const n = String(d.data().number || '').trim()
      const m = /^EXP\/(\d+)$/i.exec(n)
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
    })

    return `EXP/${String(maxNum + 1).padStart(5, '0')}`
  } catch (error) {
    console.error('Error getting next expense number:', error)
    return 'EXP/00001'
  }
}

/**
 * Writes transaction row + optional account balance (same rules as legacy saveExpense).
 */
export async function postExpenseToLedger(finalExpenseData, expenseDocId) {
  const createdAt = finalExpenseData.createdAt || new Date().toISOString()
  const updatedAt = finalExpenseData.updatedAt || new Date().toISOString()

  const transactionRef = await addDoc(collection(db, 'transactions'), {
    type: 'expense',
    contactId: finalExpenseData.recipientId || finalExpenseData.contactId || '',
    contactName: finalExpenseData.recipient || '',
    number: finalExpenseData.number,
    reference: finalExpenseData.reference || '',
    date: finalExpenseData.date || createdAt,
    dueDate: finalExpenseData.dueDate || '',
    total: finalExpenseData.total || 0,
    remaining: finalExpenseData.remaining ?? finalExpenseData.total ?? 0,
    paid: (finalExpenseData.remaining ?? finalExpenseData.total ?? 0) < 0.01,
    items: finalExpenseData.items || [],
    source: { collection: 'expenses', id: expenseDocId },
    createdAt,
    updatedAt,
  })

  const accountId = finalExpenseData.accountId || finalExpenseData.account
  const totalAmount = parseFloat(finalExpenseData.total) || 0

  if (accountId && totalAmount > 0) {
    if (finalExpenseData.remaining === 0 || finalExpenseData.paid) {
      await updateAccountBalance(accountId, -totalAmount, {
        type: 'expense',
        transactionId: transactionRef.id,
        number: finalExpenseData.number,
        date: finalExpenseData.date || createdAt,
        description: `Expense ${finalExpenseData.number}`,
      })
    }
  }

  return transactionRef.id
}

export async function saveExpense(expenseData) {
  try {
    const finalExpenseData = {
      ...expenseData,
      number: expenseData.number || (await getNextExpenseNumber()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      remaining: expenseData.total || 0,
    }

    const docRef = await addDoc(collection(db, 'expenses'), finalExpenseData)
    await postExpenseToLedger(finalExpenseData, docRef.id)

    return docRef.id
  } catch (error) {
    console.error('Error saving expense:', error)
    throw error
  }
}

/**
 * Employee / user-side: saves to `expenses` only — no ledger until approved.
 */
function requestTypeNotificationLabel(rt) {
  if (rt === REQUEST_TYPES.FUND_REQUEST) return 'permintaan dana'
  if (rt === REQUEST_TYPES.EXPENSE_REPORT) return 'laporan biaya / tagihan'
  return 'pengajuan'
}

export async function saveEmployeeExpenseRequest(payload, workflowStatus, requestType, userMeta) {
  const total = Number(payload.total) || 0
  const docRef = await addDoc(collection(db, 'expenses'), {
    ...payload,
    workflowStatus,
    requestType,
    ledgerPosted: false,
    createdBy: userMeta?.uid || '',
    createdByEmail: userMeta?.email || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    paid: false,
    remaining: total,
  })
  const id = docRef.id

  if (workflowStatus === WORKFLOW.SUBMITTED) {
    try {
      await notifyExpenseRequestSubmitted({
        expenseId: id,
        title: payload.title || '',
        total,
        requestTypeLabel: requestTypeNotificationLabel(requestType),
        submitterEmail: userMeta?.email || '',
      })
    } catch (err) {
      console.error('notifyExpenseRequestSubmitted:', err)
    }
  }

  return id
}

export async function approveEmployeeExpenseRequest(expenseId, approverUid, approverEmail = '') {
  const ref = doc(db, 'expenses', expenseId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Biaya tidak ditemukan')
  const data = snap.data()
  if (data.workflowStatus !== WORKFLOW.SUBMITTED) {
    throw new Error('Hanya pengajuan yang sudah dikirim yang dapat disetujui')
  }
  if (data.ledgerPosted) throw new Error('Sudah diposting')
  const accountId = data.accountId || data.account
  if (!accountId) throw new Error('Lengkapi akun pembayaran terlebih dahulu (menu Edit)')
  const total = parseFloat(data.total) || 0
  if (total <= 0) throw new Error('Total tidak valid')

  const number =
    data.number && /^EXP\//i.test(String(data.number))
      ? data.number
      : await getNextExpenseNumber()

  const remaining =
    data.remaining !== undefined && data.remaining !== null
      ? parseFloat(data.remaining)
      : total

  const finalExpenseData = {
    ...data,
    number,
    remaining,
    updatedAt: new Date().toISOString(),
  }

  await postExpenseToLedger(finalExpenseData, expenseId)
  await updateDoc(ref, {
    number,
    workflowStatus: WORKFLOW.APPROVED,
    ledgerPosted: true,
    approvedAt: new Date().toISOString(),
    approvedBy: approverUid || '',
    updatedAt: new Date().toISOString(),
  })

  try {
    await notifyExpenseRequestApproved({
      expenseId,
      title: data.title || '',
      total: data.total,
      submitterUid: data.createdBy || '',
      approverEmail: approverEmail || '',
    })
  } catch (err) {
    console.error('notifyExpenseRequestApproved:', err)
  }
}

export async function rejectEmployeeExpenseRequest(
  expenseId,
  approverUid,
  reason = '',
  rejectorEmail = ''
) {
  const ref = doc(db, 'expenses', expenseId)
  const snap = await getDoc(ref)
  const prev = snap.exists() ? snap.data() : {}

  await updateDoc(ref, {
    workflowStatus: WORKFLOW.REJECTED,
    rejectedAt: new Date().toISOString(),
    rejectedBy: approverUid || '',
    rejectReason: reason || '',
    updatedAt: new Date().toISOString(),
  })

  try {
    await notifyExpenseRequestRejected({
      expenseId,
      title: prev.title || '',
      submitterUid: prev.createdBy || '',
      reason: reason || '',
      rejectorEmail: rejectorEmail || '',
    })
  } catch (err) {
    console.error('notifyExpenseRequestRejected:', err)
  }
}

export function useExpenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      setError(null)

      const expensesRef = collection(db, 'expenses')
      const q = query(expensesRef, orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)

      const expensesData = await Promise.all(
        snapshot.docs.map(async (expenseDoc) => {
          const data = expenseDoc.data()
          let recipientName = data.recipient || 'N/A'

          if (
            data.recipient &&
            data.recipient.length > 0 &&
            !data.recipient.includes(' ') &&
            data.recipient.length > 10
          ) {
            try {
              const contactRef = doc(db, 'contacts', data.recipient)
              const contactSnap = await getDoc(contactRef)
              if (contactSnap.exists()) {
                recipientName =
                  contactSnap.data().name || contactSnap.data().company || data.recipient
              }
            } catch (err) {
              console.warn('Could not fetch recipient name:', err)
            }
          }

          return {
            id: expenseDoc.id,
            ...data,
            recipient: recipientName,
            remaining: data.remaining !== undefined ? data.remaining : data.total || 0,
          }
        })
      )

      setExpenses(expensesData)
    } catch (err) {
      console.error('Error fetching expenses:', err)
      setError(err.message)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [])

  return { expenses, loading, error, refetch: fetchExpenses }
}
