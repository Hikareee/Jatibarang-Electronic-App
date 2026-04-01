import { Navigate } from 'react-router-dom'
import { useUserApproval } from '../hooks/useUserApproval'

/**
 * Renders children only for owner.
 * Used to protect Payroll/salary visibility from admin.
 */
export default function OwnerRoute({ children }) {
  const { role, loading } = useUserApproval()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Memuat...</p>
      </div>
    )
  }

  if (role !== 'owner') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

