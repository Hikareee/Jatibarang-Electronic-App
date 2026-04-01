import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'
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
        console.log('useUserApproval: Fetching user data for:', currentUser.uid)
        const userSnap = await getDoc(userRef)
        console.log('useUserApproval: User document exists:', userSnap.exists())

        if (userSnap.exists()) {
          const data = userSnap.data()
          console.log('useUserApproval: User data:', { approved: data.approved, role: data.role })
          setUserData({
            id: userSnap.id,
            ...data
          })
        } else {
          // For existing authenticated users without a document (legacy users)
          // Check if there are any approved users in the system
          let hasApprovedUsers = false
          let totalUsers = 0
          try {
            const usersRef = collection(db, 'users')
            const usersSnapshot = await getDocs(usersRef)
            const existingUsers = usersSnapshot.docs.map(doc => doc.data())
            totalUsers = existingUsers.length
            hasApprovedUsers = existingUsers.some(u => u.approved === true)
          } catch (err) {
            console.warn('Could not check existing users:', err)
            // If we can't check, assume this is the first user
            hasApprovedUsers = false
            totalUsers = 0
          }
          
          // Auto-approve logic:
          // 1. If no users exist at all, this is the first user -> make them owner and auto-approve
          // 2. If users exist but none are approved -> make them owner and auto-approve (system setup)
          // 3. If approved users exist -> this is a legacy user, auto-approve as employee to prevent lockout
          const isFirstUser = totalUsers === 0
          const isSystemSetup = totalUsers > 0 && !hasApprovedUsers
          
          const newUserData = {
            email: currentUser.email,
            role: (isFirstUser || isSystemSetup) ? 'owner' : 'employee',
            approved: true, // Auto-approve to prevent lockout of existing users
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            approvedAt: new Date().toISOString()
          }
          
          await setDoc(userRef, newUserData)
          setUserData({
            id: currentUser.uid,
            ...newUserData
          })
        }
      } catch (err) {
        console.error('useUserApproval: Error fetching user data:', err)
        console.error('useUserApproval: Error code:', err.code)
        console.error('useUserApproval: Error message:', err.message)
        setError(err.message)
        // On error, create a default user data to allow access (graceful degradation)
        // This prevents blank pages if there's a Firestore permission issue
        const fallbackData = {
          id: currentUser.uid,
          email: currentUser.email,
          role: 'employee',
          approved: true, // Default to approved on error to prevent lockout
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        console.log('useUserApproval: Using fallback data:', fallbackData)
        setUserData(fallbackData)
      } finally {
        setLoading(false)
        // Log after state update
        setTimeout(() => {
          console.log('useUserApproval: Loading complete, userData:', userData ? { approved: userData.approved, role: userData.role } : null)
        }, 100)
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

