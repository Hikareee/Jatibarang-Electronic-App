import { useState, useEffect } from 'react'
import { doc, getDoc, updateDoc, collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { updateAccountBalance } from '../utils/accountBalance'

export function usePurchaseInvoiceDetail(invoiceId) {
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

        const invoiceRef = doc(db, 'purchaseInvoices', invoiceId)
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

        // Fetch vendor name if vendor is an ID
        if (invoiceData.vendor && invoiceData.vendor.length > 0 && !invoiceData.vendor.includes(' ')) {
          try {
            const contactRef = doc(db, 'contacts', invoiceData.vendor)
            const contactSnap = await getDoc(contactRef)
            if (contactSnap.exists()) {
              invoiceData.vendorName = contactSnap.data().name || contactSnap.data().company || invoiceData.vendor
            }
          } catch (err) {
            console.warn('Could not fetch vendor name:', err)
            invoiceData.vendorName = invoiceData.vendor
          }
        } else {
          invoiceData.vendorName = invoiceData.vendor || 'N/A'
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

  const approveInvoice = async () => {
    if (!invoiceId) return false

    try {
      const invoiceRef = doc(db, 'purchaseInvoices', invoiceId)
      const invoiceSnap = await getDoc(invoiceRef)
      
      if (!invoiceSnap.exists()) {
        throw new Error('Invoice not found')
      }

      const invoiceData = invoiceSnap.data()
      
      // Update invoice status
      await updateDoc(invoiceRef, {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      // Update account balance when approved (decrease for purchase invoice - money going out)
      const accountId = invoiceData.accountId || invoiceData.account
      const totalAmount = parseFloat(invoiceData.total) || 0
      
      if (accountId && totalAmount > 0) {
        // Find the transaction for this invoice
        const transactionsRef = collection(db, 'transactions')
        const transactionsQuery = query(
          transactionsRef,
          orderBy('createdAt', 'desc')
        )
        const transactionsSnapshot = await getDocs(transactionsQuery)
        
        let transactionId = null
        transactionsSnapshot.docs.forEach(doc => {
          const data = doc.data()
          if (data.source?.collection === 'purchaseInvoices' && data.source?.id === invoiceId) {
            transactionId = doc.id
          }
        })

        await updateAccountBalance(accountId, -totalAmount, {
          type: 'invoice_purchase',
          transactionId: transactionId || invoiceId,
          number: invoiceData.number,
          date: invoiceData.transactionDate || invoiceData.createdAt,
          description: `Purchase Invoice ${invoiceData.number} (Approved)`
        })
      }

      setInvoice(prev => prev ? { ...prev, status: 'approved', approvedAt: new Date().toISOString() } : null)
      return true
    } catch (err) {
      console.error('Error approving invoice:', err)
      throw err
    }
  }

  const declineInvoice = async (reason) => {
    if (!invoiceId) return false

    try {
      const invoiceRef = doc(db, 'purchaseInvoices', invoiceId)
      await updateDoc(invoiceRef, {
        status: 'declined',
        declinedAt: new Date().toISOString(),
        declineReason: reason || '',
        updatedAt: new Date().toISOString()
      })

      setInvoice(prev => prev ? { ...prev, status: 'declined', declinedAt: new Date().toISOString(), declineReason: reason } : null)
      return true
    } catch (err) {
      console.error('Error declining invoice:', err)
      throw err
    }
  }

  const updateInvoice = async (invoiceData) => {
    if (!invoiceId) return false

    try {
      const invoiceRef = doc(db, 'purchaseInvoices', invoiceId)
      const currentInvoice = await getDoc(invoiceRef)
      
      if (!currentInvoice.exists()) {
        throw new Error('Invoice not found')
      }

      // Get edit history
      const editHistory = currentInvoice.data().editHistory || []
      
      // Get user email for edit history
      let editedByEmail = invoiceData.editedBy || ''
      if (invoiceData.editedBy && invoiceData.editedBy.length > 0) {
        try {
          const userRef = doc(db, 'users', invoiceData.editedBy)
          const userSnap = await getDoc(userRef)
          if (userSnap.exists()) {
            editedByEmail = userSnap.data().email || invoiceData.editedBy
          }
        } catch (err) {
          console.warn('Could not fetch user email:', err)
        }
      }
      
      // Add new edit entry
      editHistory.push({
        editedBy: invoiceData.editedBy || '',
        editedByEmail: editedByEmail,
        editedAt: new Date().toISOString(),
        changes: invoiceData.changes || {}
      })

      // Remove editedBy and changes from invoiceData before saving
      const { editedBy, changes, ...dataToSave } = invoiceData

      await updateDoc(invoiceRef, {
        ...dataToSave,
        editHistory: editHistory,
        updatedAt: new Date().toISOString()
      })

      // Refetch invoice
      const updatedSnap = await getDoc(invoiceRef)
      if (updatedSnap.exists()) {
        const updatedData = {
          id: updatedSnap.id,
          ...updatedSnap.data()
        }
        
        // Fetch vendor name if needed
        if (updatedData.vendor && updatedData.vendor.length > 0 && !updatedData.vendor.includes(' ')) {
          try {
            const contactRef = doc(db, 'contacts', updatedData.vendor)
            const contactSnap = await getDoc(contactRef)
            if (contactSnap.exists()) {
              updatedData.vendorName = contactSnap.data().name || contactSnap.data().company || updatedData.vendor
            }
          } catch (err) {
            console.warn('Could not fetch vendor name:', err)
            updatedData.vendorName = updatedData.vendor
          }
        } else {
          updatedData.vendorName = updatedData.vendor || 'N/A'
        }
        
        setInvoice(updatedData)
      }

      return true
    } catch (err) {
      console.error('Error updating invoice:', err)
      throw err
    }
  }

  return { invoice, loading, error, approveInvoice, declineInvoice, updateInvoice }
}
