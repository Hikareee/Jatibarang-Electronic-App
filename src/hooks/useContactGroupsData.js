import { useState, useEffect } from 'react'
import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useContactGroups() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGroups = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const groupsRef = collection(db, 'contactGroups')
      const q = query(groupsRef, orderBy('name', 'asc'))
      const snapshot = await getDocs(q)
      
      const groupsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      setGroups(groupsData)
    } catch (err) {
      console.error('Error fetching contact groups:', err)
      setError(err.message)
      setGroups([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [])

  return { groups, loading, error, refetch: fetchGroups }
}

export async function saveContactGroup(groupData) {
  try {
    const finalGroupData = {
      ...groupData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const docRef = await addDoc(collection(db, 'contactGroups'), finalGroupData)
    return docRef.id
  } catch (error) {
    console.error('Error saving contact group:', error)
    throw error
  }
}

export async function deleteContactGroup(groupId) {
  try {
    await deleteDoc(doc(db, 'contactGroups', groupId))
  } catch (error) {
    console.error('Error deleting contact group:', error)
    throw error
  }
}

