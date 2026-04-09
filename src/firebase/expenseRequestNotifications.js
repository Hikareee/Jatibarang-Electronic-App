import { collection, getDocs, addDoc } from 'firebase/firestore'
import { db } from './config'

const APPROVER_ROLES = new Set(['owner', 'admin', 'manager'])

function formatIdr(amount) {
  const n = Number(amount) || 0
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

async function approvedUserIdsByRoles(rolesSet) {
  const snap = await getDocs(collection(db, 'users'))
  const ids = []
  snap.forEach((d) => {
    const u = d.data() || {}
    if (u.approved !== true) return
    if (rolesSet.has(u.role)) ids.push(d.id)
  })
  return [...new Set(ids)]
}

export async function getApproverNotifierUserIds() {
  return approvedUserIdsByRoles(APPROVER_ROLES)
}

export async function getOwnerUserIds() {
  return approvedUserIdsByRoles(new Set(['owner']))
}

/**
 * New employee request submitted — notify owners, admins, managers (deduped).
 */
export async function notifyExpenseRequestSubmitted({
  expenseId,
  title,
  total,
  requestTypeLabel,
  submitterEmail,
}) {
  const recipients = await getApproverNotifierUserIds()
  if (!recipients.length || !expenseId) return
  const now = new Date().toISOString()
  const shortTitle = title || '(tanpa judul)'
  const who = submitterEmail || 'Karyawan'
  const body = `${who} mengajukan ${requestTypeLabel}: ${shortTitle} · ${formatIdr(total)}`
  await Promise.all(
    recipients.map((userId) =>
      addDoc(collection(db, 'notifications'), {
        userId,
        type: 'expense_request_submitted',
        title: 'Pengajuan biaya / dana baru',
        body,
        expenseId,
        read: false,
        createdAt: now,
      })
    )
  )
}

/**
 * Posted to books — notify submitter + all owners (visibility / audit).
 */
export async function notifyExpenseRequestApproved({
  expenseId,
  title,
  total,
  submitterUid,
  approverEmail,
}) {
  const now = new Date().toISOString()
  const shortTitle = title || 'Pengajuan'
  const amount = formatIdr(total)
  const owners = await getOwnerUserIds()
  const tasks = []

  if (submitterUid) {
    tasks.push(
      addDoc(collection(db, 'notifications'), {
        userId: submitterUid,
        type: 'expense_request_approved',
        title: 'Pengajuan disetujui',
        body: `${shortTitle} disetujui dan diposting ke buku (${amount}).`,
        expenseId,
        read: false,
        createdAt: now,
      })
    )
  }

  const byLine = approverEmail
    ? `Disetujui oleh ${approverEmail}. ${shortTitle} · ${amount}`
    : `${shortTitle} disetujui · ${amount}`

  for (const ownerId of owners) {
    if (ownerId === submitterUid) continue
    tasks.push(
      addDoc(collection(db, 'notifications'), {
        userId: ownerId,
        type: 'expense_request_approved_owner',
        title: 'Pengajuan disetujui (laporan owner)',
        body: byLine,
        expenseId,
        read: false,
        createdAt: now,
      })
    )
  }

  await Promise.all(tasks)
}

/**
 * Rejected — notify submitter + owners.
 */
export async function notifyExpenseRequestRejected({
  expenseId,
  title,
  submitterUid,
  reason,
  rejectorEmail,
}) {
  const now = new Date().toISOString()
  const shortTitle = title || 'Pengajuan'
  const reasonLine = reason ? ` Alasan: ${reason}` : ''
  const owners = await getOwnerUserIds()
  const tasks = []

  if (submitterUid) {
    tasks.push(
      addDoc(collection(db, 'notifications'), {
        userId: submitterUid,
        type: 'expense_request_rejected',
        title: 'Pengajuan ditolak',
        body: `${shortTitle} ditolak.${reasonLine}`,
        expenseId,
        read: false,
        createdAt: now,
      })
    )
  }

  const ownerBody = `${shortTitle} ditolak${rejectorEmail ? ` oleh ${rejectorEmail}` : ''}.${reasonLine}`
  for (const ownerId of owners) {
    if (ownerId === submitterUid) continue
    tasks.push(
      addDoc(collection(db, 'notifications'), {
        userId: ownerId,
        type: 'expense_request_rejected_owner',
        title: 'Pengajuan ditolak (laporan owner)',
        body: ownerBody,
        expenseId,
        read: false,
        createdAt: now,
      })
    )
  }

  await Promise.all(tasks)
}
