import { useState, useEffect } from 'react'
import { collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'

export function usePembelianData() {
  const [data, setData] = useState({
    kpi: null,
    tagihanPesanan: null,
    pembayaran: null,
    pembelianPerVendor: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchPembelianData() {
      try {
        setLoading(true)
        setError(null)

        // Helper function to safely fetch collection
        const safeGetDocs = async (collectionPath, orderByField = 'order') => {
          try {
            const colRef = collection(db, ...collectionPath)
            const q = query(colRef, orderBy(orderByField))
            return await getDocs(q)
          } catch (err) {
            console.warn(`Collection ${collectionPath.join('/')} not found or error:`, err)
            return { 
              docs: [],
              empty: true,
              size: 0
            }
          }
        }

        // Helper function to safely fetch document
        const safeGetDoc = async (docPath) => {
          try {
            return await getDoc(doc(db, ...docPath))
          } catch (err) {
            console.warn(`Document ${docPath.join('/')} not found or error:`, err)
            return { 
              exists: () => false, 
              data: () => null,
              id: docPath[docPath.length - 1]
            }
          }
        }

        // Fetch all pembelian data
        const [
          kpiDoc,
          tagihanPesananSnapshot,
          pembayaranSnapshot,
          pembelianPerVendorSnapshot,
        ] = await Promise.all([
          safeGetDoc(['pembelian', 'overview', 'kpi']),
          safeGetDocs(['pembelian', 'overview', 'tagihanPesanan'], 'order'),
          safeGetDocs(['pembelian', 'overview', 'pembayaran'], 'order'),
          safeGetDocs(['pembelian', 'overview', 'pembelianPerVendor'], 'order'),
        ])

        // Process KPI data
        const kpiInfo = kpiDoc.exists() ? kpiDoc.data() : null

        // Process tagihan & pesanan chart data
        const tagihanPesananData = tagihanPesananSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process pembayaran chart data
        const pembayaranData = pembayaranSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process pembelian per vendor data
        const pembelianPerVendorData = pembelianPerVendorSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        setData({
          kpi: kpiInfo,
          tagihanPesanan: tagihanPesananData,
          pembayaran: pembayaranData,
          pembelianPerVendor: pembelianPerVendorData,
        })
      } catch (err) {
        console.error('Error fetching pembelian data:', err)
        setError(err.message)
        // Set empty data structure so component can still render
        setData({
          kpi: null,
          tagihanPesanan: [],
          pembayaran: [],
          pembelianPerVendor: [],
        })
      } finally {
        setLoading(false)
      }
    }

    fetchPembelianData()
  }, [])

  return { data, loading, error }
}

