import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

export function usePurchaseInvoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPurchaseInvoices = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const invoicesRef = collection(db, 'purchaseInvoices')
      const q = query(invoicesRef, orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      
      const invoicesData = await Promise.all(
        snapshot.docs.map(async (invoiceDoc) => {
          const data = invoiceDoc.data()
          let vendorName = data.vendor || 'N/A'
          
          // If vendor is an ID, fetch the contact name
          if (data.vendor && data.vendor.length > 0 && !data.vendor.includes(' ')) {
            try {
              const contactRef = doc(db, 'contacts', data.vendor)
              const contactSnap = await getDoc(contactRef)
              if (contactSnap.exists()) {
                vendorName = contactSnap.data().name || contactSnap.data().company || data.vendor
              }
            } catch (err) {
              console.warn('Could not fetch vendor name:', err)
            }
          }
          
          // Fetch user who created the invoice
          let createdByName = 'N/A'
          if (data.createdBy) {
            try {
              const userRef = doc(db, 'users', data.createdBy)
              const userSnap = await getDoc(userRef)
              if (userSnap.exists()) {
                const userData = userSnap.data()
                createdByName = userData.name || userData.email || data.createdBy
              }
            } catch (err) {
              console.warn('Could not fetch user name:', err)
            }
          }
          
          return {
            id: invoiceDoc.id,
            ...data,
            vendorId: data.vendor || '',
            vendor: vendorName,
            createdByName: createdByName,
            penanggungJawab: data.penanggungJawab || data.responsibleContactName || '',
            status: data.status || 'draft' // Ensure status is set
          }
        })
      )
      
      setInvoices(invoicesData)
    } catch (err) {
      console.error('Error fetching purchase invoices:', err)
      setError(err.message)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPurchaseInvoices()
  }, [])

  return { invoices, loading, error, refetch: fetchPurchaseInvoices }
}

