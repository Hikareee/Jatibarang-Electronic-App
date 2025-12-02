import { useState, useEffect } from 'react'
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase/config'

export async function saveInvoice(invoiceData) {
  try {
    // Get the next invoice number
    const invoicesRef = collection(db, 'invoices')
    const q = query(invoicesRef, orderBy('number', 'desc'), limit(1))
    const snapshot = await getDocs(q)
    
    let nextNumber = 'INV/00001'
    if (!snapshot.empty) {
      const lastInvoice = snapshot.docs[0].data()
      const lastNumber = lastInvoice.number || 'INV/00000'
      const numPart = parseInt(lastNumber.split('/')[1]) || 0
      nextNumber = `INV/${String(numPart + 1).padStart(5, '0')}`
    }

    // Use provided number or generate next
    const finalInvoiceData = {
      ...invoiceData,
      number: invoiceData.number || nextNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'invoices'), finalInvoiceData)
    
    // Update related financial data (cash, sales, etc.)
    await updateFinancialData(finalInvoiceData)
    
    return docRef.id
  } catch (error) {
    console.error('Error saving invoice:', error)
    throw error
  }
}

export function useInvoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchInvoices() {
      try {
        setLoading(true)
        setError(null)
        
        const invoicesRef = collection(db, 'invoices')
        const q = query(invoicesRef, orderBy('createdAt', 'desc'))
        const snapshot = await getDocs(q)
        
        const invoicesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        
        setInvoices(invoicesData)
      } catch (err) {
        console.error('Error fetching invoices:', err)
        setError(err.message)
        setInvoices([])
      } finally {
        setLoading(false)
      }
    }

    fetchInvoices()
  }, [])

  return { invoices, loading, error }
}

async function updateFinancialData(invoiceData) {
  try {
    // This will update cash, sales, and other related financial data
    // For now, we'll just save the invoice
    // Later we can add logic to update cash flow, sales reports, etc.
    console.log('Invoice saved, financial data update logic to be implemented')
  } catch (error) {
    console.error('Error updating financial data:', error)
  }
}

