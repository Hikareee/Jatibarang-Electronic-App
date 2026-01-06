import { useState, useEffect } from 'react'
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useContactDetail(contactId) {
  const [contact, setContact] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [financialData, setFinancialData] = useState({
    andaHutang: 0,
    merekaHutang: 0,
    pembayaranDiterima: 0,
    netHutang: 0,
    keluarMasukUang: []
  })

  useEffect(() => {
    if (!contactId) {
      setLoading(false)
      return
    }

    async function fetchContactDetail() {
      try {
        setLoading(true)
        setError(null)

        // Fetch contact data
        const contactRef = doc(db, 'contacts', contactId)
        const contactSnap = await getDoc(contactRef)

        if (!contactSnap.exists()) {
          setError('Contact not found')
          setContact(null)
          return
        }

        const contactData = {
          id: contactSnap.id,
          ...contactSnap.data()
        }
        setContact(contactData)

        // Fetch receivables for this contact (Mereka Hutang - They owe us)
        let merekaHutangTotal = 0
        try {
          const receivablesRef = collection(db, 'receivables')
          const receivablesQuery = query(receivablesRef, where('contactId', '==', contactId))
          const receivablesSnapshot = await getDocs(receivablesQuery)
          
          receivablesSnapshot.forEach((doc) => {
            const data = doc.data()
            // Sum the total from each receivable
            merekaHutangTotal += parseFloat(data.total || 0)
          })
        } catch (err) {
          console.error('Error fetching receivables:', err)
          // If collection doesn't exist, default to 0
        }

        // Fetch debts for this contact (Anda Hutang - We owe them)
        let andaHutangTotal = 0
        try {
          const debtsRef = collection(db, 'debts')
          const debtsQuery = query(debtsRef, where('contactId', '==', contactId))
          const debtsSnapshot = await getDocs(debtsQuery)
          
          debtsSnapshot.forEach((doc) => {
            const data = doc.data()
            // Sum the total from each debt
            andaHutangTotal += parseFloat(data.total || 0)
          })
        } catch (err) {
          console.error('Error fetching debts:', err)
          // If collection doesn't exist, default to 0
        }

        // Calculate financial data
        const netHutang = merekaHutangTotal - andaHutangTotal
        
        const financial = {
          andaHutang: andaHutangTotal,
          merekaHutang: merekaHutangTotal,
          pembayaranDiterima: contactData.pembayaranDiterima || 0,
          netHutang: netHutang,
          keluarMasukUang: contactData.keluarMasukUang || []
        }
        setFinancialData(financial)

      } catch (err) {
        console.error('Error fetching contact detail:', err)
        setError(err.message)
        setContact(null)
      } finally {
        setLoading(false)
      }
    }

    fetchContactDetail()
  }, [contactId])

  return { contact, financialData, loading, error }
}

