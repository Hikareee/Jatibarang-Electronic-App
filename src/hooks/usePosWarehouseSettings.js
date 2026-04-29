import { useState, useEffect, useCallback, useMemo } from 'react'
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { defaultPosWarehouseSettings } from '../constants/posWarehouseSettings'

const COL = 'posWarehouseSettings'

export function usePosWarehouseSettings(warehouseId) {
  const { currentUser } = useAuth()
  const [data, setData] = useState(() => defaultPosWarehouseSettings())
  const [loading, setLoading] = useState(true)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    if (!warehouseId) {
      setData(defaultPosWarehouseSettings())
      setLoading(false)
      return
    }
    const ref = doc(db, COL, warehouseId)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setData(defaultPosWarehouseSettings())
        } else {
          setData({ ...defaultPosWarehouseSettings(), ...snap.data() })
        }
        setLoading(false)
        setSaveError(null)
      },
      (err) => {
        console.error('[posWarehouseSettings]', err)
        setSaveError(err.message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [warehouseId])

  const savePartial = useCallback(
    async (partial) => {
      if (!warehouseId || !currentUser?.uid) {
        throw new Error('Outlet atau pengguna tidak valid.')
      }
      const ref = doc(db, COL, warehouseId)
      await setDoc(
        ref,
        {
          ...partial,
          updatedAt: serverTimestamp(),
          updatedByUid: currentUser.uid,
        },
        { merge: true }
      )
    },
    [warehouseId, currentUser?.uid]
  )

  /** Reset dokumen outlet ke default lalu simpan satu kali */
  const resetToDefaults = useCallback(async () => {
    if (!warehouseId) return
    const ref = doc(db, COL, warehouseId)
    await setDoc(ref, {
      ...defaultPosWarehouseSettings(),
      updatedAt: serverTimestamp(),
      updatedByUid: currentUser?.uid || '',
    })
  }, [warehouseId, currentUser?.uid])

  return useMemo(
    () => ({
      settings: data,
      loading,
      saveError,
      savePartial,
      resetToDefaults,
    }),
    [data, loading, saveError, savePartial, resetToDefaults]
  )
}
