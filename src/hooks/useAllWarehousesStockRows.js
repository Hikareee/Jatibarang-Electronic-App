import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useWarehouses } from './useWarehouses'

/**
 * All `warehouses/{id}/stock` rows across the org (for mobile product location hints).
 */
export function useAllWarehousesStockRows() {
  const { warehouses, loading: whLoading } = useWarehouses()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (whLoading) return

    let cancelled = false

    async function load() {
      if (!warehouses?.length) {
        setRows([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const chunks = await Promise.all(
          warehouses.map(async (w) => {
            const snap = await getDocs(collection(db, 'warehouses', w.id, 'stock'))
            return snap.docs.map((d) => ({
              id: d.id,
              _warehouseId: w.id,
              _warehouseName: w.name || w.id,
              ...d.data(),
            }))
          })
        )
        if (!cancelled) setRows(chunks.flat())
      } catch (e) {
        console.error(e)
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [whLoading, warehouses])

  const busy = loading || whLoading

  return { rows, loading: busy }
}
