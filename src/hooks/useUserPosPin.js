/**
 * PIN POS per user — hash SHA-256 disimpan di Firestore (`userPosPins/{uid}`).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp, deleteField } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'

/** @param {string} raw */
async function sha256Hex(raw) {
  const enc = new TextEncoder().encode(raw)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * @returns {{ hasPin: boolean, loading: boolean, setPin: (pin: string) => Promise<void>, verifyPin: (pin: string) => Promise<boolean>, clearPin: () => Promise<void> }}
 */
export function useUserPosPin() {
  const { currentUser } = useAuth()
  const uid = currentUser?.uid
  const [hasPin, setHasPin] = useState(false)
  const [loading, setLoading] = useState(true)

  const ref = useMemo(
    () => (uid ? doc(db, 'userPosPins', uid) : null),
    [uid]
  )

  useEffect(() => {
    if (!ref) {
      setHasPin(false)
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const snap = await getDoc(ref)
        if (cancelled) return
        setHasPin(snap.exists() && Boolean(snap.data()?.pinHash))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ref])

  const setPin = useCallback(
    async (pin) => {
      if (!ref) throw new Error('Belum login')
      const p = String(pin || '').trim()
      if (p.length < 4) throw new Error('PIN minimal 4 digit')
      const hash = await sha256Hex(p)
      await setDoc(
        ref,
        { pinHash: hash, updatedAt: serverTimestamp() },
        { merge: true }
      )
      setHasPin(true)
    },
    [ref]
  )

  const verifyPin = useCallback(
    async (pin) => {
      if (!ref) return false
      const snap = await getDoc(ref)
      if (!snap.exists()) return false
      const stored = snap.data()?.pinHash
      if (!stored) return false
      const hash = await sha256Hex(String(pin || ''))
      return hash === stored
    },
    [ref]
  )

  const clearPin = useCallback(async () => {
    if (!ref) return
    await setDoc(
      ref,
      { pinHash: deleteField(), updatedAt: serverTimestamp() },
      { merge: true }
    )
    setHasPin(false)
  }, [ref])

  return { hasPin, loading, setPin, verifyPin, clearPin }
}
