import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, where, doc, getDoc } from 'firebase/firestore'
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

        // Fetch all purchase invoices
        const invoicesRef = collection(db, 'purchaseInvoices')
        let invoicesSnapshot
        try {
          const invoicesQuery = query(invoicesRef, orderBy('createdAt', 'desc'))
          invoicesSnapshot = await getDocs(invoicesQuery)
        } catch (err) {
          // If orderBy fails, try without orderBy
          console.warn('Could not order by createdAt, fetching all:', err)
          invoicesSnapshot = await getDocs(invoicesRef)
        }
        
        const allInvoices = invoicesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        // Get current date info
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear

        // Helper to get month from date string
        const getMonth = (dateString) => {
          if (!dateString) return null
          const date = new Date(dateString)
          return { month: date.getMonth(), year: date.getFullYear() }
        }

        // Helper to check if date is in current month
        const isCurrentMonth = (dateString) => {
          const dateInfo = getMonth(dateString)
          return dateInfo && dateInfo.month === currentMonth && dateInfo.year === currentYear
        }

        // Helper to check if date is in last month
        const isLastMonth = (dateString) => {
          const dateInfo = getMonth(dateString)
          return dateInfo && dateInfo.month === lastMonth && dateInfo.year === lastMonthYear
        }

        // Calculate KPIs
        const currentMonthInvoices = allInvoices.filter(inv => 
          isCurrentMonth(inv.transactionDate || inv.createdAt)
        )
        const lastMonthInvoices = allInvoices.filter(inv => 
          isLastMonth(inv.transactionDate || inv.createdAt)
        )

        // Total purchases (all invoices)
        const totalPembelian = allInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0)
        const currentMonthPembelian = currentMonthInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0)
        const lastMonthPembelian = lastMonthInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0)
        const pembelianPercentage = lastMonthPembelian > 0 
          ? ((currentMonthPembelian - lastMonthPembelian) / lastMonthPembelian * 100).toFixed(1)
          : 0

        // Payments sent (invoices with remaining = 0 or paid = true)
        const paidInvoices = allInvoices.filter(inv => 
          (parseFloat(inv.remaining) || parseFloat(inv.total) || 0) === 0 || inv.paid === true
        )
        const totalPembayaran = paidInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0)
        const currentMonthPembayaran = currentMonthInvoices.filter(inv => 
          (parseFloat(inv.remaining) || parseFloat(inv.total) || 0) === 0 || inv.paid === true
        ).reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0)
        const lastMonthPembayaran = lastMonthInvoices.filter(inv => 
          (parseFloat(inv.remaining) || parseFloat(inv.total) || 0) === 0 || inv.paid === true
        ).reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0)
        const pembayaranPercentage = lastMonthPembayaran > 0
          ? ((currentMonthPembayaran - lastMonthPembayaran) / lastMonthPembayaran * 100).toFixed(1)
          : 0

        // Ratio paid (lunas)
        const currentMonthPaid = currentMonthInvoices.filter(inv => 
          (parseFloat(inv.remaining) || parseFloat(inv.total) || 0) === 0 || inv.paid === true
        ).length
        const rasioLunas = currentMonthInvoices.length > 0
          ? (currentMonthPaid / currentMonthInvoices.length * 100).toFixed(1)
          : 100

        // Waiting for payment (unpaid invoices)
        const unpaidInvoices = allInvoices.filter(inv => {
          const remaining = parseFloat(inv.remaining) || parseFloat(inv.total) || 0
          return remaining > 0 && inv.paid !== true
        })
        const totalMenungguPembayaran = unpaidInvoices.reduce((sum, inv) => 
          sum + (parseFloat(inv.remaining) || parseFloat(inv.total) || 0), 0)
        const lastMonthUnpaid = lastMonthInvoices.filter(inv => {
          const remaining = parseFloat(inv.remaining) || parseFloat(inv.total) || 0
          return remaining > 0 && inv.paid !== true
        })
        const lastMonthMenunggu = lastMonthUnpaid.reduce((sum, inv) => 
          sum + (parseFloat(inv.remaining) || parseFloat(inv.total) || 0), 0)
        const menungguPercentage = lastMonthMenunggu > 0
          ? ((totalMenungguPembayaran - lastMonthMenunggu) / lastMonthMenunggu * 100).toFixed(1)
          : 0

        // Overdue invoices (due date passed and not paid)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const overdueInvoices = unpaidInvoices.filter(inv => {
          if (!inv.dueDate) return false
          const dueDate = new Date(inv.dueDate)
          dueDate.setHours(0, 0, 0, 0)
          return dueDate < today
        })
        const totalJatuhTempo = overdueInvoices.reduce((sum, inv) => 
          sum + (parseFloat(inv.remaining) || parseFloat(inv.total) || 0), 0)

        // Build KPI data
        const kpiInfo = {
          pembelian: {
            value: totalPembelian,
            tagihanBulanIni: currentMonthInvoices.length,
            percentage: parseFloat(pembelianPercentage)
          },
          pembayaranDikirim: {
            value: totalPembayaran,
            tagihanBulanIni: currentMonthInvoices.filter(inv => 
              (parseFloat(inv.remaining) || parseFloat(inv.total) || 0) === 0 || inv.paid === true
            ).length,
            percentage: parseFloat(pembayaranPercentage)
          },
          rasioLunas: {
            percentage: parseFloat(rasioLunas),
            text: 'Tagihan Pembelian lunas vs total Tagihan Pembelian bulan ini'
          },
          menungguPembayaran: {
            value: totalMenungguPembayaran,
            tagihan: unpaidInvoices.length,
            percentage: parseFloat(menungguPercentage)
          },
          jatuhTempo: {
            value: totalJatuhTempo,
            tagihan: overdueInvoices.length,
            text: 'dari total Tagihan Pembelian belum dibayar'
          }
        }

        // Build monthly chart data (last 6 months)
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des']
        const monthlyData = []
        for (let i = 5; i >= 0; i--) {
          const date = new Date(currentYear, currentMonth - i, 1)
          const month = date.getMonth()
          const year = date.getFullYear()
          const monthKey = `${year}-${month}`
          
          const monthInvoices = allInvoices.filter(inv => {
            const invDate = getMonth(inv.transactionDate || inv.createdAt)
            return invDate && invDate.month === month && invDate.year === year
          })
          
          const tagihanTotal = monthInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0)
          const pesananTotal = monthInvoices.length // Count of orders
          
          monthlyData.push({
            month: monthNames[month],
            tagihan: tagihanTotal,
            pesanan: pesananTotal
          })
        }

        // Build payment chart data (last 6 months)
        const paymentData = []
        for (let i = 5; i >= 0; i--) {
          const date = new Date(currentYear, currentMonth - i, 1)
          const month = date.getMonth()
          const year = date.getFullYear()
          
          const monthInvoices = allInvoices.filter(inv => {
            const invDate = getMonth(inv.transactionDate || inv.createdAt)
            return invDate && invDate.month === month && invDate.year === year
          })
          
          const paidInvoices = monthInvoices.filter(inv => 
            (parseFloat(inv.remaining) || parseFloat(inv.total) || 0) === 0 || inv.paid === true
          )
          const pembayaranTotal = paidInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0)
          
          paymentData.push({
            month: monthNames[month],
            pembelian: pembayaranTotal
          })
        }

        // Build vendor chart data (current month)
        const vendorMap = new Map()
        currentMonthInvoices.forEach(inv => {
          const vendorId = inv.vendor || inv.vendorId || 'Unknown'
          const total = parseFloat(inv.total) || 0
          
          if (vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, vendorMap.get(vendorId) + total)
          } else {
            vendorMap.set(vendorId, total)
          }
        })

        // Fetch vendor names
        const vendorData = await Promise.all(
          Array.from(vendorMap.entries()).map(async ([vendorId, total]) => {
            let vendorName = vendorId
            if (vendorId && vendorId.length > 0 && !vendorId.includes(' ')) {
              try {
                const contactRef = doc(db, 'contacts', vendorId)
                const contactSnap = await getDoc(contactRef)
                if (contactSnap.exists()) {
                  vendorName = contactSnap.data().name || contactSnap.data().company || vendorId
                }
              } catch (err) {
                console.warn('Could not fetch vendor name:', err)
              }
            }
            return {
              name: vendorName,
              value: total
            }
          })
        )

        // Sort vendors by value descending
        vendorData.sort((a, b) => b.value - a.value)

        setData({
          kpi: kpiInfo,
          tagihanPesanan: monthlyData,
          pembayaran: paymentData,
          pembelianPerVendor: vendorData,
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

