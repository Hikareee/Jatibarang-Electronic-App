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
  where,
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

export async function getProductsByName(nama) {
  const name = String(nama || '').trim()
  if (!name) return []
  const ref = collection(db, 'products')
  const q = query(ref, where('nama', '==', name), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Partial update — pass only fields that should change; does not overwrite createdAt.
 */
export async function updateProduct(productId, partialData) {
  const ref = doc(db, 'products', productId)
  const snap = await getDoc(ref)
  const current = snap.exists() ? snap.data() : {}

  const {
    id: _omit,
    createdAt: _c,
    priceChangeNoteBeli,
    priceChangeNoteJual,
    ...rest
  } = partialData || {}

  const nowIso = new Date().toISOString()

  const payload = Object.fromEntries(
    Object.entries({
      ...rest,
      updatedAt: nowIso,
    }).filter(([, v]) => v !== undefined)
  )

  // Track price history when buy/sell price changes.
  const oldBeli = current?.hargaBeli
  const newBeli = rest?.hargaBeli
  const oldJual = current?.hargaJual
  const newJual = rest?.hargaJual

  const hargaBeliChanged =
    newBeli !== undefined && Number(oldBeli ?? 0) !== Number(newBeli ?? 0)
  const hargaJualChanged =
    newJual !== undefined && Number(oldJual ?? 0) !== Number(newJual ?? 0)

  if (hargaBeliChanged) {
    const history = Array.isArray(current?.priceHistoryBeli) ? current.priceHistoryBeli : []
    const entry = {
      at: nowIso,
      from: Number(oldBeli ?? 0),
      to: Number(newBeli ?? 0),
      delta: Number(newBeli ?? 0) - Number(oldBeli ?? 0),
      note: String(priceChangeNoteBeli || '').trim(),
      pemasokContactId: rest?.pemasokContactId ?? current?.pemasokContactId ?? '',
      pemasokNama: rest?.pemasokNama ?? current?.pemasokNama ?? '',
    }
    payload.priceHistoryBeli = [...history, entry].slice(-200)
  }

  if (hargaJualChanged) {
    const history = Array.isArray(current?.priceHistoryJual) ? current.priceHistoryJual : []
    const entry = {
      at: nowIso,
      from: Number(oldJual ?? 0),
      to: Number(newJual ?? 0),
      delta: Number(newJual ?? 0) - Number(oldJual ?? 0),
      note: String(priceChangeNoteJual || '').trim(),
    }
    payload.priceHistoryJual = [...history, entry].slice(-200)
  }

  await updateDoc(ref, payload)
}

