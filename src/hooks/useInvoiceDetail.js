import { useState, useEffect } from 'react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useInvoiceDetail(invoiceId) {
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false)
      return
    }

    async function fetchInvoice() {
      try {
        setLoading(true)
        setError(null)

        const invoiceRef = doc(db, 'invoices', invoiceId)
        const invoiceSnap = await getDoc(invoiceRef)

        if (!invoiceSnap.exists()) {
          setError('Invoice not found')
          setInvoice(null)
          return
        }

        const invoiceData = {
          id: invoiceSnap.id,
          ...invoiceSnap.data()
        }

        // Fetch customer name if customer is an ID
        if (invoiceData.customer && invoiceData.customer.length > 0 && !invoiceData.customer.includes(' ')) {
          try {
            const contactRef = doc(db, 'contacts', invoiceData.customer)
            const contactSnap = await getDoc(contactRef)
            if (contactSnap.exists()) {
              invoiceData.customerName = contactSnap.data().name || contactSnap.data().company || invoiceData.customer
            }
          } catch (err) {
            console.warn('Could not fetch customer name:', err)
            invoiceData.customerName = invoiceData.customer
          }
        } else {
          invoiceData.customerName = invoiceData.customer || 'N/A'
        }

        setInvoice(invoiceData)
      } catch (err) {
        console.error('Error fetching invoice:', err)
        setError(err.message)
        setInvoice(null)
      } finally {
        setLoading(false)
      }
    }

    fetchInvoice()
  }, [invoiceId])

  const updateInvoice = async (invoiceData) => {
    if (!invoiceId) return false

    try {
      const invoiceRef = doc(db, 'invoices', invoiceId)
      await updateDoc(invoiceRef, {
        ...invoiceData,
        updatedAt: new Date().toISOString()
      })

      // Refetch invoice
      const updatedSnap = await getDoc(invoiceRef)
      if (updatedSnap.exists()) {
        const updatedData = {
          id: updatedSnap.id,
          ...updatedSnap.data()
        }
        
        // Fetch customer name if needed
        if (updatedData.customer && updatedData.customer.length > 0 && !updatedData.customer.includes(' ')) {
          try {
            const contactRef = doc(db, 'contacts', updatedData.customer)
            const contactSnap = await getDoc(contactRef)
            if (contactSnap.exists()) {
              updatedData.customerName = contactSnap.data().name || contactSnap.data().company || updatedData.customer
            }
          } catch (err) {
            console.warn('Could not fetch customer name:', err)
            updatedData.customerName = updatedData.customer
          }
        } else {
          updatedData.customerName = updatedData.customer || 'N/A'
        }
        
        setInvoice(updatedData)
      }

      return true
    } catch (err) {
      console.error('Error updating invoice:', err)
      throw err
    }
  }

  return { invoice, loading, error, updateInvoice }
}

