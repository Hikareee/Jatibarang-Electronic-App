import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const usersRef = collection(db, 'users')
      const q = query(usersRef, orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      setUsers(usersData)
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err.message)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const updateUserRole = async (userId, role) => {
    try {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, {
        role: role,
        approved: true,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      
      setUsers(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, role, approved: true, approvedAt: new Date().toISOString() }
            : user
        )
      )
      
      return true
    } catch (err) {
      console.error('Error updating user role:', err)
      throw err
    }
  }

  const approveUser = async (userId) => {
    try {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, {
        approved: true,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      
      setUsers(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, approved: true, approvedAt: new Date().toISOString() }
            : user
        )
      )
      
      return true
    } catch (err) {
      console.error('Error approving user:', err)
      throw err
    }
  }

  return { users, loading, error, refetch: fetchUsers, updateUserRole, approveUser }
}

