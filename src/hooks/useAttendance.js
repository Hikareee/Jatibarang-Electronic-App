import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'

const COLLECTION = 'attendance'

export const ATTENDANCE_STATUS = {
  HADIR: 'hadir',
  TIDAK_HADIR: 'tidak_hadir',
  IZIN: 'izin',
  SAKIT: 'sakit',
}

/** Document id: date + contact id (or legacy Firebase user id). */
export function attendanceDocId(dateKey, entityId) {
  return `${dateKey}_${entityId}`
}

export function displayNameForContact(contact) {
  if (!contact) return ''
  return (
    contact.name ||
    contact.company ||
    contact.fullName ||
    contact.email ||
    contact.id ||
    ''
  )
}

/**
 * @param {string} dateKey - YYYY-MM-DD (local calendar date)
 */
export function useAttendance(dateKey) {
  const [byContactId, setByContactId] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!dateKey) {
      setByContactId({})
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const q = query(collection(db, COLLECTION), where('date', '==', dateKey))
      const snap = await getDocs(q)
      const next = {}
      snap.forEach((d) => {
        const data = d.data()
        const key = data.contactId || data.userId
        if (key) {
          next[key] = { id: d.id, ...data }
        }
      })
      setByContactId(next)
    } catch (err) {
      console.error('useAttendance load:', err)
      setError(err?.message || String(err))
      setByContactId({})
    } finally {
      setLoading(false)
    }
  }, [dateKey])

  useEffect(() => {
    load()
  }, [load])

  const setStatus = useCallback(
    async (contactId, kontakNama, status, markedByUid) => {
      if (!dateKey || !contactId) return
      const id = attendanceDocId(dateKey, contactId)
      if (!status) {
        await deleteDoc(doc(db, COLLECTION, id))
        setByContactId((prev) => {
          const { [contactId]: _, ...rest } = prev
          return rest
        })
        return
      }
      const payload = {
        date: dateKey,
        contactId,
        kontakNama: kontakNama || '',
        status,
        markedBy: markedByUid || '',
        updatedAt: new Date().toISOString(),
      }
      await setDoc(doc(db, COLLECTION, id), payload, { merge: true })
      setByContactId((prev) => ({
        ...prev,
        [contactId]: { id, ...payload },
      }))
    },
    [dateKey]
  )

  const markAllPresent = useCallback(
    async (contacts, markedByUid) => {
      if (!dateKey || !Array.isArray(contacts) || !contacts.length) return
      const batch = writeBatch(db)
      const now = new Date().toISOString()

      for (const c of contacts) {
        if (!c?.id) continue
        const id = attendanceDocId(dateKey, c.id)
        const kontakNama = displayNameForContact(c)
        const payload = {
          date: dateKey,
          contactId: c.id,
          kontakNama,
          status: ATTENDANCE_STATUS.HADIR,
          markedBy: markedByUid || '',
          updatedAt: now,
        }
        batch.set(doc(db, COLLECTION, id), payload, { merge: true })
      }
      await batch.commit()
      await load()
    },
    [dateKey, load]
  )

  return {
    byContactId,
    loading,
    error,
    refetch: load,
    setStatus,
    markAllPresent,
  }
}
