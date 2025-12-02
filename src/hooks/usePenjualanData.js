import { useState, useEffect } from 'react'
import { collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'

export function usePenjualanData() {
  const [data, setData] = useState({
    kpi: null,
    tagihanPemesanan: null,
    penjualanPerProduk: null,
    pembayaranDiterima: null,
    penjualanPerPelanggan: null,
    penjualanPerSalesPerson: null,
    alurPenjualan: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchPenjualanData() {
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

        // Fetch all penjualan data
        const [
          kpiDoc,
          tagihanPemesananSnapshot,
          penjualanPerProdukSnapshot,
          pembayaranDiterimaSnapshot,
          penjualanPerPelangganSnapshot,
          penjualanPerSalesPersonSnapshot,
          alurPenjualanSnapshot,
        ] = await Promise.all([
          safeGetDoc(['penjualan', 'overview', 'kpi']),
          safeGetDocs(['penjualan', 'overview', 'tagihanPemesanan'], 'order'),
          safeGetDocs(['penjualan', 'overview', 'penjualanPerProduk'], 'order'),
          safeGetDocs(['penjualan', 'overview', 'pembayaranDiterima'], 'order'),
          safeGetDocs(['penjualan', 'overview', 'penjualanPerPelanggan'], 'order'),
          safeGetDocs(['penjualan', 'overview', 'penjualanPerSalesPerson'], 'order'),
          safeGetDocs(['penjualan', 'overview', 'alurPenjualan'], 'order'),
        ])

        // Process KPI data
        const kpiInfo = kpiDoc.exists() ? kpiDoc.data() : null

        // Process tagihan & pemesanan chart data
        const tagihanPemesananData = tagihanPemesananSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process penjualan per produk data
        const penjualanPerProdukData = penjualanPerProdukSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process pembayaran diterima data
        const pembayaranDiterimaData = pembayaranDiterimaSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process penjualan per pelanggan data
        const penjualanPerPelangganData = penjualanPerPelangganSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process penjualan per sales person data
        const penjualanPerSalesPersonData = penjualanPerSalesPersonSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process alur penjualan data
        const alurPenjualanData = alurPenjualanSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        setData({
          kpi: kpiInfo,
          tagihanPemesanan: tagihanPemesananData,
          penjualanPerProduk: penjualanPerProdukData,
          pembayaranDiterima: pembayaranDiterimaData,
          penjualanPerPelanggan: penjualanPerPelangganData,
          penjualanPerSalesPerson: penjualanPerSalesPersonData,
          alurPenjualan: alurPenjualanData,
        })
      } catch (err) {
        console.error('Error fetching penjualan data:', err)
        setError(err.message)
        // Set empty data structure so component can still render
        setData({
          kpi: null,
          tagihanPemesanan: [],
          penjualanPerProduk: [],
          pembayaranDiterima: [],
          penjualanPerPelanggan: [],
          penjualanPerSalesPerson: [],
          alurPenjualan: [],
        })
      } finally {
        setLoading(false)
      }
    }

    fetchPenjualanData()
  }, [])

  return { data, loading, error }
}

