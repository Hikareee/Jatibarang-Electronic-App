import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { canonicalRole } from './useUserApproval'

export function useUserRole() {
  const { currentUser } = useAuth()
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUserRole() {
      if (!currentUser) {
        setUserRole(null)
        setLoading(false)
        return
      }

      try {
        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)
        
        if (userSnap.exists()) {
          const userData = userSnap.data()
          setUserRole(canonicalRole(userData.role))
        } else {
          // If user document doesn't exist, create it with default role
          setUserRole('employee')
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
        setUserRole('employee') // Default to employee on error
      } finally {
        setLoading(false)
      }
    }

    fetchUserRole()
  }, [currentUser])

  const canApprove = () => {
    return userRole === 'owner' || userRole === 'manager' || userRole === 'admin'
  }

  return { userRole, loading, canApprove: canApprove() }
}
