import { Navigate } from 'react-router-dom'
import { useUserApproval } from '../hooks/useUserApproval'

/**
 * Renders children only for owner or admin.
 */
export default function AdminOwnerRoute({ children }) {
  const { role, loading } = useUserApproval()
  const canAccess = role === 'owner' || role === 'admin'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Memuat...</p>
      </div>
    )
  }

  if (!canAccess) return <Navigate to="/dashboard" replace />
  return children
}

