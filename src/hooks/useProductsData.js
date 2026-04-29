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

function normalizeProductShape(raw = {}, id = '') {
  const nama = raw.nama ?? raw.name ?? ''
  const kode = raw.kode ?? raw.sku ?? ''
  const hargaJual = raw.hargaJual ?? raw.salePrice ?? raw.price ?? 0
  const hargaBeli = raw.hargaBeli ?? raw.buyPrice ?? raw.costPrice ?? 0
  return {
    id,
    ...raw,
    nama,
    name: raw.name ?? nama,
    kode,
    sku: raw.sku ?? kode,
    hargaJual: Number(hargaJual) || 0,
    hargaBeli: Number(hargaBeli) || 0,
  }
}

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
        const snapshot = await getDocs(query(productsRef))
        
        const productsData = snapshot.docs
          .map((doc) => normalizeProductShape(doc.data(), doc.id))
          .sort((a, b) =>
            String(a.nama || '').localeCompare(String(b.nama || ''), 'id', {
              sensitivity: 'base',
            })
          )
        
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
      sku: productData.sku || productData.kode || nextCode,
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
  return normalizeProductShape(snap.data(), snap.id)
}

/**
 * Resolve a product from in-memory list by SKU, kode, or product barcode (case-insensitive).
 */
export function findProductByScan(products, raw) {
  const q = String(raw || '').trim()
  if (!q || !Array.isArray(products)) return null
  const lower = q.toLowerCase()
  return (
    products.find((p) => {
      const sku = String(p.kode || p.sku || '').trim().toLowerCase()
      const bc = String(p.barcode || '').trim().toLowerCase()
      return (sku && sku === lower) || (bc && bc === lower)
    }) || null
  )
}

/** Default for electronics: require per-unit serial tracking */
export function productRequiresSerial(p) {
  if (!p || typeof p !== 'object') return true
  return p.requiresSerial !== false
}

export async function getProductsByName(nama) {
  const name = String(nama || '').trim()
  if (!name) return []
  const ref = collection(db, 'products')
  const qNama = query(ref, where('nama', '==', name))
  const qName = query(ref, where('name', '==', name))
  const [snapNama, snapName] = await Promise.all([getDocs(qNama), getDocs(qName)])
  const merged = [...snapNama.docs, ...snapName.docs]
  const uniq = new Map()
  merged.forEach((d) => {
    if (!uniq.has(d.id)) uniq.set(d.id, normalizeProductShape(d.data(), d.id))
  })
  return Array.from(uniq.values()).sort(
    (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  )
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

