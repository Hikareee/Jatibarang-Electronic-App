import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useSalesDeliveries() {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDeliveries = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const invoicesRef = collection(db, 'invoices')
      const q = query(invoicesRef, orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      
      const deliveriesData = await Promise.all(
        snapshot.docs.map(async (invoiceDoc) => {
          const data = invoiceDoc.data()
          let customerName = data.customer || 'N/A'
          
          // If customer is an ID, fetch the contact name
          if (data.customer && data.customer.length > 0 && !data.customer.includes(' ')) {
            try {
              const contactRef = doc(db, 'contacts', data.customer)
              const contactSnap = await getDoc(contactRef)
              if (contactSnap.exists()) {
                customerName = contactSnap.data().name || contactSnap.data().company || data.customer
              }
            } catch (err) {
              console.warn('Could not fetch customer name:', err)
            }
          }
          
          // Get delivery status (default to 0 if not set)
          const deliveryStatus = data.deliveryStatus || 0
          
          return {
            id: invoiceDoc.id,
            ...data,
            customer: customerName,
            deliveryStatus: deliveryStatus
          }
        })
      )
      
      setDeliveries(deliveriesData)
    } catch (err) {
      console.error('Error fetching sales deliveries:', err)
      setError(err.message)
      setDeliveries([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeliveries()
  }, [])

  const updateDeliveryStatus = async (invoiceId, status) => {
    try {
      const invoiceRef = doc(db, 'invoices', invoiceId)
      await updateDoc(invoiceRef, {
        deliveryStatus: status,
        updatedAt: new Date().toISOString()
      })
      
      // Update local state
      setDeliveries(prev => 
        prev.map(delivery => 
          delivery.id === invoiceId 
            ? { ...delivery, deliveryStatus: status }
            : delivery
        )
      )
      
      return true
    } catch (err) {
      console.error('Error updating delivery status:', err)
      throw err
    }
  }

  return { deliveries, loading, error, refetch: fetchDeliveries, updateDeliveryStatus }
}

