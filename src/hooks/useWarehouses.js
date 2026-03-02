import { useEffect, useState, useCallback } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useWarehouses() {
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const ref = collection(db, 'warehouses')
      const q = query(ref, orderBy('name', 'asc'))
      const snap = await getDocs(q)
      setWarehouses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error('Error fetching warehouses:', err)
      setError(err)
      setWarehouses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { warehouses, loading, error, refetch }
}

