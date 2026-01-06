import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserApproval } from '../hooks/useUserApproval'
import AwaitApproval from '../pages/AwaitApproval'

export default function ApprovedRoute({ children }) {
  const { currentUser } = useAuth()
  const { isApproved, loading, error, userData } = useUserApproval()

  // Debug logging
  console.log('ApprovedRoute Debug:', {
    hasCurrentUser: !!currentUser,
    loading,
    error,
    userData: userData ? { approved: userData.approved, role: userData.role } : null,
    isApproved,
    hasChildren: !!children,
    childrenType: typeof children
  })

  if (!currentUser) {
    return <Navigate to="/login" />
  }

  // Show loading state with timeout to prevent infinite loading
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.warn('ApprovedRoute: Loading timeout - allowing access')
        setLoadingTimeout(true)
      }, 3000) // After 3 seconds, allow access even if still loading
      return () => clearTimeout(timer)
    }
  }, [loading])

  if (loading && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Memuat...</p>
        </div>
      </div>
    )
  }
  
  // If loading timed out, allow access
  if (loadingTimeout) {
    console.warn('ApprovedRoute: Loading timeout - allowing access to prevent blank page')
    return children
  }

  // If there's an error OR userData is null, allow access (graceful degradation)
  if (error || !userData) {
    console.warn('ApprovedRoute: Error or no userData - allowing access', { error, userData })
    return children
  }

  // Only redirect to approval page if user is EXPLICITLY set to false
  if (userData.approved === false) {
    console.log('ApprovedRoute: User not approved, showing AwaitApproval')
    return <AwaitApproval />
  }

  // User is approved - render children
  console.log('ApprovedRoute: User approved, rendering children', { approved: userData.approved })
  
  if (!children) {
    console.error('ApprovedRoute: children is null or undefined')
    return <div className="p-6">Error: No content to display</div>
  }
  
  return children
}

