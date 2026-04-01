import { useState, useEffect } from 'react'
import { doc, getDoc, updateDoc, collection, addDoc, query, orderBy, limit, getDocs, where } from 'firebase/firestore'
import { db } from '../firebase/config'

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

      // Account balance will be updated when payment is made, not when invoice is approved
      // This allows for partial payments and better cash flow tracking

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

      // Keep unified transaction record in sync (so payment/status pages match invoice data)
      try {
        const penanggungJawabId =
          dataToSave.penanggungJawabId || dataToSave.responsibleContactId || ''
        const penanggungJawab =
          dataToSave.penanggungJawab || dataToSave.responsibleContactName || ''
        const projectId = dataToSave.projectId || ''
        const projectName = dataToSave.projectName || ''

        const txQ = query(
          collection(db, 'transactions'),
          where('source.collection', '==', 'purchaseInvoices'),
          where('source.id', '==', invoiceId)
        )
        const txSnap = await getDocs(txQ)
        await Promise.all(
          txSnap.docs.map((txDoc) =>
            updateDoc(txDoc.ref, {
              penanggungJawabId,
              penanggungJawab,
              projectId,
              projectName,
            })
          )
        )
      } catch (err) {
        console.warn('Could not sync penanggungJawab to transactions:', err)
      }

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
