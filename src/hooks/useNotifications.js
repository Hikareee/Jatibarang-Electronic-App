import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'

const COLLECTION = 'notifications'

export function useNotifications(maxItems = 50) {
  const { currentUser } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!currentUser?.uid) {
      setItems([])
      setLoading(false)
      return
    }

    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(maxItems)
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setError(null)
        setLoading(false)
      },
      (err) => {
        console.error('useNotifications:', err)
        setError(err?.message || String(err))
        setItems([])
        setLoading(false)
      }
    )

    return () => unsub()
  }, [currentUser?.uid, maxItems])

  const unreadCount = items.filter((n) => !n.read).length

  const markRead = async (notificationId) => {
    if (!notificationId) return
    await updateDoc(doc(db, COLLECTION, notificationId), { read: true })
  }

  const markAllRead = async () => {
    const unread = items.filter((n) => !n.read)
    if (!unread.length) return
    const batch = writeBatch(db)
    unread.forEach((n) => {
      batch.update(doc(db, COLLECTION, n.id), { read: true })
    })
    await batch.commit()
  }

  return { items, unreadCount, loading, error, markRead, markAllRead }
}
