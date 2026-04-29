import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useProducts, findProductByScan } from './useProductsData'
import { useWarehouses } from './useWarehouses'
import { normalizeSerialId } from '../utils/itemSerials'

export function useMobileStockLookup() {
  const { products, loading: productsLoading } = useProducts()
  const { warehouses, loading: warehousesLoading } = useWarehouses()
  const [stockRows, setStockRows] = useState([])
  const [stockLoading, setStockLoading] = useState(false)

  useEffect(() => {
    async function loadStockRows() {
      if (!warehouses.length) {
        setStockRows([])
        return
      }
      setStockLoading(true)
      try {
        const chunks = await Promise.all(
          warehouses.map(async (warehouse) => {
            const snap = await getDocs(collection(db, 'warehouses', warehouse.id, 'stock'))
            return snap.docs.map((d) => ({
              id: d.id,
              warehouseId: warehouse.id,
              warehouseName: warehouse.name || warehouse.id,
              ...d.data(),
            }))
          })
        )
        setStockRows(chunks.flat())
      } catch (error) {
        console.error('Failed to load mobile stock rows:', error)
        setStockRows([])
      } finally {
        setStockLoading(false)
      }
    }
    loadStockRows()
  }, [warehouses])

  const productById = useMemo(() => {
    const map = {}
    ;(products || []).forEach((product) => {
      map[product.id] = product
    })
    return map
  }, [products])

  const productCards = useMemo(() => {
    return (products || []).map((product) => {
      const rows = stockRows.filter((row) => row.productId === product.id)
      const qtyTotal = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
      return {
        ...product,
        qtyTotal,
        typeName: String(product.kategori || '').trim(),
        merekName: String(product.merek || product.brand || product.merk || '').trim(),
        priceDisplay: Number(product.hargaJual ?? product.harga_jual ?? 0) || 0,
        locations: rows,
      }
    })
  }, [products, stockRows])

  const lookupByScan = useCallback(
    async (raw) => {
      const query = String(raw || '').trim()
      if (!query) return { product: null, serial: null }

      const matchedProduct = findProductByScan(products, query)
      if (matchedProduct) {
        return { product: matchedProduct, serial: null }
      }

      const norm = normalizeSerialId(query)
      const serialRef = doc(db, 'itemSerials', norm)
      const serialSnap = await getDoc(serialRef)
      if (!serialSnap.exists()) return { product: null, serial: null }

      const serial = { id: serialSnap.id, ...serialSnap.data() }
      return {
        serial,
        product: serial.productId ? productById[serial.productId] || null : null,
      }
    },
    [productById, products]
  )

  return {
    products,
    productById,
    productCards,
    stockRows,
    warehouses,
    loading: productsLoading || warehousesLoading || stockLoading,
    lookupByScan,
  }
}
