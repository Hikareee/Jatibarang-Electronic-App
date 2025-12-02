import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase/config'

export async function savePurchaseInvoice(invoiceData) {
  try {
    // Get the next invoice number
    const invoicesRef = collection(db, 'purchaseInvoices')
    const q = query(invoicesRef, orderBy('number', 'desc'), limit(1))
    const snapshot = await getDocs(q)
    
    let nextNumber = 'PI/00001'
    if (!snapshot.empty) {
      const lastInvoice = snapshot.docs[0].data()
      const lastNumber = lastInvoice.number || 'PI/00000'
      const numPart = parseInt(lastNumber.split('/')[1]) || 0
      nextNumber = `PI/${String(numPart + 1).padStart(5, '0')}`
    }

    // Use provided number or generate next
    const finalInvoiceData = {
      ...invoiceData,
      number: invoiceData.number || nextNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'purchaseInvoices'), finalInvoiceData)
    
    // Update related financial data (cash, purchases, etc.)
    await updateFinancialData(finalInvoiceData)
    
    return docRef.id
  } catch (error) {
    console.error('Error saving purchase invoice:', error)
    throw error
  }
}

async function updateFinancialData(invoiceData) {
  try {
    // This will update cash, purchases, and other related financial data
    // For now, we'll just save the invoice
    // Later we can add logic to update cash flow, purchase reports, etc.
    console.log('Purchase invoice saved, financial data update logic to be implemented')
  } catch (error) {
    console.error('Error updating financial data:', error)
  }
}

