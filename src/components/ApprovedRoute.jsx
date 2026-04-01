import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserApproval } from '../hooks/useUserApproval'
import AwaitApproval from '../pages/AwaitApproval'

export default function ApprovedRoute({ children }) {
  const { currentUser } = useAuth()
  const { isApproved, loading, error, userData } = useUserApproval()

  if (!currentUser) {
    return <Navigate to="/login" />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Memuat...</p>
        </div>
      </div>
    )
  }

  // SECURITY: If we can't read userData, do not allow access.
  if (error || !userData) {
    return <Navigate to="/login" replace />
  }

  // Only redirect to approval page if user is EXPLICITLY set to false
  if (userData.approved === false) {
    return <AwaitApproval />
  }

  // User is approved - render children
  if (!children) {
    return <div className="p-6">Error: No content to display</div>
  }
  
  return children
}

