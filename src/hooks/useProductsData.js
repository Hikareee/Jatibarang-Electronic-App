import { useState, useEffect } from 'react'
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore'
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

export async function saveProduct(productData) {
  try {
    // Get the next product code/SKU
    const productsRef = collection(db, 'products')
    const q = query(productsRef, orderBy('kode', 'desc'), limit(1))
    const snapshot = await getDocs(q)
    
    let nextCode = 'SKU/00001'
    if (!snapshot.empty) {
      const lastProduct = snapshot.docs[0].data()
      const lastCode = lastProduct.kode || 'SKU/00000'
      if (lastCode.includes('/')) {
        const numPart = parseInt(lastCode.split('/')[1]) || 0
        nextCode = `SKU/${String(numPart + 1).padStart(5, '0')}`
      }
    }

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

