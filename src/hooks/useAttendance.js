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

export function attendanceDocId(dateKey, userId) {
  return `${dateKey}_${userId}`
}

export function displayNameForUser(user) {
  if (!user) return ''
  return (
    user.displayName ||
    user.name ||
    user.fullName ||
    user.email ||
    user.id ||
    ''
  )
}

/**
 * @param {string} dateKey - YYYY-MM-DD (local calendar date)
 */
export function useAttendance(dateKey) {
  const [byUserId, setByUserId] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!dateKey) {
      setByUserId({})
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
        if (data.userId) {
          next[data.userId] = { id: d.id, ...data }
        }
      })
      setByUserId(next)
    } catch (err) {
      console.error('useAttendance load:', err)
      setError(err?.message || String(err))
      setByUserId({})
    } finally {
      setLoading(false)
    }
  }, [dateKey])

  useEffect(() => {
    load()
  }, [load])

  const setStatus = useCallback(
    async (userId, displayName, status, markedByUid) => {
      if (!dateKey || !userId) return
      const id = attendanceDocId(dateKey, userId)
      if (!status) {
        await deleteDoc(doc(db, COLLECTION, id))
        setByUserId((prev) => {
          const { [userId]: _, ...rest } = prev
          return rest
        })
        return
      }
      const payload = {
        date: dateKey,
        userId,
        displayName: displayName || '',
        status,
        markedBy: markedByUid || '',
        updatedAt: new Date().toISOString(),
      }
      await setDoc(doc(db, COLLECTION, id), payload, { merge: true })
      setByUserId((prev) => ({
        ...prev,
        [userId]: { id, ...payload },
      }))
    },
    [dateKey]
  )

  const markAllPresent = useCallback(
    async (users, markedByUid) => {
      if (!dateKey || !Array.isArray(users) || !users.length) return
      const batch = writeBatch(db)
      const now = new Date().toISOString()

      for (const u of users) {
        if (!u?.id) continue
        const id = attendanceDocId(dateKey, u.id)
        const displayName = displayNameForUser(u)
        const payload = {
          date: dateKey,
          userId: u.id,
          displayName,
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
    byUserId,
    loading,
    error,
    refetch: load,
    setStatus,
    markAllPresent,
  }
}
