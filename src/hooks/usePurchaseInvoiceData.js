import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase/config'
import { updateAccountBalance, updateMultipleAccountBalances } from '../utils/accountBalance'

export async function getNextPurchaseInvoiceNumber() {
  try {
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
    
    return nextNumber
  } catch (error) {
    console.error('Error getting next purchase invoice number:', error)
    // Return default if error
    return 'PI/00001'
  }
}

export async function savePurchaseInvoice(invoiceData, userId = null) {
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
      status: 'draft', // Always set to draft when created
      deliveryStatus: invoiceData.deliveryStatus || 0, // Default delivery status to 0%
      createdBy: invoiceData.createdBy || '', // Store who created it
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'purchaseInvoices'), finalInvoiceData)
    
    // Update related financial data (cash, purchases, etc.)
    await updateFinancialData(finalInvoiceData)

    // Also write to unified transactions collection
    const transactionRef = await addDoc(collection(db, 'transactions'), {
      type: 'invoice_purchase',
      contactId: finalInvoiceData.vendorId || finalInvoiceData.contactId || '',
      contactName: finalInvoiceData.vendor || '',
      number: finalInvoiceData.number,
      reference: finalInvoiceData.reference || '',
      date: finalInvoiceData.transactionDate || finalInvoiceData.createdAt,
      dueDate: finalInvoiceData.dueDate || '',
      total: finalInvoiceData.total || 0,
      remaining: finalInvoiceData.total || 0,
      paid: false,
      items: finalInvoiceData.items || [],
      source: { collection: 'purchaseInvoices', id: docRef.id },
      createdAt: finalInvoiceData.createdAt,
      updatedAt: finalInvoiceData.updatedAt,
    })

    // Only update account balance if invoice is approved (not for draft)
    // Account balance will be updated when invoice is approved
    // This prevents draft invoices from affecting balances
    
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

