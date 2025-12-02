import { useState, useEffect } from 'react'
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchContacts() {
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
        
        setContacts(contactsData)
      } catch (err) {
        console.error('Error fetching contacts:', err)
        setError(err.message)
        setContacts([])
      } finally {
        setLoading(false)
      }
    }

    fetchContacts()
  }, [])

  return { contacts, loading, error }
}

export async function saveContact(contactData) {
  try {
    // Use fullName if available, otherwise use name
    const finalContactData = {
      ...contactData,
      name: contactData.fullName || contactData.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Remove fullName from final data as we use name
    delete finalContactData.fullName

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'contacts'), finalContactData)
    
    return docRef.id
  } catch (error) {
    console.error('Error saving contact:', error)
    throw error
  }
}

