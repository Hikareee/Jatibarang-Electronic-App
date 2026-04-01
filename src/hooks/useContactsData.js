import { useState, useEffect } from 'react'
import { collection, addDoc, getDocs, query, orderBy, where, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchContacts = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const contactsRef = collection(db, 'contacts')
        const q = query(contactsRef, orderBy('name', 'asc'))
        const snapshot = await getDocs(q)
        
        const contactsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        
        // Fetch receivables and debts for each contact to calculate Anda Hutang and Mereka Hutang
        const contactsWithFinancials = await Promise.all(
          contactsData.map(async (contact) => {
            let merekaHutangTotal = 0
            let andaHutangTotal = 0
            
            // Fetch receivables for this contact (Mereka Hutang - They owe us)
            try {
              const receivablesRef = collection(db, 'receivables')
              const receivablesQuery = query(receivablesRef, where('contactId', '==', contact.id))
              const receivablesSnapshot = await getDocs(receivablesQuery)
              
              receivablesSnapshot.forEach((doc) => {
                const data = doc.data()
                merekaHutangTotal += parseFloat(data.total || 0)
              })
            } catch (err) {
              console.error(`Error fetching receivables for contact ${contact.id}:`, err)
              // If collection doesn't exist, default to 0
            }

            // Fetch debts for this contact (Anda Hutang - We owe them)
            try {
              const debtsRef = collection(db, 'debts')
              const debtsQuery = query(debtsRef, where('contactId', '==', contact.id))
              const debtsSnapshot = await getDocs(debtsQuery)
              
              debtsSnapshot.forEach((doc) => {
                const data = doc.data()
                andaHutangTotal += parseFloat(data.total || 0)
              })
            } catch (err) {
              console.error(`Error fetching debts for contact ${contact.id}:`, err)
              // If collection doesn't exist, default to 0
            }
            
            return {
              ...contact,
              andaHutang: andaHutangTotal,
              merekaHutang: merekaHutangTotal
            }
          })
        )
        
        setContacts(contactsWithFinancials)
      } catch (err) {
        console.error('Error fetching contacts:', err)
        setError(err.message)
        setContacts([])
      } finally {
        setLoading(false)
      }
  }

  useEffect(() => {
    fetchContacts()
  }, [])

  return { contacts, loading, error, refetch: fetchContacts }
}

export async function saveContact(contactData) {
  try {
    // Clean up the data - remove null/undefined values and handle arrays
    const cleanedData = {}
    
    // Handle name
    const name = contactData.fullName || contactData.name
    if (name) cleanedData.name = name
    
    // Handle types array - ensure it's a valid array
    if (contactData.types && Array.isArray(contactData.types) && contactData.types.length > 0) {
      cleanedData.types = contactData.types
    } else if (contactData.types && contactData.types.length > 0) {
      cleanedData.types = contactData.types
    }
    
    // Handle other fields - only include if they have values
    if (contactData.group) cleanedData.group = contactData.group
    if (contactData.salutation) cleanedData.salutation = contactData.salutation
    if (contactData.number) cleanedData.number = contactData.number
    if (contactData.company) cleanedData.company = contactData.company
    if (contactData.phone) cleanedData.phone = contactData.phone
    if (contactData.email) cleanedData.email = contactData.email

    // Payroll fields (for Pegawai). Stored under cleanedData.payroll.
    if (contactData.payroll && typeof contactData.payroll === 'object') {
      const p = contactData.payroll
      cleanedData.payroll = {
        baseSalary: Number(p.baseSalary || 0) || 0,
        allowances: Array.isArray(p.allowances) ? p.allowances : [],
        deductions: Array.isArray(p.deductions) ? p.deductions : [],
        ptkp: p.ptkp || 'TK/0',
        npwp: p.npwp || '',
        bpjsEnabled: !!p.bpjsEnabled,
        bank: p.bank && typeof p.bank === 'object'
          ? {
              bankName: p.bank.bankName || '',
              bankCode: p.bank.bankCode || '',
              accountNumber: p.bank.accountNumber || '',
              accountName: p.bank.accountName || '',
            }
          : { bankName: '', bankCode: '', accountNumber: '', accountName: '' },
      }
    }
    
    // Financial fields - always include with default 0
    cleanedData.andaHutang = contactData.andaHutang || 0
    cleanedData.merekaHutang = contactData.merekaHutang || 0
    cleanedData.pembayaranDiterima = contactData.pembayaranDiterima || 0
    cleanedData.hutangAndaJatuhTempo = contactData.hutangAndaJatuhTempo || 0
    cleanedData.hutangMereka = contactData.hutangMereka || 0
    
    // Timestamps
    cleanedData.createdAt = new Date().toISOString()
    cleanedData.updatedAt = new Date().toISOString()

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'contacts'), cleanedData)
    
    return docRef.id
  } catch (error) {
    console.error('Error saving contact:', error)
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    })
    throw error
  }
}

export async function updateContact(contactId, contactData) {
  try {
    // Clean up the data - remove null/undefined values and handle arrays
    const cleanedData = {}
    
    // Handle name
    const name = contactData.fullName || contactData.name
    if (name) cleanedData.name = name
    
    // Handle types array - ensure it's a valid array
    if (contactData.types && Array.isArray(contactData.types) && contactData.types.length > 0) {
      cleanedData.types = contactData.types
    } else if (contactData.types && contactData.types.length > 0) {
      cleanedData.types = contactData.types
    }
    
    // Handle other fields - only include if they have values
    if (contactData.group !== undefined) cleanedData.group = contactData.group || ''
    if (contactData.salutation) cleanedData.salutation = contactData.salutation
    if (contactData.number) cleanedData.number = contactData.number
    if (contactData.company) cleanedData.company = contactData.company
    if (contactData.phone) cleanedData.phone = contactData.phone
    if (contactData.email) cleanedData.email = contactData.email

    // Payroll fields (optional)
    if (contactData.payroll && typeof contactData.payroll === 'object') {
      const p = contactData.payroll
      cleanedData.payroll = {
        baseSalary: Number(p.baseSalary || 0) || 0,
        allowances: Array.isArray(p.allowances) ? p.allowances : [],
        deductions: Array.isArray(p.deductions) ? p.deductions : [],
        ptkp: p.ptkp || 'TK/0',
        npwp: p.npwp || '',
        bpjsEnabled: !!p.bpjsEnabled,
        bank: p.bank && typeof p.bank === 'object'
          ? {
              bankName: p.bank.bankName || '',
              bankCode: p.bank.bankCode || '',
              accountNumber: p.bank.accountNumber || '',
              accountName: p.bank.accountName || '',
            }
          : { bankName: '', bankCode: '', accountNumber: '', accountName: '' },
      }
    }
    
    // Update timestamp
    cleanedData.updatedAt = new Date().toISOString()

    // Update in Firestore
    const contactRef = doc(db, 'contacts', contactId)
    await updateDoc(contactRef, cleanedData)
    
    return contactId
  } catch (error) {
    console.error('Error updating contact:', error)
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    })
    throw error
  }
}

