import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useContactTransactions(contactId) {
  const [transactions, setTransactions] = useState([])
  const [piutang, setPiutang] = useState([]) // Receivables
  const [hutang, setHutang] = useState([]) // Payables
  const [penjualan, setPenjualan] = useState({
    chartData: [],
    hutangAndaJatuhTempo: 0,
    hutangMerekaJatuhTempo: 0,
    pembayaranDikirim: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!contactId) {
      setLoading(false)
      return
    }

    async function fetchContactTransactions() {
      try {
        setLoading(true)
        setError(null)

        // Fetch receivables (Piutang) from receivables collection
        let piutangData = []
        try {
          const receivablesRef = collection(db, 'receivables')
          const receivablesQ = query(
            receivablesRef,
            where('contactId', '==', contactId)
          )
          const receivablesSnapshot = await getDocs(receivablesQ)
          piutangData = receivablesSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'Piutang',
            transaction: `Piutang ${doc.data().number || ''}`,
            date: doc.data().transactionDate || doc.data().createdAt,
            total: doc.data().total || 0,
            reference: doc.data().reference || '',
            number: doc.data().number || '',
            dueDate: doc.data().dueDate || '',
            remaining: doc.data().remaining || doc.data().total || 0,
            paid: doc.data().paid || false,
            ...doc.data()
          }))
          // Sort by date descending
          piutangData.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0)
            const dateB = new Date(b.date || b.createdAt || 0)
            return dateB - dateA
          })
          console.log('Fetched receivables:', piutangData.length)
        } catch (err) {
          console.error('Error fetching receivables:', err)
          // Try without where clause to see if collection exists
          try {
            const receivablesRef = collection(db, 'receivables')
            const allReceivables = await getDocs(receivablesRef)
            console.log('All receivables count:', allReceivables.docs.length)
            console.log('Sample receivable:', allReceivables.docs[0]?.data())
          } catch (err2) {
            console.error('Collection might not exist:', err2)
          }
        }

        // Fetch debts (Hutang) from debts collection
        let hutangData = []
        try {
          const debtsRef = collection(db, 'debts')
          const debtsQ = query(
            debtsRef,
            where('contactId', '==', contactId)
          )
          const debtsSnapshot = await getDocs(debtsQ)
          hutangData = debtsSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'Hutang',
            transaction: `Hutang ${doc.data().number || ''}`,
            date: doc.data().transactionDate || doc.data().createdAt,
            total: doc.data().total || 0,
            reference: doc.data().reference || '',
            number: doc.data().number || '',
            dueDate: doc.data().dueDate || '',
            remaining: doc.data().remaining || doc.data().total || 0,
            paid: doc.data().paid || false,
            ...doc.data()
          }))
          // Sort by date descending
          hutangData.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0)
            const dateB = new Date(b.date || b.createdAt || 0)
            return dateB - dateA
          })
          console.log('Fetched debts:', hutangData.length)
        } catch (err) {
          console.error('Error fetching debts:', err)
          // Try without where clause to see if collection exists
          try {
            const debtsRef = collection(db, 'debts')
            const allDebts = await getDocs(debtsRef)
            console.log('All debts count:', allDebts.docs.length)
            console.log('Sample debt:', allDebts.docs[0]?.data())
          } catch (err2) {
            console.error('Collection might not exist:', err2)
          }
        }

        // Fetch payments from transactions collection (if exists)
        let paymentsData = []
        try {
          const transactionsRef = collection(db, 'transactions')
          const paymentsQ = query(
            transactionsRef,
            where('contactId', '==', contactId),
            where('type', '==', 'payment')
          )
          const paymentsSnapshot = await getDocs(paymentsQ)
          paymentsData = paymentsSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'Pembayaran',
            transaction: `Pembayaran ${doc.data().number || ''}`,
            date: doc.data().date || doc.data().createdAt,
            total: doc.data().total || doc.data().amount || 0,
            reference: doc.data().reference || '',
            ...doc.data()
          }))
          // Sort by date descending
          paymentsData.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0)
            const dateB = new Date(b.date || b.createdAt || 0)
            return dateB - dateA
          })
        } catch (err) {
          console.warn('Error fetching payments (collection might not exist):', err)
        }

        // Combine all transactions
        const transactionsData = [...piutangData, ...hutangData, ...paymentsData]

        // Filter out paid receivables and debts
        // A receivable/debt is considered paid if:
        // 1. paid field is explicitly true, OR
        // 2. remaining is 0 or less
        // Otherwise, show it (including if remaining/total fields don't exist)
        const unpaidPiutang = piutangData.filter(t => {
          // If explicitly marked as paid, hide it
          if (t.paid === true) return false
          
          // If remaining exists and is 0 or less, hide it
          if (t.remaining !== undefined && t.remaining !== null) {
            if (t.remaining <= 0) return false
          }
          
          // Otherwise, show it
          return true
        })

        const unpaidHutang = hutangData.filter(t => {
          // If explicitly marked as paid, hide it
          if (t.paid === true) return false
          
          // If remaining exists and is 0 or less, hide it
          if (t.remaining !== undefined && t.remaining !== null) {
            if (t.remaining <= 0) return false
          }
          
          // Otherwise, show it
          return true
        })

        // Calculate penjualan summary (only from receivables)
        const penjualanChartData = [
          { month: 'Jul', penjualan: 0 },
          { month: 'Agu', penjualan: 0 },
          { month: 'Sep', penjualan: 0 },
          { month: 'Okt', penjualan: 0 },
          { month: 'Nov', penjualan: 0 },
          { month: 'Des', penjualan: 0 },
        ]

        // Process receivables to populate chart
        unpaidPiutang.forEach(trans => {
          if (trans.date) {
            const date = new Date(trans.date)
            const monthIndex = date.getMonth()
            const monthNames = ['Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
            const monthName = monthNames[monthIndex]
            
            if (monthName && trans.total) {
              const chartItem = penjualanChartData.find(item => item.month === monthName)
              if (chartItem) {
                chartItem.penjualan = (chartItem.penjualan || 0) + (trans.total || 0)
              }
            }
          }
        })

        // Calculate summary values (only from unpaid items)
        const hutangMerekaJatuhTempo = unpaidPiutang
          .filter(t => {
            if (!t.dueDate) return false
            const dueDate = new Date(t.dueDate)
            return dueDate < new Date()
          })
          .reduce((sum, t) => sum + (t.remaining || t.total || 0), 0)

        const hutangAndaJatuhTempo = unpaidHutang
          .filter(t => {
            if (!t.dueDate) return false
            const dueDate = new Date(t.dueDate)
            return dueDate < new Date()
          })
          .reduce((sum, t) => sum + (t.remaining || t.total || 0), 0)

        const pembayaranDikirim = paymentsData
          .reduce((sum, t) => sum + (t.total || 0), 0)

        // Sort all transactions by date (newest first)
        const sortedTransactions = transactionsData.sort((a, b) => {
          const dateA = new Date(a.date || a.createdAt || 0)
          const dateB = new Date(b.date || b.createdAt || 0)
          return dateB - dateA
        })

        console.log('Final data:', {
          transactions: sortedTransactions.length,
          unpaidPiutang: unpaidPiutang.length,
          unpaidHutang: unpaidHutang.length,
          contactId
        })

        setTransactions(sortedTransactions)
        setPiutang(unpaidPiutang)
        setHutang(unpaidHutang)
        setPenjualan({
          chartData: penjualanChartData,
          hutangAndaJatuhTempo,
          hutangMerekaJatuhTempo,
          pembayaranDikirim
        })

      } catch (err) {
        console.error('Error fetching contact transactions:', err)
        setError(err.message)
        setTransactions([])
        setPiutang([])
        setHutang([])
        setPenjualan({
          chartData: [],
          hutangAndaJatuhTempo: 0,
          hutangMerekaJatuhTempo: 0,
          pembayaranDikirim: 0
        })
      } finally {
        setLoading(false)
      }
    }

    fetchContactTransactions()
  }, [contactId])

  return { transactions, piutang, hutang, penjualan, loading, error }
}

