import { useState, useEffect } from 'react'
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase/config'
import { updateAccountBalance, updateMultipleAccountBalances } from '../utils/accountBalance'

export async function getNextInvoiceNumber() {
  try {
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
    return nextNumber
  } catch (error) {
    console.error('Error getting next invoice number:', error)
    return 'INV/00001'
  }
}

export async function saveInvoice(invoiceData) {
  try {
    // Use provided number or generate next
    // Normalize attachments to plain serializable objects
    const normalizedAttachments = (invoiceData.attachments || []).map((a) => ({
      name: a.name || a.fileName || '',
      url: a.url || a.downloadUrl || '',
      type: a.type || '',
      size: a.size || 0,
      path: a.path || a.storagePath || '',
      uploadedAt: a.uploadedAt || new Date().toISOString(),
    }))

    const finalInvoiceData = {
      ...invoiceData,
      attachments: normalizedAttachments,
      number: invoiceData.number || (await getNextInvoiceNumber()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Save to Firestore
  const docRef = await addDoc(collection(db, 'invoices'), finalInvoiceData)
    
    // Update related financial data (cash, sales, etc.)
    await updateFinancialData(finalInvoiceData)

    // Also write to unified transactions collection
    const transactionRef = await addDoc(collection(db, 'transactions'), {
      type: 'invoice_sale',
      contactId: finalInvoiceData.customerId || finalInvoiceData.contactId || '',
      contactName: finalInvoiceData.customer || '',
      penanggungJawabId: finalInvoiceData.penanggungJawabId || finalInvoiceData.responsibleContactId || '',
      penanggungJawab: finalInvoiceData.penanggungJawab || finalInvoiceData.responsibleContactName || '',
      number: finalInvoiceData.number,
      reference: finalInvoiceData.reference || '',
      date: finalInvoiceData.transactionDate || finalInvoiceData.createdAt,
      dueDate: finalInvoiceData.dueDate || '',
      total: finalInvoiceData.total || 0,
      remaining: finalInvoiceData.total || 0,
      paid: false,
      items: finalInvoiceData.items || [],
      source: { collection: 'invoices', id: docRef.id },
      createdAt: finalInvoiceData.createdAt,
      updatedAt: finalInvoiceData.updatedAt,
    })

    // Update account balance if account is specified (for cash sales - increase balance)
    // For credit sales, balance won't change until payment is received
    const accountId = finalInvoiceData.accountId || finalInvoiceData.account
    const totalAmount = parseFloat(finalInvoiceData.total) || 0
    const isCashSale = finalInvoiceData.paymentMethod === 'cash' || finalInvoiceData.isCashSale || finalInvoiceData.paymentMethod === 'tunai'
    
    if (accountId && totalAmount > 0 && isCashSale) {
      await updateAccountBalance(accountId, totalAmount, {
        type: 'invoice_sale',
        transactionId: transactionRef.id,
        number: finalInvoiceData.number,
        date: finalInvoiceData.transactionDate || finalInvoiceData.createdAt,
        description: `Sales Invoice ${finalInvoiceData.number} (Cash)`
      })
    }
    
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

