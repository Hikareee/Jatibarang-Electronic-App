import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'

export function useUserApproval() {
  const { currentUser } = useAuth()
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchUserData() {
      if (!currentUser) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          const data = userSnap.data()
          setUserData({
            id: userSnap.id,
            ...data
          })
        } else {
          // SECURITY: Do NOT auto-create/auto-approve roles on the client.
          // If the user has no Firestore user doc, treat as unapproved.
          setUserData({
            id: currentUser.uid,
            email: currentUser.email,
            role: 'employee',
            approved: false,
          })
        }
      } catch (err) {
        console.error('useUserApproval: Error fetching user data:', err)
        setError(err?.message || String(err))
        // SECURITY: On error, do not grant access implicitly.
        setUserData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [currentUser])

  const isApproved = () => {
    return userData?.approved === true
  }

  const canApprove = () => {
    const role = userData?.role
    return role === 'owner' || role === 'manager' || role === 'admin'
  }

  const canEditApproved = () => {
    // Admin should behave like owner for editing privileges (except Payroll visibility handled separately)
    return userData?.role === 'owner' || userData?.role === 'admin'
  }

  return { 
    userData, 
    loading, 
    error, 
    isApproved: isApproved(), 
    canApprove: canApprove(),
    canEditApproved: canEditApproved(),
    role: userData?.role || 'employee'
  }
}

