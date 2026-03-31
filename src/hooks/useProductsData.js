import { useState, useEffect } from 'react'
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export function useProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true)
        setError(null)
        
        const productsRef = collection(db, 'products')
        const q = query(productsRef, orderBy('nama', 'asc'))
        const snapshot = await getDocs(q)
        
        const productsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        
        setProducts(productsData)
      } catch (err) {
        console.error('Error fetching products:', err)
        setError(err.message)
        setProducts([])
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  return { products, loading, error }
}

export async function getNextProductCode() {
  // NOTE: relies on kode being consistently padded to sort well lexicographically
  const productsRef = collection(db, 'products')
  const q = query(productsRef, orderBy('kode', 'desc'), limit(1))
  const snapshot = await getDocs(q)

  const fallbackPrefix = 'SKU/'
  const fallbackWidth = 5

  if (snapshot.empty) {
    return `${fallbackPrefix}${String(1).padStart(fallbackWidth, '0')}`
  }

  const lastProduct = snapshot.docs[0].data()
  const lastCodeRaw = String(lastProduct?.kode || `${fallbackPrefix}${String(0).padStart(fallbackWidth, '0')}`)

  const parts = lastCodeRaw.split('/')
  const numericStr = parts.length > 1 ? parts[parts.length - 1] : lastCodeRaw.replace(/\D+/g, '')
  const lastNum = parseInt(numericStr, 10)
  const nextNum = Number.isFinite(lastNum) ? lastNum + 1 : 1

  const width = Math.max(
    fallbackWidth,
    String(numericStr || '').trim().length || 0,
    String(nextNum).length
  )

  return `${fallbackPrefix}${String(nextNum).padStart(width, '0')}`
}

export async function saveProduct(productData) {
  try {
    const nextCode = await getNextProductCode()

    // Use provided code or generate next
    const finalProductData = {
      ...productData,
      kode: productData.kode || nextCode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'products'), finalProductData)
    
    return docRef.id
  } catch (error) {
    console.error('Error saving product:', error)
    throw error
  }
}

export async function getProductById(productId) {
  const ref = doc(db, 'products', productId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/**
 * Partial update — pass only fields that should change; does not overwrite createdAt.
 */
export async function updateProduct(productId, partialData) {
  const ref = doc(db, 'products', productId)
  const { id: _omit, createdAt: _c, ...rest } = partialData || {}
  const payload = Object.fromEntries(
    Object.entries({
      ...rest,
      updatedAt: new Date().toISOString(),
    }).filter(([, v]) => v !== undefined)
  )
  await updateDoc(ref, payload)
}

