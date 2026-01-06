import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

export function usePurchaseDeliveries() {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDeliveries = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const invoicesRef = collection(db, 'purchaseInvoices')
      const q = query(invoicesRef, orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      
      const deliveriesData = await Promise.all(
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
          
          // Get delivery status (default to 0 if not set)
          const deliveryStatus = data.deliveryStatus || 0
          
          return {
            id: invoiceDoc.id,
            ...data,
            vendor: vendorName,
            deliveryStatus: deliveryStatus
          }
        })
      )
      
      setDeliveries(deliveriesData)
    } catch (err) {
      console.error('Error fetching purchase deliveries:', err)
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
      const invoiceRef = doc(db, 'purchaseInvoices', invoiceId)
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

